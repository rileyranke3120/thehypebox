CREATE TABLE IF NOT EXISTS appointment_reminders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text,
  customer_name text,
  appointment_time text,
  sent_at timestamptz DEFAULT now()
);
