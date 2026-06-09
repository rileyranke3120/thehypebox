import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';
import { sendSMS } from '@/lib/twilio';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GHL_BASE = 'https://services.leadconnectorhq.com';

// ─── Claude message generation ───────────────────────────────────────────────

async function generateReviewRequest({ customerName, businessName, serviceType, reviewUrl }) {
  const isFollowUp = false;
  return _generateMessage({ customerName, businessName, serviceType, reviewUrl, isFollowUp });
}

async function generateFollowUp({ customerName, businessName, reviewUrl }) {
  return _generateMessage({ customerName, businessName, serviceType: null, reviewUrl, isFollowUp: true });
}

async function _generateMessage({ customerName, businessName, serviceType, reviewUrl, isFollowUp }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const firstName = (customerName || '').split(' ')[0] || 'there';
  const biz       = businessName || 'our team';
  const job       = serviceType  || 'the work we did';
  const linkLine  = reviewUrl ? ` Leave us one here: ${reviewUrl}` : '';

  const system = isFollowUp
    ? `You write short, warm follow-up SMS messages asking customers to leave a Google review. One sentence only. Friendly, not pushy. No emojis.`
    : `You write short, warm SMS messages asking customers to leave a Google review right after a job is completed. Two sentences max. Friendly and conversational. No emojis. Always end with the review link if provided.`;

  const user = isFollowUp
    ? `Customer first name: ${firstName}. Business: ${biz}. Google review link: ${reviewUrl || 'not available'}. Write a gentle one-sentence follow-up reminder.`
    : `Customer first name: ${firstName}. Business: ${biz}. Job completed: ${job}. Google review link: ${reviewUrl || 'not available'}. Write the review request SMS.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }

  const result = await res.json();
  let msg = result.content?.[0]?.text?.trim() ?? '';

  // Ensure the review URL is present if Claude omitted it
  if (reviewUrl && !msg.includes(reviewUrl)) {
    msg = `${msg}${msg.endsWith('.') ? '' : '.'} ${reviewUrl}`;
  }

  return msg;
}

// ─── GHL SMS sender ──────────────────────────────────────────────────────────

async function sendGhlSms(phone, message, locationId, apiKey) {
  // Find or create the contact in GHL, then send the message
  const searchRes = await fetch(`${GHL_BASE}/contacts/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    body: JSON.stringify({
      locationId,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: phone }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  let contactId = null;
  if (searchRes.ok) {
    const searchData = await searchRes.json();
    contactId = searchData?.contacts?.[0]?.id ?? null;
  }

  if (!contactId) {
    const createRes = await fetch(`${GHL_BASE}/contacts/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Version: '2021-07-28',
      },
      body: JSON.stringify({ locationId, phone }),
      signal: AbortSignal.timeout(10000),
    });
    const createData = await createRes.json();
    contactId = createData?.contact?.id || createData?.meta?.contactId;
    if (!contactId) throw new Error('Could not find or create GHL contact');
  }

  const msgRes = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    body: JSON.stringify({ type: 'SMS', contactId, locationId, message }),
    signal: AbortSignal.timeout(10000),
  });

  if (!msgRes.ok) {
    const err = await msgRes.json().catch(() => ({}));
    throw new Error(err.message || `GHL SMS ${msgRes.status}`);
  }

  return await msgRes.json();
}

// ─── Cron handler ────────────────────────────────────────────────────────────

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ghlKey     = process.env.GHL_LOCATION_KEY;
  const smsApiKey  = process.env.GHL_SMS_KEY;
  const smsLocId   = process.env.GHL_LOCATION_ID;
  const rileyPhone = process.env.RILEY_PHONE;

  if (!ghlKey) return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });

  const supabase = createClient();
  const now      = new Date().toISOString();
  const stats    = { initial: 0, followUp: 0, failed: 0 };

  // ── 1. Send initial review requests (pending, send_after elapsed) ──────────
  const { data: pending, error: pendingErr } = await supabase
    .from('review_requests')
    .select('*')
    .eq('status', 'pending')
    .lte('send_after', now)
    .limit(20);

  if (pendingErr) {
    console.error('[review-requests] pending query error:', pendingErr.message);
  }

  for (const row of pending ?? []) {
    if (!row.phone_number) {
      console.warn(`[review-requests] no phone on record ${row.id} — skipping`);
      await supabase.from('review_requests').update({ status: 'skipped' }).eq('id', row.id);
      continue;
    }

    try {
      const message = await generateReviewRequest({
        customerName: row.customer_name,
        businessName: row.business_name,
        serviceType:  row.service_type,
        reviewUrl:    row.google_review_url,
      });

      const locId = row.location_id || smsLocId;
      await sendGhlSms(row.phone_number, message, locId, ghlKey);

      const followUpAfter = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from('review_requests').update({
        status:           'sent',
        sent_at:          new Date().toISOString(),
        message_sent:     message,
        follow_up_after:  followUpAfter,
      }).eq('id', row.id);

      stats.initial++;
      console.log(`[review-requests] initial sent → ${row.phone_number} (opp: ${row.opportunity_id})`);

      // Alert Riley
      if (rileyPhone && smsApiKey && smsLocId) {
        const alert =
          `[HypeBox] Review request sent to ${row.customer_name || row.phone_number}` +
          (row.business_name ? ` for ${row.business_name}` : '') + '.';
        await sendSMS(rileyPhone, alert, { apiKey: smsApiKey, locationId: smsLocId })
          .catch((err) => console.error('[review-requests] Riley alert failed:', err.message));
      }
    } catch (err) {
      console.error(`[review-requests] initial failed for ${row.id}:`, err.message);
      stats.failed++;
    }
  }

  // ── 2. Send follow-ups (sent, follow_up_after elapsed) ────────────────────
  const { data: followUps, error: followErr } = await supabase
    .from('review_requests')
    .select('*')
    .eq('status', 'sent')
    .lte('follow_up_after', now)
    .limit(20);

  if (followErr) {
    console.error('[review-requests] follow-up query error:', followErr.message);
  }

  for (const row of followUps ?? []) {
    if (!row.phone_number) {
      await supabase.from('review_requests').update({ status: 'follow_up_skipped' }).eq('id', row.id);
      continue;
    }

    try {
      const message = await generateFollowUp({
        customerName: row.customer_name,
        businessName: row.business_name,
        reviewUrl:    row.google_review_url,
      });

      const locId = row.location_id || smsLocId;
      await sendGhlSms(row.phone_number, message, locId, ghlKey);

      await supabase.from('review_requests').update({
        status:             'follow_up_sent',
        follow_up_sent_at:  new Date().toISOString(),
        follow_up_message:  message,
      }).eq('id', row.id);

      stats.followUp++;
      console.log(`[review-requests] follow-up sent → ${row.phone_number} (opp: ${row.opportunity_id})`);
    } catch (err) {
      console.error(`[review-requests] follow-up failed for ${row.id}:`, err.message);
      stats.failed++;
    }
  }

  console.log(
    `[review-requests] done — initial=${stats.initial} follow_up=${stats.followUp} failed=${stats.failed}`
  );

  return NextResponse.json({ ok: true, ...stats });
}
