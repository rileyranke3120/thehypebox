-- Migration: stateful password reset tokens (HIGH-3)
-- Run this in the Supabase SQL editor before deploying the updated reset-password routes.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_hash        TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at  TIMESTAMPTZ;
