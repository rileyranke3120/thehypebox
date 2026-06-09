create table if not exists upsell_log (
  id              bigserial primary key,
  user_id         uuid,
  client_email    text not null,
  client_name     text,
  plan            text,
  calls_30d       integer not null default 0,
  contacts_count  integer not null default 0,
  pipeline_value  numeric not null default 0,
  triggers        text[] not null default '{}',
  sms_draft       text,
  ghl_contact_id  text,
  ghl_note_id     text,
  tagged          boolean not null default false,
  created_at      timestamptz not null default now()
);

create index if not exists upsell_log_user_id_idx on upsell_log (user_id, created_at desc);
create index if not exists upsell_log_created_at_idx on upsell_log (created_at desc);

alter table upsell_log enable row level security;

-- Only service role can read/write upsell log
create policy "service role only" on upsell_log
  using (false)
  with check (false);
