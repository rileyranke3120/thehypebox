import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendSMS } from '@/lib/twilio';
import { sendAlertSMS } from '@/lib/inbound-alert';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ANTHROPIC_BASE = 'https://api.anthropic.com';
const FOLLOW_UP_WINDOW_MS = 24 * 60 * 60 * 1000;

async function generateFollowupSMS(name, plan, initialSms) {
  const firstName = (name || 'there').split(' ')[0];

  const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are Riley, founder of TheHypeBox AI automation platform. You sent a cancellation retention SMS to ${firstName} yesterday and got no reply. Write a short, genuine follow-up SMS (2-3 sentences max, casual tone, no pressure). Reference that the 1 free month offer still stands. Don't repeat the original message verbatim.

Original message sent:
"${initialSms}"

Client: ${firstName} | Plan: ${plan || 'TheHypeBox'}

Reply with ONLY the SMS text, no quotes, no explanation.`,
      }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim().replace(/^"|"$/g, '');
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!safeCompare(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const cutoff = new Date(Date.now() - FOLLOW_UP_WINDOW_MS).toISOString();

  const { data: pending, error } = await supabase
    .from('cancellation_deflection')
    .select('id, email, name, plan, phone, initial_sms_body, initial_sms_sent_at')
    .eq('outcome', 'pending')
    .eq('client_responded', false)
    .is('followup_sent_at', null)
    .lt('initial_sms_sent_at', cutoff)
    .not('phone', 'is', null);

  if (error) {
    console.error('[cancellation-followup] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const apiKey = process.env.GHL_SMS_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      const followupBody = await generateFollowupSMS(row.name, row.plan, row.initial_sms_body);

      await sendSMS(row.phone, followupBody, { apiKey, locationId });

      await supabase
        .from('cancellation_deflection')
        .update({
          followup_sms_body: followupBody,
          followup_sent_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      console.log(`[cancellation-followup] follow-up sent to ${row.email}`);
      sent++;
    } catch (err) {
      console.error(`[cancellation-followup] failed for ${row.email}:`, err.message);
      failed++;
    }
  }

  if (sent > 0) {
    try {
      await sendAlertSMS(`📊 Cancellation follow-ups sent: ${sent}${failed ? `, ${failed} failed` : ''}`);
    } catch (_) {}
  }

  return NextResponse.json({ ok: true, processed: pending.length, sent, failed });
}
