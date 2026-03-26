CREATE TABLE IF NOT EXISTS lead_nurture (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text,
  customer_name text,
  step integer,
  sent_at timestamptz DEFAULT now()
);
