CREATE SEQUENCE IF NOT EXISTS oj_problem_public_id_seq START WITH 1000;

CREATE TABLE IF NOT EXISTS oj_problems (
  id uuid PRIMARY KEY,
  public_id bigint UNIQUE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected')),
  title varchar(160) NOT NULL,
  statement text NOT NULL,
  time_limit_ms integer NOT NULL CHECK (time_limit_ms BETWEEN 100 AND 10000),
  memory_limit_mb integer NOT NULL CHECK (memory_limit_mb BETWEEN 16 AND 512),
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 10),
  tags text[] NOT NULL DEFAULT '{}',
  tests jsonb NOT NULL,
  std_source text NOT NULL,
  review_note varchar(1000) NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (status = 'published' AND public_id IS NOT NULL AND published_at IS NOT NULL)
    OR status <> 'published'
  )
);

CREATE INDEX IF NOT EXISTS oj_problems_public_index
  ON oj_problems(status, difficulty, public_id DESC);

CREATE INDEX IF NOT EXISTS oj_problems_author_index
  ON oj_problems(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS oj_problems_tags_index
  ON oj_problems USING gin(tags);
