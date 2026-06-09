// scrape-angi.mjs
// Scrapes Angi.com and HomeAdvisor.com for contractor leads in 4 Ohio cities.
// These contractors are paying for leads on those platforms — proven buyers.
//
// What it does:
//   1. Scrapes listing pages → collects profile URLs
//   2. Visits each profile → extracts name, phone, website, rating, reviews
//   3. Deduplicates by phone (within run + against GHL)
//   4. Upserts new leads to GHL with angi-lead/homeadvisor-lead + niche tags
//   5. Logs each lead to Supabase angi_leads table
//   6. Sends Barry's "paying for Angi leads" SMS immediately for new contacts
//
// Setup:
//   npx playwright install chromium   (first time only)
//
// Usage:
//   node scripts/scrape-angi.mjs                   # visible browser
//   node scripts/scrape-angi.mjs --headless         # headless
//   node scripts/scrape-angi.mjs --dry-run          # no GHL/SMS/Supabase writes
//   node scripts/scrape-angi.mjs --source angi      # only Angi
//   node scripts/scrape-angi.mjs --source homeadvisor
//
// Cron (6am daily, before master cron at 7am):
//   0 6 * * * cd /path/to/thehypebox && node scripts/scrape-angi.mjs --headless >> /tmp/scrape-angi.log 2>&1
//
// Env vars (reads from .env.local):
//   GHL_LOCATION_KEY         — GHL location-level private integration token
//   NEXT_PUBLIC_SUPABASE_URL — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── env ────────────────────────────────────────────────────────────────────

try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    const raw = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !process.env[k]) process.env[k] = raw;
  }
} catch { /* rely on shell env */ }

const GHL_KEY     = process.env.GHL_LOCATION_KEY;
const GHL_BASE    = 'https://services.leadconnectorhq.com';
const LOCATION_ID = 'Ra79aZSYkl96uPQajjkJ';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── config ─────────────────────────────────────────────────────────────────

const HEADLESS = process.argv.includes('--headless');
const DRY_RUN  = process.argv.includes('--dry-run');
const SOURCE_ARG = (() => {
  const idx = process.argv.indexOf('--source');
  return idx >= 0 ? process.argv[idx + 1] : null; // 'angi' | 'homeadvisor' | null
})();

const MAX_PROFILES_PER_QUERY = 20; // max profile pages to visit per search
const DELAY_MS = 400;

const CITIES = [
  { name: 'Columbus',   slug: 'columbus',   haSlug: 'Columbus-OH'   },
  { name: 'Cleveland',  slug: 'cleveland',  haSlug: 'Cleveland-OH'  },
  { name: 'Cincinnati', slug: 'cincinnati', haSlug: 'Cincinnati-OH' },
  { name: 'Dayton',     slug: 'dayton',     haSlug: 'Dayton-OH'     },
];

const NICHES = [
  { tag: 'plumber',     angiSlug: 'plumbers',             haCategory: 'Plumbers'              },
  { tag: 'hvac',        angiSlug: 'hvac-contractors',     haCategory: 'HVAC-Contractors'      },
  { tag: 'electrician', angiSlug: 'electricians',         haCategory: 'Electricians'          },
  { tag: 'concrete',    angiSlug: 'concrete-contractors', haCategory: 'Concrete-Contractors'  },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(min = 800, max = 2200) { return sleep(Math.floor(Math.random() * (max - min) + min)); }

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return '';
}

