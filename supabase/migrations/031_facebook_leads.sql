CREATE TABLE IF NOT EXISTS facebook_leads (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scraped_at       TIMESTAMPTZ DEFAULT NOW(),
  group_query      TEXT NOT NULL,
  post_url         TEXT UNIQUE,
  poster_name      TEXT,
  business_name    TEXT,
  phone            TEXT,
  post_content     TEXT NOT NULL,
  pain_point       TEXT NOT NULL,
  matched_keywords TEXT[] DEFAULT '{}',
  ghl_contact_id   TEXT,
  barry_sms_sent   BOOLEAN DEFAULT FALSE,
  barry_sms_sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_facebook_leads_scraped_at  ON facebook_leads(scraped_at);
CREATE INDEX IF NOT EXISTS idx_facebook_leads_pain_point  ON facebook_leads(pain_point);
CREATE INDEX IF NOT EXISTS idx_facebook_leads_ghl_contact ON facebook_leads(ghl_contact_id);
CREATE INDEX IF NOT EXISTS idx_facebook_leads_sms_sent    ON facebook_leads(barry_sms_sent);
