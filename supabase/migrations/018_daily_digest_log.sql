create table if not exists daily_digest_log (
  id              bigserial primary key,
  date            date not null,
  summary         text not null,
  pipeline_by_stage jsonb,
  pipeline_total  integer,
  new_leads_count integer default 0,
  responded_count integer default 0,
  demos_count     integer default 0,
  signups_count   integer default 0,
  signups_detail  jsonb,
  sms_sent_to     jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists daily_digest_log_date_idx on daily_digest_log (date desc);

alter table daily_digest_log enable row level security;

-- Only service role can read/write digest logs
create policy "service role only" on daily_digest_log
  using (false)
  with check (false);
