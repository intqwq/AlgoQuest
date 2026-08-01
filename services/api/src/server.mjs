import http from "node:http";
import crypto from "node:crypto";
import {
  bearerToken,
  cleanDisplayName,
  clientIp,
  hashPassword,
  normalizeEmail,
  passwordPolicyError,
  playableAccountError,
  verifyPassword,
} from "./auth.mjs";
import { createDatabase, migrateWithRetry } from "./database.mjs";
import { createEmailService } from "./email.mjs";
import {
  EditorialContentError,
  validateEditorialContent,
} from "./editorial-content.mjs";
import {
  cachedTerminalSubmission,
  upstreamFailure,
} from "./judge-status.mjs";
import {
  OjValidationError,
  trustedOjQuest,
  validateOjProblem,
} from "./oj.mjs";
import {
  handleAdminOjRoutes,
  handlePlayerOjRoutes,
  handlePublicOjRoutes,
} from "./routes/oj-routes.mjs";
import { handleAuthRoutes } from "./routes/auth-routes.mjs";
import {
  handlePlayerCommunityRoutes,
  handlePublicCommunityRoutes,
} from "./routes/community-routes.mjs";
import { missingPrerequisites, questPrerequisites } from "./quests.mjs";
import {
  createTurnstileVerifier,
  turnstileFailureResponse,
  turnstileTestSecretKey,
  turnstileTestSiteKey,
} from "./security.mjs";
import {
  ensureQuestRuleAccess,
  handleLearningRequest,
} from "./learning-router.mjs";
import {
  log,
  observeRequest,
  prometheusMetrics,
} from "./observability.mjs";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://algoquest:algoquest@127.0.0.1:5432/algoquest";
const judgeBaseUrl = (
  process.env.JUDGE_API_URL ?? "http://127.0.0.1:8788"
).replace(/\/$/, "");
const judgeToken = process.env.JUDGE_API_TOKEN ?? "";
const siteOwnerEmail = normalizeEmail(process.env.SITE_OWNER_EMAIL);
const allowedOrigin = process.env.API_ALLOWED_ORIGIN ?? "*";
const emailMode =
  process.env.AUTH_EMAIL_MODE ??
  (process.env.NODE_ENV === "production" ? "resend" : "log");
const turnstileSiteKey =
  process.env.TURNSTILE_SITE_KEY ??
  (emailMode === "log" ? turnstileTestSiteKey : "");
const turnstileSecretKey =
  process.env.TURNSTILE_SECRET_KEY ??
  (emailMode === "log" ? turnstileTestSecretKey : "");
const database = createDatabase(databaseUrl);
const emailService = createEmailService({
  apiKey: process.env.RESEND_API_KEY ?? "",
  fromEmail: process.env.RESEND_FROM_EMAIL ?? "AlgoQuest@intqwq.com",
  appUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:8080",
  mode: emailMode,
});
const turnstile = createTurnstileVerifier({
  secretKey: turnstileSecretKey,
  expectedHostname: process.env.TURNSTILE_EXPECTED_HOSTNAME ?? "",
});

class ApiError extends Error {
  constructor(status, code, details = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function corsHeaders() {
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-expose-headers": "location, retry-after",
    vary: "Origin",
  };
}

function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    ...corsHeaders(),
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(status === 204 ? undefined : JSON.stringify(body));
}

async function readJson(request, limit = 70 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new ApiError(413, "PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_JSON");
  }
}

async function authenticate(request) {
  const token = bearerToken(request);
  return token ? database.authenticate(token) : undefined;
}

async function applyAuthRateLimit(request, action, email, limit, windowSeconds) {
  const ip = clientIp(request);
  const ipAllowed = await database.consumeRateLimit(
    `${action}:ip`,
    ip,
    limit,
    windowSeconds,
  );
  const emailAllowed = email
    ? await database.consumeRateLimit(
        `${action}:email`,
        email,
        limit,
        windowSeconds,
      )
    : true;
  if (!ipAllowed || !emailAllowed) {
    throw new ApiError(429, "RATE_LIMITED", {
      retryAfterMs: windowSeconds * 1000,
    });
  }
}

async function requireHuman(request, body, action) {
  const verification = await turnstile.verify({
    token: body.turnstileToken,
    remoteIp: clientIp(request),
    action,
  });
  if (!verification.ok) {
    const failure = turnstileFailureResponse(verification);
    throw new ApiError(failure.status, failure.code, failure.details);
  }
}

function validateAccountInput(body, { password = true, displayName = false } = {}) {
  const email = normalizeEmail(body.email);
  if (!email) throw new ApiError(400, "INVALID_EMAIL");
  if (password) {
    const policyError = passwordPolicyError(body.password);
    if (policyError) throw new ApiError(400, policyError);
  }
  const cleanedName = cleanDisplayName(body.displayName);
  if (displayName && cleanedName === "PLAYER" && body.displayName !== "PLAYER") {
    throw new ApiError(400, "DISPLAY_NAME_REQUIRED");
  }
  return { email, displayName: cleanedName };
}

