-- Migration: create appointments table
-- Run this in your Supabase SQL editor or via the CLI

CREATE TABLE IF NOT EXISTS appointments (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email       text        NOT NULL,
  customer_name    text        NOT NULL,
  service          text        NOT NULL,
  appointment_date date        NOT NULL,
  appointment_time time        NOT NULL,
  phone            text,
  notes            text,
  created_at       timestamptz DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS appointments_user_email_idx
  ON appointments (user_email);

CREATE INDEX IF NOT EXISTS appointments_date_idx
  ON appointments (appointment_date);

-- Optional: RLS policy if you use Supabase Auth
-- ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Users see own appointments"
--   ON appointments FOR ALL
--   USING (user_email = auth.jwt() ->> 'email');
