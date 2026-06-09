import { NextResponse } from 'next/server';
import { getContactsByTag, addContactNote, addContactTags, ghlFetch } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOCATION_ID = process.env.GHL_LOCATION_ID;
const BATCH_LIMIT = 20;
const DELAY_MS    = 400;

// State markers injected into GHL notes — never counted as initial outreach
const AUTO_MARKERS  = ['[FOLLOWUP_1]', '[FOLLOWUP_2]', '[COLD_TAGGED]', '[REACTIVATION]'];
const FOLLOWUP_1_MS = 48 * 60 * 60 * 1000;
const FOLLOWUP_2_MS = 48 * 60 * 60 * 1000;
const COLD_MS       = 48 * 60 * 60 * 1000;
const REACT_MS      = 30 * 24 * 60 * 60 * 1000;

const NICHE = { plumber: 'plumber', hvac: 'HVAC contractor', electrician: 'electrician', concrete: 'concrete contractor' };
const TARGET_TAGS = Object.keys(NICHE);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getNiche(tags = []) {
  const lower = tags.map(t => t.toLowerCase());
  return lower.find(t => TARGET_TAGS.includes(t)) || 'trade business';
}

function detectState(notes) {
  const sorted = [...notes].sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

  const f1   = notes.find(n => (n.body || '').includes('[FOLLOWUP_1]'));
  const f2   = notes.find(n => (n.body || '').includes('[FOLLOWUP_2]'));
  const cold = notes.find(n => (n.body || '').includes('[COLD_TAGGED]'));
  const rct  = notes.find(n => (n.body || '').includes('[REACTIVATION]'));

  if (rct)  return { state: 'reactivation_sent' };
  if (cold) return { state: 'cold', coldAt: cold.dateAdded };
  if (f2)   return { state: 'followup2_sent', f2At: f2.dateAdded };
  if (f1)   return { state: 'followup1_sent', f1At: f1.dateAdded };

  const nonAuto = sorted.filter(n => !AUTO_MARKERS.some(m => (n.body || '').includes(m)));
  if (nonAuto.length === 0) return null;
  return { state: 'outreach_detected', outreachAt: nonAuto[0].dateAdded };
}

async function generateFollowup(firstName, niche, num, prevMessages) {
  const isReact  = num === 'reactivation';
  const prevCtx  = prevMessages.length
    ? `\n\nPrevious messages sent:\n${prevMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}`
    : '';

  const prompt = isReact
    ? `Write a re-engagement SMS to ${firstName}, a ${NICHE[niche] || niche} business owner. We reached out ~30 days ago and never heard back. Low-pressure, checking in.${prevCtx}\n\nMax 160 chars. Return ONLY the message text.`
    : `Write follow-up SMS #${num} to ${firstName}, a ${NICHE[niche] || niche} business owner. No response yet.${prevCtx}\n\nRequirements: different angle from prior messages, casual, soft CTA, max 160 chars. Return ONLY the message text.`;

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
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim().replace(/^"|"$/g, '');
}

