CREATE TABLE IF NOT EXISTS automation_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid,
  automation text,
  payload jsonb,
  triggered_at timestamptz DEFAULT now(),
  status text DEFAULT 'sent'
);
