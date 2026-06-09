// scrape-facebook-groups.mjs
// Scrapes public Facebook groups for contractor pain-point posts, pushes hot leads
// to GHL, logs to Supabase, and fires Barry SMS immediately.
//
// Requires: npx playwright install chromium
//
// Env vars (reads .env.local):
//   FB_EMAIL, FB_PASSWORD          — Facebook login
//   GHL_LOCATION_KEY               — GHL private integration token
//   NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY      — Supabase service role key
//
// Session is cached in .fb-session.json; run headed once to log in, then use --headless.
//
// Usage:
//   node scripts/scrape-facebook-groups.mjs
//   node scripts/scrape-facebook-groups.mjs --headless
//   node scripts/scrape-facebook-groups.mjs --dry-run
//
// Local cron (runs daily at 8am):
//   0 8 * * * cd /path/to/thehypebox && node scripts/scrape-facebook-groups.mjs --headless >> /tmp/fb-leads.log 2>&1

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIES_FILE = path.join(__dirname, '..', '.fb-session.json');
const HEADLESS = process.argv.includes('--headless');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── env ────────────────────────────────────────────────────────────────────

try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
} catch { /* rely on shell env */ }

const FB_EMAIL      = process.env.FB_EMAIL;
const FB_PASSWORD   = process.env.FB_PASSWORD;
const GHL_KEY       = process.env.GHL_LOCATION_KEY;
const LOCATION_ID   = 'Ra79aZSYkl96uPQajjkJ';
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GHL_BASE      = 'https://services.leadconnectorhq.com';
const DELAY_MS      = 500;

// ─── config ─────────────────────────────────────────────────────────────────

const GROUP_QUERIES = [
  'Columbus contractors',
  'Ohio plumbers',
  'HVAC Ohio',
  'electricians Columbus',
  'home services Ohio',
];

const PAIN_POINTS = {
  'missed-calls': [
    'miss call', 'missed call', 'missing call', 'lost a call', 'losing calls',
    'calls go to voicemail', 'voicemail', "can't answer", 'cant answer',
    'miss jobs', 'missed jobs', 'losing jobs', 'lost jobs', 'rings through',
    'phone goes to', 'goes straight to', 'missed the call',
  ],
  'busy-season': [
    'busy season', 'slammed', 'swamped', 'overwhelmed', "can't keep up",
    'cant keep up', 'too busy', 'drowning in', 'backed up', 'booked solid',
    'turning down jobs', 'turning down work', 'fully booked',
  ],
  'need-coverage': [
    'need help answering', 'need someone to answer', 'answer my phones',
    'handle my calls', 'looking for receptionist', 'need office help',
    'answer the phone', 'someone to answer',
  ],
};

const BARRY_MESSAGES = {
  'missed-calls':  (first) => `Hey ${first}, saw your post about missing calls. We answer for contractors 24/7 so you never lose a job to voicemail. — Barry, TheHypeBox`,
  'busy-season':   (first) => `Hey ${first}, saw you're slammed. We handle your calls so you keep every job while you're on site. — Barry, TheHypeBox`,
  'need-coverage': (first) => `Hey ${first}, saw you need phone coverage. We handle contractor calls 24/7. Interested? — Barry, TheHypeBox`,
};

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function jitter(min = 800, max = 2200) { return sleep(Math.floor(Math.random() * (max - min) + min)); }

function classifyPost(text) {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(PAIN_POINTS)) {
    const matched = keywords.filter(kw => lower.includes(kw));
    if (matched.length > 0) return { category, matched };
  }
  return null;
}

function extractPhone(text) {
  const m = text.match(/\b(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/);
  if (!m) return '';
  const digits = m[1].replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return '';
}

function isWithinDays(timestampText, days = 7) {
  const lower = (timestampText || '').toLowerCase();
  if (/hours?\s*ago|mins?\s*ago|minutes?\s*ago|just\s*now|moments?\s*ago/.test(lower)) return true;
  if (lower.includes('yesterday')) return true;
  const daysMatch = lower.match(/(\d+)\s*days?\s*ago/);
  if (daysMatch) return parseInt(daysMatch[1]) <= days;
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (dayNames.some(d => lower.includes(d))) return true;
  const monthMatch = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d+)/);
  if (monthMatch) {
    const now = new Date();
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const monthIdx = months.findIndex(m => monthMatch[1].startsWith(m));
    const day = parseInt(monthMatch[2]);
    const postDate = new Date(now.getFullYear(), monthIdx, day);
    const diff = (now - postDate) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= days;
  }
  return false;
}

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return '';
}

// ─── supabase ────────────────────────────────────────────────────────────────

