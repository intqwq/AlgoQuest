ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS source_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS language varchar(16) NOT NULL DEFAULT 'cpp14',
  ADD COLUMN IF NOT EXISTS mode varchar(16) NOT NULL DEFAULT 'submit';

CREATE TABLE IF NOT EXISTS quest_drafts (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id varchar(96) NOT NULL,
  source_code text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS quest_drafts_user_updated_idx
  ON quest_drafts(user_id, updated_at DESC);
