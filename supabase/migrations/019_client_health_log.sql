create table if not exists client_health_log (
  id              bigserial primary key,
  user_id         uuid not null references users(id) on delete cascade,
  date            date not null,
  health_score    text not null check (health_score in ('green', 'yellow', 'red')),
  reason          text,
  calls_7d        integer,
  new_contacts_7d integer,
  pipeline_active boolean,
  conversations_7d integer,
  reengagement_sent boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists client_health_log_user_date_idx on client_health_log (user_id, date desc);
create index if not exists client_health_log_score_idx on client_health_log (health_score);
create index if not exists client_health_log_date_idx on client_health_log (date desc);

alter table client_health_log enable row level security;

create policy "service role only" on client_health_log
  using (false)
  with check (false);
