-- Run this in your Supabase SQL editor to create the users table

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz default now()
);

-- Enable Row Level Security (RLS) and lock down direct client access.
-- All reads/writes go through the service role key on the server.
alter table public.users enable row level security;

-- Example: insert a user (run this once to seed a test account).
-- Replace values with real credentials.
-- Generate a bcrypt hash with: node -e "require('bcryptjs').hash('yourpassword', 10).then(console.log)"
--
-- insert into public.users (name, email, password_hash)
-- values ('Test User', 'test@example.com', '$2a$10$...');
