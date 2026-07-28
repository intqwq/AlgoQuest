import http from "node:http";
import { judgeCpp14 } from "./docker-runner.mjs";
import { quests } from "./quests.mjs";
import { QueueError, SubmissionQueue } from "./submission-queue.mjs";

const port = Number(process.env.PORT ?? 8788);
const maxParallel = Math.max(1, Number(process.env.JUDGE_MAX_PARALLEL ?? 2));
const maxQueued = Math.max(1, Number(process.env.JUDGE_QUEUE_CAPACITY ?? 1000));
const cooldownMs = Math.max(0, Number(process.env.JUDGE_COOLDOWN_MS ?? 4000));
const resultTtlMs = Math.max(
  60_000,
  Number(process.env.JUDGE_RESULT_TTL_MS ?? 10 * 60 * 1000),
);
const allowedOrigin = process.env.JUDGE_ALLOWED_ORIGIN ?? "*";
const apiToken = process.env.JUDGE_API_TOKEN ?? "";
const trustProxy = process.env.JUDGE_TRUST_PROXY === "true";

const submissionQueue = new SubmissionQueue({
  maxParallel,
  maxQueued,
  cooldownMs,
  resultTtlMs,
  executor: ({ source, quest }, onProgress) =>
    judgeCpp14(source, quest, { onProgress }),
});

function corsHeaders() {
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, OPTIONS",
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

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 70 * 1024) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function requestOwner(request) {
  if (trustProxy) {
    const forwarded = request.headers["x-real-ip"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return `ip:${forwarded.trim()}`;
    }
  }
  return `ip:${request.socket.remoteAddress ?? "unknown"}`;
}

function selectedQuest(quest, mode) {
  if (mode !== "sample") return quest;
  return {
    ...quest,
    tests: quest.tests.slice(0, 1),
  };
}

function authorized(request) {
  return (
    !apiToken || request.headers.authorization === `Bearer ${apiToken}`
  );
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://judge.local");

  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders());
    return response.end();
  }
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, {
      status: "ok",
      ...submissionQueue.stats(),
      isolation: "one-container-per-submission",
    });
  }
  if (!authorized(request)) {
    return json(response, 401, { error: "UNAUTHORIZED" });
  }

  const submissionMatch = url.pathname.match(
    /^\/v1\/submissions\/([0-9a-f-]+)$/,
  );
  if (request.method === "GET" && submissionMatch) {
    const submission = submissionQueue.get(submissionMatch[1]);
    if (!submission) return json(response, 404, { error: "UNKNOWN_SUBMISSION" });
    return json(response, 200, { submission });
  }

  if (request.method !== "POST" || url.pathname !== "/v1/submissions") {
    return json(response, 404, { error: "NOT_FOUND" });
  }

  try {
    const body = await readJson(request);
    const quest = quests[body.questId];
    if (!quest) return json(response, 404, { error: "UNKNOWN_QUEST" });
    if (body.language !== "cpp14") {
      return json(response, 400, { error: "UNSUPPORTED_LANGUAGE" });
    }
    if (body.mode !== undefined && !["sample", "submit"].includes(body.mode)) {
      return json(response, 400, { error: "UNKNOWN_MODE" });
    }
    if (typeof body.source !== "string" || !body.source.trim()) {
      return json(response, 400, { error: "EMPTY_SOURCE" });
    }
    if (Buffer.byteLength(body.source, "utf8") > 64 * 1024) {
      return json(response, 413, { error: "SOURCE_TOO_LARGE" });
    }

    const submission = submissionQueue.create({
      owner: requestOwner(request),
      source: body.source,
      language: body.language,
      questId: body.questId,
      quest: selectedQuest(quest, body.mode),
      mode: body.mode ?? "submit",
    });
    return json(
      response,
      202,
      { submission },
      { location: `/v1/submissions/${submission.id}` },
    );
  } catch (error) {
    if (error instanceof QueueError) {
      const statuses = {
        ACTIVE_SUBMISSION: 409,
        SUBMISSION_COOLDOWN: 429,
        QUEUE_FULL: 503,
      };
      const headers =
        error.code === "SUBMISSION_COOLDOWN"
          ? {
              "retry-after": String(
                Math.max(1, Math.ceil(error.details.retryAfterMs / 1000)),
              ),
            }
          : {};
      return json(
        response,
        statuses[error.code] ?? 400,
        { error: error.code, ...error.details },
        headers,
      );
    }
    const status = error.message === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return json(response, status, {
      error: status === 413 ? "PAYLOAD_TOO_LARGE" : "JUDGE_FAILURE",
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(
    `AlgoQuest judge listening on :${port} (${maxParallel} workers, queue ${maxQueued})`,
  );
});
