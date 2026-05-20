-- Cold outreach sequence tracker
-- Each row = one prospect being worked through the 3-email sequence

create table if not exists public.cold_outreach (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  company text,
  ghl_contact_id text,
  sequence_step integer not null default 0,
  next_send_at timestamptz not null default now(),
  opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists cold_outreach_next_send_idx
  on public.cold_outreach (next_send_at)
  where opted_out = false and sequence_step < 3;

alter table public.cold_outreach enable row level security;
