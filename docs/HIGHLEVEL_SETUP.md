# HighLevel Integration Setup

This doc covers how TheHypeBox automatically provisions a HighLevel sub-account for every new paying customer.

---

## How It Works

**Flow:**
1. Customer completes Stripe checkout (SetupIntent deferred payment)
2. Stripe fires `setup_intent.succeeded` webhook
3. Webhook calls `createSubAccount()` in `lib/highlevel.js`
4. HighLevel creates a new sub-account (location) from your snapshot
5. Customer receives an email with their HL login credentials
6. If HL provisioning fails, an alert email is sent to `riley@thehypeboxllc.com`

---

## Required Environment Variables

Add these to Vercel (Production + Preview):

| Variable | Description |
|---|---|
| `GHL_AGENCY_API_KEY` | Agency-level API key from HL Settings → Integrations |
| `GHL_SNAPSHOT_ID` | Snapshot ID to install into new sub-accounts |
| `ADMIN_SECRET` | Secret for the `/api/admin/create-highlevel` endpoint |

---

## Finding Your Snapshot ID

**Option A — Test script:**
```bash
node scripts/test-highlevel.js list-snapshots
```
Look for your snapshot in the output and copy the `id`.

**Option B — HighLevel UI:**
1. Go to Agency Settings → Snapshots
2. Copy the snapshot URL — the ID is in the URL after `/snapshot/`

---

## Creating Your API Key

1. In HighLevel, go to **Agency Settings → Integrations**
2. Under **API Keys**, click **Create New Key**
3. Give it a name like "TheHypeBox Automation"
4. Copy the key — paste it as `GHL_AGENCY_API_KEY`

---

## Testing the Integration

Before going live, test with a real email:
```bash
# List your snapshots
node scripts/test-highlevel.js list-snapshots

# Create a test sub-account (use your own email — a real account will be made)
node scripts/test-highlevel.js create-account \
  --email your@email.com \
  --name "Test User" \
  --plan launch
```

This will:
- Create a HighLevel sub-account
- Install your snapshot
- Create a HL user
- Return `{ locationId, userId, password, dashboardUrl }`

Delete the test account from HighLevel after verifying.

---

## Admin Panel

If automatic provisioning fails (HL outage, missing API key, etc.), use the admin panel to provision manually:

**URL:** `/dashboard/admin/highlevel`

Only accounts with `role = 'super_admin'` in Supabase can access this page.

To make yourself a super admin, run in the Supabase SQL editor:
```sql
UPDATE users SET role = 'super_admin' WHERE email = 'riley@thehypeboxllc.com';
```

The admin panel shows all active/trialing users without HL accounts and lets you provision them with one click (this also sends the access email).

---

## Manual API (curl)

You can also provision via the API directly:
```bash
curl -X POST https://thehypeboxllc.com/api/admin/create-highlevel \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"email": "customer@example.com", "sendAccessEmail": true}'
```

---

## Database Migration

Before deploying, run migration 010 in the Supabase SQL editor:

```
supabase/migrations/010_highlevel_integration.sql
```

This adds:
- `ghl_user_id TEXT` column on the `users` table
- Index on `ghl_location_id`
- `users_pending_highlevel` view (used by admin panel)

---

## Troubleshooting

**"Missing GHL_AGENCY_API_KEY environment variable"**
→ Add the env var to Vercel and redeploy.

**"HighLevel API 401"**
→ Your agency API key is wrong or expired. Regenerate in HL.

**"HighLevel API 422 on /locations/"**
→ Location creation failed — check that your agency account has sub-account capacity.

**Snapshot not installed**
→ Non-fatal. The location was created, but workflows/templates won't be pre-loaded. Re-push the snapshot from HighLevel UI: Agency → Locations → find the account → push snapshot.

**User creation failed ("existing HL account")**
→ Customer already had a HighLevel account. Non-fatal — they can use their existing HL login. Their `ghl_location_id` is still set so they have access to the sub-account.
