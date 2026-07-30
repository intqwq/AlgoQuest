import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { createOpaqueToken, hashToken } from "./auth.mjs";

const { Pool } = pg;

export function createRateLimitQuery(action, key, windowSeconds) {
  return {
    text: `INSERT INTO auth_rate_limits
             (action, key_hash, window_started_at, attempts)
           VALUES ($1, $2, now(), 1)
           ON CONFLICT (action, key_hash) DO UPDATE SET
             attempts = CASE
               WHEN auth_rate_limits.window_started_at <
                    now() - ($3::integer * interval '1 second')
               THEN 1
               ELSE auth_rate_limits.attempts + 1
             END,
             window_started_at = CASE
               WHEN auth_rate_limits.window_started_at <
                    now() - ($3::integer * interval '1 second')
               THEN now()
               ELSE auth_rate_limits.window_started_at
             END
           RETURNING attempts`,
    values: [action, hashToken(key), windowSeconds],
  };
}

export function createSaveProgressQuery(userId, questId, status, score) {
  return {
    text: `INSERT INTO quest_progress
       (user_id, quest_id, status, best_score, cleared_at, updated_at)
     VALUES
       (
         $1::uuid,
         $2::varchar(96),
         $3::varchar(16),
         $4::integer,
         CASE
           WHEN $3::varchar(16) = 'cleared'::varchar(16) THEN now()
         END,
         now()
       )
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
    values: [userId, questId, status, score],
  };
}

export function createDatabase(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: Math.max(2, Number(process.env.DATABASE_POOL_SIZE ?? 10)),
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 30_000,
  });

  return {
    async migrate() {
      const migrationsUrl = new URL("../migrations/", import.meta.url);
      const migrationsPath = fileURLToPath(migrationsUrl);
      const files = (await readdir(migrationsPath))
        .filter((name) => /^\d+_.+\.sql$/.test(name))
        .sort();
      for (const file of files) {
        const sql = await readFile(new URL(file, migrationsUrl), "utf8");
        await pool.query(sql);
      }
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
        player: {
          id: userId,
          displayName,
          email: null,
          emailVerified: false,
          isGuest: true,
          role: "player",
        },
      };
    },

    async authenticate(token) {
      const result = await pool.query(
        `SELECT
           u.id, u.display_name, u.email, u.email_verified_at, u.is_guest, u.role
           FROM sessions s
           JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [hashToken(token)],
      );
      if (!result.rowCount) return undefined;
      return {
        id: result.rows[0].id,
        displayName: result.rows[0].display_name,
        email: result.rows[0].email,
        emailVerified: Boolean(result.rows[0].email_verified_at),
        isGuest: result.rows[0].is_guest,
      };
    },

    async consumeRateLimit(action, key, limit, windowSeconds) {
      const query = createRateLimitQuery(action, key, windowSeconds);
      const result = await pool.query(query.text, query.values);
      return result.rows[0].attempts <= limit;
    },

    async registerAccount({ anonymousUserId, displayName, email, passwordHash }) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await client.query(
          "SELECT id, email_verified_at FROM users WHERE lower(email) = $1 FOR UPDATE",
          [email],
        );
        if (existing.rowCount) {
          await client.query("COMMIT");
          return { created: false, verified: Boolean(existing.rows[0].email_verified_at) };
        }

        let userId;
        if (anonymousUserId) {
          const updated = await client.query(
            `UPDATE users
                SET display_name = $2,
                    email = $3,
                    password_hash = $4,
                    is_guest = false,
                    updated_at = now()
              WHERE id = $1 AND is_guest = true
              RETURNING id`,
            [anonymousUserId, displayName, email, passwordHash],
          );
          userId = updated.rows[0]?.id;
        }
        if (!userId) {
          userId = crypto.randomUUID();
          await client.query(
            `INSERT INTO users
               (id, display_name, email, password_hash, is_guest)
             VALUES ($1, $2, $3, $4, false)`,
            [userId, displayName, email, passwordHash],
          );
        }

        const token = createOpaqueToken();
        const tokenHash = hashToken(token);
        await client.query(
          "DELETE FROM account_tokens WHERE user_id = $1 AND kind = 'verify_email' AND used_at IS NULL",
          [userId],
        );
        await client.query(
          `INSERT INTO account_tokens
             (id, user_id, kind, token_hash, expires_at)
           VALUES ($1, $2, 'verify_email', $3, now() + interval '30 minutes')`,
          [crypto.randomUUID(), userId, tokenHash],
        );
        await client.query("COMMIT");
        return {
          created: true,
          userId,
          displayName,
          email,
          token,
          tokenHash,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        if (error.code === "23505") return { created: false, verified: false };
        throw error;
      } finally {
        client.release();
      }
    },

    async createVerificationToken(email) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const user = await client.query(
          `SELECT id, display_name, email, email_verified_at
             FROM users
            WHERE lower(email) = $1 AND is_guest = false
            FOR UPDATE`,
          [email],
        );
        if (!user.rowCount || user.rows[0].email_verified_at) {
          await client.query("COMMIT");
          return undefined;
        }
        const token = createOpaqueToken();
        const tokenHash = hashToken(token);
        await client.query(
          "DELETE FROM account_tokens WHERE user_id = $1 AND kind = 'verify_email' AND used_at IS NULL",
          [user.rows[0].id],
        );
        await client.query(
          `INSERT INTO account_tokens
             (id, user_id, kind, token_hash, expires_at)
           VALUES ($1, $2, 'verify_email', $3, now() + interval '30 minutes')`,
          [crypto.randomUUID(), user.rows[0].id, tokenHash],
        );
        await client.query("COMMIT");
        return {
          displayName: user.rows[0].display_name,
          email: user.rows[0].email,
          token,
          tokenHash,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async verifyEmail(token) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const record = await client.query(
          `SELECT id, user_id
             FROM account_tokens
            WHERE token_hash = $1
              AND kind = 'verify_email'
              AND used_at IS NULL
              AND expires_at > now()
            FOR UPDATE`,
          [hashToken(token)],
        );
        if (!record.rowCount) {
          await client.query("ROLLBACK");
          return undefined;
        }
        await client.query(
          "UPDATE account_tokens SET used_at = now() WHERE id = $1",
          [record.rows[0].id],
        );
        const user = await client.query(
          `UPDATE users
              SET email_verified_at = COALESCE(email_verified_at, now()),
                  updated_at = now()
            WHERE id = $1
            RETURNING
              id, display_name, email, email_verified_at, is_guest, role`,
          [record.rows[0].user_id],
        );
        const session = await createSessionForUser(client, record.rows[0].user_id);
        await client.query("COMMIT");
        return { token: session, player: mapPlayer(user.rows[0]) };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async findAccountForLogin(email) {
      const result = await pool.query(
        `SELECT
           id, display_name, email, password_hash, email_verified_at,
           is_guest, role
           FROM users
          WHERE lower(email) = $1 AND is_guest = false`,
        [email],
      );
      if (!result.rowCount) return undefined;
      return {
        ...mapPlayer(result.rows[0]),
        passwordHash: result.rows[0].password_hash,
      };
    },

    async loginAccount(userId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const user = await client.query(
          `UPDATE users
              SET last_login_at = now(), updated_at = now()
            WHERE id = $1
            RETURNING
              id, display_name, email, email_verified_at, is_guest, role`,
          [userId],
        );
        const token = await createSessionForUser(client, userId);
        await client.query("COMMIT");
        return { token, player: mapPlayer(user.rows[0]) };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async createPasswordResetToken(email) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const user = await client.query(
          `SELECT id, display_name, email
             FROM users
            WHERE lower(email) = $1
              AND is_guest = false
              AND email_verified_at IS NOT NULL
            FOR UPDATE`,
          [email],
        );
        if (!user.rowCount) {
          await client.query("COMMIT");
          return undefined;
        }
        const token = createOpaqueToken();
        const tokenHash = hashToken(token);
        await client.query(
          "DELETE FROM account_tokens WHERE user_id = $1 AND kind = 'password_reset' AND used_at IS NULL",
          [user.rows[0].id],
        );
        await client.query(
          `INSERT INTO account_tokens
             (id, user_id, kind, token_hash, expires_at)
           VALUES ($1, $2, 'password_reset', $3, now() + interval '20 minutes')`,
          [crypto.randomUUID(), user.rows[0].id, tokenHash],
        );
        await client.query("COMMIT");
        return {
          displayName: user.rows[0].display_name,
          email: user.rows[0].email,
          token,
          tokenHash,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async resetPassword(token, passwordHash) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const record = await client.query(
          `SELECT id, user_id
             FROM account_tokens
            WHERE token_hash = $1
              AND kind = 'password_reset'
              AND used_at IS NULL
              AND expires_at > now()
            FOR UPDATE`,
          [hashToken(token)],
        );
        if (!record.rowCount) {
          await client.query("ROLLBACK");
          return undefined;
        }
        await client.query(
          "UPDATE account_tokens SET used_at = now() WHERE id = $1",
          [record.rows[0].id],
        );
        const user = await client.query(
          `UPDATE users
              SET password_hash = $2, updated_at = now()
            WHERE id = $1
            RETURNING
              id, display_name, email, email_verified_at, is_guest, role`,
          [record.rows[0].user_id, passwordHash],
        );
        await client.query("DELETE FROM sessions WHERE user_id = $1", [
          record.rows[0].user_id,
        ]);
        const session = await createSessionForUser(client, record.rows[0].user_id);
        await client.query("COMMIT");
        return { token: session, player: mapPlayer(user.rows[0]) };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async updateProfile(userId, displayName) {
      const result = await pool.query(
        `UPDATE users
            SET display_name = $2, updated_at = now()
          WHERE id = $1
          RETURNING
            id, display_name, email, email_verified_at, is_guest, role`,
        [userId, displayName],
      );
      return mapPlayer(result.rows[0]);
    },

    async revokeSession(token) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [
        hashToken(token),
      ]);
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
      const query = createSaveProgressQuery(userId, questId, status, score);
      await pool.query(query.text, query.values);
    },

    async hasAcceptedSubmission(userId, questId) {
      const result = await pool.query(
        `SELECT 1
           FROM submissions
          WHERE user_id = $1 AND quest_id = $2 AND verdict = 'AC'
          LIMIT 1`,
        [userId, questId],
      );
      return Boolean(result.rowCount);
    },

    async createSubmission(
      userId,
      judgeSubmissionId,
      questId,
      status,
      sourceCode,
      language,
      mode,
    ) {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO submissions
           (
             id, judge_submission_id, user_id, quest_id, status,
             source_code, language, mode
           )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          judgeSubmissionId,
          userId,
          questId,
          status,
          sourceCode,
          language,
          mode,
        ],
      );
      return id;
    },

    async findSubmission(userId, judgeSubmissionId) {
      const result = await pool.query(
        `SELECT id, judge_submission_id, quest_id, status, verdict, details
           FROM submissions
          WHERE user_id = $1 AND judge_submission_id = $2`,
        [userId, judgeSubmissionId],
      );
      if (!result.rowCount) return undefined;
      return {
        id: result.rows[0].id,
        judgeSubmissionId: result.rows[0].judge_submission_id,
        questId: result.rows[0].quest_id,
        status: result.rows[0].status,
        verdict: result.rows[0].verdict,
        details: result.rows[0].details,
      };
    },

    async updateSubmission(id, submission) {
      const score = Math.min(
        100,
        Math.max(
          0,
          Math.round(
            Number(
              submission.score ??
                (submission.verdict === "AC" ? 100 : 0),
            ),
          ),
        ),
      );
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

    async listDrafts(userId) {
      const result = await pool.query(
        `SELECT quest_id, source_code, updated_at
           FROM quest_drafts
          WHERE user_id = $1
          ORDER BY updated_at DESC`,
        [userId],
      );
      return result.rows.map((row) => ({
        questId: row.quest_id,
        source: row.source_code,
        updatedAt: row.updated_at.toISOString(),
      }));
    },

    async saveDraft(userId, questId, source) {
      const result = await pool.query(
        `INSERT INTO quest_drafts
           (user_id, quest_id, source_code, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (user_id, quest_id) DO UPDATE SET
           source_code = EXCLUDED.source_code,
           updated_at = now()
         RETURNING quest_id, source_code, updated_at`,
        [userId, questId, source],
      );
      const row = result.rows[0];
      return {
        questId: row.quest_id,
        source: row.source_code,
        updatedAt: row.updated_at.toISOString(),
      };
    },

    async replaceDrafts(userId, drafts) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM quest_drafts WHERE user_id = $1", [
          userId,
        ]);
        for (const draft of drafts) {
          await client.query(
            `INSERT INTO quest_drafts
               (user_id, quest_id, source_code, updated_at)
             VALUES ($1, $2, $3, now())`,
            [userId, draft.questId, draft.source],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async listSubmissionHistory(userId, limit = 100) {
      const result = await pool.query(
        `SELECT
           id, judge_submission_id, quest_id, status, verdict, score,
           source_code, language, mode, details, created_at, updated_at
         FROM submissions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2::integer`,
        [userId, limit],
      );
      return result.rows.map((row) => ({
        id: row.id,
        judgeSubmissionId: row.judge_submission_id,
        questId: row.quest_id,
        status: row.status,
        verdict: row.verdict,
        score: row.score ?? 0,
        source: row.source_code,
        language: row.language,
        mode: row.mode,
        details: row.details,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }));
    },

    async getPlayerSave(userId) {
      const [progress, drafts, submissions] = await Promise.all([
        this.listProgress(userId),
        this.listDrafts(userId),
        this.listSubmissionHistory(userId),
      ]);
      const timestamps = [
        ...progress.map((item) => item.updatedAt),
        ...drafts.map((item) => item.updatedAt),
        ...submissions.map((item) => item.updatedAt),
      ].map((value) => Date.parse(value));
      const latest = timestamps.length ? Math.max(...timestamps) : 0;
      return {
        version: 2,
        accountId: userId,
        updatedAt: new Date(latest).toISOString(),
        progress,
        drafts,
        submissions,
      };
    },

    async transferGuestSave(guestId, userId) {
      if (!guestId || guestId === userId) return;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const guest = await client.query(
          "SELECT id FROM users WHERE id = $1 AND is_guest = true FOR UPDATE",
          [guestId],
        );
        if (!guest.rowCount) {
          await client.query("COMMIT");
          return;
        }
        await mergeGuestProgress(client, guestId, userId);
        await client.query(
          `INSERT INTO quest_drafts
             (user_id, quest_id, source_code, updated_at)
           SELECT $2, quest_id, source_code, updated_at
             FROM quest_drafts
            WHERE user_id = $1
           ON CONFLICT (user_id, quest_id) DO UPDATE SET
             source_code = EXCLUDED.source_code,
             updated_at = GREATEST(
               quest_drafts.updated_at,
               EXCLUDED.updated_at
             )`,
          [guestId, userId],
        );
        await client.query(
          "UPDATE submissions SET user_id = $2 WHERE user_id = $1",
          [guestId, userId],
        );
        await client.query("DELETE FROM users WHERE id = $1", [guestId]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async discardGuestSave(guestId) {
      if (!guestId) return;
      await pool.query("DELETE FROM users WHERE id = $1 AND is_guest = true", [
        guestId,
      ]);
    },

    async ensureSiteOwner(email) {
      const result = email
        ? await pool.query(
            `UPDATE users
                SET role = 'owner', updated_at = now()
              WHERE lower(email) = lower($1)
                AND is_guest = false
                AND email_verified_at IS NOT NULL
              RETURNING
                id, display_name, email, email_verified_at, is_guest, role`,
            [email],
          )
        : await pool.query(
            `WITH candidate AS (
               SELECT id
                 FROM users
                WHERE is_guest = false
                  AND email_verified_at IS NOT NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM users WHERE role = 'owner'
                  )
                ORDER BY created_at
                LIMIT 1
             )
             UPDATE users
                SET role = 'owner', updated_at = now()
               FROM candidate
              WHERE users.id = candidate.id
              RETURNING
                users.id,
                users.display_name,
                users.email,
                users.email_verified_at,
                users.is_guest,
                users.role`,
          );
      return result.rowCount ? mapPlayer(result.rows[0]) : undefined;
    },

    async listUsers({ query = "", limit = 50, offset = 0 } = {}) {
      const normalizedQuery = query.trim().slice(0, 120);
      const result = await pool.query(
        `SELECT
           u.id,
           u.display_name,
           u.email,
           u.email_verified_at,
           u.is_guest,
           u.role,
           u.created_at,
           u.updated_at,
           u.last_login_at,
           COUNT(DISTINCT qp.quest_id)
             FILTER (WHERE qp.status = 'cleared')::integer AS cleared_count,
           COUNT(DISTINCT s.id)::integer AS submission_count
         FROM users u
         LEFT JOIN quest_progress qp ON qp.user_id = u.id
         LEFT JOIN submissions s ON s.user_id = u.id
         WHERE u.is_guest = false
           AND (
             $1 = ''
             OR u.display_name ILIKE '%' || $1 || '%'
             OR COALESCE(u.email, '') ILIKE '%' || $1 || '%'
           )
         GROUP BY u.id
         ORDER BY
           CASE u.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
           u.created_at DESC
         LIMIT $2::integer
         OFFSET $3::integer`,
        [normalizedQuery, Math.min(100, Math.max(1, limit)), Math.max(0, offset)],
      );
      return result.rows.map((row) => ({
        ...mapPlayer(row),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        lastLoginAt: row.last_login_at?.toISOString() ?? null,
        clearedCount: row.cleared_count ?? 0,
        submissionCount: row.submission_count ?? 0,
      }));
    },

    async findUserById(userId) {
      const result = await pool.query(
        `SELECT
           id, display_name, email, email_verified_at, is_guest, role,
           created_at, updated_at, last_login_at
         FROM users
         WHERE id = $1`,
        [userId],
      );
      if (!result.rowCount) return undefined;
      return {
        ...mapPlayer(result.rows[0]),
        createdAt: result.rows[0].created_at.toISOString(),
        updatedAt: result.rows[0].updated_at.toISOString(),
        lastLoginAt: result.rows[0].last_login_at?.toISOString() ?? null,
      };
    },

    async updateManagedUser(userId, { displayName, emailVerified, role }) {
      const result = await pool.query(
        `UPDATE users
            SET display_name = $2,
                email_verified_at = CASE
                  WHEN $3::boolean THEN COALESCE(email_verified_at, now())
                  ELSE NULL
                END,
                role = $4,
                updated_at = now()
          WHERE id = $1 AND is_guest = false
          RETURNING
            id, display_name, email, email_verified_at, is_guest, role`,
        [userId, displayName, emailVerified, role],
      );
      return result.rowCount ? mapPlayer(result.rows[0]) : undefined;
    },

    async listQuestRecords({ includeArchived = false } = {}) {
      const result = await pool.query(
        `SELECT
           id, public_definition, judge_definition, archived,
           created_at, updated_at
         FROM quest_catalog
         WHERE $1::boolean OR archived = false
         ORDER BY
           COALESCE((public_definition->>'sortOrder')::integer, 999999),
           id`,
        [includeArchived],
      );
      return result.rows.map(mapQuestRecord);
    },

    async getQuestRecord(questId) {
      const result = await pool.query(
        `SELECT
           id, public_definition, judge_definition, archived,
           created_at, updated_at
         FROM quest_catalog
         WHERE id = $1`,
        [questId],
      );
      return result.rowCount ? mapQuestRecord(result.rows[0]) : undefined;
    },

    async upsertQuestRecord(
      questId,
      publicDefinition,
      judgeDefinition,
      actorId,
    ) {
      const result = await pool.query(
        `INSERT INTO quest_catalog
           (
             id, public_definition, judge_definition, archived,
             created_by, updated_by
           )
         VALUES ($1, $2::jsonb, $3::jsonb, false, $4, $4)
         ON CONFLICT (id) DO UPDATE SET
           public_definition = EXCLUDED.public_definition,
           judge_definition = EXCLUDED.judge_definition,
           archived = false,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
         RETURNING
           id, public_definition, judge_definition, archived,
           created_at, updated_at`,
        [
          questId,
          JSON.stringify(publicDefinition),
          judgeDefinition === null ? null : JSON.stringify(judgeDefinition),
          actorId,
        ],
      );
      return mapQuestRecord(result.rows[0]);
    },

    async archiveQuestRecord(questId, actorId) {
      const result = await pool.query(
        `UPDATE quest_catalog
            SET archived = true, updated_by = $2, updated_at = now()
          WHERE id = $1
          RETURNING id`,
        [questId, actorId],
      );
      return Boolean(result.rowCount);
    },

    async getServerSettings() {
      const result = await pool.query(
        `SELECT
           registration_enabled,
           judge_enabled,
           maintenance_message,
           submission_cooldown_seconds,
           updated_at
         FROM server_settings
         WHERE singleton = true`,
      );
      const row = result.rows[0];
      return {
        registrationEnabled: row.registration_enabled,
        judgeEnabled: row.judge_enabled,
        maintenanceMessage: row.maintenance_message,
        submissionCooldownSeconds: row.submission_cooldown_seconds,
        updatedAt: row.updated_at.toISOString(),
      };
    },

    async updateServerSettings(settings, actorId) {
      const result = await pool.query(
        `UPDATE server_settings
            SET registration_enabled = $1,
                judge_enabled = $2,
                maintenance_message = $3,
                submission_cooldown_seconds = $4,
                updated_by = $5,
                updated_at = now()
          WHERE singleton = true
          RETURNING
            registration_enabled,
            judge_enabled,
            maintenance_message,
            submission_cooldown_seconds,
            updated_at`,
        [
          settings.registrationEnabled,
          settings.judgeEnabled,
          settings.maintenanceMessage,
          settings.submissionCooldownSeconds,
          actorId,
        ],
      );
      const row = result.rows[0];
      return {
        registrationEnabled: row.registration_enabled,
        judgeEnabled: row.judge_enabled,
        maintenanceMessage: row.maintenance_message,
        submissionCooldownSeconds: row.submission_cooldown_seconds,
        updatedAt: row.updated_at.toISOString(),
      };
    },

    async serverStatistics() {
      const result = await pool.query(
        `SELECT
           (SELECT COUNT(*)::integer FROM users WHERE is_guest = false)
             AS players,
           (SELECT COUNT(*)::integer FROM users WHERE role = 'admin')
             AS admins,
           (SELECT COUNT(*)::integer FROM users WHERE role = 'owner')
             AS owners,
           (SELECT COUNT(*)::integer FROM submissions)
             AS submissions,
           (SELECT COUNT(*)::integer FROM submissions WHERE verdict = 'AC')
             AS accepted,
           (SELECT COUNT(*)::integer FROM quest_catalog WHERE archived = false)
             AS quests,
           pg_database_size(current_database())::bigint AS database_bytes`,
      );
      const row = result.rows[0];
      return {
        players: row.players,
        admins: row.admins,
        owners: row.owners,
        submissions: row.submissions,
        accepted: row.accepted,
        quests: row.quests,
        databaseBytes: Number(row.database_bytes),
      };
    },

    async reserveSubmission(userId, cooldownSeconds) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const previous = await client.query(
          `SELECT
             GREATEST(
               0,
               CEIL(
                 EXTRACT(
                   EPOCH FROM
                     last_submitted_at
                     + ($2::integer * interval '1 second')
                     - now()
                 ) * 1000
               )
             )::integer AS retry_after_ms
           FROM submission_cooldowns
           WHERE user_id = $1
           FOR UPDATE`,
          [userId, cooldownSeconds],
        );
        const retryAfterMs = previous.rows[0]?.retry_after_ms ?? 0;
        if (retryAfterMs > 0) {
          await client.query("ROLLBACK");
          return { allowed: false, retryAfterMs };
        }
        await client.query(
          `INSERT INTO submission_cooldowns(user_id, last_submitted_at)
           VALUES ($1, now())
           ON CONFLICT (user_id) DO UPDATE SET last_submitted_at = now()`,
          [userId],
        );
        await client.query("COMMIT");
        return { allowed: true, retryAfterMs: 0 };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async close() {
      await pool.end();
    },
  };
}

function mapQuestRecord(row) {
  return {
    id: row.id,
    publicDefinition: row.public_definition,
    judgeDefinition: row.judge_definition,
    archived: row.archived,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapPlayer(row) {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email ?? null,
    emailVerified: Boolean(row.email_verified_at),
    isGuest: row.is_guest,
    role: row.role ?? "player",
  };
}

async function createSessionForUser(client, userId) {
  const token = createOpaqueToken();
  await client.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '30 days')`,
    [hashToken(token), userId],
  );
  return token;
}

async function mergeGuestProgress(client, guestId, userId) {
  await client.query(
    `INSERT INTO quest_progress
       (user_id, quest_id, status, best_score, cleared_at, updated_at)
     SELECT $2, quest_id, status, best_score, cleared_at, updated_at
       FROM quest_progress
      WHERE user_id = $1
     ON CONFLICT (user_id, quest_id) DO UPDATE SET
       status = CASE
         WHEN quest_progress.status = 'cleared'
           OR EXCLUDED.status = 'cleared'
         THEN 'cleared'
         ELSE 'started'
       END,
       best_score = GREATEST(quest_progress.best_score, EXCLUDED.best_score),
       cleared_at = COALESCE(quest_progress.cleared_at, EXCLUDED.cleared_at),
       updated_at = GREATEST(quest_progress.updated_at, EXCLUDED.updated_at)`,
    [guestId, userId],
  );
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
