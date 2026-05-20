// import-cold-leads.mjs
// Reads an Apollo.io CSV export and:
//  1. Upserts contacts into TheHypeBox GHL sub-account (tagged cold-outreach-columbus)
//  2. Inserts them into Supabase cold_outreach table so the cron sequence fires
//
// Usage:
//   node scripts/import-cold-leads.mjs path/to/apollo-export.csv
//
// Requires env vars (or .env.local):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
try {
  const env = fs.readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
} catch {}

const GHL_KEY = process.env.GHL_OUTREACH_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_OUTREACH_LOCATION_ID;
const TAG = 'cold-outreach-columbus';
const GHL_BASE = 'https://services.leadconnectorhq.com';
const DELAY_MS = 350;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;
    const rl = readline.createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });

    rl.on('line', (line) => {
      const cols = [];
      let cur = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuote = !inQuote; continue; }
        if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      cols.push(cur.trim());

      if (!headers) { headers = cols.map((h) => h.toLowerCase()); return; }

      const row = {};
      headers.forEach((h, i) => { row[h] = cols[i] || ''; });
      rows.push(row);
    });

    rl.on('close', () => resolve(rows));
    rl.on('error', reject);
  });
}

function mapRow(row) {
  return {
    firstName: row['first name'] || row['firstname'] || row['first_name'] || '',
    lastName:  row['last name']  || row['lastname']  || row['last_name']  || '',
    email:     row['email'] || row['work email'] || row['email address']  || '',
    company:   row['company'] || row['company name'] || row['organization'] || '',
    title:     row['title'] || row['job title'] || row['position'] || '',
    phone:     row['phone'] || row['mobile phone'] || row['work direct phone'] || '',
  };
}

async function upsertGHLContact({ firstName, lastName, email, company, title, phone }) {
  const body = {
    locationId: GHL_LOCATION_ID,
    firstName, lastName, email,
    companyName: company,
    tags: [TAG],
  };
  if (phone) body.phone = phone;

  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data.contact?.id;
}

async function upsertSupabaseRecord({ email, firstName, lastName, company, ghlContactId }) {
  const { error } = await supabase.from('cold_outreach').upsert(
    {
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      company,
      ghl_contact_id: ghlContactId,
      // Only reset sequence if this is truly a new record — upsert on email conflict
      // preserves existing sequence_step for re-imports
    },
    { onConflict: 'email', ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

async function run() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Usage: node scripts/import-cold-leads.mjs path/to/apollo-export.csv');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  if (!GHL_KEY || !GHL_LOCATION_ID) {
    console.error('Missing GHL_OUTREACH_API_KEY or GHL_OUTREACH_LOCATION_ID in .env.local');
    process.exit(1);
  }

  console.log(`\nReading ${path.basename(csvPath)}...`);
  const rows = await parseCSV(csvPath);
  console.log(`Found ${rows.length} rows\n`);

  let created = 0, skipped = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const mapped = mapRow(rows[i]);

    if (!mapped.email) {
      console.log(`[${i + 1}/${rows.length}] SKIP — no email: ${mapped.firstName} ${mapped.lastName} @ ${mapped.company}`);
      skipped++;
      continue;
    }

    try {
      const ghlId = await upsertGHLContact(mapped);
      await upsertSupabaseRecord({ ...mapped, ghlContactId: ghlId });
      console.log(`[${i + 1}/${rows.length}] IMPORTED — ${mapped.firstName} ${mapped.lastName} @ ${mapped.company}`);
      created++;
    } catch (err) {
      console.error(`[${i + 1}/${rows.length}] FAILED — ${mapped.email}: ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n✓ Done — ${created} imported, ${skipped} skipped, ${failed} failed`);
  console.log(`Sequence emails will fire automatically via the daily cron.`);
}

run().catch((err) => { console.error(err); process.exit(1); });