async function checkPostExists(postUrl) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !postUrl) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/facebook_leads?post_url=eq.${encodeURIComponent(postUrl)}&select=id&limit=1`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await res.json().catch(() => []);
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

async function logToSupabase(record) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[supabase] env not set — skipping log');
    return null;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/facebook_leads`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(record),
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) { console.error('[supabase] insert error:', JSON.stringify(data).slice(0, 200)); return null; }
    return data[0] || null;
  } catch (err) { console.error('[supabase] exception:', err.message); return null; }
}

async function markSmsSent(postUrl, contactId) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !postUrl) return;
  await fetch(
    `${SUPABASE_URL}/rest/v1/facebook_leads?post_url=eq.${encodeURIComponent(postUrl)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ barry_sms_sent: true, barry_sms_sent_at: new Date().toISOString(), ghl_contact_id: contactId }),
    }
  ).catch(() => {});
}

// ─── GHL ─────────────────────────────────────────────────────────────────────

async function upsertGHLContact({ posterName, businessName, phone, painPoint, matchedKeywords, postContent, groupQuery }, attempt = 1) {
  const parts = (posterName || '').trim().split(/\s+/);
  const firstName = parts[0] || 'Contractor';
  const lastName = parts.slice(1).join(' ');

  const body = {
    locationId: LOCATION_ID,
    firstName,
    lastName,
    name: businessName || posterName || 'Facebook Lead',
    tags: ['facebook-group-lead', 'hot-prospect', `fb-pain-${painPoint}`],
    source: 'facebook-group-scraper',
  };
  if (businessName) body.companyName = businessName;
  if (phone) body.phone = phone;

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
    if (attempt > 3) throw new Error('GHL rate limit exceeded');
    await sleep(5000 * attempt);
    return upsertGHLContact({ posterName, businessName, phone, painPoint, matchedKeywords, postContent, groupQuery }, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `GHL HTTP ${res.status}`);

  const contactId = data.contact?.id || data.id;

  if (contactId && postContent) {
    await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GHL_KEY}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: `📘 Facebook Group Lead\n\nGroup Search: ${groupQuery}\nPain Point: ${painPoint}\nKeywords Matched: ${matchedKeywords.join(', ')}\n\nPost Content:\n"${postContent.slice(0, 800)}"`,
      }),
      signal: AbortSignal.timeout(8000),
    }).catch(err => console.error('[ghl] note failed:', err.message));
  }

  return { id: contactId, isNew: data.isNew ?? false };
}

async function sendBarrySMS(phone, painPoint, posterName) {
  if (!phone || !GHL_KEY) return false;
  const first = (posterName || '').split(/\s+/)[0] || 'there';
  const msgFn = BARRY_MESSAGES[painPoint] || BARRY_MESSAGES['missed-calls'];
  const message = msgFn(first);

  // Find contact by phone
  const searchRes = await fetch(`${GHL_BASE}/contacts/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      locationId: LOCATION_ID,
      pageLimit: 1,
      filters: [{ field: 'phone', operator: 'eq', value: phone }],
    }),
    signal: AbortSignal.timeout(10000),
  });

  const searchData = await searchRes.json().catch(() => ({}));
  const contactId = searchData?.contacts?.[0]?.id;
  if (!contactId) { console.warn(`[barry] no GHL contact for ${phone}`); return false; }

  const smsRes = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      locationId: LOCATION_ID,
      message,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!smsRes.ok) {
    const errData = await smsRes.json().catch(() => ({}));
    throw new Error(errData.message || `SMS ${smsRes.status}`);
  }

  console.log(`  [barry] SMS sent: "${message}"`);
  return contactId;
}

// ─── Facebook ────────────────────────────────────────────────────────────────

async function loadCookies() {
  try {
    if (fs.existsSync(COOKIES_FILE)) return JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
  } catch {}
  return null;
}

async function saveCookies(context) {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  console.log('[fb] Session saved to .fb-session.json');
}

async function checkLoggedIn(page) {
  try {
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    const loggedIn = await page.evaluate(() => {
      // Logged-in Facebook shows a nav with profile link; logged-out shows login form
      return (
        !!document.querySelector('[aria-label="Your profile"]') ||
        !!document.querySelector('[data-pagelet="LeftRail"]') ||
        !!document.querySelector('div[aria-label="Facebook"][role="navigation"]') ||
        !document.querySelector('input[name="email"]')
      );
    });
    return loggedIn;
  } catch { return false; }
}

