// follow-up-sequence.mjs
// Automated 3-step SMS follow-up for plumber/hvac/electrician/concrete contacts in GHL.
//
// State machine (per contact):
//   outreach_detected → followup1_sent (after 48h) → followup2_sent (after 48h)
//   → cold (after 48h, tags contact "cold", schedules reactivation) → reactivation_sent (after 30d)
//
// Initial outreach detection: any note on the contact NOT bearing one of our auto-markers.
// Response detection: any inbound SMS message after the outreach note date.
//
// Usage:
//   node scripts/follow-up-sequence.mjs
//   node scripts/follow-up-sequence.mjs --dry-run
//
// Cron (daily at 9am):
//   0 9 * * * cd /path/to/thehypebox && node scripts/follow-up-sequence.mjs >> logs/followup.log 2>&1
//
// Env vars (reads from .env.local):
//   GHL_API_KEY or GHL_AGENCY_KEY  — PIT token with contacts/conversations read+write
//   ANTHROPIC_API_KEY              — Anthropic API key

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── env ──────────────────────────────────────────────────────────────────────

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
} catch { /* no .env.local — rely on shell env */ }

// ─── constants ────────────────────────────────────────────────────────────────

const GHL_KEY       = process.env.GHL_API_KEY || process.env.GHL_AGENCY_KEY;
const LOCATION_ID   = 'Ra79aZSYkl96uPQajjkJ';
const GHL_BASE      = 'https://services.leadconnectorhq.com';
const GHL_VERSION   = '2021-07-28';
const LOG_FILE      = path.join(__dirname, 'follow_up_log.json');
const DRY_RUN       = process.argv.includes('--dry-run');

const TARGET_TAGS   = ['plumber', 'hvac', 'electrician', 'concrete'];

const NICHE_LABELS  = {
  plumber:     'plumber',
  hvac:        'HVAC contractor',
  electrician: 'electrician',
  concrete:    'concrete contractor',
};

const FOLLOWUP_1_MS       = 48 * 60 * 60 * 1000;
const FOLLOWUP_2_MS       = 48 * 60 * 60 * 1000;
const COLD_WINDOW_MS      = 48 * 60 * 60 * 1000;
const REACTIVATION_MS     = 30 * 24 * 60 * 60 * 1000;

// Markers injected into GHL notes by THIS script — never counted as "initial outreach"
const AUTO_MARKERS = ['[FOLLOWUP_1]', '[FOLLOWUP_2]', '[COLD_TAGGED]', '[REACTIVATION]'];

const DELAY_MS       = 400;
const RETRY_DELAY_MS = 5000;
const MAX_RETRIES    = 3;

// ─── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isAutoNote(body) {
  return AUTO_MARKERS.some(m => body?.includes(m));
}

function getBizType(tags = []) {
  const lower = tags.map(t => t.toLowerCase());
  return TARGET_TAGS.find(t => lower.includes(t)) || 'trade business';
}

function getNicheLabel(bizType) {
  return NICHE_LABELS[bizType] || bizType;
}

function getFirstName(contact) {
  return contact.firstName || contact.name?.split(' ')[0] || 'there';
}

// Extract quoted message text from an auto-note body, e.g. "[FOLLOWUP_1] ...\n\n"Hey John..."
function extractQuotedMessage(body) {
  const m = body?.match(/"([^"]+)"/);
  return m ? m[1] : null;
}

// ─── GHL API ──────────────────────────────────────────────────────────────────

