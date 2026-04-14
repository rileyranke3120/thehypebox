-- Migration 006: add google_review_url to users table
alter table public.users
  add column if not exists google_review_url text;
