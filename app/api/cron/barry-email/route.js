import { NextResponse } from 'next/server';
import { getContactsByTag, addContactTags, addContactNote } from '@/lib/ghl';
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOCATION_ID = process.env.GHL_LOCATION_ID;
const BATCH_LIMIT = 10;
const DELAY_MS    = 500;

const NICHE_LABEL = {
  plumber:      'plumbing',
  hvac:         'HVAC',
  electrician:  'electrical',
  concrete:     'concrete coating',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getNiche(tags = []) {
  const lower = tags.map(t => t.toLowerCase());
  return lower.find(t => NICHE_LABEL[t]) || 'home services';
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

async function personalizeEmail(contact, niche) {
  const first = contact.firstName || (contact.fullName || '').split(' ')[0] || 'there';
  const biz   = contact.companyName || 'your business';
  const label = NICHE_LABEL[niche] || niche;

  const prompt = `You are Barry, co-founder of TheHypeBox — an AI automation company for local home service businesses.

Write a short, conversational cold email to ${first}, owner of "${biz}", a ${label} company.

Requirements:
- Subject line is already set — do NOT include it in your output
- 3–4 short paragraphs, plain conversational tone
- Mention that we have an AI phone agent that answers calls 24/7, captures leads, and books appointments
- Ask ONE specific question at the end (e.g. "How many calls do you think you miss in a week?")
- Sign off as: Barry from TheHypeBox
- Do NOT mention pricing, plans, or upsell
- Do NOT use bullet points or headers
- Return ONLY the email body as plain text (no subject line, no HTML tags)`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 350,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim();
}

function textToHtml(text) {
  return text
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 16px;">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[barry-email] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey)                        return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  if (!LOCATION_ID)                   return NextResponse.json({ error: 'GHL_LOCATION_ID not configured' }, { status: 500 });
  if (!process.env.RESEND_API_KEY)    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const resend   = new Resend(process.env.RESEND_API_KEY);
  const supabase = createClient();

  // Contacts with email found, not yet emailed, not opted-out
  let contacts = [];
  try {
    contacts = await getContactsByTag(LOCATION_ID, 'email-found', apiKey);
  } catch (err) {
    console.error('[barry-email] contacts fetch error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const eligible = contacts
    .filter(c => {
      const tags = c.tags || [];
      return c.email &&
        !tags.includes('email-sent') &&
        !tags.includes('opted-out') &&
        !tags.includes('email-unsubscribed');
    })
    .slice(0, BATCH_LIMIT);

  console.log(`[barry-email] ${contacts.length} email-found contacts, ${eligible.length} eligible`);

  const results = { sent: 0, skipped: 0, errors: [] };
  const startTime = Date.now();

  for (const contact of eligible) {
    if (Date.now() - startTime > 45000) {
      console.log('[barry-email] 45s limit reached, exiting early');
      break;
    }
    if (!contact.email) { results.skipped++; continue; }

    const first = contact.firstName || (contact.fullName || '').split(' ')[0] || 'there';
    const biz   = contact.companyName || '';
    const niche = getNiche(contact.tags);

    const subject = biz
      ? `${biz} — are you missing calls?`
      : `${first}, are you missing calls?`;

    try {
      const bodyText = await personalizeEmail(contact, niche);
      await sleep(200);

      const html = emailWrapper(textToHtml(bodyText));

      const { error: sendErr } = await resend.emails.send({
        from:    'Barry from TheHypeBox <riley@thehypeboxllc.com>',
        to:      contact.email,
        subject,
        html,
      });

      if (sendErr) throw new Error(sendErr.message || 'Resend error');

      // Record in Supabase
      await supabase.from('email_outreach').upsert({
        contact_id:    contact.id,
        location_id:   LOCATION_ID,
        email:         contact.email,
        step:          0,
        subject,
        contact_name:  first,
        business_name: biz,
        niche,
        sent_at:       new Date().toISOString(),
      }, { onConflict: 'contact_id,step' });

      // Tag + note in GHL
      await addContactTags(contact.id, ['email-sent'], apiKey);
      await sleep(DELAY_MS);
      await addContactNote(
        contact.id,
        `📨 Barry Email — Step 0 (Initial)\n\nSubject: ${subject}\n\n${bodyText}`,
        apiKey
      );

      results.sent++;
      console.log(`[barry-email] sent to ${contact.email} (${contact.id})`);
    } catch (err) {
      console.error(`[barry-email] error on ${contact.id}:`, err.message);
      results.errors.push({ id: contact.id, email: contact.email, error: err.message });

      await supabase.from('email_outreach').upsert({
        contact_id:  contact.id,
        location_id: LOCATION_ID,
        email:       contact.email,
        step:        0,
        subject,
        error:       err.message,
        sent_at:     new Date().toISOString(),
      }, { onConflict: 'contact_id,step' });
    }

    await sleep(DELAY_MS);
  }

  console.log('[barry-email] done:', results);
  return NextResponse.json({ ok: true, ...results });
}