function sessionPayload(session) {
  return {
    sessionToken: session.token,
    player: session.player,
  };
}

function requirePlayableAccount(player) {
  const error = playableAccountError(player);
  if (error) throw new ApiError(403, error);
}

function requireAdmin(player) {
  if (!["admin", "owner"].includes(player?.role)) {
    throw new ApiError(403, "ADMIN_REQUIRED");
  }
}

function requireOwner(player) {
  if (player?.role !== "owner") {
    throw new ApiError(403, "OWNER_REQUIRED");
  }
}

function validQuestId(value) {
  return typeof value === "string" && /^[a-z0-9-]{1,96}$/.test(value);
}

function validUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validatedOjProblem(value) {
  try {
    return validateOjProblem(value);
  } catch (error) {
    if (error instanceof OjValidationError) {
      throw new ApiError(400, error.code);
    }
    throw error;
  }
}

function cleanRole(value) {
  return value === "admin" || value === "owner" ? value : "player";
}

function boundedText(value, maxLength, fallback = "") {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maxLength)
    : fallback;
}

function validateQuestRichText(content, format) {
  try {
    return validateEditorialContent(content, format);
  } catch (error) {
    if (error instanceof EditorialContentError) throw new ApiError(400, error.code);
    throw error;
  }
}

function validatePublicQuest(value, questId) {
  if (!value || typeof value !== "object") {
    throw new ApiError(400, "INVALID_QUEST_DEFINITION");
  }
  const prerequisites = Array.isArray(value.prerequisites)
    ? [...new Set(value.prerequisites.filter(validQuestId))]
        .filter((id) => id !== questId)
        .slice(0, 16)
    : [];
  const translations =
    value.translations && typeof value.translations === "object"
      ? value.translations
      : {};
  const problem = value.problem;
  if (!problem || typeof problem !== "object") {
    throw new ApiError(400, "QUEST_PROBLEM_REQUIRED");
  }
  const story = Array.isArray(problem.story)
    ? problem.story.map((item) => boundedText(item, 2000)).filter(Boolean).slice(0, 12)
    : [];
  const guidance = Array.isArray(problem.guidance)
    ? problem.guidance
        .map((item) => boundedText(item, 1000))
        .filter(Boolean)
        .slice(0, 16)
    : [];
  if (!story.length || !guidance.length) {
    throw new ApiError(400, "QUEST_GUIDANCE_REQUIRED");
  }
  const samples = Array.isArray(problem.samples)
    ? problem.samples.slice(0, 20).map((sample, index) => {
        if (!sample || typeof sample.input !== "string" || typeof sample.output !== "string") {
          throw new ApiError(400, "INVALID_QUEST_SAMPLE");
        }
        return {
          id: boundedText(sample.id, 32, String(index + 1).padStart(2, "0")),
          input: sample.input.slice(0, 64 * 1024),
          output: sample.output.slice(0, 64 * 1024),
        };
      })
    : [];
  const richStatement = problem.richStatement
    ? validateQuestRichText(problem.richStatement, problem.statementFormat)
    : undefined;
  const richHint = problem.richHint
    ? validateQuestRichText(problem.richHint, problem.hintFormat)
    : undefined;
  return {
    id: questId,
    index: boundedText(value.index, 8, "??"),
    title: boundedText(value.title, 120, questId),
    subtitle: boundedText(value.subtitle, 160),
    difficulty: Math.min(5, Math.max(1, Number(value.difficulty) || 1)),
    xp: Math.min(100000, Math.max(0, Math.round(Number(value.xp) || 0))),
    status: value.status === "secret" ? "secret" : "locked",
    prerequisites,
    chapter: boundedText(value.chapter, 120, "CUSTOM / QUEST"),
    gridArea: boundedText(value.gridArea, 32, questId),
    mapPosition: {
      x: Math.min(98, Math.max(2, Number(value.mapPosition?.x) || 50)),
      y: Math.min(98, Math.max(2, Number(value.mapPosition?.y) || 50)),
    },
    description: boundedText(value.description, 1000),
    skills: Array.isArray(value.skills)
      ? value.skills.map((item) => boundedText(item, 64)).filter(Boolean).slice(0, 16)
      : [],
    translations,
    sortOrder: Math.min(
      999999,
      Math.max(0, Math.round(Number(value.sortOrder) || 0)),
    ),
    problem: {
      story,
      ...(richStatement ? { richStatement: richStatement.content, statementFormat: richStatement.contentFormat } : {}),
      guidance,
      input: boundedText(problem.input, 4000),
      constraints: boundedText(problem.constraints, 4000),
      output: boundedText(problem.output, 4000),
      sampleInput: boundedText(problem.sampleInput, 64 * 1024),
      sampleOutput: boundedText(problem.sampleOutput, 64 * 1024),
      ...(samples.length ? { samples } : {}),
      hint: boundedText(problem.hint, 4000),
      ...(richHint ? { richHint: richHint.content, hintFormat: richHint.contentFormat } : {}),
      hintMarker: boundedText(problem.hintMarker, 1000),
      hintCode:
        typeof problem.hintCode === "string"
          ? problem.hintCode.slice(0, 64 * 1024)
          : "",
      starterCode:
        typeof problem.starterCode === "string"
          ? problem.starterCode.slice(0, 64 * 1024)
          : "",
      testCaseCount: Math.min(
        50,
        Math.max(1, Math.round(Number(problem.testCaseCount) || 1)),
      ),
      passScore: Math.min(
        100,
        Math.max(1, Math.round(Number(problem.passScore) || 100)),
      ),
      timeLimitSeconds: Math.min(
        10,
        Math.max(0.1, Number(problem.timeLimitSeconds) || 1),
      ),
      memoryLimitMb: Math.min(
        512,
        Math.max(16, Math.round(Number(problem.memoryLimitMb) || 64)),
      ),
    },
  };
}

