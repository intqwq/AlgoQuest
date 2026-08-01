ALTER TABLE editorial_posts
  ADD COLUMN IF NOT EXISTS scope varchar(16) NOT NULL DEFAULT 'quest';

ALTER TABLE editorial_posts
  DROP CONSTRAINT IF EXISTS editorial_posts_scope_check,
  ADD CONSTRAINT editorial_posts_scope_check
    CHECK (scope IN ('quest', 'oj', 'community'));

CREATE INDEX IF NOT EXISTS editorial_posts_scope_target_feed_idx
  ON editorial_posts(scope, quest_id, kind, status, created_at DESC);

CREATE INDEX IF NOT EXISTS player_profiles_public_search_idx
  ON player_profiles(is_public, lower(handle));
