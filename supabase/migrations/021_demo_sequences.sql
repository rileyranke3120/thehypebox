CREATE TABLE IF NOT EXISTS demo_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_business TEXT,
  calendar_id TEXT NOT NULL,
  appointment_start TIMESTAMPTZ NOT NULL,
  appointment_end TIMESTAMPTZ NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('pre', 'post')),
  step TEXT NOT NULL,
  fire_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'error')),
  error_msg TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT demo_sequences_appointment_step_key UNIQUE (appointment_id, step)
);

CREATE INDEX IF NOT EXISTS demo_sequences_pending_fire_at
  ON demo_sequences (fire_at)
  WHERE status = 'pending';
