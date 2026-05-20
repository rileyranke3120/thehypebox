-- Add win_back_sent flag to users table for win-back email cron
ALTER TABLE users ADD COLUMN IF NOT EXISTS win_back_sent boolean NOT NULL DEFAULT false;
