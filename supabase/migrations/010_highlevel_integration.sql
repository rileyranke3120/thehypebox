-- Migration 010: Add ghl_user_id column for HighLevel sub-account tracking
-- The ghl_location_id column was added in migration 002.
-- This adds the HL user ID returned when we create a user in the new sub-account.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ghl_user_id TEXT;

-- Index for looking up by HL location (admin queries)
CREATE INDEX IF NOT EXISTS idx_users_ghl_location_id ON users (ghl_location_id)
  WHERE ghl_location_id IS NOT NULL;

-- View: users missing HL provisioning (active/trialing but no location)
CREATE OR REPLACE VIEW users_pending_highlevel AS
  SELECT id, email, name, plan, plan_status, created_at
  FROM users
  WHERE plan_status IN ('trialing', 'active')
    AND (ghl_location_id IS NULL OR ghl_location_id = '')
  ORDER BY created_at DESC;
