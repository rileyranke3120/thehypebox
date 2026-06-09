-- Extend the existing review_requests table with full automation columns.

ALTER TABLE review_requests
  ADD COLUMN IF NOT EXISTS opportunity_id   text UNIQUE,
  ADD COLUMN IF NOT EXISTS contact_id       text,
  ADD COLUMN IF NOT EXISTS location_id      text,
  ADD COLUMN IF NOT EXISTS business_name    text,
  ADD COLUMN IF NOT EXISTS service_type     text,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS send_after       timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_after  timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS message_sent     text,
  ADD COLUMN IF NOT EXISTS follow_up_message text,
  ADD COLUMN IF NOT EXISTS google_review_url text,
  ADD COLUMN IF NOT EXISTS created_at       timestamptz DEFAULT now();

-- sent_at was DEFAULT now() on insert; make it nullable so the cron sets it explicitly.
-- Guard: column may not exist on all environments.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_requests' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE review_requests ALTER COLUMN sent_at DROP DEFAULT;
  END IF;
END $$;

-- Speed up the hourly cron query (pending/sent records due to send)
CREATE INDEX IF NOT EXISTS idx_review_requests_status_send_after
  ON review_requests (status, send_after);
