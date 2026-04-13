-- Migration 002: Ensure role and ghl_location_id columns exist on users table
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'client';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ghl_location_id text;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('role', 'ghl_location_id')
ORDER BY column_name;