function validateJudgeQuest(value, publicQuest) {
  if (!value || typeof value !== "object" || !Array.isArray(value.tests)) {
    throw new ApiError(400, "INVALID_JUDGE_DEFINITION");
  }
  const tests = value.tests.slice(0, 50).map((test, index) => {
    if (
      !test ||
      typeof test.input !== "string" ||
      typeof test.expected !== "string" ||
      Buffer.byteLength(test.input, "utf8") > 64 * 1024 ||
      Buffer.byteLength(test.expected, "utf8") > 64 * 1024
    ) {
      throw new ApiError(400, "INVALID_TEST_CASE");
    }
    return {
      id: String(index + 1).padStart(2, "0"),
      input: test.input,
      expected: test.expected,
      sample: test.sample === true || index < (publicQuest.problem.samples?.length ?? 1),
    };
  });
  if (!tests.length) throw new ApiError(400, "QUEST_TESTS_REQUIRED");
  if (tests.length !== publicQuest.problem.testCaseCount) {
    throw new ApiError(400, "TEST_CASE_COUNT_MISMATCH");
  }
  return {
    language: "cpp14",
    timeLimitMs: Math.round(publicQuest.problem.timeLimitSeconds * 1000),
    memoryLimitMb: publicQuest.problem.memoryLimitMb,
    compileLimitMs: Math.min(
      30000,
      Math.max(5000, Math.round(Number(value.compileLimitMs) || 15000)),
    ),
    passScore: publicQuest.problem.passScore,
    tests,
  };
}

function parseLocalDrafts(value) {
  if (!Array.isArray(value) || value.length > 64) {
    throw new ApiError(400, "INVALID_SAVE");
  }
  return value.map((draft) => {
    if (
      !draft ||
      !validQuestId(draft.questId) ||
      typeof draft.source !== "string" ||
      draft.source.length > 64 * 1024
    ) {
      throw new ApiError(400, "INVALID_SAVE");
    }
    return { questId: draft.questId, source: draft.source };
  });
}

function judgeHeaders(userId, contentType, requestId) {
  const headers = {
    accept: "application/json",
    "x-real-ip": `player-${userId}`,
  };
  if (contentType) headers["content-type"] = contentType;
  if (requestId) headers["x-request-id"] = requestId;
  if (judgeToken) headers.authorization = `Bearer ${judgeToken}`;
  return headers;
}

