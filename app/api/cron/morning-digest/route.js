import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { ghlFetch, getOpportunities, getAppointments } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// TheHypeBox GHL location — Ra79aZSYkl96uPQajjkJ
const LOC = process.env.GHL_LOCATION_ID;

// Set these in your Vercel env vars before enabling the cron
// RILEY_PHONE=+15551234567
// DAD_PHONE=+15551234567

async function getPipelineByStage(apiKey) {
  const opps = await getOpportunities(LOC, apiKey);
  const byStage = {};
  for (const opp of opps) {
    const stage = opp.stage?.name || 'Unknown';
    byStage[stage] = (byStage[stage] || 0) + 1;
  }
  return { byStage, total: opps.length };
}

async function getNewLeads(apiKey, sinceMs) {
  const data = await ghlFetch(
    `/contacts/?locationId=${LOC}&limit=100`,
    apiKey
  );
  const contacts = data?.contacts ?? [];
  return contacts.filter((c) => {
    const added = c.dateAdded ? new Date(c.dateAdded).getTime() : 0;
    return added >= sinceMs;
  });
}

async function getRespondedContacts(apiKey, sinceMs) {
  try {
    const data = await ghlFetch(
      `/conversations/search?locationId=${LOC}&sort=last_message_date&sortBy=desc&limit=50`,
      apiKey
    );
    const convs = data?.conversations ?? [];
    return convs.filter((c) => {
      const lastDate = c.lastMessageDate ? new Date(c.lastMessageDate).getTime() : 0;
      return lastDate >= sinceMs && c.lastMessageDirection === 'inbound';
    }).map((c) => ({ name: c.contactName || c.fullName || null, phone: c.phone || null }));
  } catch (err) {
    console.warn('[morning-digest] conversations fetch skipped:', err.message);
    return [];
  }
}

async function getUpcomingDemos(apiKey) {
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  try {
    const events = await getAppointments(LOC, now.toISOString(), in7d.toISOString(), apiKey);
    return events.filter(
      (e) => e.appointmentStatus !== 'cancelled' && e.appointmentStatus !== 'invalid'
    );
  } catch (err) {
    console.warn('[morning-digest] appointments fetch skipped:', err.message);
    return [];
  }
}

async function getNewStripeSignups(supabase, since) {
  const { data } = await supabase
    .from('users')
    .select('name, email, plan, plan_status, created_at')
    .gte('created_at', since)
    .not('plan_status', 'is', null)
    .not('role', 'eq', 'super_admin')
    .in('plan_status', ['active', 'trialing']);
  return data ?? [];
}

async function buildSummary(digest) {
  const { pipelineByStage, pipelineTotal, newLeads, responded, demos, signups } = digest;

  const stageLines = Object.entries(pipelineByStage)
    .map(([stage, count]) => `${stage}: ${count}`)
    .join(', ');

  const signupNames = signups.length
    ? signups.map((u) => `${u.name || u.email} (${u.plan})`).join(', ')
    : 'none';

  const leadNames = newLeads.length
    ? newLeads.slice(0, 5).map((c) => c.firstName || c.name || c.email || 'Unknown').join(', ') +
      (newLeads.length > 5 ? ` +${newLeads.length - 5} more` : '')
    : 'none';

  const prompt = `You're writing a morning briefing text message for Riley and his dad. They run TheHypeBox, a SaaS that sells AI voice agents to local businesses.

Today's snapshot:
- Pipeline total: ${pipelineTotal} contacts
- By stage: ${stageLines || 'no data'}
- New leads added in last 24h: ${newLeads.length}${newLeads.length ? ' (' + leadNames + ')' : ''}
- Contacts who replied to outreach (last 24h): ${responded.length}
- Demos/appointments booked (next 7 days): ${demos.length}
- New Stripe signups (last 24h): ${signups.length}${signups.length ? ' — ' + signupNames : ''}

Write a short, plain-text morning briefing. Conversational, no fluff — just what matters right now. Lead with the best news. Flag anything needing attention. Keep it to 3–4 sentences max. No emojis, no bullet points, no formatting. Plain text sentences only.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${err}`);
  }

  const result = await res.json();
  return result.content?.[0]?.text ?? 'Morning digest data ready but summary generation failed.';
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[morning-digest] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GHL_API_KEY not configured' }, { status: 500 });
  }
  if (!LOC) {
    return NextResponse.json({ error: 'GHL_LOCATION_ID not configured' }, { status: 500 });
  }

  const supabase = createClient();
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const [pipeline, newLeads, responded, demos, signups] = await Promise.all([
      getPipelineByStage(apiKey),
      getNewLeads(apiKey, ago24h.getTime()),
      getRespondedContacts(apiKey, ago24h.getTime()),
      getUpcomingDemos(apiKey),
      getNewStripeSignups(supabase, ago24h.toISOString()),
    ]);

    const digest = {
      pipelineByStage: pipeline.byStage,
      pipelineTotal: pipeline.total,
      newLeads,
      responded,
      demos,
      signups,
    };

    const summary = await buildSummary(digest);

    // Send SMS to Riley and Dad
    const phones = [process.env.RILEY_PHONE, process.env.DAD_PHONE].filter(Boolean);
    const smsResults = [];

    for (const phone of phones) {
      try {
        await sendSMS(phone, summary, { apiKey, locationId: LOC });
        smsResults.push({ phone, ok: true });
        console.log(`[morning-digest] SMS sent to ${phone}`);
      } catch (err) {
        smsResults.push({ phone, ok: false, error: err.message });
        console.error(`[morning-digest] SMS failed to ${phone}:`, err.message);
      }
    }

    // Persist the digest log — Vercel filesystem is ephemeral, so we store in Supabase.
    // The log mirrors what daily_digest_log.json would contain.
    const logEntry = {
      date: now.toISOString().split('T')[0],
      summary,
      pipeline_by_stage: pipeline.byStage,
      pipeline_total: pipeline.total,
      new_leads_count: newLeads.length,
      responded_count: responded.length,
      demos_count: demos.length,
      signups_count: signups.length,
      signups_detail: signups.map((u) => ({ name: u.name, email: u.email, plan: u.plan })),
      sms_sent_to: smsResults,
      created_at: now.toISOString(),
    };

    const { error: logErr } = await supabase.from('daily_digest_log').insert(logEntry);
    if (logErr) {
      console.warn('[morning-digest] log insert failed (table may not exist yet):', logErr.message);
    }

    const smsSentCount = smsResults.filter((r) => r.ok).length;
    console.log(
      `[morning-digest] complete — pipeline=${pipeline.total} leads=${newLeads.length} ` +
      `responded=${responded.length} demos=${demos.length} signups=${signups.length} sms=${smsSentCount}/${phones.length}`
    );

    return NextResponse.json({
      ok: true,
      summary,
      pipeline: pipeline.byStage,
      newLeads: newLeads.length,
      responded: responded.length,
      demos: demos.length,
      signups: signups.length,
      smsResults,
    });
  } catch (err) {
    console.error('[morning-digest] fatal error:', err);
    return NextResponse.json({ error: err.message || 'Something went wrong.' }, { status: 500 });
  }
}

export const GET = withErrorMonitor('morning-digest', handler);
