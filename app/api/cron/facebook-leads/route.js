// Daily 8am cron — contacts any GHL leads tagged facebook-group-lead that Barry
// hasn't reached yet. Acts as a safety net for leads scraped without a phone number
// who later get one added, and for any SMS failures from the scraper script.

import { NextResponse } from 'next/server';
import { getContactsByTag, addContactTags, addContactNote } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOC_ID     = 'Ra79aZSYkl96uPQajjkJ';
const BATCH      = 20;
const SKIP_TAGS  = new Set(['fb-barry-sent', 'opted-out']);

const BARRY_MESSAGES = {
  'fb-pain-missed-calls':  (first) => `Hey ${first}, saw your post about missing calls. We answer for contractors 24/7 so you never lose a job to voicemail. — Barry, TheHypeBox`,
  'fb-pain-busy-season':   (first) => `Hey ${first}, saw you're slammed. We handle your calls so you keep every job while you're on site. — Barry, TheHypeBox`,
  'fb-pain-need-coverage': (first) => `Hey ${first}, saw you need phone coverage. We handle contractor calls 24/7. Interested? — Barry, TheHypeBox`,
};

function buildMessage(contact) {
  const first = contact.firstName || (contact.fullName || '').split(' ')[0] || 'there';
  const painTag = (contact.tags || []).find(t => t.startsWith('fb-pain-'));
  const msgFn = BARRY_MESSAGES[painTag] || BARRY_MESSAGES['fb-pain-missed-calls'];
  return msgFn(first);
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[facebook-leads] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey) {
    console.error('[facebook-leads] GHL_LOCATION_KEY not set');
    return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  }

  let allContacts = [];
  try {
    allContacts = await getContactsByTag(LOC_ID, 'facebook-group-lead', apiKey);
  } catch (err) {
    console.error('[facebook-leads] contacts fetch error:', err.message);
    return NextResponse.json({ error: 'GHL fetch failed', detail: err.message }, { status: 500 });
  }

  const pending = allContacts
    .filter(c => !(c.tags || []).some(t => SKIP_TAGS.has(t)))
    .filter(c => c.phone || c.phoneNumbers?.[0]?.phoneNumber)
    .slice(0, BATCH);

  console.log(`[facebook-leads] ${allContacts.length} fb leads, ${pending.length} to contact`);

  const results = { sent: 0, skipped: 0, errors: [] };

  for (const contact of pending) {
    const phone = contact.phone || contact.phoneNumbers?.[0]?.phoneNumber;
    if (!phone) { results.skipped++; continue; }

    const message = buildMessage(contact);

    try {
      await sendSMS(phone, message, { apiKey, locationId: LOC_ID });
      await addContactTags(contact.id, ['fb-barry-sent'], apiKey);
      await addContactNote(
        contact.id,
        `🤖 Barry FB Outreach\n\nSMS sent:\n"${message}"`,
        apiKey
      );
      results.sent++;
      console.log(`[facebook-leads] SMS sent → ${contact.id}`);
    } catch (err) {
      console.error(`[facebook-leads] error on ${contact.id}:`, err.message);
      results.errors.push({ id: contact.id, error: err.message });
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log('[facebook-leads] done:', results);
  return NextResponse.json({ ok: true, ...results });
}
