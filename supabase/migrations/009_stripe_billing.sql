-- Add Stripe billing columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan_status           text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS trial_ends_at         timestamptz;

-- Index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription ON public.users(stripe_subscription_id);
