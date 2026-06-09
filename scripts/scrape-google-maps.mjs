// scrape-google-maps.mjs
// Scrapes Google Maps for contractor businesses in Columbus, OH across four niches.
// Saves results incrementally to scripts/scraped-leads.json so the run can be resumed.
//
// First-time setup: npx playwright install chromium
//
// Usage:
//   node scripts/scrape-google-maps.mjs            # runs with visible browser (recommended first run)
//   node scripts/scrape-google-maps.mjs --headless  # runs headless

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, 'scraped-leads.json');
const HEADLESS = process.argv.includes('--headless');
const MAX_RESULTS_PER_QUERY = 100; // scroll until this many are in the feed

const SEARCHES = [
  { query: 'plumbers Columbus Ohio', tag: 'plumber' },
  { query: 'HVAC companies Columbus Ohio', tag: 'hvac' },
  { query: 'electricians Columbus Ohio', tag: 'electrician' },
  { query: 'concrete contractors Columbus Ohio', tag: 'concrete' },
  { query: 'concrete coating Columbus Ohio', tag: 'concrete' },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(min = 800, max = 2200) { return sleep(Math.floor(Math.random() * (max - min) + min)); }

function splitName(businessName) {
  const parts = businessName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function loadResults() {
  if (fs.existsSync(OUTPUT_FILE)) {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')); } catch { return []; }
  }
  return [];
}

function saveResults(results) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
}

// ─── scraper ────────────────────────────────────────────────────────────────

async function dismissOverlays(page) {
  const candidates = [
    'button[aria-label="Reject all"]',
    'button[aria-label="Accept all"]',
    'form[action*="consent"] button:last-child',
    '[jsname="higCR"]', // Google's "I agree" on consent screen
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
      await el.click().catch(() => {});
      await sleep(1000);
    }
  }
}

async function collectResultUrls(page, query) {
  console.log(`\n  Navigating to: ${query}`);
  const encoded = encodeURIComponent(query);
  await page.goto(`https://www.google.com/maps/search/${encoded}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  await jitter(2000, 4000);
  await dismissOverlays(page);

  // Wait for the results feed
  const feedSel = 'div[role="feed"]';
  const hasFeed = await page.waitForSelector(feedSel, { timeout: 20000 })
    .then(() => true).catch(() => false);

  if (!hasFeed) {
    console.log('  No results feed found — skipping query');
    return [];
  }

  // Scroll the feed to load more results
  let prevCount = 0;
  let staleTicks = 0;

  while (staleTicks < 4) {
    const links = page.locator('div[role="feed"] a.hfpxzc');
    const count = await links.count();

    if (count >= MAX_RESULTS_PER_QUERY) break;

    const endOfList = await page.locator('text="You\'ve reached the end of the list"')
      .isVisible({ timeout: 300 }).catch(() => false);
    if (endOfList) break;

    if (count === prevCount) {
      staleTicks++;
    } else {
      staleTicks = 0;
      prevCount = count;
    }

    // Scroll the feed panel
    await page.evaluate(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (feed) feed.scrollBy(0, 1200);
    });
    await jitter(1200, 2500);
  }

  // Collect hrefs
  const links = page.locator('div[role="feed"] a.hfpxzc');
  const count = await links.count();
  const urls = [];

  for (let i = 0; i < count; i++) {
    const href = await links.nth(i).getAttribute('href').catch(() => null);
    if (href) {
      const absolute = href.startsWith('http') ? href : `https://www.google.com${href}`;
      urls.push(absolute);
    }
  }

  console.log(`  Collected ${urls.length} result URLs`);
  return urls;
}

