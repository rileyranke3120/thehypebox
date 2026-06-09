import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { ghlFetch } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { sendEmail } from '@/lib/send-email';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── GHL metric fetchers (30-day window) ──────────────────────

async function countConversations30d(locationId, apiKey, sinceMs) {
  try {
    const data = await ghlFetch(
      `/conversations/search?locationId=${locationId}&sort=last_message_date&sortBy=desc&limit=100`,
      apiKey
    );
    const convs = data?.conversations ?? [];
    return convs.filter((c) => {
      const ts = c.lastMessageDate ? new Date(c.lastMessageDate).getTime() : 0;
      return ts >= sinceMs;
    }).length;
  } catch {
    return null;
  }
}

async function hasPipelineActivity30d(locationId, apiKey, sinceMs) {
  try {
    const data = await ghlFetch(
      `/opportunities/search?location_id=${locationId}&limit=100`,
      apiKey
    );
    const opps = data?.opportunities ?? [];
    return opps.some((opp) => {
      const ts = opp.lastStageChangeAt || opp.date_updated || opp.updatedAt;
      return ts && new Date(ts).getTime() >= sinceMs;
    });
  } catch {
    return null;
  }
}

// ── Claude churn prediction ──────────────────────────────────

async function predictChurn(client, metrics) {
  const { calls30d, conversations30d, pipelineActive, lastLoginDays } = metrics;

  const loginStatus =
    lastLoginDays === null ? 'unknown' :
    lastLoginDays === 0    ? 'today' :
    `${lastLoginDays} days ago`;

  const prompt = `You are a churn analyst for TheHypeBox, an AI automation SaaS serving home service businesses (HVAC, plumbing, electrical, roofing). Monthly plans range $297–$997.

Client: ${client.name || client.email}
Plan: ${client.plan} | Status: ${client.plan_status}
Days since signup: ${client.daysSinceSignup}

Activity — last 30 days:
- AI phone calls handled (Sarah/Retell): ${calls30d ?? 'unknown'}
- GHL conversations/SMS activity: ${conversations30d ?? 'unknown'}
- Pipeline stage movement: ${pipelineActive === null ? 'unknown' : pipelineActive ? 'yes' : 'no'}
- Last login: ${loginStatus}

Predict churn risk based on engagement patterns. High-value clients who actively use the system rarely churn. Clients with declining or zero usage over 30 days are strong churn candidates.

RISK LEVELS:
- low: actively using the platform, calls or pipeline moving, logged in recently
- medium: some gaps in usage, one or two weak signals, may need a check-in
- high: multiple strong disengagement signals — no calls, no pipeline movement, not logging in, or very low activity across the board

Reply with exactly two lines and nothing else:
RISK: [low|medium|high]
REASON: [one sentence, specific to their data, no markdown]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const result = await res.json();
  const text = result.content?.[0]?.text ?? '';

  const riskMatch   = text.match(/RISK:\s*(low|medium|high)/i);
  const reasonMatch = text.match(/REASON:\s*(.+)/i);

  return {
    risk:   (riskMatch?.[1] ?? 'medium').toLowerCase(),
    reason: reasonMatch?.[1]?.trim() ?? 'Churn prediction inconclusive.',
  };
}

// ── Streak check ─────────────────────────────────────────────

async function isHighFor3PlusDays(supabase, userId) {
  const { data } = await supabase
    .from('churn_prediction')
    .select('risk_level')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(3);

  if (!data || data.length < 3) return false;
  return data.every((row) => row.risk_level === 'high');
}

// ── Personal outreach email ───────────────────────────────────

async function sendOutreachEmail(client) {
  const firstName = (client.name || client.email).split(/[\s@]/)[0];
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:540px;margin:0 auto;padding:40px 24px;">
  <div style="margin-bottom:28px;">
    <span style="font-size:1.1rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
  </div>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 16px;">Hey ${firstName},</p>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 16px;">I wanted to reach out personally — I've been watching your account and I'm not seeing the activity I'd expect from your setup. That usually means one of two things: either something's broken on our end, or there's been a change in your business I should know about.</p>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 16px;">Either way, I want to make sure you're getting real value. If Sarah isn't answering calls, if your pipeline has gone quiet, or if anything just isn't clicking — hit reply and let's fix it. I'll personally get on it.</p>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 4px;">— Riley</p>
  <p style="font-size:0.8rem;color:#444;margin:0;">TheHypeBox LLC</p>
</div>
</body>
</html>`;

  try {
    await sendEmail({
      to: client.email,
      subject: "Checking in on your HypeBox",
      html,
    });
    return true;
  } catch (err) {
    console.warn(`[churn-prediction] outreach email failed for ${client.email}:`, err.message);
    return false;
  }
}

