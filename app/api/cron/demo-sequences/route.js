import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';
import { ghlFetch } from '@/lib/ghl';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TRIAL_LINK = 'https://thehypeboxllc.com/checkout';

function formatDateTime(isoStr) {
  return new Date(isoStr).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildStaticSms(step, row) {
  const first = ((row.contact_name || '').split(' ')[0]) || 'there';
  const dt    = formatDateTime(row.appointment_start);
  const time  = formatTime(row.appointment_start);

  switch (step) {
    case 'confirm':
      return `Hey ${first}! Your HypeBox demo is confirmed — ${dt}. We'll show you exactly how AI automation can work in your business. See you then!\n– Riley @ TheHypeBox`;

    case 'reminder_24h':
      return `Hey ${first} — reminder, your HypeBox demo is tomorrow at ${time}. We're showing the full system live. See you then!\n– Riley`;

    case 'reminder_1h':
      return `Hey ${first} — your HypeBox demo starts in 1 hour at ${time}. We're ready when you are.\n– Riley @ TheHypeBox`;

    case 'followup_24h':
      return `Hey ${first}, still thinking it over? Here's your 14-day free trial (no card needed): ${TRIAL_LINK}\n– Riley @ TheHypeBox`;

    case 'followup_48h':
      return `Hey ${first} — most of our clients wish they'd started sooner. Your free trial: ${TRIAL_LINK}\n– Riley`;

    case 'breakup_7d':
      return `Hey ${first}, I won't keep reaching out. When you're ready to automate your business, we'll be here: ${TRIAL_LINK}\n– Riley @ TheHypeBox`;

    default:
      return null;
  }
}

async function generateAiFollowup(contactName, contactBusiness) {
  const first   = (contactName || '').split(' ')[0] || 'there';
  const bizLine = contactBusiness ? ` They run ${contactBusiness}.` : '';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':          process.env.ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
      'content-type':       'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 120,
      messages: [{
        role:    'user',
        content: `You are Riley, co-owner of TheHypeBox LLC, an AI automation SaaS for local home service businesses. Write a SHORT follow-up SMS (under 160 characters total) to a prospect named ${first} who just had a 1-on-1 live demo of TheHypeBox.${bizLine} Be casual, direct, and reference the demo. No emojis. End with: – Riley @ TheHypeBox. Output only the SMS text, nothing else.`,
      }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim()
    ?? `Hey ${first} — great chatting on the demo! Any questions? Just reply and I'll get right back to you. – Riley @ TheHypeBox`;
}

async function hasContactResponded(contactId, afterMs, locationId, apiKey) {
  try {
    const data = await ghlFetch(
      `/conversations/search?locationId=${locationId}&contactId=${contactId}&limit=10`,
      apiKey
    );
    const convs = data?.conversations ?? [];
    return convs.some((c) => {
      const lastMs = c.lastMessageDate ? new Date(c.lastMessageDate).getTime() : 0;
      return lastMs > afterMs && c.lastMessageDirection === 'inbound';
    });
  } catch (err) {
    console.warn('[demo-sequences] hasContactResponded error (fail open):', err.message);
    return false;
  }
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey     = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    return NextResponse.json({ error: 'GHL_API_KEY or GHL_LOCATION_ID not configured' }, { status: 500 });
  }

  const supabase = createClient();
  const now      = new Date().toISOString();

  const { data: dueSteps, error: fetchErr } = await supabase
    .from('demo_sequences')
    .select('*')
    .eq('status', 'pending')
    .lte('fire_at', now)
    .order('fire_at', { ascending: true })
    .limit(50);

  if (fetchErr) {
    console.error('[demo-sequences] DB fetch error:', fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!dueSteps?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  console.log(`[demo-sequences] processing ${dueSteps.length} due steps`);

  const results = [];

  for (const row of dueSteps) {
    const { id, step, contact_phone, contact_name, contact_id, contact_business, appointment_end, location_id } = row;
    const rowLocationId = location_id || locationId;

    if (!contact_phone) {
      await supabase.from('demo_sequences').update({ status: 'skipped', error_msg: 'no phone' }).eq('id', id);
      results.push({ id, step, status: 'skipped', reason: 'no phone' });
      continue;
    }

    try {
      let smsText    = null;
      let shouldSkip = false;

      if (step === 'followup_ai') {
        smsText = await generateAiFollowup(contact_name, contact_business);
      } else if (['followup_24h', 'followup_48h', 'breakup_7d'].includes(step)) {
        const endMs = new Date(appointment_end).getTime();
        const responded = await hasContactResponded(contact_id, endMs, rowLocationId, apiKey);
        if (responded) {
          shouldSkip = true;
        } else {
          smsText = buildStaticSms(step, row);
        }
      } else {
        smsText = buildStaticSms(step, row);
      }

      if (shouldSkip) {
        await supabase.from('demo_sequences').update({ status: 'skipped', sent_at: new Date().toISOString() }).eq('id', id);
        console.log(`[demo-sequences] skipped ${step} for ${contact_name} — responded`);
        results.push({ id, step, status: 'skipped', reason: 'responded' });
        continue;
      }

      if (!smsText) {
        await supabase.from('demo_sequences').update({ status: 'error', error_msg: 'no SMS text' }).eq('id', id);
        results.push({ id, step, status: 'error', reason: 'no text' });
        continue;
      }

      await sendSMS(contact_phone, smsText, { apiKey, locationId: rowLocationId });
      await supabase.from('demo_sequences').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);

      console.log(`[demo-sequences] sent ${step} to ${contact_name} (${contact_phone})`);
      results.push({ id, step, status: 'sent' });
    } catch (err) {
      console.error(`[demo-sequences] error on ${step} for ${contact_name}:`, err.message);
      await supabase.from('demo_sequences').update({ status: 'error', error_msg: err.message.slice(0, 500) }).eq('id', id);
      results.push({ id, step, status: 'error', reason: err.message });
    }
  }

  return NextResponse.json({
    ok:        true,
    processed: results.length,
    sent:      results.filter((r) => r.status === 'sent').length,
    skipped:   results.filter((r) => r.status === 'skipped').length,
    errors:    results.filter((r) => r.status === 'error').length,
    steps:     results,
  });
}
