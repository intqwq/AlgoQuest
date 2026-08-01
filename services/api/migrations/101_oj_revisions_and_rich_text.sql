ALTER TABLE oj_problems
  ADD COLUMN IF NOT EXISTS statement_format varchar(24) NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS pending_revision jsonb,
  ADD COLUMN IF NOT EXISTS revision_status varchar(16),
  ADD COLUMN IF NOT EXISTS revision_review_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS revision_reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revision_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE oj_problems
  DROP CONSTRAINT IF EXISTS oj_problems_statement_format_check,
  ADD CONSTRAINT oj_problems_statement_format_check
    CHECK (statement_format IN ('plain', 'tiptap-json-v1')),
  DROP CONSTRAINT IF EXISTS oj_problems_revision_status_check,
  ADD CONSTRAINT oj_problems_revision_status_check
    CHECK (revision_status IS NULL OR revision_status IN ('pending', 'rejected'));

CREATE INDEX IF NOT EXISTS oj_problems_revision_queue_index
  ON oj_problems(revision_status, updated_at)
  WHERE revision_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS oj_problems_archived_index
  ON oj_problems(status, archived_at DESC)
  WHERE status = 'archived';
