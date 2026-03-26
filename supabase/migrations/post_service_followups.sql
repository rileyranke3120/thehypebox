CREATE TABLE IF NOT EXISTS post_service_followups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text,
  customer_name text,
  business_name text,
  sent_at timestamptz DEFAULT now()
);