function phoneKey(phone) {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

function splitName(businessName) {
  const parts = businessName.trim().split(/\s+/);
  return parts.length === 1
    ? { firstName: parts[0], lastName: '' }
    : { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function parseAddress(formatted) {
  const parts = (formatted || '').split(',').map(s => s.trim());
  const address1  = parts[0] || '';
  const city      = parts[1] || '';
  const stateZip  = parts[2] || '';
  const [state, postalCode] = stateZip.split(/\s+/);
  return { address1, city, state: state || '', postalCode: postalCode || '' };
}

function buildBarrySMS(businessName, source) {
  const platform = source === 'homeadvisor' ? 'HomeAdvisor' : 'Angi';
  if (businessName && businessName.length <= 28) {
    const msg = `Hey, ${businessName} is paying ${platform} per lead — Sarah at TheHypeBox answers calls 24/7 for less than one lead costs. Worth a chat? — Barry`;
    if (msg.length <= 160) return msg;
  }
  return `Hey, you're paying ${platform} for every lead — Sarah at TheHypeBox answers calls 24/7 for less. Could replace that cost entirely. — Barry`;
}

// ─── GHL ────────────────────────────────────────────────────────────────────

async function ghlUpsert(record, source, niche, cityName, attempt = 1) {
  const { firstName, lastName } = splitName(record.businessName);
  const phone = normalizePhone(record.phone);

  const sourceTags = source === 'homeadvisor'
    ? ['homeadvisor-lead']
    : ['angi-lead'];

  const body = {
    locationId: LOCATION_ID,
    firstName,
    lastName,
    name: record.businessName,
    tags: [niche, ...sourceTags, 'high-quality-prospect', cityName.toLowerCase()],
    source: `${source}-scraper`,
    country: 'US',
  };

  if (phone)          body.phone     = phone;
  if (record.website) body.website   = record.website;

  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 429) {
    if (attempt > 3) throw new Error('Rate limited after max retries');
    await sleep(5000 * attempt);
    return ghlUpsert(record, source, niche, cityName, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.msg || `HTTP ${res.status}`);

  return { id: data.contact?.id || data.id, isNew: data.isNew ?? false };
}

async function ghlAddNote(contactId, text) {
  await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GHL_KEY}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: text }),
    signal: AbortSignal.timeout(8000),
  }).catch(err => console.warn(`  Note failed: ${err.message}`));
}

