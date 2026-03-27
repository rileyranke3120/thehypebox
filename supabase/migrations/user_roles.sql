-- User roles and profile columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'client';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text DEFAULT 'starter';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_hours text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_industry text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS retell_agent_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS retell_phone_number text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS toggles jsonb DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Set super_admin roles
-- Run manually after migration:
-- UPDATE users SET role = 'super_admin' WHERE email IN
-- ('rileyranke@gmail.com', 'barry@thehypeboxllc.com', 'dad@thehypeboxllc.com');

-- Add client_id to all automation tables
ALTER TABLE missed_calls ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE review_requests ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE reactivation_campaigns ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE appointment_reminders ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE post_service_followups ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE lead_nurture ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE automation_logs ADD COLUMN IF NOT EXISTS client_id uuid;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS client_id uuid;
