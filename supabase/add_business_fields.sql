-- Migration: add business profile fields to users table
-- Run this in your Supabase SQL editor or via the CLI

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS business_hours text,
  ADD COLUMN IF NOT EXISTS website      text;

-- Optional: update the name column if it does not already exist
-- (next-auth typically stores name in the users table already)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name text;

-- Billing: plan name (e.g. 'Growth', 'Starter', 'Pro')
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'Growth';
