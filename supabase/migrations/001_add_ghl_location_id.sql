-- Migration: add ghl_location_id to users table
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ghl_location_id TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'ghl_location_id';
