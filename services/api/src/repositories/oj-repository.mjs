import crypto from "node:crypto";

export function createOjRepository(pool) {
  return {
    async createOjProblem(authorId, problem) {
      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO oj_problems
           (
             id, author_id, status, title, statement, time_limit_ms,
             statement_format, memory_limit_mb, difficulty, tags, tests, std_source
           )
         VALUES
           ($1::uuid, $2::uuid, 'pending', $3, $4, $5::integer,
            $6, $7::integer, $8::smallint, $9::text[], $10::jsonb, $11)
         RETURNING *`,
        [
          id,
          authorId,
          problem.title,
          problem.statement,
          problem.timeLimitMs,
          problem.statementFormat,
          problem.memoryLimitMb,
          problem.difficulty,
          problem.tags,
          JSON.stringify(problem.tests),
          problem.stdSource,
        ],
      );
      return mapOjProblem(result.rows[0]);
    },

    async updateOjProblemDraft(problemId, authorId, problem) {
      const pendingRevision = await pool.query(
        `UPDATE oj_problems
            SET pending_revision = $3::jsonb,
                revision_status = 'pending',
                revision_review_note = '',
                revision_reviewer_id = NULL,
                revision_reviewed_at = NULL,
                updated_at = now()
          WHERE id = $1::uuid
            AND author_id = $2::uuid
            AND status = 'published'
          RETURNING *, true AS use_pending_revision`,
        [problemId, authorId, JSON.stringify(problem)],
      );
      if (pendingRevision.rowCount) return mapOjProblem(pendingRevision.rows[0]);

      const result = await pool.query(
        `UPDATE oj_problems
            SET title = $3,
                statement = $4,
                statement_format = $5,
                time_limit_ms = $6::integer,
                memory_limit_mb = $7::integer,
                difficulty = $8::smallint,
                tags = $9::text[],
                tests = $10::jsonb,
                std_source = $11,
                status = 'pending',
                review_note = '',
                reviewer_id = NULL,
                reviewed_at = NULL,
                updated_at = now()
          WHERE id = $1::uuid
            AND author_id = $2::uuid
            AND status IN ('pending', 'rejected')
          RETURNING *`,
        [
          problemId,
          authorId,
          problem.title,
          problem.statement,
          problem.statementFormat,
          problem.timeLimitMs,
          problem.memoryLimitMb,
          problem.difficulty,
          problem.tags,
          JSON.stringify(problem.tests),
          problem.stdSource,
        ],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async listPublishedOjProblems({ query = "", difficulty, tag = "", limit = 30, offset = 0 } = {}) {
      const normalizedQuery = query.trim().slice(0, 160);
      const normalizedDifficulty = Number.isInteger(difficulty) ? difficulty : null;
      const result = await pool.query(
        `SELECT
           p.id, p.public_id, p.status, p.title, p.time_limit_ms,
           p.memory_limit_mb, p.difficulty, p.tags, p.created_at,
           p.published_at, p.updated_at,
           u.id AS author_id, u.display_name AS author_name,
           CASE WHEN profile.is_public THEN profile.handle END AS author_handle,
           COUNT(s.id)::integer AS submission_count,
           COUNT(s.id) FILTER (WHERE s.verdict = 'AC')::integer AS accepted_count,
           COUNT(*) OVER()::integer AS total_count
         FROM oj_problems p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN player_profiles profile ON profile.user_id = u.id
         LEFT JOIN submissions s ON s.quest_id = 'oj-' || p.public_id::text
         WHERE p.status = 'published'
           AND (
             $1::text = ''
             OR p.title ILIKE '%' || $1::text || '%'
             OR p.public_id::text = $1::text
           )
           AND ($2::smallint IS NULL OR p.difficulty = $2::smallint)
           AND ($3::text = '' OR $3::text = ANY(p.tags))
         GROUP BY p.id, u.id, profile.handle, profile.is_public
         ORDER BY p.public_id DESC
         LIMIT $4::integer OFFSET $5::integer`,
        [
          normalizedQuery,
          normalizedDifficulty,
          tag.trim().slice(0, 80),
          Math.min(100, Math.max(1, limit)),
          Math.max(0, offset),
        ],
      );
      return {
        problems: result.rows.map(mapOjProblem),
        total: result.rows[0]?.total_count ?? 0,
      };
    },

    async getPublishedOjProblem(publicId) {
      const result = await pool.query(
        `SELECT
           p.*,
           u.id AS author_id, u.display_name AS author_name,
           CASE WHEN profile.is_public THEN profile.handle END AS author_handle,
           COUNT(s.id)::integer AS submission_count,
           COUNT(s.id) FILTER (WHERE s.verdict = 'AC')::integer AS accepted_count
         FROM oj_problems p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN player_profiles profile ON profile.user_id = u.id
         LEFT JOIN submissions s ON s.quest_id = 'oj-' || p.public_id::text
         WHERE p.status = 'published' AND p.public_id = $1::bigint
         GROUP BY p.id, u.id, profile.handle, profile.is_public`,
        [publicId],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async listAuthorOjProblems(authorId) {
      const result = await pool.query(
        `SELECT p.*, u.display_name AS author_name,
                (p.status <> 'archived' AND p.revision_status IS NOT NULL) AS use_pending_revision
           FROM oj_problems p
           JOIN users u ON u.id = p.author_id
          WHERE p.author_id = $1::uuid
          ORDER BY p.created_at DESC
          LIMIT 100`,
        [authorId],
      );
      return result.rows.map(mapOjProblem);
    },

    async listOjProblemsForModeration(status = "pending") {
      const result = await pool.query(
        `SELECT p.*, u.display_name AS author_name,
                (p.revision_status = $1::varchar(16)) AS use_pending_revision
           FROM oj_problems p
           JOIN users u ON u.id = p.author_id
          WHERE p.status = $1::varchar(16)
             OR p.revision_status = $1::varchar(16)
          ORDER BY p.created_at ASC
          LIMIT 200`,
        [status],
      );
      return result.rows.map(mapOjProblem);
    },

    async moderateOjProblem(problemId, status, reviewerId, reviewNote) {
      const revision = await pool.query(
        `UPDATE oj_problems
            SET title = CASE WHEN $2::varchar(16) = 'published' THEN pending_revision->>'title' ELSE title END,
                statement = CASE WHEN $2::varchar(16) = 'published' THEN pending_revision->>'statement' ELSE statement END,
                statement_format = CASE WHEN $2::varchar(16) = 'published' THEN COALESCE(pending_revision->>'statementFormat', 'plain') ELSE statement_format END,
                time_limit_ms = CASE WHEN $2::varchar(16) = 'published' THEN (pending_revision->>'timeLimitMs')::integer ELSE time_limit_ms END,
                memory_limit_mb = CASE WHEN $2::varchar(16) = 'published' THEN (pending_revision->>'memoryLimitMb')::integer ELSE memory_limit_mb END,
                difficulty = CASE WHEN $2::varchar(16) = 'published' THEN (pending_revision->>'difficulty')::smallint ELSE difficulty END,
                tags = CASE WHEN $2::varchar(16) = 'published' THEN ARRAY(SELECT jsonb_array_elements_text(pending_revision->'tags')) ELSE tags END,
                tests = CASE WHEN $2::varchar(16) = 'published' THEN pending_revision->'tests' ELSE tests END,
                std_source = CASE WHEN $2::varchar(16) = 'published' THEN pending_revision->>'stdSource' ELSE std_source END,
                revision_status = CASE WHEN $2::varchar(16) = 'published' THEN NULL ELSE 'rejected' END,
                revision_review_note = $4,
                revision_reviewer_id = $3::uuid,
                revision_reviewed_at = now(),
                pending_revision = CASE WHEN $2::varchar(16) = 'published' THEN NULL ELSE pending_revision END,
                updated_at = now()
          WHERE id = $1::uuid
            AND status = 'published'
            AND revision_status IN ('pending', 'rejected')
          RETURNING id`,
        [problemId, status, reviewerId, reviewNote],
      );
      if (revision.rowCount) {
        const listStatus = status === "published" ? "published" : "rejected";
        const problems = await this.listOjProblemsForModeration(listStatus);
        return problems.find((problem) => problem.id === problemId);
      }

      const result = await pool.query(
        `UPDATE oj_problems
            SET status = $2::varchar(16),
                public_id = CASE
                  WHEN $2::varchar(16) = 'published'
                  THEN COALESCE(public_id, nextval('oj_problem_public_id_seq'))
                  ELSE public_id
                END,
                reviewer_id = $3::uuid,
                review_note = $4,
                reviewed_at = now(),
                published_at = CASE
                  WHEN $2::varchar(16) = 'published'
                  THEN COALESCE(published_at, now())
                  ELSE published_at
                END,
                updated_at = now()
          WHERE id = $1::uuid
            AND status IN ('pending', 'rejected')
          RETURNING id`,
        [problemId, status, reviewerId, reviewNote],
      );
      if (!result.rowCount) return undefined;
      const problems = await this.listOjProblemsForModeration(status);
      return problems.find((problem) => problem.id === problemId);
    },

    async adminUpdateOjProblem(problemId, actorId, problem) {
      const result = await pool.query(
        `UPDATE oj_problems
            SET title = $3,
                statement = $4,
                statement_format = $5,
                time_limit_ms = $6::integer,
                memory_limit_mb = $7::integer,
                difficulty = $8::smallint,
                tags = $9::text[],
                tests = $10::jsonb,
                std_source = $11,
                pending_revision = NULL,
                revision_status = NULL,
                revision_review_note = '',
                revision_reviewer_id = NULL,
                revision_reviewed_at = NULL,
                reviewer_id = $2::uuid,
                reviewed_at = now(),
                updated_at = now()
          WHERE id = $1::uuid
          RETURNING *`,
        [
          problemId, actorId, problem.title, problem.statement,
          problem.statementFormat, problem.timeLimitMs, problem.memoryLimitMb,
          problem.difficulty, problem.tags, JSON.stringify(problem.tests),
          problem.stdSource,
        ],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async archiveOjProblem(problemId, actorId) {
      const result = await pool.query(
        `UPDATE oj_problems
            SET status = 'archived', archived_at = now(), reviewer_id = $2::uuid,
                reviewed_at = now(), updated_at = now()
          WHERE id = $1::uuid AND status <> 'archived'
          RETURNING *`,
        [problemId, actorId],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async deleteOjProblem(problemId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const target = await client.query(
          "SELECT public_id FROM oj_problems WHERE id = $1::uuid FOR UPDATE",
          [problemId],
        );
        if (!target.rowCount) {
          await client.query("ROLLBACK");
          return false;
        }
        if (target.rows[0].public_id !== null) {
          await client.query(
            "DELETE FROM editorial_posts WHERE scope = 'oj' AND quest_id = $1::text",
            [String(target.rows[0].public_id)],
          );
        }
        await client.query("DELETE FROM oj_problems WHERE id = $1::uuid", [problemId]);
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

function mapOjProblem(row) {
  const revision = row.use_pending_revision && row.pending_revision
    ? row.pending_revision
    : undefined;
  return {
    id: row.id,
    publicId: row.public_id === null || row.public_id === undefined
      ? null
      : Number(row.public_id),
    status: revision ? row.revision_status : row.status,
    title: revision?.title ?? row.title,
    statement: revision?.statement ?? row.statement ?? "",
    statementFormat: revision?.statementFormat ?? row.statement_format ?? "plain",
    timeLimitMs: revision?.timeLimitMs ?? row.time_limit_ms,
    memoryLimitMb: revision?.memoryLimitMb ?? row.memory_limit_mb,
    difficulty: revision?.difficulty ?? row.difficulty,
    tags: revision?.tags ?? row.tags ?? [],
    tests: revision?.tests ?? (Array.isArray(row.tests) ? row.tests : []),
    stdSource: revision?.stdSource ?? row.std_source ?? "",
    reviewNote: revision ? row.revision_review_note ?? "" : row.review_note ?? "",
    author: {
      id: row.author_id,
      displayName: row.author_name ?? "PLAYER",
      handle: row.author_handle ?? null,
    },
    submissionCount: row.submission_count ?? 0,
    acceptedCount: row.accepted_count ?? 0,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
    reviewedAt: revision
      ? row.revision_reviewed_at?.toISOString?.() ?? row.revision_reviewed_at ?? null
      : row.reviewed_at?.toISOString?.() ?? row.reviewed_at ?? null,
    publishedAt: row.published_at?.toISOString?.() ?? row.published_at ?? null,
  };
}
