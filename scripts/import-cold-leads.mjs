// import-cold-leads.mjs
// Reads an Apollo.io CSV export and bulk-imports contacts into TheHypeBox GHL sub-account.
// Tags every contact with "cold-outreach-columbus" which triggers the email sequence workflow.
//
// Usage:
//   node scripts/import-cold-leads.mjs path/to/apollo-export.csv
//
// Apollo CSV columns used: First Name, Last Name, Email, Company, Title, Phone

import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import readline from 'readline';

const GHL_KEY = process.env.GHL_HYPEBOX_KEY || 'pit-adf27150-638c-40c9-95cc-f596973ebe56';
const GHL_LOCATION_ID = 'Ra79aZSYkl96uPQajjkJ';
const TAG = 'cold-outreach-columbus';
const GHL_BASE = 'https://services.leadconnectorhq.com';

// ms to wait between requests to avoid rate limiting
const DELAY_MS = 300;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;
    const rl = readline.createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });

    rl.on('line', (line) => {
      // Simple CSV parse — handles quoted fields with commas
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
  // Apollo column names vary slightly — handle common variations
  const firstName = row['first name'] || row['firstname'] || row['first_name'] || '';
  const lastName = row['last name'] || row['lastname'] || row['last_name'] || '';
  const email = row['email'] || row['work email'] || row['email address'] || '';
  const company = row['company'] || row['company name'] || row['organization'] || '';
  const title = row['title'] || row['job title'] || row['position'] || '';
  const phone = row['phone'] || row['mobile phone'] || row['work direct phone'] || row['phone number'] || '';

  return { firstName, lastName, email, company, title, phone };
}

async function upsertContact({ firstName, lastName, email, company, title, phone }) {
  const body = {
    locationId: GHL_LOCATION_ID,
    firstName,
    lastName,
    email,
    companyName: company,
    title,
    tags: [TAG],
  };
  if (phone) body.phone = phone;

  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GHL_KEY}`,
      'Version': '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return { id: data.contact?.id, new: data.new };
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

  console.log(`\nReading ${path.basename(csvPath)}...`);
  const rows = await parseCSV(csvPath);
  console.log(`Found ${rows.length} rows\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const mapped = mapRow(rows[i]);

    if (!mapped.email) {
      console.log(`[${i + 1}/${rows.length}] SKIP — no email: ${mapped.firstName} ${mapped.lastName} @ ${mapped.company}`);
      skipped++;
      continue;
    }

    try {
      const result = await upsertContact(mapped);
      const status = result.new ? 'CREATED' : 'UPDATED';
      if (result.new) created++; else updated++;
      console.log(`[${i + 1}/${rows.length}] ${status} — ${mapped.firstName} ${mapped.lastName} @ ${mapped.company} (${mapped.email})`);
    } catch (err) {
      console.error(`[${i + 1}/${rows.length}] FAILED — ${mapped.email}: ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n✓ Done`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no email): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`\nAll imported contacts are tagged "${TAG}" and will trigger your GHL email sequence.`);
}

run().catch((err) => { console.error(err); process.exit(1); });
