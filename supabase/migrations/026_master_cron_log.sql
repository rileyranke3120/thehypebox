-- Master orchestration run log
create table if not exists master_cron_log (
  id            bigint primary key generated always as identity,
  run_date      date not null,
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  total_steps   int default 0,
  failed_steps  int default 0,
  total_ms      int,
  created_at    timestamptz default now()
);

-- Per-agent step log (one row per agent per master run)
create table if not exists cron_run_log (
  id            bigint primary key generated always as identity,
  master_run_id bigint references master_cron_log(id),
  agent         text not null,
  run_at        timestamptz not null default now(),
  ok            boolean not null,
  status_code   int,
  result        jsonb,
  error         text,
  duration_ms   int,
  created_at    timestamptz default now()
);

create index if not exists cron_run_log_agent_idx  on cron_run_log (agent, run_at desc);
create index if not exists cron_run_log_master_idx on cron_run_log (master_run_id);

-- Prune rows older than 90 days (run manually or via pg_cron if available)
-- delete from cron_run_log where created_at < now() - interval '90 days';
-- delete from master_cron_log where created_at < now() - interval '90 days';