function extractQuotedMsg(noteBody) {
  const m = (noteBody || '').match(/"([^"]+)"/);
  return m ? m[1] : null;
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey)      return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  if (!LOCATION_ID) return NextResponse.json({ error: 'GHL_LOCATION_ID not configured' }, { status: 500 });

  // Contacts that barry-outbound has SMS'd, not opted-out, not already in terminal state
  let contacted = [];
  try {
    contacted = await getContactsByTag(LOCATION_ID, 'sms-sent', apiKey);
  } catch (err) {
    console.error('[follow-up] contacts fetch failed:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const eligible = contacted
    .filter(c => {
      const tags = c.tags || [];
      return !tags.includes('opted-out') && !tags.includes('responded');
    })
    .slice(0, BATCH_LIMIT);

  console.log(`[follow-up] ${contacted.length} sms-sent contacts, ${eligible.length} eligible`);

  const results = { processed: 0, sent: 0, skipped: 0, errors: [] };
  const now = Date.now();

  for (const contact of eligible) {
    const name  = contact.firstName || (contact.name || '').split(' ')[0] || 'there';
    const phone = contact.phone;
    const niche = getNiche(contact.tags);

    if (!phone) { results.skipped++; continue; }

    try {
      // Fetch notes to determine state
      const notesData = await ghlFetch(`/contacts/${contact.id}/notes`, apiKey);
      const notes = notesData?.notes ?? [];
      await sleep(DELAY_MS);

      const stateInfo = detectState(notes);
      if (!stateInfo) { results.skipped++; continue; }

      const { state } = stateInfo;

      // Extract prior messages for Claude context (avoid repetition)
      const f1Note = notes.find(n => (n.body || '').includes('[FOLLOWUP_1]'));
      const f2Note = notes.find(n => (n.body || '').includes('[FOLLOWUP_2]'));
      const prevMessages = [extractQuotedMsg(f1Note?.body), extractQuotedMsg(f2Note?.body)].filter(Boolean);

      if (state === 'reactivation_sent') {
        results.skipped++;
        continue;
      }

      if (state === 'cold') {
        const coldMs = new Date(stateInfo.coldAt).getTime();
        if (now - coldMs >= REACT_MS) {
          const msg = await generateFollowup(name, niche, 'reactivation', prevMessages);
          await sendSMS(phone, msg, { apiKey, locationId: LOCATION_ID });
          await sleep(DELAY_MS);
          await addContactNote(contact.id, `[REACTIVATION] 30-day reactivation sent:\n\n"${msg}"`, apiKey);
          results.sent++;
          console.log(`[follow-up] reactivation → ${name}`);
        } else {
          results.skipped++;
        }
        results.processed++;
        continue;
      }

      if (state === 'followup2_sent') {
        const f2Ms = new Date(stateInfo.f2At).getTime();
        if (now - f2Ms >= COLD_MS) {
          await addContactTags(contact.id, ['cold'], apiKey);
          await sleep(DELAY_MS);
          await addContactNote(contact.id, `[COLD_TAGGED] No response after 2 follow-ups. Reactivation in 30 days.`, apiKey);
          console.log(`[follow-up] cold-tagged → ${name}`);
        } else {
          results.skipped++;
        }
        results.processed++;
        continue;
      }

      if (state === 'followup1_sent') {
        const f1Ms = new Date(stateInfo.f1At).getTime();
        if (now - f1Ms >= FOLLOWUP_2_MS) {
          const msg = await generateFollowup(name, niche, 2, prevMessages);
          await sendSMS(phone, msg, { apiKey, locationId: LOCATION_ID });
          await sleep(DELAY_MS);
          await addContactNote(contact.id, `[FOLLOWUP_2] Second follow-up sent:\n\n"${msg}"`, apiKey);
          results.sent++;
          console.log(`[follow-up] followup2 → ${name}`);
        } else {
          results.skipped++;
        }
        results.processed++;
        continue;
      }

      if (state === 'outreach_detected') {
        const outMs = new Date(stateInfo.outreachAt).getTime();
        if (now - outMs >= FOLLOWUP_1_MS) {
          const msg = await generateFollowup(name, niche, 1, []);
          await sendSMS(phone, msg, { apiKey, locationId: LOCATION_ID });
          await sleep(DELAY_MS);
          await addContactNote(contact.id, `[FOLLOWUP_1] First follow-up sent:\n\n"${msg}"`, apiKey);
          results.sent++;
          console.log(`[follow-up] followup1 → ${name}`);
        } else {
          results.skipped++;
        }
        results.processed++;
        continue;
      }

      results.skipped++;
    } catch (err) {
      console.error(`[follow-up] error on ${name}:`, err.message);
      results.errors.push({ id: contact.id, name, error: err.message });
    }

    await sleep(DELAY_MS);
  }

  console.log(`[follow-up] done — processed=${results.processed} sent=${results.sent} skipped=${results.skipped} errors=${results.errors.length}`);
  return NextResponse.json({ ok: true, ...results });
}

export const GET = withErrorMonitor('follow-up', handler);
