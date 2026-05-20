-- Migration 011: Ensure all automation logging tables exist and have client_id.
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- automation_logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid,
  automation    text,
  payload       jsonb,
  triggered_at  timestamptz DEFAULT now(),
  status        text DEFAULT 'sent'
);

-- appointment_reminders
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number     text,
  customer_name    text,
  business_name    text,
  appointment_time text,
  sent_at          timestamptz DEFAULT now()
);
ALTER TABLE appointment_reminders ADD COLUMN IF NOT EXISTS client_id uuid;

-- missed_calls
CREATE TABLE IF NOT EXISTS missed_calls (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id      text,
  from_number  text,
  business_name text,
  timestamp    timestamptz DEFAULT now(),
  text_sent    boolean DEFAULT false
);
ALTER TABLE missed_calls ADD COLUMN IF NOT EXISTS client_id uuid;

-- review_requests
CREATE TABLE IF NOT EXISTS review_requests (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number  text,
  customer_name text,
  sent_at       timestamptz DEFAULT now()
);
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS client_id uuid;

-- lead_nurture
CREATE TABLE IF NOT EXISTS lead_nurture (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number  text,
  customer_name text,
  step          integer,
  sent_at       timestamptz DEFAULT now()
);
ALTER TABLE lead_nurture ADD COLUMN IF NOT EXISTS client_id uuid;

-- post_service_followups
CREATE TABLE IF NOT EXISTS post_service_followups (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number  text,
  customer_name text,
  business_name text,
  sent_at       timestamptz DEFAULT now()
);
ALTER TABLE post_service_followups ADD COLUMN IF NOT EXISTS client_id uuid;

-- reactivation_campaigns
CREATE TABLE IF NOT EXISTS reactivation_campaigns (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number  text,
  customer_name text,
  sent_at       timestamptz DEFAULT now()
);
ALTER TABLE reactivation_campaigns ADD COLUMN IF NOT EXISTS client_id uuid;
