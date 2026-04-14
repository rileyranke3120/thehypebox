-- Migration 007: RLS policies for retell_calls, appointments, review_requests, automation_logs
--
-- Auth model: NextAuth is used for login; the Supabase service role key is used
-- for all server-side writes (bypasses RLS automatically). Policies below use
-- auth.email() so they apply when a Supabase Auth session exists, and block
-- unauthenticated (anon key) reads by default.
--
-- Linking columns:
--   appointments     → user_email       = auth.email()
--   review_requests  → user_email       = auth.email()
--   automation_logs  → client_id        = users.id where users.email = auth.email()
--   retell_calls     → agent_id         = users.retell_agent_id where users.email = auth.email()


-- ─── appointments ─────────────────────────────────────────────────────────────
-- RLS already enabled in migration 004; add the missing SELECT policy.
drop policy if exists "users read own appointments" on public.appointments;
create policy "users read own appointments"
  on public.appointments
  for select
  using (user_email = auth.email());

drop policy if exists "users insert own appointments" on public.appointments;
create policy "users insert own appointments"
  on public.appointments
  for insert
  with check (user_email = auth.email());

drop policy if exists "users delete own appointments" on public.appointments;
create policy "users delete own appointments"
  on public.appointments
  for delete
  using (user_email = auth.email());


-- ─── review_requests ──────────────────────────────────────────────────────────
alter table public.review_requests enable row level security;

drop policy if exists "users read own review requests" on public.review_requests;
create policy "users read own review requests"
  on public.review_requests
  for select
  using (user_email = auth.email());

drop policy if exists "users insert own review requests" on public.review_requests;
create policy "users insert own review requests"
  on public.review_requests
  for insert
  with check (user_email = auth.email());


-- ─── automation_logs ──────────────────────────────────────────────────────────
alter table public.automation_logs enable row level security;

drop policy if exists "users read own automation logs" on public.automation_logs;
create policy "users read own automation logs"
  on public.automation_logs
  for select
  using (
    client_id = (
      select id from public.users where email = auth.email() limit 1
    )
  );

drop policy if exists "users insert own automation logs" on public.automation_logs;
create policy "users insert own automation logs"
  on public.automation_logs
  for insert
  with check (
    client_id = (
      select id from public.users where email = auth.email() limit 1
    )
  );


-- ─── retell_calls ─────────────────────────────────────────────────────────────
-- RLS already enabled in migration 004; add the missing SELECT policy.
drop policy if exists "users read own retell calls" on public.retell_calls;
create policy "users read own retell calls"
  on public.retell_calls
  for select
  using (
    agent_id = (
      select retell_agent_id from public.users where email = auth.email() limit 1
    )
  );
