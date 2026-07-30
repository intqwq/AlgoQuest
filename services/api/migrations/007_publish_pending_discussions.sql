UPDATE editorial_posts
SET status = 'published',
    moderated_by = COALESCE(moderated_by, author_id),
    moderated_at = COALESCE(moderated_at, now()),
    updated_at = now()
WHERE kind = 'discussion'
  AND status = 'pending';