async function scrapeDetailPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await jitter(1500, 3000);

  return page.evaluate(() => {
    // Name
    const name = document.querySelector('h1.DUwDvf')?.textContent?.trim()
      || document.querySelector('h1')?.textContent?.trim()
      || '';

    // Rating — first aria-hidden span inside the F7nice div
    const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]');
    const rating = ratingEl ? parseFloat(ratingEl.textContent) || null : null;

    // Info items — Google Maps wraps address/phone/website in buttons/links
    // with data-item-id attributes
    let address = '', phone = '', website = '';

    // Address
    const addrBtn = document.querySelector('button[data-item-id="address"]');
    if (addrBtn) {
      address = addrBtn.querySelector('div.Io6YTe')?.textContent?.trim()
        || addrBtn.querySelector('[class*="Io6YTe"]')?.textContent?.trim()
        || '';
    }
    // Fallback: aria-label approach
    if (!address) {
      document.querySelectorAll('button').forEach(btn => {
        const lbl = (btn.getAttribute('aria-label') || '').toLowerCase();
        if ((lbl.includes('address') || lbl.includes('located')) && !address) {
          const inner = btn.querySelector('div.Io6YTe') || btn.querySelector('[class*="Io6YTe"]');
          address = inner?.textContent?.trim() || '';
        }
      });
    }

    // Phone — data-item-id starts with "phone:tel:"
    const phoneBtn = document.querySelector('button[data-item-id^="phone:tel:"]');
    if (phoneBtn) {
      phone = phoneBtn.querySelector('div.Io6YTe')?.textContent?.trim()
        || phoneBtn.querySelector('[class*="Io6YTe"]')?.textContent?.trim()
        || '';
    }
    if (!phone) {
      document.querySelectorAll('button').forEach(btn => {
        const lbl = (btn.getAttribute('aria-label') || '').toLowerCase();
        if ((lbl.includes('phone') || lbl.startsWith('call ')) && !phone) {
          const inner = btn.querySelector('div.Io6YTe') || btn.querySelector('[class*="Io6YTe"]');
          phone = inner?.textContent?.trim() || '';
        }
      });
    }

    // Website
    const wsLink = document.querySelector('a[data-item-id="authority"]');
    if (wsLink) {
      let href = wsLink.getAttribute('href') || '';
      // Google sometimes wraps in a tracking redirect — unwrap it
      if (href.includes('google.com/url')) {
        try {
          href = new URL(href).searchParams.get('q') || href;
        } catch { /* keep raw href */ }
      }
      website = href;
    }
    if (!website) {
      const wsAlt = document.querySelector('a[aria-label*="website" i]');
      if (wsAlt) website = wsAlt.href || '';
    }

    return { name, rating, address, phone, website };
  });
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  // Load previously scraped results
  const allResults = loadResults();
  const scrapedQueries = new Set(allResults.map(r => r._query).filter(Boolean));
  const scrapedUrls = new Set(allResults.map(r => r._url).filter(Boolean));

  console.log(`Loaded ${allResults.length} existing results`);
  if (allResults.length) {
    console.log('Already-scraped queries:', [...scrapedQueries].join(', ') || 'none');
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    geolocation: { latitude: 39.9612, longitude: -82.9988 }, // Columbus, OH
    permissions: ['geolocation'],
  });

  const page = await context.newPage();

  // Mask automation signals
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    for (const { query, tag } of SEARCHES) {
      if (scrapedQueries.has(query)) {
        console.log(`\nSkipping "${query}" — already scraped`);
        continue;
      }

      console.log(`\n═══ ${query} (${tag}) ═══`);

      const urls = await collectResultUrls(page, query);
      if (!urls.length) continue;

      let added = 0;
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        if (scrapedUrls.has(url)) {
          console.log(`  [${i + 1}/${urls.length}] SKIP — already have this URL`);
          continue;
        }

        try {
          const detail = await scrapeDetailPage(page, url);

          if (!detail.name) {
            console.log(`  [${i + 1}/${urls.length}] SKIP — no name found`);
            continue;
          }

          const { firstName, lastName } = splitName(detail.name);
          const record = {
            businessName: detail.name,
            firstName,
            lastName,
            phone: detail.phone || '',
            website: detail.website || '',
            address: detail.address || '',
            rating: detail.rating,
            tag,
            source: 'google-maps',
            _query: query,
            _url: url,
            _ghlPushed: false,
          };

          allResults.push(record);
          scrapedUrls.add(url);
          added++;

          console.log(
            `  [${i + 1}/${urls.length}] ${detail.name} | ${detail.phone || 'no phone'} | `
            + `${detail.rating ? detail.rating + '★' : 'no rating'}`
          );
        } catch (err) {
          console.log(`  [${i + 1}/${urls.length}] ERROR — ${err.message.split('\n')[0]}`);
        }

        // Save after every 5 records
        if ((i + 1) % 5 === 0) saveResults(allResults);

        await jitter(1000, 2500);
      }

      // Mark this query as complete and save
      scrapedQueries.add(query);
      saveResults(allResults);
      console.log(`\n  Added ${added} new records for "${query}" — total so far: ${allResults.length}`);

      await jitter(4000, 8000); // Longer pause between search queries
    }
  } finally {
    await browser.close();
  }

  // Deduplicate by phone number (keep first occurrence)
  const seen = new Set();
  const deduped = allResults.filter(r => {
    const key = r.phone && r.phone.replace(/\D/g, '').slice(-10);
    if (key && key.length === 10) {
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  });

  saveResults(deduped);
  console.log(`\n✓ Done — ${deduped.length} unique leads saved to ${OUTPUT_FILE}`);
  console.log(`  (${allResults.length - deduped.length} duplicate phone numbers removed)`);
  console.log('\nNext step: node scripts/push-to-ghl.mjs');
}

run().catch(err => { console.error(err); process.exit(1); });
