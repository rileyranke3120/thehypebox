-- Migration 005: add avatar_url to users table
alter table public.users
  add column if not exists avatar_url text;
