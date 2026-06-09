import { NextResponse } from 'next/server';
import { safeCompare } from '@/lib/safe-compare';
import { sendSMS } from '@/lib/twilio';
import { withErrorMonitor } from '@/lib/error-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GHL_BASE = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'Ra79aZSYkl96uPQajjkJ';
const DELAY_MS = 350;

const CITIES = [
  { name: 'Columbus',      state: 'Ohio',          stateCode: 'OH' },
  { name: 'Cleveland',     state: 'Ohio',          stateCode: 'OH' },
  { name: 'Cincinnati',    state: 'Ohio',          stateCode: 'OH' },
  { name: 'Dayton',        state: 'Ohio',          stateCode: 'OH' },
  { name: 'Pittsburgh',    state: 'Pennsylvania',  stateCode: 'PA' },
  { name: 'Indianapolis',  state: 'Indiana',       stateCode: 'IN' },
  { name: 'Detroit',       state: 'Michigan',      stateCode: 'MI' },
  { name: 'Louisville',    state: 'Kentucky',      stateCode: 'KY' },
  { name: 'Nashville',     state: 'Tennessee',     stateCode: 'TN' },
  { name: 'Charlotte',     state: 'North Carolina', stateCode: 'NC' },
  { name: 'Atlanta',       state: 'Georgia',       stateCode: 'GA' },
  { name: 'Houston',       state: 'Texas',         stateCode: 'TX' },
  { name: 'Dallas',        state: 'Texas',         stateCode: 'TX' },
  { name: 'Phoenix',       state: 'Arizona',       stateCode: 'AZ' },
  { name: 'Denver',        state: 'Colorado',      stateCode: 'CO' },
  { name: 'Portland',      state: 'Oregon',        stateCode: 'OR' },
  { name: 'Seattle',       state: 'Washington',    stateCode: 'WA' },
  { name: 'Chicago',       state: 'Illinois',      stateCode: 'IL' },
  { name: 'Miami',         state: 'Florida',       stateCode: 'FL' },
  { name: 'Tampa',         state: 'Florida',       stateCode: 'FL' },
];

const TRADES = [
  { query: 'plumbers',              tag: 'plumber'     },
  { query: 'HVAC companies',        tag: 'hvac'        },
  { query: 'electricians',          tag: 'electrician' },
  { query: 'concrete contractors',  tag: 'concrete'    },
  { query: 'concrete coating',      tag: 'concrete'    },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Rotate cities by day of year so each daily run hits a different city
function getCurrentCity() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now - jan1) / (24 * 60 * 60 * 1000));
  return CITIES[dayOfYear % CITIES.length];
}

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return raw;
}

function splitName(businessName) {
  const parts = businessName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function parseAddress(formatted) {
  const parts = (formatted || '').split(',').map(s => s.trim());
  const address1 = parts[0] || '';
  const city     = parts[1] || '';
  const stateZip = parts[2] || '';
  const [state, postalCode] = stateZip.trim().split(/\s+/);
  return { address1, city, state: state || '', postalCode: postalCode || '' };
}

// Google Places API (New) — text search, up to 3 pages (60 results per trade)
async function searchPlaces(query, placesKey) {
  const results = [];
  let pageToken = null;

  for (let page = 0; page < 3; page++) {
    const body = { textQuery: query, pageSize: 20 };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': placesKey,
        'X-Goog-FieldMask': [
          'places.displayName',
          'places.formattedAddress',
          'places.nationalPhoneNumber',
          'places.websiteUri',
          'places.rating',
          'nextPageToken',
        ].join(','),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Places API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    results.push(...(data.places || []));
    pageToken = data.nextPageToken || null;
    if (!pageToken) break;

    await sleep(2000); // Google requires a delay before requesting next page
  }

  return results;
}

async function upsertToGHL(contact, ghlKey, attempt = 1) {
  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ghlKey}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contact),
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 429) {
    if (attempt > 3) throw new Error('Rate limited after max retries');
    await sleep(5000 * attempt);
    return upsertToGHL(contact, ghlKey, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.msg || `HTTP ${res.status}`);

  return { id: data.contact?.id || data.id, isNew: data.isNew ?? false };
}

