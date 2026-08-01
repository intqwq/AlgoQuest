import crypto from "node:crypto";

const startedAt = Date.now();
let requests = 0;
let failures = 0;

export function observeRequest(request, response) {
  const supplied = request.headers["x-request-id"];
  const requestId =
    typeof supplied === "string" && /^[A-Za-z0-9._-]{8,128}$/.test(supplied)
      ? supplied
      : crypto.randomUUID();
  const started = performance.now();
  response.setHeader("x-request-id", requestId);
  response.once("finish", () => {
    requests += 1;
    if (response.statusCode >= 500) failures += 1;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: response.statusCode >= 500 ? "error" : "info",
      service: "judge-api",
      event: "http_request",
      requestId,
      method: request.method,
      path: new URL(request.url ?? "/", "http://judge.local").pathname,
      status: response.statusCode,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
    }));
  });
}

export function metrics(queueStats) {
  return [
    "# TYPE algoquest_judge_uptime_seconds gauge",
    `algoquest_judge_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
    "# TYPE algoquest_judge_http_requests_total counter",
    `algoquest_judge_http_requests_total ${requests}`,
    "# TYPE algoquest_judge_http_failures_total counter",
    `algoquest_judge_http_failures_total ${failures}`,
    "# TYPE algoquest_judge_queue_depth gauge",
    `algoquest_judge_queue_depth ${queueStats.queued}`,
    "# TYPE algoquest_judge_active_jobs gauge",
    `algoquest_judge_active_jobs ${queueStats.active}`,
    "",
  ].join("\n");
}
