ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS posted_at       timestamptz;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS platform_post_id text;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS error_message    text;
