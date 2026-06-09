import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { ghlFetch, getContacts, getOpportunities, addContactNote, addContactTags } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const THRESHOLDS = { calls: 20, contacts: 50, pipeline: 10000 };

async function findContactByEmail(locationId, email, apiKey) {
  try {
    const data = await ghlFetch(
      `/contacts/?locationId=${locationId}&query=${encodeURIComponent(email)}&limit=1`,
      apiKey
    );
    return data?.contacts?.[0] ?? null;
  } catch {
    return null;
  }
}

async function getClientPipelineValue(locationId, apiKey) {
  try {
    const opps = await getOpportunities(locationId, apiKey);
    return opps.reduce((sum, o) => sum + (Number(o.monetaryValue) || 0), 0);
  } catch {
    return 0;
  }
}

async function generateUpsellSMS(client, { calls, contacts, pipeline }) {
  const usageLines = [];
  if (calls >= THRESHOLDS.calls) usageLines.push(`${calls} calls in the last 30 days`);
  if (contacts >= THRESHOLDS.contacts) usageLines.push(`${contacts} contacts in their system`);
  if (pipeline >= THRESHOLDS.pipeline) usageLines.push(`$${pipeline.toLocaleString()} in pipeline value`);

  const firstName = (client.name || '').split(' ')[0] || null;

  const prompt = `You're writing a personalized upsell SMS on behalf of TheHypeBox — an AI automation SaaS for local home service businesses. The message is from Riley at TheHypeBox to a client currently on the Launch Box plan ($97/month).

Client name: ${client.name || client.email}
Usage signals: ${usageLines.join('; ')}

Write a short, conversational SMS (under 160 characters) suggesting they upgrade to Rocket Box ($297/mo) or Velocity Box ($497/mo). Reference their specific numbers to make it feel personal. Sound like a real person texting — not a bot or template. No emojis. ${firstName ? `Start with "${firstName},"` : ''} End with a soft call to action like "Want me to walk you through it?" or "Worth a quick chat?".`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${text}`);
  }

  const result = await res.json();
  return result.content?.[0]?.text?.trim() ?? '';
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[upsell-detector] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const now = new Date();
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ago7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();

  // Load active Launch Box clients
  const { data: rawUsers, error: usersErr } = await supabase
    .from('users')
    .select('id, name, email, plan, plan_status, role, ghl_location_id, ghl_api_key, retell_agent_id')
    .in('plan', ['launch', 'starter'])
    .in('plan_status', ['active', 'trialing']);

  if (usersErr) {
    console.error('[upsell-detector] users fetch failed:', usersErr.message);
    return NextResponse.json({ error: 'DB error' }, { status: 500 });
  }

  const clients = (rawUsers ?? []).filter((u) => u.role !== 'super_admin');

  if (clients.length === 0) {
    console.log('[upsell-detector] no Launch Box clients found');
    return NextResponse.json({ ok: true, flagged: 0 });
  }

  // Check upsell_log for clients already flagged in the last 7 days (avoid duplicates)
  const clientEmails = clients.map((c) => c.email).filter(Boolean);
  const { data: recentLogs } = await supabase
    .from('upsell_log')
    .select('client_email')
    .in('client_email', clientEmails)
    .gte('created_at', ago7d);

  const recentlyFlagged = new Set((recentLogs ?? []).map((r) => r.client_email));

  // Pull 30-day call counts from retell_calls
  const agentIds = clients.map((u) => u.retell_agent_id).filter(Boolean);
  const { data: callData } = await supabase
    .from('retell_calls')
    .select('agent_id')
    .in('agent_id', agentIds.length ? agentIds : ['__none__'])
    .gte('start_timestamp', ago30d);

  const callCounts = {};
  for (const row of callData ?? []) {
    callCounts[row.agent_id] = (callCounts[row.agent_id] || 0) + 1;
  }

  // Evaluate each client
  const flagged = [];

  for (const client of clients) {
    if (recentlyFlagged.has(client.email)) {
      console.log(`[upsell-detector] skip ${client.email} — already flagged this week`);
      continue;
    }

    const calls = callCounts[client.retell_agent_id] ?? 0;
    let contacts = 0;
    let pipeline = 0;

    if (client.ghl_location_id && client.ghl_api_key) {
      const [contactList, pipelineValue] = await Promise.all([
        getContacts(client.ghl_location_id, client.ghl_api_key).catch(() => []),
        getClientPipelineValue(client.ghl_location_id, client.ghl_api_key),
      ]);
      contacts = contactList.length;
      pipeline = pipelineValue;
    }

    const triggers = [];
    if (calls     >= THRESHOLDS.calls)    triggers.push('calls');
    if (contacts  >= THRESHOLDS.contacts) triggers.push('contacts');
    if (pipeline  >= THRESHOLDS.pipeline) triggers.push('pipeline');

    if (triggers.length > 0) {
      flagged.push({ client, calls, contacts, pipeline, triggers });
    }
  }

  if (flagged.length === 0) {
    console.log('[upsell-detector] no clients met upsell thresholds today');
    return NextResponse.json({ ok: true, flagged: 0 });
  }

  const mainApiKey    = process.env.GHL_API_KEY;
  const mainLocationId = process.env.GHL_LOCATION_ID;
  const results = [];

  for (const { client, calls, contacts, pipeline, triggers } of flagged) {
    let smsDraft     = '';
    let ghlContactId = null;
    let ghlNoteId    = null;
    let tagged       = false;

    // Generate personalized SMS via Claude
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        smsDraft = await generateUpsellSMS(client, { calls, contacts, pipeline });
      } catch (err) {
        console.error(`[upsell-detector] AI draft failed for ${client.email}:`, err.message);
      }
    }

    // Find client in main GHL location and save note + tag
    if (mainApiKey && mainLocationId && client.email) {
      const contact = await findContactByEmail(mainLocationId, client.email, mainApiKey);
      if (contact?.id) {
        ghlContactId = contact.id;

        if (smsDraft) {
          try {
            const noteBody =
              `[UPSELL DRAFT — Awaiting Riley Approval]\n\n` +
              `Triggers: ${triggers.join(', ')}\n` +
              `Calls (30d): ${calls} | Contacts: ${contacts} | Pipeline: $${pipeline.toLocaleString()}\n\n` +
              `--- SMS DRAFT ---\n${smsDraft}`;
            const noteRes = await addContactNote(ghlContactId, noteBody, mainApiKey);
            ghlNoteId = noteRes?.id ?? null;
          } catch (err) {
            console.error(`[upsell-detector] GHL note failed for ${client.email}:`, err.message);
          }
        }

        try {
          await addContactTags(ghlContactId, ['upsell-ready'], mainApiKey);
          tagged = true;
        } catch (err) {
          console.error(`[upsell-detector] GHL tag failed for ${client.email}:`, err.message);
        }
      }
    }

    // Log to Supabase
    const { error: logErr } = await supabase.from('upsell_log').insert({
      user_id:        client.id,
      client_email:   client.email,
      client_name:    client.name,
      plan:           client.plan,
      calls_30d:      calls,
      contacts_count: contacts,
      pipeline_value: pipeline,
      triggers,
      sms_draft:      smsDraft,
      ghl_contact_id: ghlContactId,
      ghl_note_id:    ghlNoteId,
      tagged,
    });

    if (logErr) {
      console.error(`[upsell-detector] log insert failed for ${client.email}:`, logErr.message);
    }

    results.push({ email: client.email, triggers, calls, contacts, pipeline, tagged });
    console.log(`[upsell-detector] flagged ${client.email} — triggers: ${triggers.join(', ')}`);
  }

  return NextResponse.json({ ok: true, flagged: results.length, results });
}

export const GET = withErrorMonitor('upsell-detector', handler);
