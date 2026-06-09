-- Niche detection + snapshot deployment tracking

ALTER TABLE users ADD COLUMN IF NOT EXISTS niche text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS niche_confidence text;

CREATE TABLE IF NOT EXISTS snapshot_deployments (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid        REFERENCES users(id) ON DELETE SET NULL,
  location_id        text        NOT NULL,
  niche              text,
  snapshot_id        text,
  status             text        NOT NULL DEFAULT 'applied'
                                 CHECK (status IN ('applied', 'manual_required', 'failed')),
  confidence         text,
  matched_keyword    text,
  is_niche_specific  boolean     DEFAULT false,
  notes              text,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_deployments_location ON snapshot_deployments(location_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_deployments_status   ON snapshot_deployments(status);
CREATE INDEX IF NOT EXISTS idx_snapshot_deployments_created  ON snapshot_deployments(created_at DESC);
