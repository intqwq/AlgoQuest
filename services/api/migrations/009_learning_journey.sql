ALTER TABLE users
  ADD COLUMN IF NOT EXISTS has_cpp_foundation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_algorithm_foundation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS learning_profile_set boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS web_tutorial_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS quest_story_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id varchar(96) NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS quest_story_progress_user_idx
  ON quest_story_progress(user_id, completed_at DESC);
