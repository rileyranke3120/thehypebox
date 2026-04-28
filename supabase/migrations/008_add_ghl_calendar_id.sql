-- Migration 008: add ghl_calendar_id to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ghl_calendar_id text;
