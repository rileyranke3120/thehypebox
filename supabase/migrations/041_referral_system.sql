-- Referral system: unique codes per user, credit tracking, referral log
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_credits_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

CREATE INDEX IF NOT EXISTS users_referred_by_code_idx ON users(referred_by_code);

CREATE TABLE IF NOT EXISTS referral_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referrer_email TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  credit_cents INTEGER NOT NULL DEFAULT 5000,
  stripe_credit_applied BOOLEAN NOT NULL DEFAULT false,
  sms_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS referral_tracking_referrer_idx ON referral_tracking(referrer_user_id);

-- Atomic increment for referral credit balance
CREATE OR REPLACE FUNCTION increment_referral_credits(p_user_id UUID, p_amount INTEGER)
RETURNS VOID LANGUAGE SQL AS $$
  UPDATE users SET referral_credits_cents = referral_credits_cents + p_amount WHERE id = p_user_id;
$$;
