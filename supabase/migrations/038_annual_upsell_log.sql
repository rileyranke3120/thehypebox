create table if not exists annual_upsell_log (
  id                     bigserial primary key,
  user_id                uuid,
  client_email           text not null,
  client_name            text,
  plan                   text,
  months_on_plan         integer not null default 0,
  annual_price_cents     bigint  not null default 0,
  monthly_price_cents    bigint  not null default 0,
  savings_cents          bigint  not null default 0,
  sms_draft              text,
  ghl_contact_id         text,
  ghl_note_id            text,
  stripe_subscription_id text,
  created_at             timestamptz not null default now()
);

create index if not exists annual_upsell_log_user_id_idx    on annual_upsell_log (user_id, created_at desc);
create index if not exists annual_upsell_log_created_at_idx on annual_upsell_log (created_at desc);
create index if not exists annual_upsell_log_email_idx      on annual_upsell_log (client_email, created_at desc);

alter table annual_upsell_log enable row level security;

create policy "service role only" on annual_upsell_log
  using (false)
  with check (false);
