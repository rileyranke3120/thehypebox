// generate-outreach-messages.mjs
// Fetches contacts from GHL (Ra79aZSYkl96uPQajjkJ) tagged plumber/hvac/electrician/concrete,
// generates a personalized SMS pitch via Claude, and saves it as a note on each contact.
//
// Usage:
//   node scripts/generate-outreach-messages.mjs
//   node scripts/generate-outreach-messages.mjs --dry-run   # generate messages, skip saving notes
//
// SETUP — two env vars required in .env.local:
//
//   GHL_OUTREACH_KEY
//     A Private Integration Token scoped to sub-account Ra79aZSYkl96uPQajjkJ.
//     Create it in GHL: Agency → Sub-accounts → [Outreach account] → Settings →
//     Integrations → Private Integration → New → grant Contacts (read + write) + Notes scopes.
//     Falls back to GHL_API_KEY if GHL_OUTREACH_KEY is not set.
//
//   ANTHROPIC_API_KEY
//     Your Anthropic API key. Set via: vercel env add ANTHROPIC_API_KEY

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── config ──────────────────────────────────────────────────────────────────

try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  for (const line of env.split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      const val = v.replace(/^["']|["']$/g, ''); // strip surrounding quotes
      if (k && !process.env[k]) process.env[k] = val;
    }
  }
} catch { /* no .env.local — rely on shell env */ }

const GHL_KEY     = process.env.GHL_OUTREACH_KEY || process.env.GHL_API_KEY;
const LOCATION_ID = 'Ra79aZSYkl96uPQajjkJ';
const GHL_BASE    = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';
const DRY_RUN     = process.argv.includes('--dry-run');

const TARGET_TAGS = ['plumber', 'hvac', 'electrician', 'concrete'];

const NICHE_LABELS = {
  plumber:     'plumber',
  hvac:        'HVAC contractor',
  electrician: 'electrician',
  concrete:    'concrete contractor',
};

const DELAY_MS       = 400; // stay under GHL rate limit
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES    = 3;

// ─── helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── GHL: fetch contacts by tag (paginated) ──────────────────────────────────

async function fetchContactsByTag(tag) {
  const contacts = [];
  let startAfter = null;
  let page = 1;

  while (true) {
    const url = new URL(`${GHL_BASE}/contacts/`);
    url.searchParams.set('locationId', LOCATION_ID);
    url.searchParams.set('tag', tag);
    url.searchParams.set('limit', '100');
    if (startAfter) url.searchParams.set('startAfterId', startAfter);

    let res;
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${GHL_KEY}`, Version: GHL_VERSION },
        signal: AbortSignal.timeout(20000),
      });
    } catch (networkErr) {
      console.log(`  Network error on page ${page} — retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      console.log(`  HTTP ${res.status} on page ${page} — retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

    const batch = data.contacts || [];
    contacts.push(...batch);

    if (batch.length < 100) break;

    // GHL uses contact ID of last record as cursor
    startAfter = batch[batch.length - 1].id;
    page++;
    await sleep(DELAY_MS);
  }

  return contacts;
}

// ─── Claude: generate SMS message ────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateSMS(contact, niche) {
  const businessName = contact.companyName || contact.name || 'your business';
  const firstName    = contact.firstName || '';

  const prompt = `Generate a single cold SMS outreach message for a ${niche} business called "${businessName}"${firstName ? ` (owner: ${firstName})` : ''}.

Rules:
- Under 160 characters total (count carefully)
- Conversational and natural — not salesy or corporate
- Mention we help contractors never miss a call with an AI phone agent
- End with a simple, low-pressure question to open a conversation
- No hashtags, no emojis, no links
- Sign off as "- Barry @ TheHypeBox"

Output only the SMS text, nothing else.`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text.trim();
}

// ─── GHL: save note on contact ────────────────────────────────────────────────

async function saveNote(contactId, smsText, attempt = 1) {
  const body = {
    body: `[AI OUTREACH MESSAGE — PENDING APPROVAL]\n\n${smsText}\n\n---\nGenerated by generate-outreach-messages.mjs on ${new Date().toLocaleDateString('en-US')}. Review and send manually.`,
    userId: '',
  };

  const res = await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: GHL_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    if (attempt > MAX_RETRIES) throw new Error('Rate limited after max retries');
    const wait = RETRY_DELAY_MS * attempt;
    console.log(`  Rate limited saving note — waiting ${wait / 1000}s...`);
    await sleep(wait);
    return saveNote(contactId, smsText, attempt + 1);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.note?.id || 'saved';
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!GHL_KEY) {
    console.error('GHL_OUTREACH_KEY not set.');
    console.error('Create a PIT for sub-account Ra79aZSYkl96uPQajjkJ with Contacts + Notes scopes,');
    console.error('then add GHL_OUTREACH_KEY=pit-... to .env.local');
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set. Add it to .env.local or shell env.');
    process.exit(1);
  }

  console.log(`\nFetching contacts from location ${LOCATION_ID}...`);
  if (DRY_RUN) console.log('DRY RUN — notes will not be saved\n');

  // Collect all contacts across tags, deduplicate by ID
  const seen = new Set();
  const allContacts = []; // { contact, niche }

  for (const tag of TARGET_TAGS) {
    process.stdout.write(`  tag=${tag} ... `);
    const batch = await fetchContactsByTag(tag);
    let added = 0;
    for (const c of batch) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        allContacts.push({ contact: c, niche: NICHE_LABELS[tag] });
        added++;
      }
    }
    console.log(`${batch.length} contacts (${added} new)`);
    await sleep(DELAY_MS);
  }

  console.log(`\nTotal unique contacts: ${allContacts.length}\n`);

  const stats = { generated: 0, saved: 0, failed: 0 };

  for (let i = 0; i < allContacts.length; i++) {
    const { contact, niche } = allContacts[i];
    const label = `[${i + 1}/${allContacts.length}] ${contact.companyName || contact.name || contact.id} (${niche})`;

    try {
      const sms = await generateSMS(contact, niche);
      stats.generated++;

      console.log(`${label}`);
      console.log(`  SMS (${sms.length} chars): ${sms}`);

      if (!DRY_RUN) {
        await saveNote(contact.id, sms);
        stats.saved++;
        console.log(`  ✓ Note saved`);
        await sleep(DELAY_MS);
      }
    } catch (err) {
      console.error(`${label} — FAILED: ${err.message}`);
      stats.failed++;
    }

    // Small pause between Claude calls to avoid hammering the API
    await sleep(200);
  }

  console.log(`\n✓ Done — ${stats.generated} messages generated, ${stats.saved} notes saved, ${stats.failed} failed`);
  if (DRY_RUN && stats.generated > 0) {
    console.log('\nRun without --dry-run to save notes to GHL.');
  }
}

run().catch(err => { console.error(err); process.exit(1); });
