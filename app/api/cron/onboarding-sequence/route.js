import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { findContactByPhone, addContactTags, addContactNote } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GHL_BASE = 'https://services.leadconnectorhq.com';

const SETUP_GUIDE_URL = 'https://thehypeboxllc.com/dashboard';
const TIPS_URL = 'https://thehypeboxllc.com/dashboard';

const STEP_PROMPTS = {
  day1: (name, plan) =>
    `Write a welcome SMS for a new TheHypeBox client named ${name} who just signed up for the ${plan || 'Launch Box'} plan. ` +
    `Tell them their AI phone agent (Sarah) is being set up, give them their dashboard link (${SETUP_GUIDE_URL}), and let them know to reply if they need anything. ` +
    `Max 160 characters. Warm and excited tone. Sign off "— TheHypeBox". Output ONLY the SMS text.`,

  day3: (name) =>
    `Write a check-in SMS for a TheHypeBox client named ${name}. It's been 3 days since they signed up. ` +
    `Ask if Sarah (their AI phone agent) is set up and answering calls. Offer help if they're stuck. ` +
    `Max 160 characters. Casual and helpful. Sign off "— TheHypeBox". Output ONLY the SMS text.`,

  day7: (name) =>
    `Write an SMS for a TheHypeBox client named ${name}. It's been 7 days since they signed up. ` +
    `Ask if they've gotten their first appointment booked through Sarah. Encouraging, celebrate the win. ` +
    `Max 160 characters. Upbeat and conversational. Sign off "— TheHypeBox". Output ONLY the SMS text.`,

  day14: (name) =>
    `Write an SMS for a TheHypeBox client named ${name} who has been using TheHypeBox for 14 days. ` +
    `Share 2 quick tips: (1) make sure review request texts are enabled after every job, (2) check their pipeline for leads who haven't responded yet — Sarah can follow up automatically. ` +
    `Max 200 characters. Practical and confident. Sign off "— TheHypeBox". Output ONLY the SMS text.`,
};

async function generateSMS(step, name, plan) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const prompt = STEP_PROMPTS[step]?.(name, plan);
  if (!prompt) throw new Error(`Unknown step: ${step}`);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim().replace(/^"|"$/g, '');
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey     = process.env.GHL_LOCATION_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    return NextResponse.json({ error: 'GHL_LOCATION_KEY or GHL_LOCATION_ID not configured' }, { status: 500 });
  }

  const supabase = createClient();
  const now = new Date().toISOString();

  const { data: dueSteps, error: fetchErr } = await supabase
    .from('onboarding_sequences')
    .select('*')
    .eq('status', 'pending')
    .lte('fire_at', now)
    .order('fire_at', { ascending: true })
    .limit(50);

  if (fetchErr) {
    console.error('[onboarding-sequence] DB fetch error:', fetchErr.message);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!dueSteps?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  console.log(`[onboarding-sequence] processing ${dueSteps.length} due steps`);

  const results = [];

  for (const row of dueSteps) {
    const { id, email, phone, name, plan, step } = row;

    if (!phone) {
      await supabase.from('onboarding_sequences')
        .update({ status: 'skipped', error_msg: 'no phone on file' })
        .eq('id', id);
      results.push({ id, step, email, status: 'skipped', reason: 'no phone' });
      continue;
    }

    try {
      const firstName = (name || 'there').split(' ')[0];
      const smsText = await generateSMS(step, firstName, plan);

      await sendSMS(phone, smsText, { apiKey, locationId });

      // Tag the GHL contact so Barry handles replies
      try {
        const normalizedPhone = normalizePhone(phone);
        const contactId = await findContactByPhone(locationId, normalizedPhone, apiKey);
        if (contactId) {
          await addContactTags(contactId, ['onboarding-client'], apiKey);
          await addContactNote(
            contactId,
            `[ONBOARDING_${step.toUpperCase()}] Sequence message sent:\n\n"${smsText}"`,
            apiKey
          );
        }
      } catch (tagErr) {
        console.warn(`[onboarding-sequence] tagging failed for ${email}:`, tagErr.message);
      }

      await supabase.from('onboarding_sequences')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id);

      console.log(`[onboarding-sequence] sent ${step} to ${email}`);
      results.push({ id, step, email, status: 'sent' });
    } catch (err) {
      console.error(`[onboarding-sequence] error on ${step} for ${email}:`, err.message);
      await supabase.from('onboarding_sequences')
        .update({ status: 'error', error_msg: err.message.slice(0, 500) })
        .eq('id', id);
      results.push({ id, step, email, status: 'error', reason: err.message });
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
