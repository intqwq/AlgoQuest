import crypto from "node:crypto";

const startedAt = Date.now();
let requestCount = 0;
let errorCount = 0;
let totalDurationMs = 0;

function validRequestId(value) {
  return typeof value === "string" && /^[A-Za-z0-9._-]{8,128}$/.test(value);
}

export function log(level, event, fields = {}) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "core-api",
    event,
    ...fields,
  });
  (level === "error" ? console.error : console.log)(line);
}

export function observeRequest(request, response) {
  const requestId = validRequestId(request.headers["x-request-id"])
    ? request.headers["x-request-id"]
    : crypto.randomUUID();
  const started = performance.now();
  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);
  response.once("finish", () => {
    const durationMs = Math.round((performance.now() - started) * 100) / 100;
    requestCount += 1;
    totalDurationMs += durationMs;
    if (response.statusCode >= 500) errorCount += 1;
    log(response.statusCode >= 500 ? "error" : "info", "http_request", {
      requestId,
      method: request.method,
      path: new URL(request.url ?? "/", "http://api.local").pathname,
      status: response.statusCode,
      durationMs,
    });
  });
  return requestId;
}

export function prometheusMetrics() {
  return [
    "# HELP algoquest_api_uptime_seconds Core API process uptime.",
    "# TYPE algoquest_api_uptime_seconds gauge",
    `algoquest_api_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
    "# HELP algoquest_api_http_requests_total Completed HTTP requests.",
    "# TYPE algoquest_api_http_requests_total counter",
    `algoquest_api_http_requests_total ${requestCount}`,
    "# HELP algoquest_api_http_errors_total Completed HTTP 5xx requests.",
    "# TYPE algoquest_api_http_errors_total counter",
    `algoquest_api_http_errors_total ${errorCount}`,
    "# HELP algoquest_api_http_duration_ms_total Total request duration.",
    "# TYPE algoquest_api_http_duration_ms_total counter",
    `algoquest_api_http_duration_ms_total ${Math.round(totalDurationMs)}`,
    "",
  ].join("\n");
}
