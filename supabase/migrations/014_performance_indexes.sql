-- Migration 014: Add performance indexes for time-series queries used by cron jobs and reports.
-- Safe to run multiple times (IF NOT EXISTS).

-- automation_logs: weekly-report and log viewer query by triggered_at
CREATE INDEX IF NOT EXISTS automation_logs_triggered_at_idx ON automation_logs (triggered_at DESC);

-- retell_calls: weekly-report queries by created_at
CREATE INDEX IF NOT EXISTS retell_calls_created_at_idx ON retell_calls (created_at DESC);

-- users: faster plan_status lookups used by trial-drip, win-back, weekly-report
CREATE INDEX IF NOT EXISTS users_plan_status_idx ON users (plan_status);

-- users: retell health-check looks up by retell_agent_id
CREATE INDEX IF NOT EXISTS users_retell_agent_id_idx ON users (retell_agent_id);
