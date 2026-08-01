CREATE TABLE IF NOT EXISTS learning_goals (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_minutes integer NOT NULL DEFAULT 30 CHECK (daily_minutes BETWEEN 5 AND 480),
  weekly_quest_target integer NOT NULL DEFAULT 3 CHECK (weekly_quest_target BETWEEN 1 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 480),
  kind varchar(16) NOT NULL CHECK (kind IN ('study', 'practice', 'review')),
  note varchar(240) NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_sessions_user_started_idx
  ON learning_sessions(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS player_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle varchar(32) NOT NULL UNIQUE,
  bio varchar(280) NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT false,
  show_code boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_profiles_public_handle_idx
  ON player_profiles(handle) WHERE is_public = true;

CREATE TABLE IF NOT EXISTS player_achievements (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id varchar(64) NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS quest_unlock_rules (
  quest_id varchar(96) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  label varchar(160) NOT NULL DEFAULT '',
  rule jsonb NOT NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quest_content_drafts (
  id uuid PRIMARY KEY,
  quest_id varchar(96) NOT NULL,
  title varchar(160) NOT NULL,
  public_definition jsonb NOT NULL,
  judge_definition jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  status varchar(16) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quest_content_drafts_quest_idx
  ON quest_content_drafts(quest_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS quest_versions (
  quest_id varchar(96) NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  public_definition jsonb NOT NULL,
  judge_definition jsonb NOT NULL,
  note varchar(240) NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (quest_id, version)
);

CREATE TABLE IF NOT EXISTS codex_entries (
  id varchar(64) PRIMARY KEY,
  category varchar(32) NOT NULL,
  quest_id varchar(96) NOT NULL,
  marker varchar(8) NOT NULL DEFAULT '++',
  title jsonb NOT NULL,
  summary jsonb NOT NULL,
  explanation jsonb NOT NULL,
  checkpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_complexity varchar(80) NOT NULL DEFAULT 'O(?)',
  space_complexity varchar(80) NOT NULL DEFAULT 'O(?)',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  code text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS codex_entries_published_order_idx
  ON codex_entries(published, sort_order, id);

INSERT INTO quest_unlock_rules(quest_id, enabled, label, rule)
VALUES (
  'nameless-room',
  true,
  'Sustained learner: five clears, five ACs and a two-day streak',
  '{"all":[{"clearedAtLeast":5},{"acceptedCountAtLeast":5},{"streakAtLeast":2}]}'::jsonb
)
ON CONFLICT (quest_id) DO NOTHING;

