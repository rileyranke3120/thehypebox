create table if not exists stripe_metrics (
  id            bigserial primary key,
  run_date      date        not null unique,
  mrr_cents     bigint      not null default 0,
  active_subs   int         not null default 0,
  new_subs      int         not null default 0,
  churned_subs  int         not null default 0,
  revenue_mtd_cents     bigint not null default 0,
  revenue_last_month_cents bigint not null default 0,
  raw_snapshot  jsonb,
  sms_sent      boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists stripe_metrics_run_date_idx on stripe_metrics(run_date desc);
