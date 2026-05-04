#!/usr/bin/env node
/**
 * Test script for HighLevel agency API integration.
 *
 * Usage:
 *   node scripts/test-highlevel.js list-snapshots
 *   node scripts/test-highlevel.js create-account --email test@example.com --name "Test User" --plan launch
 *
 * Requires env vars in .env.local:
 *   GHL_AGENCY_API_KEY
 *   GHL_SNAPSHOT_ID
 */

import 'dotenv/config';
import { createSubAccount, listSnapshots } from '../lib/highlevel.js';

const [,, command, ...args] = process.argv;

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      out[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return out;
}

async function main() {
  if (!command) {
    console.log('Commands: list-snapshots | create-account --email <email> --name <name> --plan <launch|rocket|velocity>');
    process.exit(1);
  }

  if (command === 'list-snapshots') {
    console.log('Fetching snapshots...');
    const result = await listSnapshots();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'create-account') {
    const { email, name, plan = 'launch', phone = '' } = parseArgs(args);
    if (!email) {
      console.error('--email is required');
      process.exit(1);
    }

    console.log(`Creating sub-account for ${email} on ${plan} plan...`);
    const result = await createSubAccount({ name, email, phone, plan });
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
    if (result.locationId) {
      console.log(`\n✓ Success! Dashboard: ${result.dashboardUrl}`);
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
