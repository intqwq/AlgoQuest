const terminalStatuses = new Set(["DONE", "ERROR"]);

export function cachedTerminalSubmission(record) {
  if (!record || !terminalStatuses.has(record.status)) return undefined;
  const details = record.details;
  if (!details || typeof details !== "object" || !details.id) return undefined;
  return details;
}

export function upstreamFailure(status, body = {}) {
  if (status < 500 && status !== 429) {
    return { status, body };
  }
  return {
    status: 503,
    body: {
      error: "JUDGE_STATUS_UNAVAILABLE",
      retryAfterMs: 1000,
      upstreamStatus: status,
    },
  };
}
