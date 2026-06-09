create table if not exists churn_prediction (
  id                bigserial primary key,
  user_id           uuid not null references users(id) on delete cascade,
  date              date not null,
  risk_level        text not null check (risk_level in ('low', 'medium', 'high')),
  reason            text,
  calls_30d         integer,
  conversations_30d integer,
  pipeline_active   boolean,
  last_login_days   integer,
  sms_sent          boolean not null default false,
  outreach_sent     boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists churn_prediction_user_date_idx on churn_prediction (user_id, date desc);
create index if not exists churn_prediction_risk_idx on churn_prediction (risk_level);
create index if not exists churn_prediction_date_idx on churn_prediction (date desc);

alter table churn_prediction enable row level security;

create policy "service role only" on churn_prediction
  using (false)
  with check (false);
