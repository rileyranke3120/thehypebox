import { NextResponse } from 'next/server';
import { getContactsByTag, addContactTags, addContactNote } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOC_ID = 'Ra79aZSYkl96uPQajjkJ';
const BATCH_LIMIT = 25;
const SKIP_TAGS = new Set(['sms-sent', 'opted-out', 'hot-lead']);

function buildInitialSMS(contact) {
  const first = contact.firstName || (contact.fullName || '').split(' ')[0] || null;
  const biz = (contact.companyName || '').trim();
  const greeting = first ? `Hey ${first}` : 'Hey';

  if (biz && biz.length <= 28) {
    const msg = `${greeting}, does ${biz} ever miss calls when you're on the job? We stop that. — Barry from TheHypeBox`;
    if (msg.length <= 160) return msg;
  }

  return `${greeting}, ever lose a job because you missed a call on-site? We stop that. — Barry from TheHypeBox`;
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[barry-outbound] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey) {
    console.error('[barry-outbound] GHL_LOCATION_KEY not set');
    return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  }

  let allContacts = [];
  try {
    allContacts = await getContactsByTag(LOC_ID, 'google-maps-scraped', apiKey);
  } catch (err) {
    console.error('[barry-outbound] contacts fetch error:', err.message);
    return NextResponse.json({ error: 'GHL contacts fetch failed', detail: err.message }, { status: 500 });
  }

  const uncontacted = allContacts
    .filter((c) => !(c.tags || []).some((t) => SKIP_TAGS.has(t)))
    .slice(0, BATCH_LIMIT);

  console.log(`[barry-outbound] ${allContacts.length} scraped contacts, ${uncontacted.length} to contact`);

  const results = { sent: 0, skipped: 0, errors: [] };

  for (const contact of uncontacted) {
    const phone = contact.phone || contact.phoneNumbers?.[0]?.phoneNumber;
    if (!phone) {
      results.skipped++;
      continue;
    }

    const message = buildInitialSMS(contact);

    try {
      await sendSMS(phone, message, { apiKey, locationId: LOC_ID });
      await addContactTags(contact.id, ['sms-sent'], apiKey);
      await addContactNote(contact.id, `🤖 Barry Outbound\n\nInitial SMS sent:\n"${message}"`, apiKey);
      results.sent++;
      console.log(`[barry-outbound] sent to ${contact.id} (${phone})`);
    } catch (err) {
      console.error(`[barry-outbound] error on ${contact.id}:`, err.message);
      results.errors.push({ id: contact.id, phone, error: err.message });
    }

    // Respect GHL rate limits
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log('[barry-outbound] done:', results);
  return NextResponse.json({ ok: true, ...results });
}

export const GET = withErrorMonitor('barry-outbound', handler);
