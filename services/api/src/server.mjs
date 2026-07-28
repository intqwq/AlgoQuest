import http from "node:http";
import { bearerToken, cleanDisplayName } from "./auth.mjs";
import { createDatabase, migrateWithRetry } from "./database.mjs";
import {
  cachedTerminalSubmission,
  upstreamFailure,
} from "./judge-status.mjs";
import { missingPrerequisites } from "./quests.mjs";

const port = Number(process.env.PORT ?? 8787);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://algoquest:algoquest@127.0.0.1:5432/algoquest";
const judgeBaseUrl = (
  process.env.JUDGE_API_URL ?? "http://127.0.0.1:8788"
).replace(/\/$/, "");
const judgeToken = process.env.JUDGE_API_TOKEN ?? "";
const allowedOrigin = process.env.API_ALLOWED_ORIGIN ?? "*";
const database = createDatabase(databaseUrl);

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
  response.end(JSON.stringify(body));
}

async function readJson(request, limit = 70 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function authenticate(request) {
  const token = bearerToken(request);
  return token ? database.authenticate(token) : undefined;
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
  const result = { status: "ok", database: "ok", judge: "ok" };
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
    if (request.method === "POST" && url.pathname === "/v1/sessions") {
      const body = await readJson(request, 4 * 1024);
      const session = await database.createSession(
        cleanDisplayName(body.displayName),
      );
      return json(response, 201, {
        sessionToken: session.token,
        player: session.player,
      });
    }

    const player = await authenticate(request);
    if (!player) return json(response, 401, { error: "UNAUTHORIZED" });

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
    const payloadTooLarge = error.message === "PAYLOAD_TOO_LARGE";
    console.error("Core API request failed:", error.message);
    return json(response, payloadTooLarge ? 413 : 502, {
      error: payloadTooLarge ? "PAYLOAD_TOO_LARGE" : "UPSTREAM_FAILURE",
    });
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
