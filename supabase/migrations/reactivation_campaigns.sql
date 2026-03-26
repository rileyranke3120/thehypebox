CREATE TABLE IF NOT EXISTS reactivation_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text,
  customer_name text,
  sent_at timestamptz DEFAULT now()
);