// ── Route ────────────────────────────────────────────────────

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const now = new Date();
  const sinceMs = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const ago30d = new Date(sinceMs).toISOString();
  const today = now.toISOString().split('T')[0];

  const { data: rawUsers, error: usersErr } = await supabase
    .from('users')
    .select('id, name, email, plan, plan_status, created_at, last_login_at, ghl_location_id, ghl_api_key, retell_agent_id, role')
    .in('plan_status', ['active', 'trialing']);

  if (usersErr) {
    console.error('[churn-prediction] DB fetch failed:', usersErr.message);
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }

  const clients = (rawUsers ?? []).filter(
    (u) => u.role !== 'super_admin' && u.ghl_location_id && u.ghl_api_key
  );

  if (clients.length === 0) {
    console.log('[churn-prediction] no eligible clients');
    return NextResponse.json({ ok: true, checked: 0, date: today });
  }

  // Bulk fetch Retell calls for the last 30 days
  const { data: recentCalls } = await supabase
    .from('retell_calls')
    .select('agent_id')
    .gte('start_timestamp', ago30d);

  const callsByAgent = {};
  for (const c of recentCalls ?? []) {
    if (c.agent_id) callsByAgent[c.agent_id] = (callsByAgent[c.agent_id] || 0) + 1;
  }

  const results = [];
  const highRiskAlerts = [];

  for (const client of clients) {
    try {
      const [conversations30d, pipelineActive] = await Promise.all([
        countConversations30d(client.ghl_location_id, client.ghl_api_key, sinceMs),
        hasPipelineActivity30d(client.ghl_location_id, client.ghl_api_key, sinceMs),
      ]);

      const calls30d = client.retell_agent_id
        ? (callsByAgent[client.retell_agent_id] ?? 0)
        : null;

      const lastLoginDays = client.last_login_at
        ? Math.floor((now.getTime() - new Date(client.last_login_at).getTime()) / (24 * 60 * 60 * 1000))
        : null;

      const daysSinceSignup = client.created_at
        ? Math.floor((now.getTime() - new Date(client.created_at).getTime()) / (24 * 60 * 60 * 1000))
        : null;

      const metrics = { calls30d, conversations30d, pipelineActive, lastLoginDays };
      const clientWithMeta = { ...client, daysSinceSignup };

      const { risk, reason } = await predictChurn(clientWithMeta, metrics);

      let smsSent = false;
      let outreachSent = false;

      if (risk === 'high') {
        highRiskAlerts.push(`HIGH: ${client.name || client.email} — ${reason}`);

        const streak = await isHighFor3PlusDays(supabase, client.id);
        if (streak) {
          outreachSent = await sendOutreachEmail(client);
          if (outreachSent) {
            console.log(`[churn-prediction] outreach email sent to ${client.email}`);
          }
        }
      }

      const { error: logErr } = await supabase.from('churn_prediction').upsert(
        {
          user_id:           client.id,
          date:              today,
          risk_level:        risk,
          reason,
          calls_30d:         calls30d,
          conversations_30d: conversations30d,
          pipeline_active:   pipelineActive,
          last_login_days:   lastLoginDays,
          sms_sent:          smsSent,
          outreach_sent:     outreachSent,
          created_at:        now.toISOString(),
        },
        { onConflict: 'user_id,date' }
      );
      if (logErr) console.warn(`[churn-prediction] log upsert failed (${client.email}):`, logErr.message);

      results.push({ email: client.email, risk, reason, outreachSent });
      console.log(`[churn-prediction] ${client.email} → ${risk}`);
    } catch (err) {
      console.error(`[churn-prediction] error on ${client.email}:`, err.message);
      results.push({ email: client.email, risk: 'error', reason: err.message });
    }
  }

  // SMS Riley for all high-risk clients
  if (highRiskAlerts.length > 0) {
    const rileyPhone  = process.env.RILEY_PHONE;
    const smsApiKey   = process.env.GHL_API_KEY;
    const smsLocation = process.env.GHL_LOCATION_ID;

    if (rileyPhone && smsApiKey && smsLocation) {
      const cap      = highRiskAlerts.slice(0, 5);
      const overflow = highRiskAlerts.length > 5 ? `\n+${highRiskAlerts.length - 5} more` : '';
      const body     = `HypeBox Churn Alert ${today}:\n${cap.join('\n')}${overflow}`;
      try {
        await sendSMS(rileyPhone, body, { apiKey: smsApiKey, locationId: smsLocation });
        // Mark sms_sent=true in today's high-risk rows
        const highRiskIds = results
          .filter((r) => r.risk === 'high')
          .map((r) => r.email);
        if (highRiskIds.length > 0) {
          await supabase
            .from('churn_prediction')
            .update({ sms_sent: true })
            .in('user_id',
              clients
                .filter((c) => highRiskIds.includes(c.email))
                .map((c) => c.id)
            )
            .eq('date', today);
        }
        console.log(`[churn-prediction] SMS sent to Riley (${highRiskAlerts.length} high-risk)`);
      } catch (err) {
        console.warn('[churn-prediction] SMS to Riley failed:', err.message);
      }
    } else {
      console.warn('[churn-prediction] RILEY_PHONE/GHL_API_KEY/GHL_LOCATION_ID not set — skipping SMS');
    }
  }

  const summary = {
    ok:          true,
    date:        today,
    checked:     clients.length,
    low:         results.filter((r) => r.risk === 'low').length,
    medium:      results.filter((r) => r.risk === 'medium').length,
    high:        results.filter((r) => r.risk === 'high').length,
    outreaches:  results.filter((r) => r.outreachSent).length,
    clients:     results,
  };

  console.log(
    `[churn-prediction] done — ${summary.checked} checked, ${summary.low}L ${summary.medium}M ${summary.high}H, ${summary.outreaches} outreaches`
  );
  return NextResponse.json(summary);
}

export const GET = withErrorMonitor('churn-prediction', handler);
