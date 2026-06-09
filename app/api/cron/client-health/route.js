import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { ghlFetch } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { sendEmail } from '@/lib/send-email';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── GHL metric fetchers ──────────────────────────────────────

async function countNewContacts(locationId, apiKey, sinceMs) {
  try {
    const data = await ghlFetch(
      `/contacts/?locationId=${locationId}&limit=100&sortBy=date_added&sort=desc`,
      apiKey
    );
    const contacts = data?.contacts ?? [];
    return contacts.filter((c) => {
      const added = c.dateAdded ? new Date(c.dateAdded).getTime() : 0;
      return added >= sinceMs;
    }).length;
  } catch {
    return null;
  }
}

async function hasPipelineMovement(locationId, apiKey, sinceMs) {
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

async function countConversations(locationId, apiKey, sinceMs) {
  try {
    const data = await ghlFetch(
      `/conversations/search?locationId=${locationId}&sort=last_message_date&sortBy=desc&limit=50`,
      apiKey
    );
    const convs = data?.conversations ?? [];
    return convs.filter((c) => {
      const lastDate = c.lastMessageDate ? new Date(c.lastMessageDate).getTime() : 0;
      return lastDate >= sinceMs;
    }).length;
  } catch {
    return null;
  }
}

// ── Claude health score ──────────────────────────────────────

async function assessHealth(client, metrics) {
  const { calls7d, newContacts, pipelineMoving, conversations } = metrics;

  const prompt = `You're a business health analyst for TheHypeBox, an AI automation SaaS for home service businesses.

Client: ${client.name || client.email} (Plan: ${client.plan}, Status: ${client.plan_status})

Activity last 7 days:
- AI phone calls (Sarah/Retell): ${calls7d ?? 'unknown'}
- New contacts added in GHL: ${newContacts ?? 'unknown'}
- Pipeline stage movement: ${pipelineMoving === null ? 'unknown' : pipelineMoving ? 'yes' : 'no'}
- Conversations/SMS activity: ${conversations ?? 'unknown'}

Assign a health score:
GREEN = active usage, system working for them
YELLOW = low activity, may need a check-in
RED = no meaningful activity, client is disengaged or something is broken

Reply with exactly two lines and nothing else:
SCORE: [GREEN|YELLOW|RED]
REASON: [one sentence, plain text, no markdown]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);

  const result = await res.json();
  const text = result.content?.[0]?.text ?? '';

  const scoreMatch = text.match(/SCORE:\s*(GREEN|YELLOW|RED)/i);
  const reasonMatch = text.match(/REASON:\s*(.+)/i);

  return {
    score: (scoreMatch?.[1] ?? 'yellow').toLowerCase(),
    reason: reasonMatch?.[1]?.trim() ?? 'Health assessment inconclusive.',
  };
}

// ── Re-engagement email ──────────────────────────────────────

async function sendReengagementEmail(client) {
  const firstName = (client.name || client.email).split(' ')[0];
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,sans-serif;">
<div style="max-width:540px;margin:0 auto;padding:40px 24px;">
  <div style="margin-bottom:28px;">
    <span style="font-size:1.1rem;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
  </div>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 16px;">Hey ${firstName},</p>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 16px;">I was reviewing your account and noticed it hasn't seen much activity this week. I just want to make sure Sarah and your pipeline are working the way you expect them to.</p>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 16px;">If anything feels off — calls not coming through, pipeline not updating, anything — just hit reply and I'll fix it same day.</p>
  <p style="font-size:0.95rem;color:#ccc;line-height:1.75;margin:0 0 4px;">— Riley</p>
  <p style="font-size:0.8rem;color:#444;margin:0;">TheHypeBox LLC</p>
</div>
</body>
</html>`;

  try {
    await sendEmail({
      to: client.email,
      subject: "Quick check-in on your HypeBox system",
      html,
    });
    return true;
  } catch (err) {
    console.warn(`[client-health] re-engagement email failed for ${client.email}:`, err.message);
    return false;
  }
}

// ── Streak check ─────────────────────────────────────────────

async function isRedFor3PlusDays(supabase, userId) {
  const { data } = await supabase
    .from('client_health_log')
    .select('health_score')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(3);

  if (!data || data.length < 3) return false;
  return data.every((row) => row.health_score === 'red');
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
  const sinceMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const ago7d = new Date(sinceMs).toISOString();
  const today = now.toISOString().split('T')[0];

  // All active/trialing clients with GHL credentials
  const { data: rawUsers, error: usersErr } = await supabase
    .from('users')
    .select('id, name, email, plan, plan_status, ghl_location_id, ghl_api_key, retell_agent_id, role')
    .in('plan_status', ['active', 'trialing']);

  if (usersErr) {
    console.error('[client-health] DB fetch failed:', usersErr.message);
    return NextResponse.json({ error: usersErr.message }, { status: 500 });
  }

  const clients = (rawUsers ?? []).filter(
    (u) => u.role !== 'super_admin' && u.ghl_location_id && u.ghl_api_key
  );

  if (clients.length === 0) {
    console.log('[client-health] no eligible clients');
    return NextResponse.json({ ok: true, checked: 0, date: today });
  }

  // Bulk fetch Retell calls for the last 7 days
  const { data: recentCalls } = await supabase
    .from('retell_calls')
    .select('agent_id')
    .gte('start_timestamp', ago7d);

  const callsByAgent = {};
  for (const c of recentCalls ?? []) {
    if (c.agent_id) callsByAgent[c.agent_id] = (callsByAgent[c.agent_id] || 0) + 1;
  }

  const results = [];
  const alerts = [];

  for (const client of clients) {
    try {
      // Gather GHL metrics in parallel
      const [newContacts, pipelineMoving, conversations] = await Promise.all([
        countNewContacts(client.ghl_location_id, client.ghl_api_key, sinceMs),
        hasPipelineMovement(client.ghl_location_id, client.ghl_api_key, sinceMs),
        countConversations(client.ghl_location_id, client.ghl_api_key, sinceMs),
      ]);

      const calls7d = client.retell_agent_id
        ? (callsByAgent[client.retell_agent_id] ?? 0)
        : null;

      const metrics = { calls7d, newContacts, pipelineMoving, conversations };

      // Claude assessment
      const { score, reason } = await assessHealth(client, metrics);

      // Re-engagement: red for 3+ consecutive days
      let reengagementSent = false;
      if (score === 'red') {
        const streak = await isRedFor3PlusDays(supabase, client.id);
        if (streak) {
          reengagementSent = await sendReengagementEmail(client);
          if (reengagementSent) {
            console.log(`[client-health] re-engagement sent to ${client.email}`);
          }
        }
      }

      // Upsert log row (one row per client per day)
      const { error: logErr } = await supabase.from('client_health_log').upsert(
        {
          user_id: client.id,
          date: today,
          health_score: score,
          reason,
          calls_7d: calls7d,
          new_contacts_7d: newContacts,
          pipeline_active: pipelineMoving,
          conversations_7d: conversations,
          reengagement_sent: reengagementSent,
          created_at: now.toISOString(),
        },
        { onConflict: 'user_id,date' }
      );
      if (logErr) console.warn(`[client-health] log upsert failed (${client.email}):`, logErr.message);

      results.push({ email: client.email, score, reason, reengagementSent });

      if (score === 'yellow' || score === 'red') {
        alerts.push(`${score.toUpperCase()}: ${client.name || client.email} — ${reason}`);
      }

      console.log(`[client-health] ${client.email} → ${score}`);
    } catch (err) {
      console.error(`[client-health] error on ${client.email}:`, err.message);
      results.push({ email: client.email, score: 'error', reason: err.message });
    }
  }

  // SMS Riley if any yellow/red
  if (alerts.length > 0) {
    const rileyPhone = process.env.RILEY_PHONE;
    const smsApiKey = process.env.GHL_API_KEY;
    const smsLocationId = process.env.GHL_LOCATION_ID;

    if (rileyPhone && smsApiKey && smsLocationId) {
      const cap = alerts.slice(0, 5);
      const overflow = alerts.length > 5 ? `\n+${alerts.length - 5} more` : '';
      const body = `HypeBox Health Alert ${today}:\n${cap.join('\n')}${overflow}`;
      try {
        await sendSMS(rileyPhone, body, { apiKey: smsApiKey, locationId: smsLocationId });
        console.log(`[client-health] SMS sent to Riley (${alerts.length} alerts)`);
      } catch (err) {
        console.warn('[client-health] SMS to Riley failed:', err.message);
      }
    } else {
      console.warn('[client-health] RILEY_PHONE/GHL_API_KEY/GHL_LOCATION_ID not set — skipping SMS');
    }
  }

  const summary = {
    ok: true,
    date: today,
    checked: clients.length,
    green: results.filter((r) => r.score === 'green').length,
    yellow: results.filter((r) => r.score === 'yellow').length,
    red: results.filter((r) => r.score === 'red').length,
    reengagements: results.filter((r) => r.reengagementSent).length,
    clients: results,
  };

  console.log(
    `[client-health] done — ${summary.checked} clients, ${summary.green}G ${summary.yellow}Y ${summary.red}R`
  );
  return NextResponse.json(summary);
}

export const GET = withErrorMonitor('client-health', handler);
