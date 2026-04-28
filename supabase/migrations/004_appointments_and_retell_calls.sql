-- Migration 004: fix appointments table schema + add retell_calls
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- ─── appointments ────────────────────────────────────────────────────────────
-- Drop old table if it exists (old schema had wrong column names)
drop table if exists public.appointments;

create table public.appointments (
  id         uuid        primary key default gen_random_uuid(),
  user_email text        not null,
  date       text        not null,   -- 'YYYY-MM-DD'
  time       text        not null default '09:00',
  title      text        not null,
  notes      text,
  created_at timestamptz default now()
);

create index appointments_user_email_idx on public.appointments (user_email);
create index appointments_date_idx       on public.appointments (date);

alter table public.appointments enable row level security;
-- Service role key bypasses RLS — no policies needed for server-side writes


-- ─── retell_calls ────────────────────────────────────────────────────────────
create table if not exists public.retell_calls (
  call_id             text        primary key,
  agent_id            text,
  call_status         text,
  caller_phone_number text,
  start_timestamp     timestamptz,
  end_timestamp       timestamptz,
  transcript          text,
  call_summary        text,
  created_at          timestamptz default now()
);

create index if not exists retell_calls_agent_idx on public.retell_calls (agent_id);

alter table public.retell_calls enable row level security;
