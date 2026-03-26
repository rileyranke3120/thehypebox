CREATE TABLE IF NOT EXISTS review_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text,
  customer_name text,
  sent_at timestamptz DEFAULT now()
);