async function ghlRequest(method, endpoint, body = null, attempt = 1) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: GHL_VERSION,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${GHL_BASE}${endpoint}`, opts);

  if (res.status === 429) {
    if (attempt > MAX_RETRIES) throw new Error(`Rate limited — ${method} ${endpoint}`);
    const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10) * 1000;
    const wait = Math.max(retryAfter, RETRY_DELAY_MS) * attempt;
    console.log(`  [rate-limit] waiting ${wait / 1000}s...`);
    await sleep(wait);
    return ghlRequest(method, endpoint, body, attempt + 1);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`GHL ${method} ${endpoint} → ${res.status}: ${data.message || text}`);
  }
  return data;
}

// Fetch all contacts with a given tag (cursor-paginated)
async function fetchContactsByTag(tag) {
  const contacts = [];
  let startAfter = null;

  while (true) {
    const url = new URL(`${GHL_BASE}/contacts/`);
    url.searchParams.set('locationId', LOCATION_ID);
    url.searchParams.set('tag', tag);
    url.searchParams.set('limit', '100');
    if (startAfter) url.searchParams.set('startAfter', startAfter);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${GHL_KEY}`, Version: GHL_VERSION },
    });

    if (res.status === 429) {
      console.log(`  [rate-limit] tag=${tag} — waiting ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

    const batch = data.contacts || [];
    contacts.push(...batch);
    if (batch.length < 100) break;

    startAfter = batch[batch.length - 1].id;
    await sleep(DELAY_MS);
  }

  return contacts;
}

async function getAllTargetContacts() {
  const seen = new Set();
  const contacts = [];

  for (const tag of TARGET_TAGS) {
    process.stdout.write(`  tag=${tag} ... `);
    const batch = await fetchContactsByTag(tag);
    let added = 0;
    for (const c of batch) {
      if (!seen.has(c.id)) {
        seen.add(c.id);
        contacts.push(c);
        added++;
      }
    }
    console.log(`${batch.length} fetched (${added} new)`);
    await sleep(DELAY_MS);
  }

  return contacts;
}

async function getContactNotes(contactId) {
  const data = await ghlRequest('GET', `/contacts/${contactId}/notes`);
  return data.notes || [];
}

// Find the primary SMS conversation for a contact and return all its messages
async function getContactSmsMessages(contactId) {
  const convData = await ghlRequest('GET',
    `/conversations/search?locationId=${LOCATION_ID}&contactId=${contactId}&limit=10`);

  const conversations = convData.conversations || [];
  if (conversations.length === 0) return [];

  // Prefer an SMS conversation; fall back to first available
  const conv = conversations.find(c => c.type === 'SMS' || c.lastMessageType === 'TYPE_SMS')
    || conversations[0];

  const msgData = await ghlRequest('GET', `/conversations/${conv.id}/messages?limit=100`);
  // GHL wraps messages differently depending on the version
  const raw = msgData.messages;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.messages)) return raw.messages;
  return [];
}

async function sendSMS(contactId, message) {
  return ghlRequest('POST', '/conversations/messages', {
    type: 'SMS',
    contactId,
    locationId: LOCATION_ID,
    message,
  });
}

async function addNote(contactId, body) {
  return ghlRequest('POST', `/contacts/${contactId}/notes`, { body, userId: '' });
}

async function addTags(contactId, tags) {
  return ghlRequest('POST', `/contacts/${contactId}/tags`, { tags });
}

// ─── Claude ───────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateMessage(firstName, nicheLabel, followupNum, prevMessages) {
  const isReactivation = followupNum === 'reactivation';

  const prevCtx = prevMessages.length > 0
    ? `\n\nPrevious messages already sent to this contact:\n${prevMessages.map((m, i) => `${i + 1}. "${m}"`).join('\n')}`
    : '';

  const systemPrompt = `You write short, conversational outbound SMS messages for B2B outreach to local ${nicheLabel} businesses. Sound like a real person texting — not a sales pitch. Max 160 characters per message.`;

  const userPrompt = isReactivation
    ? `Write a re-engagement SMS to ${firstName}, a ${nicheLabel} business owner. We reached out about 30 days ago and never heard back. Keep it brief and low-pressure — checking back in, not pushing hard.${prevCtx}

Return ONLY the message text. Max 160 characters.`
    : `Write follow-up SMS #${followupNum} to ${firstName}, a ${nicheLabel} business owner. No response to earlier messages.${prevCtx}

Requirements:
- Different angle/hook from any previous message
- Casual, direct, sounds like a real person
- Soft CTA (reply, quick chat, let me know, etc.)
- Max 160 characters
- Return ONLY the message text`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return response.content[0].text.trim().replace(/^"|"$/g, '');
}

// ─── log ──────────────────────────────────────────────────────────────────────

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); }
  catch { return {}; }
}

function saveLog(log) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function logActivity(entry, action, detail) {
  entry.activityLog = entry.activityLog || [];
  const ts = new Date().toISOString();
  entry.activityLog.push({ timestamp: ts, action, detail });
  console.log(`  [${action}] ${detail}`);
}

// ─── contact state machine ────────────────────────────────────────────────────

async function processContact(contact, log) {
  const id        = contact.id;
  const firstName = getFirstName(contact);
  const phone     = contact.phone;
  const bizType   = getBizType(contact.tags);
  const niche     = getNicheLabel(bizType);
  const now       = Date.now();

  if (!phone) {
    console.log(`  skip: no phone number`);
    return;
  }

  // ── Initialize log entry if this contact is new ────────────────────────────
  if (!log[id]) {
    const notes = await getContactNotes(id);
    await sleep(DELAY_MS);

    // Outreach notes: any note NOT bearing our auto-markers
    const outreachNotes = notes
      .filter(n => !isAutoNote(n.body))
      .sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

    if (outreachNotes.length === 0) {
      console.log(`  skip: no initial outreach note detected`);
      return;
    }

    const firstOutreach = outreachNotes[0];

    // Reconstruct state if the log was lost but notes still exist
    const autoNotes    = notes.filter(n => isAutoNote(n.body));
    const f1Note       = autoNotes.find(n => n.body.includes('[FOLLOWUP_1]'));
    const f2Note       = autoNotes.find(n => n.body.includes('[FOLLOWUP_2]'));
    const coldNote     = autoNotes.find(n => n.body.includes('[COLD_TAGGED]'));
    const reactNote    = autoNotes.find(n => n.body.includes('[REACTIVATION]'));

    let status = 'outreach_detected';
    if (reactNote)  status = 'reactivation_sent';
    else if (coldNote)  status = 'cold';
    else if (f2Note)    status = 'followup2_sent';
    else if (f1Note)    status = 'followup1_sent';

    const coldTaggedAt = coldNote?.dateAdded || null;

    log[id] = {
      contactId:               id,
      name:                    contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      bizType,
      phone,
      tags:                    contact.tags,
      status,
      outreachDetectedAt:      firstOutreach.dateAdded,
      outreachNoteId:          firstOutreach.id,
      followup1SentAt:         f1Note?.dateAdded || null,
      followup1Message:        extractQuotedMessage(f1Note?.body),
      followup2SentAt:         f2Note?.dateAdded || null,
      followup2Message:        extractQuotedMessage(f2Note?.body),
      coldTaggedAt,
      reactivationScheduledFor: coldTaggedAt
        ? new Date(new Date(coldTaggedAt).getTime() + REACTIVATION_MS).toISOString()
        : null,
      reactivationSentAt:      reactNote?.dateAdded || null,
      reactivationMessage:     extractQuotedMessage(reactNote?.body),
      respondedAt:             null,
      activityLog:             [],
    };

    logActivity(log[id], 'initialized',
      `outreach note found (${firstOutreach.dateAdded}), status=${status}`);
  }

  const entry = log[id];

  // ── Already terminal — nothing more to do ─────────────────────────────────
  if (['responded', 'reactivation_sent'].includes(entry.status)) {
    console.log(`  skip: status=${entry.status}`);
    return;
  }

  // ── Check for inbound response ────────────────────────────────────────────
  let messages = [];
  try {
    messages = await getContactSmsMessages(id);
    await sleep(DELAY_MS);
  } catch (err) {
    console.warn(`  warn: could not fetch messages — ${err.message}`);
  }

  const outreachTime = new Date(entry.outreachDetectedAt).getTime();
  const hasResponse  = messages.some(m =>
    m.direction === 'inbound' && new Date(m.dateAdded).getTime() > outreachTime
  );

  if (hasResponse) {
    entry.status      = 'responded';
    entry.respondedAt = new Date().toISOString();
    logActivity(entry, 'responded', 'inbound message detected — sequence complete');
    return;
  }

  // Collect previous message text for Claude context (avoids repetition)
  const prevMessages = [entry.followup1Message, entry.followup2Message].filter(Boolean);

  // ── State transitions ─────────────────────────────────────────────────────
  try {

    if (entry.status === 'cold') {
      // Ensure reactivation date is set
      if (!entry.reactivationScheduledFor) {
        entry.reactivationScheduledFor = new Date(
          new Date(entry.coldTaggedAt).getTime() + REACTIVATION_MS
        ).toISOString();
        logActivity(entry, 'reactivation_scheduled', entry.reactivationScheduledFor);
      }

      if (now >= new Date(entry.reactivationScheduledFor).getTime()) {
        const msg = await generateMessage(firstName, niche, 'reactivation', prevMessages);
        if (!DRY_RUN) {
          await sendSMS(id, msg);
          await sleep(DELAY_MS);
          await addNote(id, `[REACTIVATION] 30-day reactivation message sent:\n\n"${msg}"`);
        }
        entry.reactivationSentAt  = new Date().toISOString();
        entry.reactivationMessage = msg;
        entry.status              = 'reactivation_sent';
        logActivity(entry, 'reactivation_sent', DRY_RUN ? `[DRY RUN] ${msg}` : msg);
      } else {
        const daysLeft = Math.ceil(
          (new Date(entry.reactivationScheduledFor).getTime() - now) / (24 * 60 * 60 * 1000)
        );
        console.log(`  skip: cold — reactivation in ${daysLeft} day(s)`);
      }

    } else if (entry.status === 'followup2_sent') {
      const elapsed = now - new Date(entry.followup2SentAt).getTime();
      if (elapsed >= COLD_WINDOW_MS) {
        if (!DRY_RUN) {
          await addTags(id, ['cold']);
          await sleep(DELAY_MS);
          await addNote(id,
            `[COLD_TAGGED] No response after 2 follow-ups. Tagged cold. ` +
            `Reactivation scheduled in ${REACTIVATION_MS / (24 * 60 * 60 * 1000)} days.`);
        }
        entry.coldTaggedAt           = new Date().toISOString();
        entry.reactivationScheduledFor = new Date(now + REACTIVATION_MS).toISOString();
        entry.status                 = 'cold';
        logActivity(entry, 'cold_tagged',
          DRY_RUN
            ? `[DRY RUN] reactivation scheduled for ${entry.reactivationScheduledFor}`
            : `reactivation scheduled for ${entry.reactivationScheduledFor}`);
      } else {
        const hoursLeft = Math.ceil((COLD_WINDOW_MS - elapsed) / (60 * 60 * 1000));
        console.log(`  skip: followup2_sent — ${hoursLeft}h until cold-tag window`);
      }

    } else if (entry.status === 'followup1_sent') {
      const elapsed = now - new Date(entry.followup1SentAt).getTime();
      if (elapsed >= FOLLOWUP_2_MS) {
        const msg = await generateMessage(firstName, niche, 2, prevMessages);
        if (!DRY_RUN) {
          await sendSMS(id, msg);
          await sleep(DELAY_MS);
          await addNote(id, `[FOLLOWUP_2] Second follow-up sent:\n\n"${msg}"`);
        }
        entry.followup2SentAt  = new Date().toISOString();
        entry.followup2Message = msg;
        entry.status           = 'followup2_sent';
        logActivity(entry, 'followup2_sent', DRY_RUN ? `[DRY RUN] ${msg}` : msg);
      } else {
        const hoursLeft = Math.ceil((FOLLOWUP_2_MS - elapsed) / (60 * 60 * 1000));
        console.log(`  skip: followup1_sent — ${hoursLeft}h until followup2`);
      }

    } else if (entry.status === 'outreach_detected') {
      const elapsed = now - new Date(entry.outreachDetectedAt).getTime();
      if (elapsed >= FOLLOWUP_1_MS) {
        const msg = await generateMessage(firstName, niche, 1, []);
        if (!DRY_RUN) {
          await sendSMS(id, msg);
          await sleep(DELAY_MS);
          await addNote(id, `[FOLLOWUP_1] First follow-up sent:\n\n"${msg}"`);
        }
        entry.followup1SentAt  = new Date().toISOString();
        entry.followup1Message = msg;
        entry.status           = 'followup1_sent';
        logActivity(entry, 'followup1_sent', DRY_RUN ? `[DRY RUN] ${msg}` : msg);
      } else {
        const hoursLeft = Math.ceil((FOLLOWUP_1_MS - elapsed) / (60 * 60 * 1000));
        console.log(`  skip: outreach_detected — ${hoursLeft}h until followup1`);
      }
    }

  } catch (err) {
    logActivity(entry, 'error', err.message);
    console.error(`  ERROR: ${err.message}`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!GHL_KEY) { console.error('GHL_API_KEY / GHL_AGENCY_KEY not set'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }

  console.log(`\n=== Follow-Up Sequence — ${new Date().toISOString()} ===`);
  if (DRY_RUN) console.log('[DRY RUN] No SMS, notes, or tags will be written\n');

  const log = loadLog();

  console.log('\nFetching contacts...');
  const contacts = await getAllTargetContacts();
  console.log(`\nTotal: ${contacts.length} unique contacts across [${TARGET_TAGS.join(', ')}]\n`);

  let processed = 0, errors = 0;

  for (let i = 0; i < contacts.length; i++) {
    const c     = contacts[i];
    const label = `[${i + 1}/${contacts.length}] ${c.companyName || c.name || c.id} (${getBizType(c.tags)})`;
    console.log(label);

    try {
      await processContact(c, log);
      processed++;
    } catch (err) {
      console.error(`  FATAL: ${err.message}`);
      errors++;
    }

    // Save log incrementally every 20 contacts so progress survives crashes
    if ((i + 1) % 20 === 0) saveLog(log);

    await sleep(DELAY_MS);
  }

  saveLog(log);

  console.log(`\n=== Done — ${processed} processed, ${errors} errors ===`);
  console.log(`Log: ${LOG_FILE}`);
}

run().catch(err => { console.error(err); process.exit(1); });
