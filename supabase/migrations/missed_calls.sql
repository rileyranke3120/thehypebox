CREATE TABLE IF NOT EXISTS missed_calls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id text,
  from_number text,
  business_name text,
  timestamp timestamptz DEFAULT now(),
  text_sent boolean DEFAULT false
);
