create table if not exists cancellation_deflection (
  id                     bigint primary key generated always as identity,
  user_id                uuid references users(id) on delete set null,
  email                  text not null,
  name                   text,
  plan                   text,
  phone                  text,
  stripe_customer_id     text,
  stripe_subscription_id text,

  -- Usage snapshot at cancellation
  calls_30d              integer,
  conversations_30d      integer,
  pipeline_active        boolean,
  last_login_days        integer,

  -- SMS tracking
  initial_sms_body       text,
  initial_sms_sent_at    timestamptz,
  followup_sms_body      text,
  followup_sent_at       timestamptz,

  -- Response
  client_responded       boolean not null default false,
  responded_at           timestamptz,

  -- Outcome
  outcome                text not null default 'pending'
                           check (outcome in ('pending', 'retained', 'lost')),

  created_at             timestamptz not null default now()
);

create index if not exists cancellation_deflection_phone_idx
  on cancellation_deflection (phone);
create index if not exists cancellation_deflection_outcome_idx
  on cancellation_deflection (outcome, created_at desc);

alter table cancellation_deflection enable row level security;
create policy "service role only" on cancellation_deflection
  using (false) with check (false);
