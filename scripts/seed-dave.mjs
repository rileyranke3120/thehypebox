/**
 * Seed script: create Dave Holibaugh (client) and Riley Ranke (super_admin) in Supabase
 * Run: node scripts/seed-dave.mjs
 *
 * Prereq: Run supabase/migrations/002_role_and_ghl_columns.sql in Supabase
 *         Dashboard → SQL Editor first.
 */

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// ── Load .env.local ────────────────────────────────────────────────────────────
const envVars = {};
try {
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    });
} catch {
  console.error('❌ Could not read .env.local — run this script from the project root.');
  process.exit(1);
}

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Config ─────────────────────────────────────────────────────────────────────
const DAVE = {
  email: 'dave@idealconcretecoatings.com',
  password: 'Welcome2025!',
  name: 'Dave Holibaugh',
  role: 'client',
  plan: 'starter',
  active: true,
  business_name: 'Ideal Concrete Coatings',
  ghl_location_id: 'wd2kQPROMdPE0FHLYNFR',
  ghl_api_key: 'pit-c201ff33-45af-4c43-9066-fa23cb7154b0',
};

const RILEY = {
  email: 'rileyranke@gmail.com',  // ← update if different
  password: 'Riley3120',
  name: 'Riley Ranke',
  role: 'super_admin',
  plan: 'pro',
  active: true,
  business_name: 'TheHypeBox',
  ghl_location_id: 'Ra79aZSYkl96uPQajjkJ',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
async function upsertUser(cfg) {
  const password_hash = await bcrypt.hash(cfg.password, 12);
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        email: cfg.email,
        password_hash,
        name: cfg.name,
        role: cfg.role,
        plan: cfg.plan,
        active: cfg.active,
        business_name: cfg.business_name,
        ghl_location_id: cfg.ghl_location_id,
        ...(cfg.ghl_api_key ? { ghl_api_key: cfg.ghl_api_key } : {}),
      },
      { onConflict: 'email' }
    )
    .select('id, email, name, role, plan, ghl_location_id, ghl_api_key');

  if (error) throw new Error(`Insert failed for ${cfg.email}: ${error.message}`);
  return data?.[0];
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n TheHypeBox — Seeding user accounts\n');

  if (RILEY.password === 'CHANGE_ME') {
    console.error('❌  Set RILEY.password before running this script.');
    process.exit(1);
  }

  // 1. Verify required columns exist
  console.log('1/3  Checking role + ghl_location_id columns…');
  const { error: colErr } = await supabase
    .from('users')
    .select('role, ghl_location_id')
    .limit(1);

  if (colErr) {
    console.error('\n❌  Column check failed:', colErr.message);
    console.error('\n    Run supabase/migrations/002_role_and_ghl_columns.sql in');
    console.error('    Supabase Dashboard → SQL Editor, then re-run this script.\n');
    process.exit(1);
  }
  console.log('     ✓ Columns exist\n');

  // 2. Upsert Dave
  console.log('2/3  Upserting Dave Holibaugh (client)…');
  const dave = await upsertUser(DAVE);
  console.log(`     ✓ ${dave.id}  ${dave.email}  role=${dave.role}  ghl=${dave.ghl_location_id}\n`);

  // 3. Upsert Riley
  console.log('3/3  Upserting Riley Ranke (super_admin)…');
  const riley = await upsertUser(RILEY);
  console.log(`     ✓ ${riley.id}  ${riley.email}  role=${riley.role}  ghl=${riley.ghl_location_id}\n`);

  console.log('✅  Done. Login credentials:\n');
  console.log(`    Dave:  ${DAVE.email}  /  ${DAVE.password}`);
  console.log(`    Riley: ${RILEY.email}  /  ${RILEY.password}\n`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
