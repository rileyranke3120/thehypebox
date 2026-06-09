import { NextResponse } from 'next/server';
import { getContactsByTag, addContactTags, addContactNote, updateContact } from '@/lib/ghl';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const LOCATION_ID  = process.env.GHL_LOCATION_ID;
const BATCH_LIMIT  = 15;
const DELAY_MS     = 500;
const DEADLINE_MS  = 45_000;

// Emails to skip — too generic to be useful
const SKIP_PREFIXES = new Set([
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'postmaster', 'mailer-daemon', 'admin',
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractDomain(website) {
  if (!website) return null;
  try {
    const url = website.startsWith('http') ? website : `https://${website}`;
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function scoreEmail(email) {
  const prefix = email.split('@')[0].toLowerCase();
  if (SKIP_PREFIXES.has(prefix)) return 0;
  // Personal emails score higher
  if (/^[a-z]+\.[a-z]+/.test(prefix)) return 3;
  if (/^[a-z]{3,8}$/.test(prefix))    return 2;
  return 1;
}

function pickBestEmail(emails) {
  return emails
    .filter(e => scoreEmail(e) > 0)
    .sort((a, b) => scoreEmail(b) - scoreEmail(a))[0] ?? null;
}

async function findViaHunter(domain) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${key}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const emails = (data?.data?.emails ?? []).map(e => e.value).filter(Boolean);
    return pickBestEmail(emails) ?? null;
  } catch {
    return null;
  }
}

async function findViaWebsiteScrape(website) {
  if (!website) return null;

  const url = website.startsWith('http') ? website : `https://${website}`;
  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  // Pages most likely to have contact email — limit to 2 to stay within time budget
  const paths = ['', '/contact'];

  for (const path of paths) {
    try {
      const res = await fetch(`${url}${path}`, {
        signal: AbortSignal.timeout(6000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TheHypeBox/1.0)' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = [...new Set(html.match(EMAIL_RE) ?? [])];
      const best = pickBestEmail(matches);
      if (best) return best;
    } catch {
      // timeout or connection error — try next path
    }
    await sleep(300);
  }

  return null;
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[email-finder] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.GHL_LOCATION_KEY;
  if (!apiKey)      return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' }, { status: 500 });
  if (!LOCATION_ID) return NextResponse.json({ error: 'GHL_LOCATION_ID not configured' }, { status: 500 });

  // Contacts that were scraped but haven't had email-found or email-skip tagged yet.
  // Cap at 3 pages (300 contacts) — enough to find BATCH_LIMIT candidates without timing out.
  let contacts = [];
  try {
    contacts = await getContactsByTag(LOCATION_ID, 'google-maps-scraped', apiKey, 3);
  } catch (err) {
    console.error('[email-finder] contacts fetch error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const needsEmail = contacts
    .filter(c => {
      const tags = c.tags || [];
      // Already has email in GHL, or already processed
      if (c.email) return false;
      if (tags.includes('email-found') || tags.includes('email-skip')) return false;
      return true;
    })
    .slice(0, BATCH_LIMIT);

  console.log(`[email-finder] ${contacts.length} scraped contacts (first 3 pages), ${needsEmail.length} missing email`);

  const results = { found: 0, skipped: 0, errors: [] };
  const startedAt = Date.now();

  for (const contact of needsEmail) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      console.log('[email-finder] approaching time limit — stopping early');
      break;
    }
    const domain = extractDomain(contact.website);

    let email = null;
    let source = null;

    if (domain) {
      // 1. Try Hunter.io domain search
      email = await findViaHunter(domain);
      if (email) source = 'hunter';
      await sleep(DELAY_MS);

      // 2. If Hunter found nothing, scrape the website
      if (!email && contact.website) {
        email = await findViaWebsiteScrape(contact.website);
        if (email) source = 'scrape';
        await sleep(DELAY_MS);
      }
    }

    if (!email) {
      await addContactTags(contact.id, ['email-skip'], apiKey);
      await sleep(DELAY_MS);
      results.skipped++;
      console.log(`[email-finder] no email for ${contact.id} (${domain ?? 'no-website'})`);
      continue;
    }

    try {
      await updateContact(contact.id, { email }, apiKey);
      await sleep(DELAY_MS);
      await addContactTags(contact.id, ['email-found'], apiKey);
      await sleep(DELAY_MS);
      await addContactNote(
        contact.id,
        `📧 Email found via ${source}\n\nEmail: ${email}\nDomain: ${domain}`,
        apiKey
      );
      results.found++;
      console.log(`[email-finder] found ${email} for ${contact.id} via ${source}`);
    } catch (err) {
      console.error(`[email-finder] error saving ${contact.id}:`, err.message);
      results.errors.push({ id: contact.id, error: err.message });
    }

    await sleep(DELAY_MS);
  }

  console.log('[email-finder] done:', results);
  return NextResponse.json({ ok: true, ...results });
}
