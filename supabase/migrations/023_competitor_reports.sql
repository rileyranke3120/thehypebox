create table if not exists competitor_reports (
  id                bigserial primary key,
  date              date not null,
  competitors_found integer not null default 0,
  report_text       text,
  raw_data          jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists competitor_reports_date_idx on competitor_reports (date desc);

alter table competitor_reports enable row level security;

create policy "service role only" on competitor_reports
  using (false)
  with check (false);