async function ghlAddTags(contactId, tags) {
  await fetch(`${GHL_BASE}/contacts/${contactId}/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GHL_KEY}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(8000),
  }).catch(err => console.warn(`  Tag failed: ${err.message}`));
}

// Sends SMS via GHL conversations API
async function ghlSendSMS(phone, message, attempt = 1) {
  // Find or create the contact by phone first
  const searchRes = await fetch(`${GHL_BASE}/contacts/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GHL_KEY}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
    body: JSON.stringify({
      locationId: LOCATION_ID,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: phone }],
    }),
    signal: AbortSignal.timeout(8000),
  });
  const searchData = await searchRes.json().catch(() => ({}));
  const contactId = searchData?.contacts?.[0]?.id;
  if (!contactId) throw new Error('Contact not found by phone after upsert');

  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GHL_KEY}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
    body: JSON.stringify({ type: 'SMS', contactId, locationId: LOCATION_ID, message }),
    signal: AbortSignal.timeout(8000),
  });

  if (res.status === 429) {
    if (attempt > 3) throw new Error('SMS rate limited after max retries');
    await sleep(5000 * attempt);
    return ghlSendSMS(phone, message, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL SMS error: ${res.status}`);
  return data;
}

// ─── Supabase ────────────────────────────────────────────────────────────────

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function logToSupabase(supabase, record) {
  if (!supabase) return;
  await supabase.from('angi_leads').insert(record).then(({ error }) => {
    if (error) console.warn(`  Supabase log failed: ${error.message}`);
  });
}

// ─── Playwright extraction ────────────────────────────────────────────────────

async function extractJsonLd(page) {
  return page.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        const entries = Array.isArray(data) ? data : [data];
        for (const entry of entries) {
          const items = entry['@type'] === 'ItemList'
            ? (entry.itemListElement || []).map(i => i.item || i)
            : [entry];
          for (const item of items) {
            if (item.telephone || item.name) return item;
          }
        }
      } catch { /* skip malformed */ }
    }
    return null;
  });
}

async function extractProfileData(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await jitter(1200, 2500);

  // Try JSON-LD first — most reliable
  const ld = await extractJsonLd(page);
  if (ld) {
    const rating = parseFloat(ld.aggregateRating?.ratingValue) || null;
    const reviewCount = parseInt(ld.aggregateRating?.reviewCount || ld.aggregateRating?.ratingCount || '0') || 0;
    return {
      businessName: ld.name || '',
      phone: ld.telephone || '',
      website: ld.url && !ld.url.includes('angi.com') && !ld.url.includes('homeadvisor.com') ? ld.url : '',
      rating,
      reviewCount,
    };
  }

  // Fallback: parse visible page elements
  return page.evaluate(() => {
    const name = (
      document.querySelector('h1[class*="company" i]')
      || document.querySelector('h1[class*="name" i]')
      || document.querySelector('h1')
    )?.textContent?.trim() || '';

    // Phone: prefer tel: links, fallback to "Show phone" button reveal
    let phone = '';
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) phone = telLink.href.replace('tel:', '').trim();

    // If still no phone, look for data attributes
    if (!phone) {
      const phoneEl = document.querySelector('[data-phone], [data-telephone]');
      if (phoneEl) phone = phoneEl.dataset.phone || phoneEl.dataset.telephone || '';
    }

    // Website: any external link that's not angi/ha
    let website = '';
    for (const a of document.querySelectorAll('a[href^="http"]')) {
      const h = a.href || '';
      if (!h.includes('angi.com') && !h.includes('homeadvisor.com') && !h.includes('google.com')) {
        website = h;
        break;
      }
    }

    // Rating
    const ratingEl = document.querySelector('[aria-label*="stars" i], [aria-label*="rating" i], [class*="rating-score" i]');
    const rating = ratingEl
      ? parseFloat(ratingEl.getAttribute('aria-label') || ratingEl.textContent) || null
      : null;

    // Review count
    const reviewText = document.body.innerText.match(/(\d[\d,]*)\s*review/i);
    const reviewCount = reviewText ? parseInt(reviewText[1].replace(/,/g, '')) : 0;

    return { businessName: name, phone, website, rating, reviewCount };
  });
}

async function collectProfileUrls(page, listingUrl, domain) {
  try {
    await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    console.log(`  Failed to load listing: ${err.message.split('\n')[0]}`);
    return [];
  }
  await jitter(1500, 3000);

  // Dismiss cookie/consent overlays
  for (const sel of ['button[aria-label*="accept" i]', 'button[class*="accept" i]', '#onetrust-accept-btn-handler', '[data-testid="accept-cookies"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 600 }).catch(() => false)) {
      await el.click().catch(() => {});
      await sleep(800);
    }
  }

  const urls = await page.evaluate((domain) => {
    const seen = new Set();
    const results = [];

    // Collect all <a> hrefs that look like contractor profile pages
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.href || '';
      if (!href.includes(domain)) continue;

      // Angi profile pattern: /companylist/{state}/{city}/{slug}.htm
      // HomeAdvisor profile pattern: /pro/{Trade}/{State}/{City}/{slug}.p-{id}.html
      const isProfile = (
        /\/companylist\/.*\.htm$/.test(href) ||   // Angi company page
        /\/pro\/[^/]+\/[^/]+\/[^/]+\/.*\.html$/.test(href)  // HomeAdvisor pro page
      );

      if (isProfile && !seen.has(href)) {
        seen.add(href);
        results.push(href);
      }
    }
    return results;
  }, domain);

  // If domain-specific selectors got nothing, fall back to link-text heuristics
  if (!urls.length) {
    const fallback = await page.evaluate((domain) => {
      const seen = new Set();
      const results = [];
      // Any link on the page that goes to the same domain and ends in .htm or .html
      for (const a of document.querySelectorAll('a[href]')) {
        const href = a.href || '';
        if (!href.includes(domain)) continue;
        if ((/\.html?$/.test(href) || href.includes('/pro/')) && !seen.has(href)) {
          seen.add(href);
          results.push(href);
        }
      }
      return results;
    }, domain);
    urls.push(...fallback);
  }

  console.log(`  Found ${urls.length} profile URLs on listing page`);
  return urls.slice(0, MAX_PROFILES_PER_QUERY);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function run() {
  if (!GHL_KEY && !DRY_RUN) {
    console.error('GHL_LOCATION_KEY not found in env or .env.local');
    process.exit(1);
  }

  const supabase = getSupabase();
  if (!supabase && !DRY_RUN) console.warn('Supabase not configured — skipping DB logging');
  if (DRY_RUN) console.log('DRY RUN — no GHL, SMS, or Supabase writes\n');

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    geolocation: { latitude: 39.9612, longitude: -82.9988 }, // Columbus, OH
    permissions: ['geolocation'],
  });

  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const seenPhones = new Set(); // dedup within this run
  const stats = { total: 0, newLeads: 0, duplicate: 0, noContact: 0, failed: 0, barrySent: 0 };

  const sources = SOURCE_ARG === 'angi'
    ? [{ source: 'angi', domain: 'angi.com' }]
    : SOURCE_ARG === 'homeadvisor'
    ? [{ source: 'homeadvisor', domain: 'homeadvisor.com' }]
    : [{ source: 'angi', domain: 'angi.com' }, { source: 'homeadvisor', domain: 'homeadvisor.com' }];

  try {
    for (const { source, domain } of sources) {
      for (const city of CITIES) {
        for (const niche of NICHES) {
          const listingUrl = source === 'angi'
            ? `https://www.angi.com/companylist/us/oh/${city.slug}/${niche.angiSlug}.htm`
            : `https://www.homeadvisor.com/c.${niche.haCategory}.${city.haSlug}.html`;

          console.log(`\n═══ [${source}] ${city.name} / ${niche.tag} ═══`);
          console.log(`    ${listingUrl}`);

          const profileUrls = await collectProfileUrls(page, listingUrl, domain);
          if (!profileUrls.length) {
            console.log('  No profiles found — skipping');
            continue;
          }

          for (let i = 0; i < profileUrls.length; i++) {
            const profileUrl = profileUrls[i];
            const label = `  [${i + 1}/${profileUrls.length}]`;

            let extracted;
            try {
              extracted = await extractProfileData(page, profileUrl);
            } catch (err) {
              console.log(`${label} ERROR loading profile: ${err.message.split('\n')[0]}`);
              stats.failed++;
              continue;
            }

            if (!extracted.businessName) {
              console.log(`${label} SKIP — no name extracted`);
              continue;
            }

            const phone   = normalizePhone(extracted.phone);
            const website = extracted.website;
            const pKey    = phone ? phoneKey(phone) : null;

            if (!phone && !website) {
              console.log(`${label} SKIP — ${extracted.businessName} (no contact info)`);
              stats.noContact++;
              continue;
            }

            if (pKey && seenPhones.has(pKey)) {
              console.log(`${label} SKIP — duplicate phone (${extracted.businessName})`);
              stats.duplicate++;
              continue;
            }
            if (pKey) seenPhones.add(pKey);

            console.log(
              `${label} ${extracted.businessName} | ${phone || '—'} | `
              + `${extracted.rating ? extracted.rating + '★' : 'no rating'} | ${extracted.reviewCount} reviews`
            );

            stats.total++;

            if (DRY_RUN) {
              stats.newLeads++;
              continue;
            }

            let contactId = null;
            let isNew = false;
            try {
              const upsertResult = await ghlUpsert(extracted, source, niche.tag, city.name);
              contactId = upsertResult.id;
              isNew = upsertResult.isNew;
              if (!isNew) stats.duplicate++;
              else stats.newLeads++;
            } catch (err) {
              console.error(`  GHL upsert failed: ${err.message}`);
              stats.failed++;
            }

            // Log to Supabase regardless of isNew (every scrape is a data point)
            await logToSupabase(supabase, {
              source,
              city: city.name,
              niche: niche.tag,
              business_name: extracted.businessName,
              phone: phone || null,
              website: website || null,
              rating: extracted.rating,
              review_count: extracted.reviewCount || 0,
              ghl_contact_id: contactId,
              is_new_contact: isNew,
            });

            // Send Barry SMS immediately for new contacts
            if (isNew && phone) {
              const message = buildBarrySMS(extracted.businessName, source);
              try {
                await ghlSendSMS(phone, message);
                await ghlAddTags(contactId, ['sms-sent']);
                await ghlAddNote(
                  contactId,
                  `🤖 Barry Outbound (${source === 'homeadvisor' ? 'HomeAdvisor' : 'Angi'})\n\nInitial SMS sent:\n"${message}"`
                );
                stats.barrySent++;
                console.log(`  ✓ Barry SMS sent`);
              } catch (err) {
                console.error(`  Barry SMS failed: ${err.message}`);
              }
            }

            await sleep(DELAY_MS);
          }

          await jitter(3000, 6000); // pause between search queries
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✓ Done`);
  console.log(`  Total profiles visited : ${stats.total}`);
  console.log(`  New leads pushed to GHL: ${stats.newLeads}`);
  console.log(`  Duplicates skipped     : ${stats.duplicate}`);
  console.log(`  No contact info        : ${stats.noContact}`);
  console.log(`  Errors                 : ${stats.failed}`);
  console.log(`  Barry SMS sent         : ${stats.barrySent}`);
  if (DRY_RUN) console.log('\n(DRY RUN — nothing was actually pushed)');
}

run().catch(err => { console.error(err); process.exit(1); });
