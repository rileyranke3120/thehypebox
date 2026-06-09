create table if not exists error_log (
  id            bigint primary key generated always as identity,
  agent         text not null,
  error_message text not null,
  stack         text,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz default now()
);

create index if not exists error_log_agent_time_idx on error_log (agent, occurred_at desc);
