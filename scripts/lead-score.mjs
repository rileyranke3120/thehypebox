// scripts/lead-score.mjs
// Pulls contacts from GHL location Ra79aZSYkl96uPQajjkJ tagged with
// plumber/hvac/electrician/concrete, scores them 1-100 using rule-based
// heuristics + Claude analysis, updates each GHL contact with a lead_score
// custom field, hot/warm/cold tag, and a one-sentence note, then outputs
// lead_scores.json sorted highest to lowest.
//
// Usage:
//   node scripts/lead-score.mjs                # full run
//   node scripts/lead-score.mjs --dry-run      # score without touching GHL
//
// Env (reads .env.local):
//   GHL_AGENCY_KEY     — pit-... agency PIT token
//   ANTHROPIC_API_KEY  — sk-ant-... key

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── env ─────────────────────────────────────────────────────────────────────
try {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
} catch { /* rely on shell env */ }

// Location Ra79aZSYkl96uPQajjkJ uses GHL_API_KEY (location PIT), not the agency key
const GHL_KEY       = process.env.GHL_API_KEY || process.env.GHL_AGENCY_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const LOCATION_ID   = 'Ra79aZSYkl96uPQajjkJ';
const GHL_BASE      = 'https://services.leadconnectorhq.com';
const TARGET_TAGS   = new Set(['plumber', 'hvac', 'electrician', 'concrete']);
const DRY_RUN       = process.argv.includes('--dry-run');
const OUTPUT_FILE   = path.join(__dirname, 'lead_scores.json');
const DELAY_MS      = 400;    // stay under GHL's 100 req/10s limit
const RETRY_MS      = 5000;
const MAX_RETRIES   = 3;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── scraped-leads cross-reference (for Google rating) ───────────────────────
let scrapedLeads = [];
try { scrapedLeads = JSON.parse(fs.readFileSync(path.join(__dirname, 'scraped-leads.json'), 'utf8')); } catch {}

const byPhone = {};
const byName  = {};
for (const lead of scrapedLeads) {
  const digits = (lead.phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length === 10) byPhone[digits] = lead;
  if (lead.businessName) byName[lead.businessName.toLowerCase().trim()] = lead;
}

function findScraped(contact) {
  const digits = (contact.phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length === 10 && byPhone[digits]) return byPhone[digits];
  const key = (contact.name || contact.companyName || '').toLowerCase().trim();
  return key ? (byName[key] ?? null) : null;
}

// ─── GHL helpers ─────────────────────────────────────────────────────────────
async function ghl(endpoint, opts = {}, attempt = 1) {
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

  if (res.status === 429) {
    if (attempt > MAX_RETRIES) throw new Error('Rate limited — max retries exceeded');
    const wait = RETRY_MS * attempt;
    console.log(`  429 rate limit — waiting ${wait / 1000}s (attempt ${attempt})`);
    await sleep(wait);
    return ghl(endpoint, opts, attempt + 1);
  }

  return res;
}

async function fetchContactsByTag(tag) {
  const all = [];
  let cursor = null;

  while (true) {
    const p = new URLSearchParams({ locationId: LOCATION_ID, tag, limit: '100' });
    if (cursor) p.set('startAfterId', cursor);

    const res = await ghl(`/contacts/?${p}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status} fetching contacts (tag=${tag})`);

    const batch = data.contacts || [];
    all.push(...batch);
    process.stdout.write(`\r  [${tag}] Fetched ${all.length}...`);

    if (batch.length < 100) break;
    cursor = batch[batch.length - 1].id;
    await sleep(DELAY_MS);
  }

  console.log();
  return all;
}

async function ensureLeadScoreField() {
  const res = await ghl(`/locations/${LOCATION_ID}/customFields`);
  const data = await res.json().catch(() => ({}));
  const fields = data.customFields || [];

  const existing = fields.find(f =>
    f.name?.toLowerCase().replace(/\s+/g, '_') === 'lead_score' ||
    f.fieldKey?.includes('lead_score')
  );
  if (existing) {
    console.log(`  Custom field exists: "${existing.name}" (key: ${existing.fieldKey})`);
    return existing;
  }

  console.log('  Creating "Lead Score" custom field...');
  const createRes = await ghl(`/locations/${LOCATION_ID}/customFields`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Lead Score', dataType: 'NUMERICAL' }),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok) throw new Error(createData.message || `HTTP ${createRes.status} creating field`);
  const field = createData.customField || createData;
  console.log(`  Created field: key=${field.fieldKey}`);
  return field;
}

async function updateContactField(id, fieldKey, value) {
  const res = await ghl(`/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      customFields: [{ key: fieldKey, field_value: String(value) }],
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || `HTTP ${res.status}`);
  }
}

async function replaceTierTag(id, newTag) {
  // Remove any existing tier tags first (ignore errors — they might not exist)
  await ghl(`/contacts/${id}/tags`, {
    method: 'DELETE',
    body: JSON.stringify({ tags: ['hot-lead', 'warm-lead', 'cold-lead'] }),
  }).catch(() => {});
  await sleep(200);

  const res = await ghl(`/contacts/${id}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags: [newTag] }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || `HTTP ${res.status}`);
  }
}

