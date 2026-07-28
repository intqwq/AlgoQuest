import http from "node:http";
import {
  bearerToken,
  cleanDisplayName,
  clientIp,
  hashPassword,
  normalizeEmail,
  passwordPolicyError,
  verifyPassword,
} from "./auth.mjs";
import { createDatabase, migrateWithRetry } from "./database.mjs";
import { createEmailService } from "./email.mjs";
import {
  cachedTerminalSubmission,
  upstreamFailure,
} from "./judge-status.mjs";
import { missingPrerequisites } from "./quests.mjs";
import {
  createTurnstileVerifier,
  turnstileTestSecretKey,
  turnstileTestSiteKey,
} from "./security.mjs";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://algoquest:algoquest@127.0.0.1:5432/algoquest";
const judgeBaseUrl = (
  process.env.JUDGE_API_URL ?? "http://127.0.0.1:8788"
).replace(/\/$/, "");
const judgeToken = process.env.JUDGE_API_TOKEN ?? "";
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
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
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
    const unavailable = verification.code === "TURNSTILE_UNAVAILABLE";
    throw new ApiError(
      unavailable ? 503 : 400,
      unavailable ? "HUMAN_VERIFICATION_UNAVAILABLE" : "HUMAN_VERIFICATION_FAILED",
    );
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