async function handler(request) {
  const authHeader = request.headers.get('authorization');
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ghlKey    = process.env.GHL_LOCATION_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!ghlKey)    return NextResponse.json({ error: 'GHL_LOCATION_KEY not configured' },    { status: 500 });
  if (!placesKey) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY not configured' }, { status: 500 });

  const city  = getCurrentCity();
  const stats = { city: city.name, pushed: 0, newLeads: 0, skipped: 0, failed: 0 };

  console.log(`[scrape-leads] Starting — ${city.name}, ${city.state}`);

  const seenPhones = new Set(); // dedup within this run before GHL handles cross-run dedup

  for (const trade of TRADES) {
    const query = `${trade.query} ${city.name} ${city.state}`;
    console.log(`[scrape-leads] Searching: ${query}`);

    let places;
    try {
      places = await searchPlaces(query, placesKey);
    } catch (err) {
      console.error(`[scrape-leads] Search failed for "${query}":`, err.message);
      continue;
    }

    console.log(`[scrape-leads] ${places.length} results for "${query}"`);

    for (const place of places) {
      const name = place.displayName?.text || '';
      if (!name) continue;

      const phone   = normalizePhone(place.nationalPhoneNumber || '');
      const website = place.websiteUri || '';

      if (!phone && !website) { stats.skipped++; continue; }

      const phoneKey = phone ? phone.replace(/\D/g, '').slice(-10) : null;
      if (phoneKey && seenPhones.has(phoneKey)) continue;
      if (phoneKey) seenPhones.add(phoneKey);

      const { firstName, lastName } = splitName(name);
      const { address1, city: addrCity, state, postalCode } = parseAddress(place.formattedAddress);

      const body = {
        locationId: LOCATION_ID,
        firstName,
        lastName,
        name,
        tags: [trade.tag, 'google-maps-scraped', city.name.toLowerCase()],
        source: 'google-maps-scraper',
        country: 'US',
      };

      if (phone)     body.phone      = phone;
      if (website)   body.website    = website;
      if (address1)  body.address1   = address1;
      if (addrCity)  body.city       = addrCity;
      if (state)     body.state      = state;
      if (postalCode) body.postalCode = postalCode;

      try {
        const { isNew } = await upsertToGHL(body, ghlKey);
        stats.pushed++;
        if (isNew) stats.newLeads++;
      } catch (err) {
        console.error(`[scrape-leads] GHL upsert failed for "${name}":`, err.message);
        stats.failed++;
      }

      await sleep(DELAY_MS);
    }
  }

  console.log(
    `[scrape-leads] Done — city=${city.name} new=${stats.newLeads} ` +
    `pushed=${stats.pushed} skipped=${stats.skipped} failed=${stats.failed}`
  );

  // SMS Riley with count of new leads
  const rileyPhone   = process.env.RILEY_PHONE;
  const smsApiKey    = process.env.GHL_SMS_KEY;
  const smsLocationId = process.env.GHL_LOCATION_ID;

  if (rileyPhone && smsApiKey && smsLocationId) {
    const msg =
      `[HypeBox] ${city.name} scrape done. ` +
      `${stats.newLeads} new leads added to GHL` +
      (stats.pushed !== stats.newLeads ? ` (${stats.pushed - stats.newLeads} already existed)` : '') +
      (stats.failed ? `. ${stats.failed} failed.` : '.');

    try {
      await sendSMS(rileyPhone, msg, { apiKey: smsApiKey, locationId: smsLocationId });
      console.log(`[scrape-leads] SMS sent to ${rileyPhone}`);
    } catch (err) {
      console.error('[scrape-leads] SMS failed:', err.message);
    }
  }

  return NextResponse.json({ ok: true, ...stats });
}

export const GET = withErrorMonitor('scrape-leads', handler);
