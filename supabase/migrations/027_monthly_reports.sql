create table if not exists monthly_reports (
  id               bigserial primary key,
  user_id          uuid        not null references users(id) on delete cascade,
  client_email     text        not null,
  client_name      text,
  business_name    text,
  month_label      text        not null,
  month_start      date        not null,
  total_calls      integer     not null default 0,
  leads_captured   integer     not null default 0,
  pipeline_value   numeric     not null default 0,
  appts_booked     integer     not null default 0,
  missed_textbacks integer     not null default 0,
  report_text      text,
  email_sent       boolean     not null default false,
  sms_sent         boolean     not null default false,
  error            text,
  created_at       timestamptz not null default now(),
  unique (user_id, month_start)
);

create index if not exists monthly_reports_user_month_idx
  on monthly_reports (user_id, month_start desc);

create index if not exists monthly_reports_created_idx
  on monthly_reports (created_at desc);

alter table monthly_reports enable row level security;

drop policy if exists "service role only" on monthly_reports;
create policy "service role only" on monthly_reports
  using (false)
  with check (false);
