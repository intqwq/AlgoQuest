CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  display_name varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS quest_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id varchar(96) NOT NULL,
  status varchar(16) NOT NULL CHECK (status IN ('started', 'cleared')),
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score BETWEEN 0 AND 100),
  cleared_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY,
  judge_submission_id uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id varchar(96) NOT NULL,
  status varchar(16) NOT NULL,
  verdict varchar(8),
  score integer CHECK (score BETWEEN 0 AND 100),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_user_created_idx
  ON submissions(user_id, created_at DESC);