async function addNote(id, body) {
  const res = await ghl(`/contacts/${id}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || `HTTP ${res.status}`);
  }
}

// ─── scoring logic ───────────────────────────────────────────────────────────
const SOLO_FIRST_NAMES = /^(mike|michael|john|dave|david|bob|robert|jim|james|tom|thomas|joe|joseph|chris|christopher|brian|kevin|mark|paul|steve|steven|jeff|jeffrey|bill|william|rick|richard|dan|daniel|frank|scott|gary|larry|kenny|kenneth|eric|eric|sam|samuel|ray|raymond|ron|ronald|tim|timothy|greg|gregory|tony|anthony|matt|matthew|jason|ryan|justin|brad|charlie|chuck|carl|carlos|al|albert|fred|doug|douglas|dennis|roger|wayne|jack|henry|harry|pete|peter|joe|joey|corey|travis|chad|cody|brett|derek|adam|aaron|alex|kyle|jake|drew|zach|zachary|nathan|nate|ethan|caleb|tyler|trevor|blake|hunter|austin)\b/i;
const SOLO_POSSESSIVE  = /\w+'s\s/i;
const CORPORATE_SUFFIX = /\b(inc\.?|llc\.?|corp\.?|ltd\.?|group|systems|solutions|enterprises|associates|industries|national|regional|professional)\b/i;

function isSoloOperator(name) {
  if (CORPORATE_SUFFIX.test(name)) return false;
  if (SOLO_POSSESSIVE.test(name))  return true;
  if (SOLO_FIRST_NAMES.test(name)) return true;
  return false;
}

function baseScore(contact, scraped) {
  let score = 0;
  const pts = [];

  // Phone (+20 — required to close)
  if (contact.phone) { score += 20; pts.push('phone +20'); }

  // Website vs no website
  const hasWebsite = !!(contact.website || scraped?.website);
  if (hasWebsite) { score += 15; pts.push('website +15'); }
  else            { score += 10; pts.push('no website +10'); }

  // Google rating
  const rating = scraped?.rating ?? null;
  if (rating !== null) {
    if (rating >= 4.0)  { score += 20; pts.push(`rating ${rating}★ +20`); }
    else if (rating < 3.5) { score += 10; pts.push(`rating ${rating}★ +10`); }
    else                { pts.push(`rating ${rating}★ +0`); }
  } else {
    pts.push('rating unknown');
  }

  // Review count — not captured during scrape; skipped
  // +15 if >10 reviews, but data unavailable

  // Solo operator (+10)
  const name = contact.name || contact.companyName || '';
  if (isSoloOperator(name)) { score += 10; pts.push('solo operator +10'); }

  return { score: Math.max(1, Math.min(100, score)), pts, rating, hasWebsite };
}

// ─── Claude analysis ─────────────────────────────────────────────────────────
async function claude(contact, scraped, base, pts) {
  const name   = contact.name || contact.companyName || 'Unknown';
  const trade  = contact.tags?.find(t => TARGET_TAGS.has(t)) || 'contractor';
  const rating = scraped?.rating ?? 'unknown';

  const prompt = `You are evaluating local home service businesses as sales leads for an AI automation platform that sells:
- Reputation management (Google review generation)
- AI phone receptionist (answers calls 24/7)
- Automated follow-ups (missed call text back, appointment reminders)

The pitch is easiest to close when:
- The owner answers their own phone and is time-strapped (solo operator)
- Their Google rating hurts them and they know it (< 3.5 = urgent pain)
- They have a good rating they want to protect (≥ 4.0 = fear of losing it)
- They have no website (less tech-savvy, less comparison shopping)
- They have a phone number (can actually be called)

Business: ${name}
Trade: ${trade}
Has phone: ${contact.phone ? 'Yes' : 'No'}
Has website: ${scraped?.website || contact.website ? 'Yes' : 'No'}
Google rating: ${rating}
Rule-based score: ${base}/100
Score breakdown: ${pts.join(', ')}

Adjust the score based on business name insights (does the name suggest a solo or a company?), the trade type (plumbers and HVAC tend to be busier and more receptive to missed-call tools than concrete which is more project-based), and any other factors evident from the data.

Return ONLY valid JSON — no explanation, no markdown:
{"score":<integer 1-100>,"reason":"<one sentence max 150 chars>"}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 120,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `Anthropic ${res.status}`);
  }

  const data = await res.json();
  const text = (data.content?.[0]?.text || '').trim();
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error(`No JSON in response: ${text.slice(0, 100)}`);

  const parsed = JSON.parse(match[0]);
  return {
    score:  Math.max(1, Math.min(100, Math.round(Number(parsed.score)))),
    reason: String(parsed.reason).slice(0, 200),
  };
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function run() {
  if (!GHL_KEY) { console.error('GHL_API_KEY (or GHL_AGENCY_KEY) not set'); process.exit(1); }
  if (!ANTHROPIC_KEY && !DRY_RUN) {
    console.error('ANTHROPIC_API_KEY not set — add it to .env.local or shell env');
    process.exit(1);
  }
  if (!ANTHROPIC_KEY && DRY_RUN) {
    console.log('⚠  ANTHROPIC_API_KEY not set — Claude analysis will be skipped, showing base scores only');
  }

  console.log('\n═══ Lead Scoring System ════════════════════════════════════');
  if (DRY_RUN) console.log('⚠  DRY RUN — no GHL updates will be made');

  // 1. Fetch contacts by tag (avoids pulling the entire location's contact list)
  console.log('\n── Fetching GHL contacts ────────────────────────────────────');
  const seen = new Set();
  const contacts = [];
  for (const tag of TARGET_TAGS) {
    const batch = await fetchContactsByTag(tag);
    for (const c of batch) {
      if (!seen.has(c.id)) { seen.add(c.id); contacts.push(c); }
    }
    await sleep(DELAY_MS);
  }
  console.log(`Found ${contacts.length} unique contacts with target tags\n`);

  if (!contacts.length) {
    console.log('No contacts match target tags. Done.');
    return;
  }

  // 2. Ensure custom field exists
  let fieldKey = 'lead_score';
  if (!DRY_RUN) {
    console.log('── Custom field ─────────────────────────────────────────────');
    const field = await ensureLeadScoreField();
    fieldKey = field.fieldKey || 'lead_score';
    await sleep(DELAY_MS);
  }

  // 3. Score each contact
  console.log('── Scoring ──────────────────────────────────────────────────');
  const results = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const name    = contact.name || contact.companyName || `(id: ${contact.id})`;
    const prefix  = `[${String(i + 1).padStart(3)}/${contacts.length}]`;

    const scraped = findScraped(contact);
    const { score: base, pts, rating } = baseScore(contact, scraped);

    let finalScore = base;
    let reason = `Rule-based: ${pts.join(', ')}`;

    if (ANTHROPIC_KEY) {
      try {
        const analysis = await claude(contact, scraped, base, pts);
        finalScore = analysis.score;
        reason     = analysis.reason;
      } catch (err) {
        console.error(`  ${prefix} Claude failed — using base score: ${err.message}`);
      }
    }

    const tier  = finalScore >= 80 ? 'hot-lead' : finalScore >= 50 ? 'warm-lead' : 'cold-lead';
    const trade = contact.tags?.find(t => TARGET_TAGS.has(t)) || '?';

    console.log(`${prefix} [${String(finalScore).padStart(3)}] ${tier.padEnd(9)} ${name}`);
    console.log(`          ${trade} | rating: ${rating ?? 'n/a'} | ${pts.join(' | ')}`);
    console.log(`          ${reason}`);

    const row = {
      id:           contact.id,
      name,
      phone:        contact.phone || '',
      website:      contact.website || scraped?.website || '',
      googleRating: rating,
      trade,
      score:        finalScore,
      tier,
      reason,
      breakdown:    pts,
    };

    results.push(row);

    if (!DRY_RUN) {
      try {
        await updateContactField(contact.id, fieldKey, finalScore);
        await sleep(DELAY_MS);
        await replaceTierTag(contact.id, tier);
        await sleep(DELAY_MS);
        await addNote(contact.id, `[Lead Score ${finalScore}] ${reason}`);
        await sleep(DELAY_MS);
        console.log('          → GHL updated ✓');
      } catch (err) {
        console.error(`          → GHL update failed: ${err.message}`);
      }
    }

    // Brief pause between Claude calls to avoid bursting the rate limit
    if (i < contacts.length - 1) await sleep(300);
  }

  // 4. Sort and save
  results.sort((a, b) => b.score - a.score);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  const hot  = results.filter(r => r.tier === 'hot-lead').length;
  const warm = results.filter(r => r.tier === 'warm-lead').length;
  const cold = results.filter(r => r.tier === 'cold-lead').length;

  console.log('\n═══ Leaderboard ═════════════════════════════════════════════');
  console.log(`  Hot  (80+)   : ${hot}`);
  console.log(`  Warm (50–79) : ${warm}`);
  console.log(`  Cold (<50)   : ${cold}`);
  console.log('\n  Top 15 to call first:');
  results.slice(0, 15).forEach((r, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. [${r.score}] ${r.name} (${r.trade}) — ${r.reason}`);
  });

  console.log(`\n✓ ${results.length} leads scored → ${OUTPUT_FILE}`);
  if (DRY_RUN) console.log('\n(DRY RUN — re-run without --dry-run to push scores to GHL)');
}

run().catch(err => { console.error('\nFatal:', err.message); process.exit(1); });
