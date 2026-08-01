import crypto from "node:crypto";

export function createOjRepository(pool) {
  return {
    async createOjProblem(authorId, problem) {
      const id = crypto.randomUUID();
      const result = await pool.query(
        `INSERT INTO oj_problems
           (
             id, author_id, status, title, statement, time_limit_ms,
             memory_limit_mb, difficulty, tags, tests, std_source
           )
         VALUES
           ($1::uuid, $2::uuid, 'pending', $3, $4, $5::integer,
            $6::integer, $7::smallint, $8::text[], $9::jsonb, $10)
         RETURNING *`,
        [
          id,
          authorId,
          problem.title,
          problem.statement,
          problem.timeLimitMs,
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
      const result = await pool.query(
        `UPDATE oj_problems
            SET title = $3,
                statement = $4,
                time_limit_ms = $5::integer,
                memory_limit_mb = $6::integer,
                difficulty = $7::smallint,
                tags = $8::text[],
                tests = $9::jsonb,
                std_source = $10,
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
           COUNT(s.id)::integer AS submission_count,
           COUNT(s.id) FILTER (WHERE s.verdict = 'AC')::integer AS accepted_count,
           COUNT(*) OVER()::integer AS total_count
         FROM oj_problems p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN submissions s ON s.quest_id = 'oj-' || p.public_id::text
         WHERE p.status = 'published'
           AND (
             $1::text = ''
             OR p.title ILIKE '%' || $1::text || '%'
             OR p.public_id::text = $1::text
           )
           AND ($2::smallint IS NULL OR p.difficulty = $2::smallint)
           AND ($3::text = '' OR $3::text = ANY(p.tags))
         GROUP BY p.id, u.id
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
           COUNT(s.id)::integer AS submission_count,
           COUNT(s.id) FILTER (WHERE s.verdict = 'AC')::integer AS accepted_count
         FROM oj_problems p
         JOIN users u ON u.id = p.author_id
         LEFT JOIN submissions s ON s.quest_id = 'oj-' || p.public_id::text
         WHERE p.status = 'published' AND p.public_id = $1::bigint
         GROUP BY p.id, u.id`,
        [publicId],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },
    
    async listAuthorOjProblems(authorId) {
      const result = await pool.query(
        `SELECT p.*, u.display_name AS author_name
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
        `SELECT p.*, u.display_name AS author_name
           FROM oj_problems p
           JOIN users u ON u.id = p.author_id
          WHERE p.status = $1::varchar(16)
          ORDER BY p.created_at ASC
          LIMIT 200`,
        [status],
      );
      return result.rows.map(mapOjProblem);
    },
    
    async moderateOjProblem(problemId, status, reviewerId, reviewNote) {
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
  };
}

function mapOjProblem(row) {
  return {
    id: row.id,
    publicId: row.public_id === null || row.public_id === undefined
      ? null
      : Number(row.public_id),
    status: row.status,
    title: row.title,
    statement: row.statement ?? "",
    timeLimitMs: row.time_limit_ms,
    memoryLimitMb: row.memory_limit_mb,
    difficulty: row.difficulty,
    tags: row.tags ?? [],
    tests: Array.isArray(row.tests) ? row.tests : [],
    stdSource: row.std_source ?? "",
    reviewNote: row.review_note ?? "",
    author: {
      id: row.author_id,
      displayName: row.author_name ?? "PLAYER",
    },
    submissionCount: row.submission_count ?? 0,
    acceptedCount: row.accepted_count ?? 0,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
    reviewedAt: row.reviewed_at?.toISOString?.() ?? row.reviewed_at ?? null,
    publishedAt: row.published_at?.toISOString?.() ?? row.published_at ?? null,
  };
}

