CREATE TABLE IF NOT EXISTS editorial_posts (
  id uuid PRIMARY KEY,
  quest_id varchar(96) NOT NULL,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(16) NOT NULL
    CHECK (kind IN ('discussion', 'solution')),
  title varchar(160) NOT NULL,
  content text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected')),
  moderated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS editorial_posts_quest_kind_status_idx
  ON editorial_posts(quest_id, kind, status, created_at DESC);

CREATE INDEX IF NOT EXISTS editorial_posts_status_created_idx
  ON editorial_posts(status, created_at ASC);

CREATE INDEX IF NOT EXISTS editorial_posts_author_created_idx
  ON editorial_posts(author_id, created_at DESC);
