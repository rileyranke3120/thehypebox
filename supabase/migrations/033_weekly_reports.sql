create table if not exists weekly_reports (
  id                    bigserial primary key,
  week_start            date        not null,
  week_end              date        not null,
  leads_scraped         integer     not null default 0,
  barry_outreach_sent   integer     not null default 0,
  replies_received      integer     not null default 0,
  hot_leads_generated   integer     not null default 0,
  demos_booked          integer     not null default 0,
  new_clients_signed    integer     not null default 0,
  mrr_added             integer     not null default 0,
  total_mrr             integer     not null default 0,
  health_green          integer     not null default 0,
  health_yellow         integer     not null default 0,
  health_red            integer     not null default 0,
  top_niche             text,
  best_city             text,
  ai_summary            text,
  raw_metrics           jsonb,
  sms_sent_to           jsonb,
  created_at            timestamptz not null default now(),
  unique (week_start)
);

create index if not exists weekly_reports_week_idx on weekly_reports (week_start desc);
create index if not exists weekly_reports_created_idx on weekly_reports (created_at desc);

alter table weekly_reports enable row level security;

drop policy if exists "service role only" on weekly_reports;
create policy "service role only" on weekly_reports
  using (false)
  with check (false);