function judgeHeaders(userId, contentType) {
  const headers = {
    accept: "application/json",
    "x-real-ip": `player-${userId}`,
  };
  if (contentType) headers["content-type"] = contentType;
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

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://api.local");

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    return response.end();
  }
  if (request.method === "GET" && url.pathname === "/health") {
    const state = await health();
    return json(response, state.status === "ok" ? 200 : 503, state);
  }

  try {
    if (request.method === "GET" && url.pathname === "/v1/auth/config") {
      return json(response, 200, {
        turnstileSiteKey,
        emailDelivery: emailService.mode === "resend" ? "resend" : "local-log",
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/sessions") {
      await applyAuthRateLimit(request, "guest_session", undefined, 30, 3600);
      const body = await readJson(request, 4 * 1024);
      const session = await database.createSession(
        cleanDisplayName(body.displayName),
      );
      return json(response, 201, sessionPayload(session));
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/register") {
      const body = await readJson(request, 12 * 1024);
      const input = validateAccountInput(body, {
        password: true,
        displayName: true,
      });
      await applyAuthRateLimit(request, "register", input.email, 5, 15 * 60);
      await requireHuman(request, body, "register");
      const currentPlayer = await authenticate(request);
      const passwordHash = await hashPassword(body.password);
      const registration = await database.registerAccount({
        anonymousUserId: currentPlayer?.isGuest ? currentPlayer.id : undefined,
        displayName: input.displayName,
        email: input.email,
        passwordHash,
      });
      const verification = registration.created
        ? registration
        : !registration.verified
          ? await database.createVerificationToken(input.email)
          : undefined;
      if (verification) {
        try {
          await emailService.sendVerification({
            email: verification.email,
            displayName: verification.displayName,
            token: verification.token,
            idempotencyKey: verification.tokenHash.slice(0, 32),
          });
        } catch (error) {
          console.error("Verification email delivery failed:", error.message);
          throw new ApiError(502, "EMAIL_DELIVERY_FAILED");
        }
      }
      return json(response, 202, { status: "VERIFICATION_SENT" });
    }

    if (
      request.method === "POST" &&
      url.pathname === "/v1/auth/resend-verification"
    ) {
      const body = await readJson(request, 8 * 1024);
      const { email } = validateAccountInput(body, { password: false });
      await applyAuthRateLimit(
        request,
        "resend_verification",
        email,
        3,
        30 * 60,
      );
      await requireHuman(request, body, "resend_verification");
      const verification = await database.createVerificationToken(email);
      if (verification) {
        try {
          await emailService.sendVerification({
            ...verification,
            idempotencyKey: verification.tokenHash.slice(0, 32),
          });
        } catch (error) {
          console.error("Verification email delivery failed:", error.message);
          throw new ApiError(502, "EMAIL_DELIVERY_FAILED");
        }
      }
      return json(response, 202, { status: "VERIFICATION_SENT" });
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/verify-email") {
      const body = await readJson(request, 4 * 1024);
      if (
        typeof body.token !== "string" ||
        !/^[A-Za-z0-9_-]{40,}$/.test(body.token)
      ) {
        throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
      }
      const session = await database.verifyEmail(body.token);
      if (!session) throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
      return json(response, 200, sessionPayload(session));
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/login") {
      const body = await readJson(request, 8 * 1024);
      const { email } = validateAccountInput(body, { password: true });
      await applyAuthRateLimit(request, "login", email, 10, 15 * 60);
      await requireHuman(request, body, "login");
      const account = await database.findAccountForLogin(email);
      const validPassword = account
        ? await verifyPassword(body.password, account.passwordHash)
        : (await hashPassword(body.password), false);
      if (!account || !validPassword) {
        throw new ApiError(401, "INVALID_CREDENTIALS");
      }
      if (!account.emailVerified) {
        throw new ApiError(403, "EMAIL_NOT_VERIFIED");
      }
      const currentPlayer = await authenticate(request);
      const session = await database.loginAccount(
        account.id,
        currentPlayer?.isGuest ? currentPlayer.id : undefined,
      );
      return json(response, 200, sessionPayload(session));
    }

    if (
      request.method === "POST" &&
      url.pathname === "/v1/auth/forgot-password"
    ) {
      const body = await readJson(request, 8 * 1024);
      const { email } = validateAccountInput(body, { password: false });
      await applyAuthRateLimit(
        request,
        "forgot_password",
        email,
        4,
        30 * 60,
      );
      await requireHuman(request, body, "forgot_password");
      const reset = await database.createPasswordResetToken(email);
      if (reset) {
        try {
          await emailService.sendPasswordReset({
            ...reset,
            idempotencyKey: reset.tokenHash.slice(0, 32),
          });
        } catch (error) {
          console.error("Password reset email delivery failed:", error.message);
          throw new ApiError(502, "EMAIL_DELIVERY_FAILED");
        }
      }
      return json(response, 202, { status: "RESET_SENT" });
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/reset-password") {
      const body = await readJson(request, 8 * 1024);
      const policyError = passwordPolicyError(body.password);
      if (policyError) throw new ApiError(400, policyError);
      if (
        typeof body.token !== "string" ||
        !/^[A-Za-z0-9_-]{40,}$/.test(body.token)
      ) {
        throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
      }
      await applyAuthRateLimit(request, "reset_password", undefined, 5, 30 * 60);
      await requireHuman(request, body, "reset_password");
      const passwordHash = await hashPassword(body.password);
      const session = await database.resetPassword(body.token, passwordHash);
      if (!session) throw new ApiError(400, "INVALID_OR_EXPIRED_TOKEN");
      return json(response, 200, sessionPayload(session));
    }

    const player = await authenticate(request);
    if (!player) return json(response, 401, { error: "UNAUTHORIZED" });

    if (request.method === "GET" && url.pathname === "/v1/me") {
      return json(response, 200, { player });
    }

    if (request.method === "PUT" && url.pathname === "/v1/me/profile") {
      const body = await readJson(request, 4 * 1024);
      const displayName = cleanDisplayName(body.displayName);
      if (displayName === "PLAYER" && body.displayName !== "PLAYER") {
        throw new ApiError(400, "DISPLAY_NAME_REQUIRED");
      }
      return json(response, 200, {
        player: await database.updateProfile(player.id, displayName),
      });
    }

    if (request.method === "POST" && url.pathname === "/v1/auth/logout") {
      const token = bearerToken(request);
      if (token) await database.revokeSession(token);
      return json(response, 204, {});
    }

    if (request.method === "GET" && url.pathname === "/v1/me/progress") {
      return json(response, 200, {
        progress: await database.listProgress(player.id),
      });
    }

    const progressMatch = url.pathname.match(
      /^\/v1\/me\/progress\/([a-z0-9-]{1,96})$/,
    );
    if (request.method === "PUT" && progressMatch) {
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
      const body = await readJson(request);
      const missing = missingPrerequisites(
        body.questId,
        await database.listProgress(player.id),
      );
      if (missing === undefined) {
        return json(response, 404, { error: "UNKNOWN_QUEST" });
      }
      if (missing.length) {
        return json(response, 403, {
          error: "QUEST_LOCKED",
          missingPrerequisites: missing,
        });
      }
      const upstream = await judgeRequest("/v1/submissions", {
        method: "POST",
        headers: judgeHeaders(player.id, "application/json"),
        body: JSON.stringify(body),
      });
      const result = await readUpstreamJson(upstream);
      if (upstream.ok && result.submission?.id) {
        await database.createSubmission(
          player.id,
          result.submission.id,
          body.questId,
          result.submission.status,
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
      const record = await database.findSubmission(
        player.id,
        submissionMatch[1],
      );
      if (!record) return json(response, 404, { error: "UNKNOWN_SUBMISSION" });

      let upstream;
      try {
        upstream = await judgeRequest(
          `/v1/submissions/${submissionMatch[1]}`,
          { headers: judgeHeaders(player.id), timeoutMs: 3_000 },
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
        if (
          result.submission.status === "DONE" &&
          result.submission.verdict === "AC"
        ) {
          try {
            await database.saveProgress(
              player.id,
              record.questId,
              "cleared",
              100,
            );
          } catch (error) {
            console.error("Accepted progress persistence failed:", error.message);
          }
        }
      }
      return json(response, 200, result);
    }

    return json(response, 404, { error: "NOT_FOUND" });
  } catch (error) {
    if (error instanceof ApiError) {
      return json(response, error.status, {
        error: error.code,
        ...error.details,
      });
    }
    console.error("Core API request failed:", error.message);
    return json(response, 500, { error: "INTERNAL_ERROR" });
  }
});

await migrateWithRetry(database);
server.listen(port, "0.0.0.0", () => {
  console.log(`AlgoQuest API listening on :${port}`);
});

async function shutdown() {
  server.close();
  await database.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
