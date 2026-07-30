ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role varchar(16) NOT NULL DEFAULT 'player';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('player', 'admin', 'owner'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS users_role_created_idx
  ON users(role, created_at DESC);

CREATE TABLE IF NOT EXISTS quest_catalog (
  id varchar(96) PRIMARY KEY,
  public_definition jsonb NOT NULL,
  judge_definition jsonb,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quest_catalog_archived_updated_idx
  ON quest_catalog(archived, updated_at DESC);

CREATE TABLE IF NOT EXISTS server_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  registration_enabled boolean NOT NULL DEFAULT true,
  judge_enabled boolean NOT NULL DEFAULT true,
  maintenance_message varchar(240) NOT NULL DEFAULT '',
  submission_cooldown_seconds integer NOT NULL DEFAULT 5
    CHECK (submission_cooldown_seconds BETWEEN 5 AND 300),
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO server_settings(singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS submission_cooldowns (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_submitted_at timestamptz NOT NULL DEFAULT now()
);
