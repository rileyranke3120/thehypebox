CREATE TABLE IF NOT EXISTS social_posts (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id        text        NOT NULL,
  platform      text        NOT NULL CHECK (platform IN ('facebook', 'instagram', 'linkedin')),
  niche         text        NOT NULL,
  content       text        NOT NULL,
  hashtags      text[]      DEFAULT '{}',
  scheduled_date date       NOT NULL,
  status        text        DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'skipped')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_posts_status_idx       ON social_posts (status);
CREATE INDEX IF NOT EXISTS social_posts_scheduled_idx    ON social_posts (scheduled_date DESC);
CREATE INDEX IF NOT EXISTS social_posts_run_id_idx       ON social_posts (run_id);
