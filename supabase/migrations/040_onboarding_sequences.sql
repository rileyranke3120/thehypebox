CREATE TABLE IF NOT EXISTS onboarding_sequences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  name       TEXT,
  plan       TEXT,
  step       TEXT NOT NULL CHECK (step IN ('day1', 'day3', 'day7', 'day14')),
  fire_at    TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'error')),
  error_msg  TEXT,
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT onboarding_sequences_email_step_key UNIQUE (email, step)
);

CREATE INDEX IF NOT EXISTS onboarding_seq_pending_fire_at
  ON onboarding_sequences (fire_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS onboarding_seq_email
  ON onboarding_sequences (email);
