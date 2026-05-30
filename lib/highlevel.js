// HighLevel Agency API client — creates and manages sub-accounts (locations).
// Separate from lib/ghl.js which handles per-location operations using each
// client's own location API key.
//
// Required env vars:
//   GHL_AGENCY_KEY    — Agency-level API key (HL Settings → Integrations → API Keys)
//   GHL_SNAPSHOT_ID   — Snapshot to install on new sub-accounts
//
// Optional: Retell agent auto-provision for velocity/rocket plans.
//   Requires RETELL_API_KEY in env. Only provisioned when plan is velocity or rocket.

import crypto from 'crypto';
import { createRetellAgent } from '@/lib/retell';

const GHL_BASE = 'https://services.leadconnectorhq.com';

/**
 * Fetch the first appointment calendar for a location using the agency key.
 * Called right after location creation so we capture the snapshot calendar ID.
 */
export async function fetchLocationCalendarId(locationId) {
  try {
    const res = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, {
      headers: agencyHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const calendars = data?.calendars ?? [];
    // Prefer event/appointment type; fall back to first available
    const cal =
      calendars.find((c) => c.type === 'event' || c.type === 'appointment') ??
      calendars[0];
    return cal?.id ?? null;
  } catch (err) {
    console.error('[highlevel] fetchLocationCalendarId error:', err.message);
    return null;
  }
}

function agencyHeaders() {
  const apiKey = process.env.GHL_AGENCY_KEY || process.env.GHL_AGENCY_API_KEY;
  if (!apiKey) throw new Error('Missing GHL_AGENCY_KEY (or GHL_AGENCY_API_KEY) environment variable');
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };
}

async function agencyFetch(path, method = 'GET', body = null) {
  const options = { method, headers: agencyHeaders() };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${GHL_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HighLevel API ${res.status} on ${path}: ${text}`);
  }
  return res.json();
}

/**
 * Create a new HighLevel sub-account (location) with snapshot, then create
 * the owner user. Returns { locationId, userId, password, dashboardUrl }.
 *
 * Requires GHL_SNAPSHOT_ID in .env.local and Vercel environment variables.
 */
export async function createSubAccount({ name, email, phone, plan, businessName }) {
  const snapshotId = process.env.GHL_SNAPSHOT_ID;
  if (!snapshotId) throw new Error('Missing GHL_SNAPSHOT_ID — add it to .env.local and Vercel env vars');

  const companyId = process.env.GHL_COMPANY_ID;
  if (!companyId) throw new Error('Missing GHL_COMPANY_ID environment variable');
  // Accept both user-facing names (launch/rocket/velocity) and internal DB names (starter/growth/pro)
  const PLAN_LABELS = {
    launch: 'Launch Box', rocket: 'Rocket Box', velocity: 'Velocity Box',
    starter: 'Launch Box', growth: 'Rocket Box', pro: 'Velocity Box',
  };

  // ── Step 1: Create the location (snapshot applied in the same request) ──
  const locationRes = await agencyFetch('/locations/', 'POST', {
    name: businessName || `${name || email} — ${PLAN_LABELS[plan] || plan}`,
    email,
    phone: phone || '',
    address: '',
    city: '',
    state: '',
    country: 'US',
    postalCode: '',
    timezone: 'America/New_York',
    website: '',
    snapshotId,
    companyId,
  });

  const locationId = locationRes?.location?.id || locationRes?.id;
  if (!locationId) {
    throw new Error(`HighLevel location creation returned no ID: ${JSON.stringify(locationRes)}`);
  }

  // ── Step 2: Create a user with access to the new location ──────────────
  const parts = (name || email).split(' ');
  const password = generatePassword();
  let userId = null;

  try {
    const userRes = await agencyFetch('/users/', 'POST', {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email,
      password,
      locationIds: [locationId],
      companyId,
      role: 'user',
      type: 'account',
      permissions: {
        contactsEnabled: true,
        opportunitiesEnabled: true,
        dashboardStatsEnabled: true,
        appointmentsEnabled: true,
        reviewsEnabled: true,
        onlineListingsEnabled: true,
        phoneEnabled: true,
        mediaEnabled: true,
        conversationsEnabled: true,
        invoiceEnabled: true,
        tagsEnabled: true,
        leadValueEnabled: true,
        agentReportingEnabled: true,
        settingsEnabled: false,
        campaignsEnabled: false,
        workflowsEnabled: false,
        funnelsEnabled: false,
        websitesEnabled: false,
        membershipEnabled: false,
        marketingEnabled: false,
      },
    });
    userId = userRes?.user?.id || userRes?.id || null;
  } catch (err) {
    // Non-fatal: user creation fails when the email already has a GHL account.
    console.error(`[highlevel] user creation failed for ${email}:`, err.message);
  }

  // ── Step 3: Fetch the calendar ID the snapshot created ─────────────────────
  // GHL applies the snapshot synchronously; the calendar should be available.
  const calendarId = await fetchLocationCalendarId(locationId);
  if (calendarId) {
    console.log(`[highlevel] found calendar ${calendarId} for location ${locationId}`);
  } else {
    console.warn(`[highlevel] no calendar found for location ${locationId} — booking will fall back to default`);
  }

  // ── Step 4: Auto-provision Retell agent for Rocket/Velocity plans ──────────
  let retellAgentId = null;
  const retellPlans = ['velocity', 'rocket', 'pro', 'growth'];
  if (retellPlans.includes(plan) && process.env.RETELL_API_KEY) {
    try {
      const { agentId } = await createRetellAgent({
        businessName: businessName || name || email,
        ownerName: name,
        location: 'the local area',
        calendarId,
      });
      retellAgentId = agentId;
      console.log(`[highlevel] Retell agent created: ${agentId} for ${email}`);
    } catch (err) {
      console.error(`[highlevel] Retell agent creation failed for ${email}:`, err.message);
    }
  }

  return {
    locationId,
    calendarId,
    userId,
    password: userId ? password : null,
    dashboardUrl: 'https://app.gohighlevel.com',
    retellAgentId,
  };
}

/**
 * Update an existing sub-account with business info collected at onboarding.
 * Called after the onboarding form is submitted.
 */
export async function updateSubAccount(locationId, { businessName, phone, address, website }) {
  const updates = {};
  if (businessName) updates.name = businessName;
  if (phone) updates.phone = phone;
  if (address) updates.address = address;
  if (website) updates.website = website;

  if (Object.keys(updates).length === 0) return null;

  return agencyFetch(`/locations/${locationId}`, 'PUT', updates);
}

/**
 * List all agency snapshots — use this to find your GHL_SNAPSHOT_ID value.
 */
export async function listSnapshots() {
  return agencyFetch('/snapshots/');
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) result += '-';
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
