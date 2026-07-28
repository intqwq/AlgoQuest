import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createOpaqueToken, hashToken } from "./auth.mjs";

const { Pool } = pg;

export function createDatabase(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Math.max(2, Number(process.env.DATABASE_POOL_SIZE ?? 10)),
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
  });

  return {
    async migrate() {
      const migrationUrl = new URL("../migrations/001_initial.sql", import.meta.url);
      const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
      await pool.query(sql);
    },

    async ping() {
      await pool.query("SELECT 1");
    },

    async createSession(displayName) {
      const userId = crypto.randomUUID();
      const token = createOpaqueToken();
      const tokenHash = hashToken(token);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "INSERT INTO users (id, display_name) VALUES ($1, $2)",
          [userId, displayName],
        );
        await client.query(
          `INSERT INTO sessions (token_hash, user_id, expires_at)
           VALUES ($1, $2, now() + interval '90 days')`,
          [tokenHash, userId],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      return {
        token,
        player: { id: userId, displayName },
      };
    },

    async authenticate(token) {
      const result = await pool.query(
        `SELECT u.id, u.display_name
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [hashToken(token)],
      );
      if (!result.rowCount) return undefined;
      return {
        id: result.rows[0].id,
        displayName: result.rows[0].display_name,
      };
    },

    async listProgress(userId) {
      const result = await pool.query(
        `SELECT quest_id, status, best_score, updated_at
           FROM quest_progress
          WHERE user_id = $1
          ORDER BY updated_at DESC`,
        [userId],
      );
      return result.rows.map((row) => ({
        questId: row.quest_id,
        status: row.status,
        bestScore: row.best_score,
        updatedAt: row.updated_at.toISOString(),
      }));
    },

    async saveProgress(userId, questId, status, score) {
      await pool.query(
        `INSERT INTO quest_progress
           (user_id, quest_id, status, best_score, cleared_at, updated_at)
         VALUES
           ($1, $2, $3, $4, CASE WHEN $3 = 'cleared' THEN now() END, now())
         ON CONFLICT (user_id, quest_id) DO UPDATE SET
           status = CASE
             WHEN quest_progress.status = 'cleared' THEN 'cleared'
             ELSE EXCLUDED.status
           END,
           best_score = GREATEST(quest_progress.best_score, EXCLUDED.best_score),
           cleared_at = COALESCE(
             quest_progress.cleared_at,
             CASE WHEN EXCLUDED.status = 'cleared' THEN now() END
           ),
           updated_at = now()`,
        [userId, questId, status, score],
      );
    },

    async createSubmission(userId, judgeSubmissionId, questId, status) {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO submissions
           (id, judge_submission_id, user_id, quest_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, judgeSubmissionId, userId, questId, status],
      );
      return id;
    },

    async findSubmission(userId, judgeSubmissionId) {
      const result = await pool.query(
        `SELECT id, quest_id
           FROM submissions
          WHERE user_id = $1 AND judge_submission_id = $2`,
        [userId, judgeSubmissionId],
      );
      if (!result.rowCount) return undefined;
      return {
        id: result.rows[0].id,
        questId: result.rows[0].quest_id,
      };
    },

    async updateSubmission(id, submission) {
      const score = submission.verdict === "AC" ? 100 : 0;
      await pool.query(
        `UPDATE submissions
            SET status = $2,
                verdict = $3,
                score = $4,
                details = $5::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [
          id,
          submission.status,
          submission.verdict ?? null,
          score,
          JSON.stringify(submission),
        ],
      );
    },

    async close() {
      await pool.end();
    },
  };
}

export async function migrateWithRetry(database, attempts = 30) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await database.migrate();
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  throw lastError;
}
