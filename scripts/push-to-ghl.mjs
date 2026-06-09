// push-to-ghl.mjs
// Reads scripts/scraped-leads.json and upserts each business into GoHighLevel.
// Marks each record with _ghlPushed: true so the run can be safely resumed.
//
// Usage:
//   node scripts/push-to-ghl.mjs
//   node scripts/push-to-ghl.mjs --dry-run   # print contacts without pushing
//
// Env vars (reads from .env.local):
//   GHL_LOCATION_KEY  — Location-level Private Integration Token (pit-...)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── config ─────────────────────────────────────────────────────────────────

try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const raw = line.slice(eq + 1).trim();
      const v = raw.replace(/^["']|["']$/g, ''); // strip surrounding quotes
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
} catch { /* no .env.local — rely on shell env */ }

const GHL_KEY        = process.env.GHL_LOCATION_KEY;
const LOCATION_ID    = 'Ra79aZSYkl96uPQajjkJ'; // Cold outreach location
const GHL_BASE       = 'https://services.leadconnectorhq.com';
const INPUT_FILE     = path.join(__dirname, 'scraped-leads.json');
const DRY_RUN        = process.argv.includes('--dry-run');

// GHL v2 rate limit: ~100 req/10s. 350ms delay keeps us safely under.
const DELAY_MS       = 350;
const RETRY_DELAY_MS = 5000; // wait after a 429
const MAX_RETRIES    = 3;

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return raw; // Return as-is if we can't normalize
}

function parseAddress(fullAddress) {
  // "123 Main St, Columbus, OH 43215, USA" → parts
  const parts = fullAddress.split(',').map(s => s.trim());
  const address1 = parts[0] || '';
  const city = parts[1] || '';
  // State + ZIP are often together: "OH 43215"
  const stateZip = parts[2] || '';
  const [state, postalCode] = stateZip.trim().split(/\s+/);
  return { address1, city, state: state || '', postalCode: postalCode || '' };
}

async function upsertContact(record, attempt = 1) {
  const { address1, city, state, postalCode } = parseAddress(record.address);
  const phone = normalizePhone(record.phone);

  const body = {
    locationId: LOCATION_ID,
    firstName: record.firstName,
    lastName:  record.lastName,
    name:      record.businessName,
    tags:      [record.tag, 'google-maps-scraped'],
    source:    'google-maps-scraper',
  };

  if (phone)      body.phone      = phone;
  if (record.website) body.website = record.website;
  if (address1)   body.address1   = address1;
  if (city)       body.city       = city;
  if (state)      body.state      = state;
  if (postalCode) body.postalCode = postalCode;
  // Columbus, OH is always USA
  body.country = 'US';

  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Rate limit — back off and retry
  if (res.status === 429) {
    if (attempt > MAX_RETRIES) throw new Error('Rate limited after max retries');
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10) * 1000;
    const wait = Math.max(retryAfter, RETRY_DELAY_MS) * attempt;
    console.log(`  Rate limited — waiting ${wait / 1000}s before retry ${attempt}/${MAX_RETRIES}`);
    await sleep(wait);
    return upsertContact(record, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.msg || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data.contact?.id || data.id || 'unknown-id';
}

// ─── main ───────────────────────────────────────────────────────────────────

async function run() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`No scraped-leads.json found. Run scrape-google-maps.mjs first.`);
    process.exit(1);
  }

  if (!GHL_KEY && !DRY_RUN) {
    console.error('GHL_LOCATION_KEY not found in env or .env.local');
    process.exit(1);
  }

  const leads = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const pending = leads.filter(r => !r._ghlPushed);
  const alreadyDone = leads.length - pending.length;

  console.log(`\nLoaded ${leads.length} leads — ${alreadyDone} already pushed, ${pending.length} pending`);
  if (DRY_RUN) console.log('DRY RUN — no contacts will be created\n');

  const stats = { pushed: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < pending.length; i++) {
    const record = pending[i];
    const label = `[${i + 1}/${pending.length}] ${record.businessName}`;

    if (!record.phone && !record.website) {
      console.log(`${label} — SKIP (no phone or website)`);
      stats.skipped++;
      record._ghlPushed = 'skipped-no-contact-info';
      continue;
    }

    if (DRY_RUN) {
      console.log(
        `${label}\n`
        + `  tag=${record.tag} phone=${record.phone || '—'} website=${record.website || '—'}\n`
        + `  address=${record.address || '—'}`
      );
      stats.pushed++;
      continue;
    }

    try {
      const contactId = await upsertContact(record);
      console.log(`${label} — PUSHED (${contactId})`);
      record._ghlPushed = contactId;
      stats.pushed++;
    } catch (err) {
      console.error(`${label} — FAILED: ${err.message}`);
      record._ghlPushed = false; // Keep false so it retries on next run
      stats.failed++;
    }

    // Save progress every 10 records
    if ((i + 1) % 10 === 0) fs.writeFileSync(INPUT_FILE, JSON.stringify(leads, null, 2));

    await sleep(DELAY_MS);
  }

  // Final save
  fs.writeFileSync(INPUT_FILE, JSON.stringify(leads, null, 2));

  console.log(`\n✓ Done — ${stats.pushed} pushed, ${stats.skipped} skipped, ${stats.failed} failed`);
  if (stats.failed > 0) {
    console.log('Re-run this script to retry failures (failed records have _ghlPushed: false)');
  }
}

run().catch(err => { console.error(err); process.exit(1); });
