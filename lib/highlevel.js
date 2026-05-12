// HighLevel Agency API client — for creating sub-accounts (locations) from snapshots.
// This is separate from lib/ghl.js which handles per-location operations using
// each client's own location API key.
//
// Requires env vars:
//   GHL_AGENCY_API_KEY  — Agency-level API key from HL Settings → Integrations
//   GHL_SNAPSHOT_ID     — Snapshot ID to install into new sub-accounts

const GHL_BASE = 'https://rest.gohighlevel.com/v1';

async function ghlAgencyFetch(path, method = 'GET', body = null) {
  const apiKey = process.env.GHL_AGENCY_API_KEY;
  if (!apiKey) throw new Error('Missing GHL_AGENCY_API_KEY environment variable');

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${GHL_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HighLevel API ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

/**
 * Create a new HighLevel sub-account (location) and load the snapshot.
 * Returns { locationId, userId, password, dashboardUrl }
 */
export async function createSubAccount({ name, email, phone, plan }) {
  const snapshotId = process.env.GHL_SNAPSHOT_ID;
  if (!snapshotId) throw new Error('Missing GHL_SNAPSHOT_ID environment variable');

  const PLAN_LABELS = {
    launch: 'Launch Box',
    rocket: 'Rocket Box',
    velocity: 'Velocity Box',
  };

  // ── Step 1: Create the location ───────────────────────────────
  const locationRes = await ghlAgencyFetch('/locations/', 'POST', {
    name: `${name || email} — ${PLAN_LABELS[plan] || plan}`,
    email,
    phone: phone || '',
    address: '',
    city: '',
    state: '',
    country: 'US',
    postalCode: '',
    timezone: 'America/New_York',
    website: '',
  });

  const locationId = locationRes?.location?.id || locationRes?.id;
  if (!locationId) throw new Error(`HighLevel location creation failed — no ID returned: ${JSON.stringify(locationRes)}`);

  // ── Step 2: Install snapshot into the location ────────────────
  try {
    await ghlAgencyFetch(`/snapshots/${snapshotId}/push`, 'POST', { locationId });
  } catch (err) {
    // Snapshot install failure is non-fatal — location exists, workflows may be missing.
    // Admin will be notified via the calling code.
    console.error(`[highlevel] snapshot install failed for ${locationId}:`, err.message);
  }

  // ── Step 3: Create a user with access to the new location ─────
  const parts = (name || email).split(' ');
  const password = generatePassword();

  let userId = null;
  try {
    const userRes = await ghlAgencyFetch('/users/', 'POST', {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email,
      password,
      locationId,
      role: 'user',
      type: 'account',
    });
    userId = userRes?.user?.id || userRes?.id || null;
  } catch (err) {
    // User creation can fail if they already have a HL account with that email.
    console.error(`[highlevel] user creation failed for ${email}:`, err.message);
    // Still return the location — they can use their existing HL login.
  }

  return {
    locationId,
    userId,
    password: userId ? password : null, // null means they have an existing HL account
    dashboardUrl: `https://app.gohighlevel.com/location/${locationId}`,
  };
}

/**
 * List all available snapshots (useful for finding your snapshot ID).
 */
export async function listSnapshots() {
  return ghlAgencyFetch('/snapshots/');
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) result += '-';
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