async function doLogin(page, context) {
  if (!FB_EMAIL || !FB_PASSWORD) {
    throw new Error('FB_EMAIL and FB_PASSWORD must be set in .env.local to run Facebook scraper');
  }

  console.log('[fb] Logging in...');
  await page.goto('https://www.facebook.com/login/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await jitter(1000, 2000);

  await page.fill('input[name="email"]', FB_EMAIL);
  await jitter(500, 900);
  await page.fill('input[name="pass"]', FB_PASSWORD);
  await jitter(500, 900);
  await page.click('button[name="login"]');
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
  await jitter(2000, 4000);

  const url = page.url();
  if (url.includes('checkpoint') || url.includes('two_factor') || url.includes('login')) {
    // Save whatever cookies we have so user can complete 2FA in a browser session
    await saveCookies(context);
    throw new Error(
      'Facebook login blocked (checkpoint or 2FA). ' +
      'Log in manually in a real browser, export cookies to .fb-session.json, then re-run.'
    );
  }

  await saveCookies(context);
  console.log('[fb] Login successful');
}

async function searchForGroups(page, query) {
  const encoded = encodeURIComponent(query);
  await page.goto(`https://www.facebook.com/groups/search/?q=${encoded}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await jitter(2000, 3500);

  const groupLinks = await page.evaluate(() => {
    const seen = new Set();
    const links = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
    return links
      .map(a => a.href)
      .filter(href => {
        const m = href.match(/facebook\.com\/groups\/([^/?#]+)/);
        if (!m) return false;
        const gid = m[1];
        if (['search', 'feed', 'discover', 'create', 'joins', 'requests'].includes(gid)) return false;
        if (seen.has(gid)) return false;
        seen.add(gid);
        return true;
      })
      .slice(0, 3);
  });

  return groupLinks;
}

async function scrapeGroupPosts(page, groupUrl) {
  await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await jitter(2000, 4000);

  // Dismiss any pop-ups (login nudges, cookie banners)
  for (const sel of ['[aria-label="Close"]', '[data-testid="cookie-policy-manage-dialog-accept-button"]']) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
      await el.click().catch(() => {});
      await sleep(500);
    }
  }

  // Click "See More" on truncated posts before extracting
  const seeMoreButtons = page.locator('div[role="button"]:has-text("See more"), div[role="button"]:has-text("See More")');
  const btnCount = await seeMoreButtons.count().catch(() => 0);
  for (let i = 0; i < Math.min(btnCount, 10); i++) {
    await seeMoreButtons.nth(i).click().catch(() => {});
    await sleep(300);
  }

  const posts = [];
  let prevCount = 0;
  let staleTicks = 0;

  while (staleTicks < 4 && posts.length < 30) {
    const newPosts = await page.evaluate(() => {
      const results = [];
      // Collect all top-level divs in known feed containers
      const feedCandidates = [
        ...document.querySelectorAll('[data-pagelet="GroupFeed"] > div > div'),
        ...document.querySelectorAll('div[role="feed"] > div'),
      ];
      // Fallback: any large text block that looks like a post
      const allDivs = feedCandidates.length ? feedCandidates
        : Array.from(document.querySelectorAll('div[data-visualcompletion="ignore-dynamic"]'));

      for (const el of allDivs) {
        // Post text: find longest dir="auto" child
        let text = '';
        const textEls = el.querySelectorAll('div[dir="auto"]');
        for (const t of textEls) {
          const content = (t.innerText || '').trim();
          if (content.length > text.length) text = content;
        }
        if (!text || text.length < 40) continue;

        // Timestamp
        let timestamp = '';
        const timeEl = el.querySelector(
          'abbr[data-utime], a[aria-label*="ago"], a[aria-label*="hour"], a[aria-label*="day"], span[title*="ago"]'
        );
        if (timeEl) {
          timestamp = timeEl.getAttribute('aria-label') || timeEl.getAttribute('title') || timeEl.innerText || '';
        }
        if (!timestamp) {
          const m = (el.innerText || '').match(
            /(\d+\s*(hours?|minutes?|days?)\s*ago|yesterday|just\s*now|\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|[A-Z][a-z]+ \d+)/i
          );
          if (m) timestamp = m[0];
        }

        // Author
        let author = '';
        const authorEl = el.querySelector('h3 a, h2 a, strong a');
        if (authorEl) author = (authorEl.innerText || '').trim();

        // Post URL
        let postUrl = '';
        const postLink = el.querySelector('a[href*="/posts/"], a[href*="story_fbid"], a[href*="permalink"]');
        if (postLink) postUrl = postLink.href || '';

        results.push({ text, timestamp, author, postUrl });
      }
      return results;
    });

    const existingKeys = new Set(posts.map(p => p.text.slice(0, 80)));
    let added = 0;
    for (const p of newPosts) {
      const key = p.text.slice(0, 80);
      if (!existingKeys.has(key)) {
        posts.push(p);
        existingKeys.add(key);
        added++;
      }
    }

    if (posts.length === prevCount) {
      staleTicks++;
    } else {
      staleTicks = 0;
      prevCount = posts.length;
    }

    await page.evaluate(() => window.scrollBy(0, 1400));
    await jitter(1500, 3000);
  }

  return posts;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  if (!FB_EMAIL || !FB_PASSWORD) {
    console.error('ERROR: FB_EMAIL and FB_PASSWORD must be set in .env.local');
    process.exit(1);
  }
  if (!GHL_KEY && !DRY_RUN) {
    console.error('ERROR: GHL_LOCATION_KEY must be set in .env.local');
    process.exit(1);
  }

  if (DRY_RUN) console.log('DRY RUN — no contacts will be pushed\n');

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
  });

  // Mask webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  // Load saved session cookies
  const savedCookies = await loadCookies();
  if (savedCookies) {
    await context.addCookies(savedCookies);
    console.log('[fb] Loaded saved session');
  }

  const page = await context.newPage();
  const stats = { posts_scanned: 0, matches: 0, pushed: 0, sms_sent: 0, errors: 0 };

  try {
    const loggedIn = await checkLoggedIn(page);
    if (!loggedIn) await doLogin(page, context);

    for (const query of GROUP_QUERIES) {
      console.log(`\n═══ Searching: "${query}" ═══`);

      let groupLinks;
      try {
        groupLinks = await searchForGroups(page, query);
        console.log(`  Found ${groupLinks.length} groups`);
      } catch (err) {
        console.error(`  Group search failed: ${err.message}`);
        continue;
      }

      for (const groupUrl of groupLinks) {
        console.log(`  Group: ${groupUrl}`);
        let posts;
        try {
          posts = await scrapeGroupPosts(page, groupUrl);
          console.log(`  ${posts.length} posts loaded`);
        } catch (err) {
          console.error(`  Scrape failed: ${err.message}`);
          stats.errors++;
          continue;
        }

        for (const post of posts) {
          stats.posts_scanned++;

          // Date filter
          if (!isWithinDays(post.timestamp, 7)) continue;

          // Keyword filter
          const match = classifyPost(post.text);
          if (!match) continue;

          stats.matches++;
          const phone = extractPhone(post.text);

          console.log(`\n  MATCH [${match.category}] — ${post.author || 'Unknown'}`);
          console.log(`    Keywords: ${match.matched.join(', ')}`);
          console.log(`    Phone: ${phone || 'none found'}`);
          console.log(`    Preview: ${post.text.slice(0, 120).replace(/\n/g, ' ')}...`);

          // Deduplicate against Supabase
          const alreadyLogged = await checkPostExists(post.postUrl);
          if (alreadyLogged) {
            console.log('    SKIP — already in Supabase');
            continue;
          }

          if (DRY_RUN) {
            console.log('    DRY RUN — skipping GHL push and SMS');
            continue;
          }

          // Push to GHL
          let contactId = null;
          try {
            const result = await upsertGHLContact({
              posterName: post.author,
              businessName: null,
              phone: normalizePhone(phone),
              painPoint: match.category,
              matchedKeywords: match.matched,
              postContent: post.text,
              groupQuery: query,
            });
            contactId = result.id;
            stats.pushed++;
            console.log(`    GHL: ${contactId} (${result.isNew ? 'new' : 'existing'})`);
          } catch (err) {
            console.error(`    GHL push failed: ${err.message}`);
            stats.errors++;
          }

          await sleep(DELAY_MS);

          // Log to Supabase
          await logToSupabase({
            group_query: query,
            post_url: post.postUrl || null,
            poster_name: post.author || null,
            phone: normalizePhone(phone) || null,
            post_content: post.text.slice(0, 2000),
            pain_point: match.category,
            matched_keywords: match.matched,
            ghl_contact_id: contactId,
            barry_sms_sent: false,
          });

          // Send Barry SMS immediately (only if we have a phone number)
          if (phone && contactId) {
            try {
              await sendBarrySMS(normalizePhone(phone), match.category, post.author);
              await markSmsSent(post.postUrl, contactId);
              stats.sms_sent++;
            } catch (err) {
              console.error(`    Barry SMS failed: ${err.message}`);
            }
          } else {
            console.log('    No phone — Barry SMS skipped (Vercel cron will follow up)');
          }
        }

        await jitter(4000, 8000); // Pause between groups
      }

      await jitter(5000, 10000); // Pause between queries
    }
  } finally {
    await saveCookies(context);
    await browser.close();
  }

  console.log('\n═══ Done ═══');
  console.log(`Posts scanned: ${stats.posts_scanned}`);
  console.log(`Matches found: ${stats.matches}`);
  console.log(`GHL contacts:  ${stats.pushed}`);
  console.log(`Barry SMS:     ${stats.sms_sent}`);
  console.log(`Errors:        ${stats.errors}`);
}

run().catch(err => { console.error('[fatal]', err.message); process.exit(1); });
