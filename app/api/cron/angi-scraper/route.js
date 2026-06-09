// Vercel cron — 6am daily, before master cron.
//
// Sends Barry's custom "paying for leads" SMS to contacts tagged angi-lead or
// homeadvisor-lead that haven't been contacted yet (no sms-sent tag).
//
// The actual scraping happens in scripts/scrape-angi.mjs (Playwright, runs
// locally). This cron handles Barry so the pipeline works even if the local
// script ran hours earlier on a different machine.

import { NextResponse } from 'next/server';
import { getContactsByTag, addContactTags, addContactNote } from '@/lib/ghl';
import { sendSMS } from '@/lib/twilio';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOC_ID     = 'Ra79aZSYkl96uPQajjkJ';
const BATCH_LIMIT = 30;
const SKIP_TAGS  = new Set(['sms-sent', 'opted-out', 'hot-lead', 'do-not-contact']);

function buildBarrySMS(contact, source) {
  const first    = contact.firstName || (contact.fullName || '').split(' ')[0] || null;
  const biz      = (contact.companyName || '').trim();
  const platform = source === 'homeadvisor' ? 'HomeAdvisor' : 'Angi';
  const greeting = first ? `Hey ${first}` : 'Hey';

  if (biz && biz.length <= 28) {
    const msg = `${greeting}, ${biz} is paying ${platform} per lead — Sarah at TheHypeBox answers calls 24/7 for less than one lead costs. Worth a chat? — Barry`;
    if (msg.length <= 160) return msg;
  }

  return `${greeting}, you're paying ${platform} for every lead — Sarah at TheHypeBox answers calls 24/7 for less. Could replace that cost entirely. — Barry`;
}

function detectSource(tags) {
  if ((tags || []).includes('homeadvisor-lead')) return 'homeadvisor';
  return 'angi';
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET) {
    console.error('[angi-scraper] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey) {
    console.error('[angi-scraper] GHL_LOCATION_KEY not set');
    return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  }

  // Fetch contacts from both source tags in parallel
  const [angiContacts, haContacts] = await Promise.all([
    getContactsByTag(LOC_ID, 'angi-lead', apiKey).catch(err => {
      console.error('[angi-scraper] angi-lead fetch failed:', err.message);
      return [];
    }),
    getContactsByTag(LOC_ID, 'homeadvisor-lead', apiKey).catch(err => {
      console.error('[angi-scraper] homeadvisor-lead fetch failed:', err.message);
      return [];
    }),
  ]);

  // Merge and deduplicate by contact id
  const seenIds = new Set();
  const allContacts = [...angiContacts, ...haContacts].filter(c => {
    if (seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });

  const uncontacted = allContacts
    .filter(c => !(c.tags || []).some(t => SKIP_TAGS.has(t)))
    .slice(0, BATCH_LIMIT);

  console.log(`[angi-scraper] ${allContacts.length} total angi/ha contacts, ${uncontacted.length} uncontacted`);

  const results = { sent: 0, skipped: 0, errors: [] };

  for (const contact of uncontacted) {
    const phone = contact.phone || contact.phoneNumbers?.[0]?.phoneNumber;
    if (!phone) {
      results.skipped++;
      continue;
    }

    const source  = detectSource(contact.tags);
    const message = buildBarrySMS(contact, source);

    try {
      await sendSMS(phone, message, { apiKey, locationId: LOC_ID });
      await addContactTags(contact.id, ['sms-sent'], apiKey);
      await addContactNote(
        contact.id,
        `🤖 Barry Outbound (${source === 'homeadvisor' ? 'HomeAdvisor' : 'Angi'})\n\nInitial SMS sent:\n"${message}"`,
        apiKey
      );
      results.sent++;
      console.log(`[angi-scraper] sent to ${contact.id} (${phone})`);
    } catch (err) {
      console.error(`[angi-scraper] error on ${contact.id}:`, err.message);
      results.errors.push({ id: contact.id, phone, error: err.message });
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log('[angi-scraper] done:', results);
  return NextResponse.json({ ok: true, ...results });
}
