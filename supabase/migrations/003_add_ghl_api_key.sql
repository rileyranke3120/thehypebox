-- Migration 003: Add ghl_api_key column to users table
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ghl_api_key text;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'ghl_api_key';