async function judgeRequest(path, init = {}) {
  const { timeoutMs = 10_000, ...requestInit } = init;
  return fetch(`${judgeBaseUrl}${path}`, {
    ...requestInit,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function readUpstreamJson(response) {
  try {
    return await response.json();
  } catch {
    return { error: "INVALID_UPSTREAM_RESPONSE" };
  }
}

async function health() {
  const result = {
    status: "ok",
    database: "ok",
    judge: "ok",
    accounts: turnstileSiteKey ? "ready" : "configuration_required",
  };
  try {
    await database.ping();
  } catch {
    result.status = "degraded";
    result.database = "offline";
  }
  try {
    const response = await judgeRequest("/health", { timeoutMs: 1_500 });
    if (!response.ok) throw new Error("judge unavailable");
  } catch {
    result.status = "degraded";
    result.judge = "offline";
  }
  return result;
}

async function resolveQuestAccess(questId, progress, player) {
  const record = await database.getQuestRecord(questId);
  if (record) {
    if (record.archived) return undefined;
    const cleared = new Set(
      progress
        .filter((item) => item.status === "cleared")
        .map((item) => item.questId),
    );
    const missing = (record.publicDefinition.prerequisites ?? []).filter(
      (requiredId) => !cleared.has(requiredId),
    );
    return {
      record,
      missing: player?.recommendedQuestId === questId ? [] : missing,
    };
  }
  const missing = missingPrerequisites(questId, progress);
  return missing === undefined
    ? undefined
    : {
        record: undefined,
        missing: player?.recommendedQuestId === questId ? [] : missing,
      };
}

const server = http.createServer(async (request, response) => {
  observeRequest(request, response);
  const url = new URL(request.url ?? "/", "http://api.local");

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    return response.end();
  }
  if (request.method === "GET" && url.pathname === "/health") {
    const state = await health();
    return json(response, state.status === "ok" ? 200 : 503, state);
  }
  if (request.method === "GET" && url.pathname === "/metrics") {
    response.writeHead(200, {
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
      "cache-control": "no-store",
    });
    return response.end(prometheusMetrics());
  }

  try {
    if (await handleLearningRequest(request, response)) return;

    if (request.method === "GET" && url.pathname === "/v1/quests") {
      const [records, mapLayout] = await Promise.all([
        database.listQuestRecords({ includeArchived: true }),
        database.listQuestMapLayout(),
      ]);
      return json(response, 200, {
        quests: records
          .filter((record) => !record.archived)
          .map((record) => record.publicDefinition),
        archivedQuestIds: records
          .filter((record) => record.archived)
          .map((record) => record.id),
        mapLayout,
      });
    }

    if (
      await handlePublicOjRoutes({
        request,
        response,
        url,
        database,
        json,
        ApiError,
        boundedText,
      })
    ) {
      return;
    }

    if (
      await handlePublicCommunityRoutes({
        request, response, url, database, json, ApiError, boundedText, authenticate,
      })
    ) {
      return;
    }

    await handleAuthRoutes({
      request, response, url, database, json, turnstileSiteKey, emailService,
      applyAuthRateLimit, readJson, ApiError, validateAccountInput, requireHuman,
      authenticate, hashPassword, siteOwnerEmail, verifyPassword,
      passwordPolicyError, sessionPayload, cleanDisplayName,
    });
    if (response.writableEnded) return;
    const player = await authenticate(request);
    if (!player) return json(response, 401, { error: "UNAUTHORIZED" });

    if (request.method === "GET" && url.pathname === "/v1/me") {
      return json(response, 200, { player });
    }

    if (
      await handlePlayerOjRoutes({
        request,
        response,
        url,
        database,
        player,
        json,
        ApiError,
        readJson,
        requirePlayableAccount,
        validUuid,
        validatedOjProblem,
      })
    ) {
      return;
    }

    if (
      await handlePlayerCommunityRoutes({
        request, response, url, database, player, json, ApiError, boundedText,
        readJson, requirePlayableAccount,
      })
    ) {
      return;
    }

    const editorialQuestMatch = url.pathname.match(
      /^\/v1\/editorial\/quests\/([a-z0-9-]{1,96})$/,
    );
    if (editorialQuestMatch) {
      requirePlayableAccount(player);
      const questId = editorialQuestMatch[1];
      const record = await database.getQuestRecord(questId);
      const builtIn = missingPrerequisites(questId, []) !== undefined;
      if ((!record && !builtIn) || record?.archived) {
        throw new ApiError(404, "QUEST_NOT_FOUND");
      }
      const moderator = ["admin", "owner"].includes(player.role);
      const eligibility = await database.editorialEligibility(player.id, questId);

      if (request.method === "GET") {
        return json(response, 200, {
          posts: await database.listEditorialPosts({
            questId,
            viewerId: player.id,
            includeModeration: moderator,
          }),
          eligibility: {
            discussion: moderator || eligibility.hasSubmission,
            solution: moderator || eligibility.hasCleared,
            directPublish: moderator,
          },
        });
      }

      if (request.method === "POST") {
        const body = await readJson(request, 160 * 1024);
        if (body.kind !== "discussion" && body.kind !== "solution") {
          throw new ApiError(400, "INVALID_EDITORIAL_KIND");
        }
        if (
          (!moderator && body.kind === "discussion" && !eligibility.hasSubmission) ||
          (!moderator && body.kind === "solution" && !eligibility.hasCleared)
        ) {
          throw new ApiError(
            403,
            body.kind === "solution"
              ? "QUEST_CLEAR_REQUIRED"
              : "QUEST_SUBMISSION_REQUIRED",
          );
        }
        const title = boundedText(body.title, 160);
        if (title.length < 3) {
          throw new ApiError(400, "EDITORIAL_CONTENT_REQUIRED");
        }
        let editorialContent;
        try {
          editorialContent = validateEditorialContent(
            body.content,
            body.contentFormat,
          );
        } catch (error) {
          if (error instanceof EditorialContentError) {
            throw new ApiError(400, error.code);
          }
          throw error;
        }
        const post = await database.createEditorialPost({
          id: crypto.randomUUID(),
          questId,
          authorId: player.id,
          kind: body.kind,
          title,
          content: editorialContent.content,
          contentFormat: editorialContent.contentFormat,
          status: body.kind === "discussion" || moderator ? "published" : "pending",
        });
        return json(response, 201, { post });
      }
    }

    if (request.method === "GET" && url.pathname === "/v1/admin/users") {
      requireAdmin(player);
      const query = boundedText(url.searchParams.get("query"), 120);
      const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
      const limit = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get("limit")) || 50),
      );
      return json(response, 200, {
        users: await database.listUsers({
          query,
          limit,
          offset: (page - 1) * limit,
        }),
        page,
        limit,
      });
    }

    const managedUserMatch = url.pathname.match(
      /^\/v1\/admin\/users\/([0-9a-f-]{36})$/,
    );
    if (request.method === "PUT" && managedUserMatch) {
      requireAdmin(player);
      const target = await database.findUserById(managedUserMatch[1]);
      if (!target || target.isGuest) {
        throw new ApiError(404, "PLAYER_NOT_FOUND");
      }
      if (target.role === "owner") {
        throw new ApiError(403, "OWNER_ACCOUNT_PROTECTED");
      }
      if (player.role === "admin" && target.role !== "player") {
        throw new ApiError(403, "ROLE_SCOPE_EXCEEDED");
      }
      const body = await readJson(request, 8 * 1024);
      const nextRole =
        player.role === "owner" ? cleanRole(body.role) : target.role;
      if (nextRole === "owner") {
        throw new ApiError(403, "OWNER_ROLE_IS_BOOTSTRAPPED");
      }
      const displayName = cleanDisplayName(body.displayName);
      if (displayName === "PLAYER" && body.displayName !== "PLAYER") {
        throw new ApiError(400, "DISPLAY_NAME_REQUIRED");
      }
      const updated = await database.updateManagedUser(target.id, {
        displayName,
        emailVerified: Boolean(body.emailVerified),
        role: nextRole,
      });
      return json(response, 200, { player: updated });
    }

    if (request.method === "GET" && url.pathname === "/v1/admin/quests") {
      requireAdmin(player);
      return json(response, 200, {
        quests: await database.listQuestRecords({ includeArchived: true }),
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/admin/editorial") {
      requireAdmin(player);
      const requestedStatus = url.searchParams.get("status");
      const status = ["pending", "published", "rejected"].includes(requestedStatus)
        ? requestedStatus
        : "pending";
      return json(response, 200, {
        posts: await database.listEditorialPosts({
          viewerId: player.id,
          includeModeration: true,
          status,
        }),
      });
    }

    if (
      await handleAdminOjRoutes({
        request,
        response,
        url,
        database,
        player,
        json,
        ApiError,
        readJson,
        requireAdmin,
        validUuid,
        boundedText,
        validatedOjProblem,
      })
    ) {
      return;
    }

    const editorialModerationMatch = url.pathname.match(
      /^\/v1\/admin\/editorial\/([0-9a-f-]{36})$/,
    );
    if (request.method === "PATCH" && editorialModerationMatch) {
      requireAdmin(player);
      const body = await readJson(request, 4 * 1024);
      if (body.status !== "published" && body.status !== "rejected") {
        throw new ApiError(400, "INVALID_MODERATION_STATUS");
      }
      const post = await database.moderateEditorialPost(
        editorialModerationMatch[1],
        body.status,
        player.id,
      );
      if (!post) throw new ApiError(404, "EDITORIAL_NOT_FOUND");
      return json(response, 200, { post });
    }

    if (
      request.method === "PUT" &&
      url.pathname === "/v1/admin/quest-map-layout"
    ) {
      requireAdmin(player);
      const body = await readJson(request, 64 * 1024);
      if (!Array.isArray(body.positions) || body.positions.length > 128) {
        throw new ApiError(400, "INVALID_MAP_LAYOUT");
      }
      const records = await database.listQuestRecords({ includeArchived: false });
      const knownQuestIds = new Set([
        ...Object.keys(questPrerequisites),
        "nameless-room",
        ...records.map((record) => record.id),
      ]);
      const seen = new Set();
      const positions = body.positions.map((position) => {
        const id = boundedText(position?.id, 96);
        const x = Number(position?.x);
        const y = Number(position?.y);
        if (
          !validQuestId(id) ||
          !knownQuestIds.has(id) ||
          seen.has(id) ||
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          x < 2 ||
          x > 98 ||
          y < 2 ||
          y > 98
        ) {
          throw new ApiError(400, "INVALID_MAP_LAYOUT");
        }
        seen.add(id);
        return {
          id,
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(2)),
        };
      });
      return json(response, 200, {
        mapLayout: await database.updateQuestMapLayout(positions, player.id),
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/admin/quests") {
      requireAdmin(player);
      const body = await readJson(request, 1024 * 1024);
      if (!validQuestId(body.id)) throw new ApiError(400, "INVALID_QUEST_ID");
      if (
        (await database.getQuestRecord(body.id)) ||
        missingPrerequisites(body.id, []) !== undefined
      ) {
        throw new ApiError(409, "QUEST_ALREADY_EXISTS");
      }
      const publicDefinition = validatePublicQuest(body.publicDefinition, body.id);
      const judgeDefinition = validateJudgeQuest(
        body.judgeDefinition,
        publicDefinition,
      );
      return json(response, 201, {
        quest: await database.upsertQuestRecord(
          body.id,
          publicDefinition,
          judgeDefinition,
          player.id,
        ),
      });
    }

    const managedQuestMatch = url.pathname.match(
      /^\/v1\/admin\/quests\/([a-z0-9-]{1,96})$/,
    );
    if (request.method === "PUT" && managedQuestMatch) {
      requireAdmin(player);
      const body = await readJson(request, 1024 * 1024);
      const publicDefinition = validatePublicQuest(
        body.publicDefinition,
        managedQuestMatch[1],
      );
      const staticQuest = missingPrerequisites(
        managedQuestMatch[1],
        [],
      ) !== undefined;
      const judgeDefinition =
        body.judgeDefinition === null && staticQuest
          ? null
          : validateJudgeQuest(body.judgeDefinition, publicDefinition);
      return json(response, 200, {
        quest: await database.upsertQuestRecord(
          managedQuestMatch[1],
          publicDefinition,
          judgeDefinition,
          player.id,
        ),
      });
    }

    if (request.method === "DELETE" && managedQuestMatch) {
      requireAdmin(player);
      const archived = await database.archiveQuestRecord(
        managedQuestMatch[1],
        player.id,
      );
      return json(
        response,
        archived ? 204 : 404,
        archived ? {} : { error: "QUEST_NOT_FOUND" },
      );
    }

    if (request.method === "GET" && url.pathname === "/v1/owner/server") {
      requireOwner(player);
      const [settings, statistics, questRecords, judgeHealth] = await Promise.all([
        database.getServerSettings(),
        database.serverStatistics(),
        database.listQuestRecords({ includeArchived: true }),
        judgeRequest("/health", { timeoutMs: 1500 })
          .then(readUpstreamJson)
          .catch(() => ({ status: "offline" })),
      ]);
      const archived = new Set(
        questRecords.filter((record) => record.archived).map((record) => record.id),
      );
      statistics.quests =
        Object.keys(questPrerequisites).filter((id) => !archived.has(id)).length +
        questRecords.filter(
          (record) =>
            !record.archived && !(record.id in questPrerequisites),
        ).length;
      return json(response, 200, {
        settings,
        statistics,
        runtime: {
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
          uptimeSeconds: Math.floor(process.uptime()),
          judge: judgeHealth,
        },
      });
    }

    if (request.method === "PUT" && url.pathname === "/v1/owner/server") {
      requireOwner(player);
      const body = await readJson(request, 8 * 1024);
      return json(response, 200, {
        settings: await database.updateServerSettings(
          {
            registrationEnabled: Boolean(body.registrationEnabled),
            judgeEnabled: Boolean(body.judgeEnabled),
            maintenanceMessage: boundedText(body.maintenanceMessage, 240),
            submissionCooldownSeconds: Math.min(
              300,
              Math.max(5, Math.round(Number(body.submissionCooldownSeconds) || 5)),
            ),
          },
          player.id,
        ),
      });
    }

    if (request.method === "PUT" && url.pathname === "/v1/me/profile") {
      const body = await readJson(request, 4 * 1024);
      const displayName = cleanDisplayName(body.displayName);
      if (displayName === "PLAYER" && body.displayName !== "PLAYER") {
        throw new ApiError(400, "DISPLAY_NAME_REQUIRED");
      }
      return json(response, 200, {
        player: await database.updateProfile(player.id, {
          displayName,
          hasCppFoundation: body.hasCppFoundation === true,
          hasAlgorithmFoundation: body.hasAlgorithmFoundation === true,
        }),
      });
    }

    if (
      request.method === "PUT" &&
      url.pathname === "/v1/me/learning/tutorial"
    ) {
      requirePlayableAccount(player);
      return json(response, 200, {
        player: await database.completeWebTutorial(player.id),
      });
    }

    if (
      request.method === "GET" &&
      url.pathname === "/v1/me/learning/stories"
    ) {
      requirePlayableAccount(player);
      return json(response, 200, {
        stories: await database.listQuestStoryProgress(player.id),
      });
    }

    const storyProgressMatch = url.pathname.match(
      /^\/v1\/me\/learning\/stories\/([a-z0-9-]{1,96})$/,
    );
    if (request.method === "PUT" && storyProgressMatch) {
      requirePlayableAccount(player);
      const access = await resolveQuestAccess(
        storyProgressMatch[1],
        await database.listProgress(player.id),
        player,
      );
      if (!access) throw new ApiError(404, "UNKNOWN_QUEST");
      return json(response, 200, {
        story: await database.completeQuestStory(
          player.id,
          storyProgressMatch[1],
        ),
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/logout") {
      const token = bearerToken(request);
      if (token) await database.revokeSession(token);
      return json(response, 204, {});
    }

    if (request.method === "GET" && url.pathname === "/v1/me/progress") {
      requirePlayableAccount(player);
      return json(response, 200, {
        progress: await database.listProgress(player.id),
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/me/save") {
      requirePlayableAccount(player);
      return json(response, 200, {
        save: await database.getPlayerSave(player.id),
      });
    }

    const draftMatch = url.pathname.match(
      /^\/v1\/me\/drafts\/([a-z0-9-]{1,96})$/,
    );
    if (request.method === "PUT" && draftMatch) {
      requirePlayableAccount(player);
      const body = await readJson(request);
      if (
        typeof body.source !== "string" ||
        body.source.length > 64 * 1024
      ) {
        throw new ApiError(400, "INVALID_DRAFT");
      }
      return json(response, 200, {
        draft: await database.saveDraft(
          player.id,
          draftMatch[1],
          body.source,
        ),
      });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/v1/me/save/resolve"
    ) {
      requirePlayableAccount(player);
      const body = await readJson(request, 1024 * 1024);
      if (body.choice !== "local" && body.choice !== "cloud") {
        throw new ApiError(400, "INVALID_SAVE_CHOICE");
      }

      let guest;
      if (typeof body.guestToken === "string" && body.guestToken) {
        guest = await database.authenticate(body.guestToken);
        if (guest && !guest.isGuest) guest = undefined;
      }

      if (body.choice === "local") {
        if (guest) {
          await database.transferGuestSave(guest.id, player.id);
        }
        const drafts = parseLocalDrafts(body.localSave?.drafts ?? []);
        await database.replaceDrafts(player.id, drafts);
        const clearedQuestIds = Array.isArray(
          body.localSave?.clearedQuestIds,
        )
          ? [
              ...new Set(
                body.localSave.clearedQuestIds.filter(validQuestId),
              ),
            ].slice(0, 64)
          : [];
        for (const questId of clearedQuestIds) {
          if (await database.hasAcceptedSubmission(player.id, questId)) {
            await database.saveProgress(player.id, questId, "cleared", 100);
          }
        }
      } else if (guest) {
        await database.discardGuestSave(guest.id);
      }

      return json(response, 200, {
        save: await database.getPlayerSave(player.id),
      });
    }

    const progressMatch = url.pathname.match(
      /^\/v1\/me\/progress\/([a-z0-9-]{1,96})$/,
    );
    if (request.method === "PUT" && progressMatch) {
      requirePlayableAccount(player);
      const body = await readJson(request, 4 * 1024);
      const status = body.status === "cleared" ? "cleared" : "started";
      const score = Math.max(0, Math.min(100, Number(body.score ?? 0)));
      if (
        status === "cleared" &&
        !(await database.hasAcceptedSubmission(player.id, progressMatch[1]))
      ) {
        return json(response, 409, {
          error: "PROGRESS_REQUIRES_ACCEPTED_SUBMISSION",
        });
      }
      await database.saveProgress(
        player.id,
        progressMatch[1],
        status,
        score,
      );
      return json(response, 204, {});
    }

    if (
      request.method === "POST" &&
      url.pathname === "/v1/judge/submissions"
    ) {
      requirePlayableAccount(player);
      const body = await readJson(request);
      if (
        validQuestId(body.questId) &&
        !(await ensureQuestRuleAccess(player.id, body.questId))
      ) {
        throw new ApiError(403, "QUEST_UNLOCK_RULE_NOT_MET", {
          questId: body.questId,
        });
      }
      const settings = await database.getServerSettings();
      if (!settings.judgeEnabled) {
        throw new ApiError(503, "JUDGE_DISABLED");
      }
      const access = await resolveQuestAccess(
        body.questId,
        await database.listProgress(player.id),
        player,
      );
      if (!access) {
        return json(response, 404, { error: "UNKNOWN_QUEST" });
      }
      if (access.missing.length) {
        return json(response, 403, {
          error: "QUEST_LOCKED",
          missingPrerequisites: access.missing,
        });
      }
      const reservation = await database.reserveSubmission(
        player.id,
        settings.submissionCooldownSeconds,
      );
      if (!reservation.allowed) {
        return json(
          response,
          429,
          {
            error: "SUBMISSION_COOLDOWN",
            retryAfterMs: reservation.retryAfterMs,
          },
          {
            "retry-after": String(
              Math.max(1, Math.ceil(reservation.retryAfterMs / 1000)),
            ),
          },
        );
      }
      const upstream = await judgeRequest("/v1/submissions", {
        method: "POST",
        headers: judgeHeaders(player.id, "application/json", request.requestId),
        body: JSON.stringify({
          ...body,
          trustedQuest: access.record?.judgeDefinition,
        }),
      });
      const result = await readUpstreamJson(upstream);
      if (upstream.ok && result.submission?.id) {
        await database.createSubmission(
          player.id,
          result.submission.id,
          body.questId,
          result.submission.status,
          body.source,
          body.language,
          body.mode,
        );
      }
      const headers = {};
      const retryAfter = upstream.headers.get("retry-after");
      if (retryAfter) headers["retry-after"] = retryAfter;
      return json(response, upstream.status, result, headers);
    }

    const ojSubmissionMatch = url.pathname.match(/^\/v1\/oj\/problems\/(\d{1,12})\/submissions$/);
    if (request.method === "POST" && ojSubmissionMatch) {
      requirePlayableAccount(player);
      const body = await readJson(request, 80 * 1024);
      const settings = await database.getServerSettings();
      if (!settings.judgeEnabled) throw new ApiError(503, "JUDGE_DISABLED");
      const problem = await database.getPublishedOjProblem(Number(ojSubmissionMatch[1]));
      if (!problem) throw new ApiError(404, "OJ_PROBLEM_NOT_FOUND");
      const reservation = await database.reserveSubmission(
        player.id,
        settings.submissionCooldownSeconds,
      );
      if (!reservation.allowed) {
        return json(response, 429, {
          error: "SUBMISSION_COOLDOWN",
          retryAfterMs: reservation.retryAfterMs,
        }, {
          "retry-after": String(Math.max(1, Math.ceil(reservation.retryAfterMs / 1000))),
        });
      }
      const questId = `oj-${problem.publicId}`;
      const mode = body.mode === "sample" ? "sample" : "submit";
      const requestedSampleIndex = Number(body.sampleIndex ?? 0);
      if (mode === "sample" && (!Number.isInteger(requestedSampleIndex) || requestedSampleIndex < 0)) {
        throw new ApiError(400, "UNKNOWN_SAMPLE");
      }
      const sampleIndex = mode === "sample" ? requestedSampleIndex : undefined;
      const upstream = await judgeRequest("/v1/submissions", {
        method: "POST",
        headers: judgeHeaders(player.id, "application/json", request.requestId),
        body: JSON.stringify({
          questId,
          source: body.source,
          language: "cpp14",
          mode,
          sampleIndex,
          trustedQuest: trustedOjQuest(problem),
        }),
      });
      const result = await readUpstreamJson(upstream);
      if (upstream.ok && result.submission?.id) {
        await database.createSubmission(
          player.id,
          result.submission.id,
          questId,
          result.submission.status,
          body.source,
          "cpp14",
          mode,
        );
      }
      const headers = {};
      const retryAfter = upstream.headers.get("retry-after");
      if (retryAfter) headers["retry-after"] = retryAfter;
      return json(response, upstream.status, result, headers);
    }

    const submissionMatch = url.pathname.match(
      /^\/v1\/judge\/submissions\/([0-9a-f-]+)$/,
    );
    if (request.method === "GET" && submissionMatch) {
      requirePlayableAccount(player);
      const record = await database.findSubmission(
        player.id,
        submissionMatch[1],
      );
      if (!record) return json(response, 404, { error: "UNKNOWN_SUBMISSION" });

      let upstream;
      try {
        upstream = await judgeRequest(
          `/v1/submissions/${submissionMatch[1]}`,
          {
            headers: judgeHeaders(player.id, undefined, request.requestId),
            timeoutMs: 3_000,
          },
        );
      } catch (error) {
        const cached = cachedTerminalSubmission(record);
        if (cached) return json(response, 200, { submission: cached });
        console.error("Judge status request failed:", error.message);
        return json(response, 503, {
          error: "JUDGE_STATUS_UNAVAILABLE",
          retryAfterMs: 1000,
        });
      }

      const result = await readUpstreamJson(upstream);
      if (!upstream.ok) {
        const cached = cachedTerminalSubmission(record);
        if (cached) return json(response, 200, { submission: cached });
        const failure = upstreamFailure(upstream.status, result);
        return json(response, failure.status, failure.body);
      }

      if (result.submission) {
        try {
          await database.updateSubmission(record.id, result.submission);
        } catch (error) {
          console.error("Submission persistence failed:", error.message);
        }
        if (result.submission.status === "DONE") {
          const score = Math.min(
            100,
            Math.max(
              0,
              Math.round(
                Number(
                  result.submission.score ??
                    (result.submission.verdict === "AC" ? 100 : 0),
                ),
              ),
            ),
          );
          const passScore = Math.min(
            100,
            Math.max(1, Number(result.submission.passScore ?? 100)),
          );
          if (score < passScore) {
            return json(response, 200, result);
          }
          if (!record.questId.startsWith("oj-")) {
            try {
              await database.saveProgress(
                player.id,
                record.questId,
                "cleared",
                score,
              );
            } catch (error) {
              console.error("Accepted progress persistence failed:", error.message);
            }
          }
        }
      }
      return json(response, 200, result);
    }

    return json(response, 404, { error: "NOT_FOUND" });
  } catch (error) {
    if (error instanceof ApiError) {
      const headers = {};
      if (Number.isFinite(error.details.retryAfterMs)) {
        headers["retry-after"] = String(
          Math.max(1, Math.ceil(error.details.retryAfterMs / 1000)),
        );
      }
      return json(
        response,
        error.status,
        {
          error: error.code,
          ...error.details,
        },
        headers,
      );
    }
    log("error", "request_failed", { message: error.message });
    return json(response, 500, { error: "INTERNAL_ERROR" });
  }
});

await migrateWithRetry(database);
const bootstrappedOwner = await database.ensureSiteOwner(siteOwnerEmail);
if (siteOwnerEmail && !bootstrappedOwner) {
  console.warn(
    "SITE_OWNER_EMAIL does not match a verified, non-guest AlgoQuest account.",
  );
} else if (bootstrappedOwner) {
  console.log("Site owner role is active.");
}
server.listen(port, "0.0.0.0", () => {
  log("info", "server_started", { port });
});

async function shutdown() {
  server.close();
  await database.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
