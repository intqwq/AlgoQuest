ALTER TABLE editorial_posts
  ADD COLUMN IF NOT EXISTS content_format varchar(32) NOT NULL DEFAULT 'plain';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'editorial_posts_content_format_check'
       AND conrelid = 'editorial_posts'::regclass
  ) THEN
    ALTER TABLE editorial_posts
      ADD CONSTRAINT editorial_posts_content_format_check
      CHECK (content_format IN ('plain', 'tiptap-json-v1'));
  END IF;
END
$$;

