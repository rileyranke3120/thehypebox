import { NextResponse } from 'next/server';
import { addContactNote } from '@/lib/ghl';
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOCATION_ID   = process.env.GHL_LOCATION_ID;
const BATCH_LIMIT   = 20;
const DELAY_MS      = 500;
const DAY3_MS       = 3 * 24 * 60 * 60 * 1000;   // 72h after step 0
const DAY7_MS       = 4 * 24 * 60 * 60 * 1000;   // 96h after step 1 (= day 7 total)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emailWrapper(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;">
    <div style="background:#0a0a0a;padding:20px 32px;">
      <span style="font-size:1rem;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#FFD000;">THE HYPE BOX</span>
    </div>
    <div style="padding:36px 32px;font-size:0.97rem;color:#222;line-height:1.8;">
      ${bodyHtml}
    </div>
    <div style="background:#0a0a0a;padding:16px 32px;text-align:center;">
      <p style="font-size:0.72rem;color:#666;margin:0;line-height:1.8;">
        TheHypeBox LLC · Westerville, OH<br>
        <a href="mailto:riley@thehypeboxllc.com?subject=Unsubscribe" style="color:#666;text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function textToHtml(text) {
  return text
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px;">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function generateFollowup(step, { contactName, businessName, niche }) {
  const first = contactName || 'there';
  const biz   = businessName || 'your business';
  const label = niche || 'home services';

  const angle = step === 1
    ? 'A different angle — mention that missing one job could cost hundreds of dollars and our AI agent pays for itself quickly'
    : 'Final follow-up — keep it short, mention we understand if timing is off, leave door open, no pressure';

  const prompt = `You are Barry, co-founder of TheHypeBox — an AI automation company for local home service businesses.

Write follow-up email #${step} to ${first}, owner of "${biz}", a ${label} company. They didn't reply to our first outreach.

Angle for this email: ${angle}

Requirements:
- 2–3 short paragraphs only
- Different angle from a standard first outreach
- Casual, no pushy sales language
- End with a low-pressure question or statement
- Sign off as: Barry from TheHypeBox
- Return ONLY the email body as plain text (no subject line, no HTML)`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim();
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[email-followup] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!LOCATION_ID)                   return NextResponse.json({ error: 'GHL_LOCATION_ID not configured' }, { status: 500 });
  if (!process.env.RESEND_API_KEY)    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const resend   = new Resend(process.env.RESEND_API_KEY);
  const supabase = createClient();
  const apiKey   = process.env.GHL_LOCATION_KEY;
  const now      = new Date();

  // ── Step 1: contacts ready for day-3 follow-up ──
  const day3Cutoff = new Date(now.getTime() - DAY3_MS).toISOString();
  const { data: needsStep1 } = await supabase
    .from('email_outreach')
    .select('contact_id, email, contact_name, business_name, niche, subject')
    .eq('step', 0)
    .eq('replied', false)
    .eq('unsubscribed', false)
    .is('error', null)
    .lt('sent_at', day3Cutoff)
    .limit(BATCH_LIMIT);

  // ── Step 2: contacts ready for day-7 follow-up ──
  const day7Cutoff = new Date(now.getTime() - DAY7_MS).toISOString();
  const { data: needsStep2 } = await supabase
    .from('email_outreach')
    .select('contact_id, email, contact_name, business_name, niche, subject')
    .eq('step', 1)
    .eq('replied', false)
    .eq('unsubscribed', false)
    .is('error', null)
    .lt('sent_at', day7Cutoff)
    .limit(BATCH_LIMIT);

  // Filter step-1 candidates that haven't already had step-1 sent
  const step1ContactIds = (needsStep1 ?? []).map(r => r.contact_id);
  let already1 = new Set();
  if (step1ContactIds.length) {
    const { data: existing } = await supabase
      .from('email_outreach')
      .select('contact_id')
      .eq('step', 1)
      .in('contact_id', step1ContactIds);
    already1 = new Set((existing ?? []).map(r => r.contact_id));
  }
  const step1Queue = (needsStep1 ?? []).filter(r => !already1.has(r.contact_id));

  // Filter step-2 candidates that haven't already had step-2 sent
  const step2ContactIds = (needsStep2 ?? []).map(r => r.contact_id);
  let already2 = new Set();
  if (step2ContactIds.length) {
    const { data: existing } = await supabase
      .from('email_outreach')
      .select('contact_id')
      .eq('step', 2)
      .in('contact_id', step2ContactIds);
    already2 = new Set((existing ?? []).map(r => r.contact_id));
  }
  const step2Queue = (needsStep2 ?? []).filter(r => !already2.has(r.contact_id));

  console.log(`[email-followup] step1_queue=${step1Queue.length} step2_queue=${step2Queue.length}`);

  const results = { sent: 0, skipped: 0, errors: [] };

  async function sendFollowup(record, step) {
    const { contact_id, email, contact_name, business_name, niche, subject: origSubject } = record;
    const first   = contact_name || 'there';
    const biz     = business_name || '';
    const reSubject = `Re: ${origSubject || (biz ? `${biz} — are you missing calls?` : 'are you missing calls?')}`;

    try {
      const bodyText = await generateFollowup(step, { contactName: first, businessName: biz, niche });
      await sleep(200);

      const html = emailWrapper(textToHtml(bodyText));

      const { error: sendErr } = await resend.emails.send({
        from:    'Barry from TheHypeBox <riley@thehypeboxllc.com>',
        to:      email,
        subject: reSubject,
        html,
      });

      if (sendErr) throw new Error(sendErr.message || 'Resend error');

      await supabase.from('email_outreach').upsert({
        contact_id,
        location_id:   LOCATION_ID,
        email,
        step,
        subject:       reSubject,
        contact_name:  first,
        business_name: biz,
        niche,
        sent_at:       new Date().toISOString(),
      }, { onConflict: 'contact_id,step' });

      if (apiKey) {
        await addContactNote(
          contact_id,
          `📨 Barry Email — Step ${step} (Follow-up)\n\nSubject: ${reSubject}\n\n${bodyText}`,
          apiKey
        ).catch(() => {});
      }

      results.sent++;
      console.log(`[email-followup] step${step} → ${email} (${contact_id})`);
    } catch (err) {
      console.error(`[email-followup] error step${step} on ${contact_id}:`, err.message);
      results.errors.push({ contact_id, step, error: err.message });

      await supabase.from('email_outreach').upsert({
        contact_id,
        location_id: LOCATION_ID,
        email,
        step,
        subject:     reSubject,
        error:       err.message,
        sent_at:     new Date().toISOString(),
      }, { onConflict: 'contact_id,step' });
    }
  }

  for (const record of step1Queue) {
    await sendFollowup(record, 1);
    await sleep(DELAY_MS);
  }

  for (const record of step2Queue) {
    await sendFollowup(record, 2);
    await sleep(DELAY_MS);
  }

  console.log('[email-followup] done:', results);
  return NextResponse.json({ ok: true, ...results, step1: step1Queue.length, step2: step2Queue.length });
}
