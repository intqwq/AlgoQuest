import crypto from "node:crypto";

export const turnstileTestSiteKey = "1x00000000000000000000AA";
export const turnstileTestSecretKey = "1x0000000000000000000000000000000AA";

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 150;
const RETRYABLE_PROVIDER_ERRORS = new Set(["internal-error"]);
const SECRET_ERRORS = new Set(["missing-input-secret", "invalid-input-secret"]);

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

function providerErrors(result) {
  if (!Array.isArray(result?.["error-codes"])) return [];
  return result["error-codes"]
    .filter((code) => typeof code === "string")
    .slice(0, 16);
}

function retryableHttpStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function timeoutError(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError";
}

function classifiedProviderFailure(errors, attempts) {
  if (errors.some((code) => SECRET_ERRORS.has(code))) {
    return {
      ok: false,
      code: "TURNSTILE_MISCONFIGURED",
      errors,
      attempts,
    };
  }
  if (errors.includes("timeout-or-duplicate")) {
    return {
      ok: false,
      code: "TURNSTILE_TOKEN_EXPIRED",
      errors,
      attempts,
    };
  }
  if (errors.includes("missing-input-response")) {
    return {
      ok: false,
      code: "TURNSTILE_TOKEN_REQUIRED",
      errors,
      attempts,
    };
  }
  if (errors.some((code) => RETRYABLE_PROVIDER_ERRORS.has(code))) {
    return {
      ok: false,
      code: "TURNSTILE_UNAVAILABLE",
      errors,
      attempts,
    };
  }
  return {
    ok: false,
    code: "TURNSTILE_REJECTED",
    errors,
    attempts,
  };
}

async function defaultSleep(delayMs) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function turnstileFailureResponse(verification) {
  const unavailableCodes = new Set([
    "TURNSTILE_NOT_CONFIGURED",
    "TURNSTILE_MISCONFIGURED",
    "TURNSTILE_TIMEOUT",
    "TURNSTILE_NETWORK_ERROR",
    "TURNSTILE_UPSTREAM_ERROR",
    "TURNSTILE_INVALID_RESPONSE",
    "TURNSTILE_UNAVAILABLE",
  ]);
  const unavailable = unavailableCodes.has(verification.code);
  const resetWidget = new Set([
    "TURNSTILE_TOKEN_EXPIRED",
    "TURNSTILE_REJECTED",
    "TURNSTILE_ACTION_MISMATCH",
    "TURNSTILE_HOSTNAME_MISMATCH",
  ]).has(verification.code);

  return {
    status: unavailable ? 503 : 400,
    code: unavailable
      ? "HUMAN_VERIFICATION_UNAVAILABLE"
      : "HUMAN_VERIFICATION_FAILED",
    details: {
      reason: verification.code,
      retryable: unavailable || resetWidget,
      resetWidget,
      ...(Number.isInteger(verification.attempts)
        ? { attempts: verification.attempts }
        : {}),
      ...(Array.isArray(verification.errors) && verification.errors.length
        ? { providerErrors: verification.errors }
        : {}),
      ...(unavailable ? { retryAfterMs: 1_000 } : {}),
    },
  };
}

export function createTurnstileVerifier({
  secretKey,
  expectedHostname = "",
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  retryBaseMs = DEFAULT_RETRY_BASE_MS,
  sleepImpl = defaultSleep,
}) {
  const requestTimeoutMs = boundedInteger(timeoutMs, DEFAULT_TIMEOUT_MS, 250, 30_000);
  const attemptLimit = boundedInteger(maxAttempts, DEFAULT_MAX_ATTEMPTS, 1, 5);
  const baseDelayMs = boundedInteger(retryBaseMs, DEFAULT_RETRY_BASE_MS, 0, 5_000);

  async function pauseBeforeRetry(attempt) {
    const delayMs = baseDelayMs * 2 ** (attempt - 1);
    if (delayMs > 0) await sleepImpl(delayMs);
  }

  return {
    async verify({ token, remoteIp, action }) {
      if (!secretKey) {
        return { ok: false, code: "TURNSTILE_NOT_CONFIGURED", attempts: 0 };
      }
      if (typeof token !== "string" || !token || token.length > 2048) {
        return { ok: false, code: "TURNSTILE_TOKEN_REQUIRED", attempts: 0 };
      }

      const idempotencyKey = crypto.randomUUID();
      let lastFailure = {
        ok: false,
        code: "TURNSTILE_UNAVAILABLE",
        attempts: 0,
      };

      for (let attempt = 1; attempt <= attemptLimit; attempt += 1) {
        try {
          const response = await fetchImpl(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                secret: secretKey,
                response: token,
                remoteip: remoteIp,
                idempotency_key: idempotencyKey,
              }),
              signal: AbortSignal.timeout(requestTimeoutMs),
            },
          );

          let result;
          try {
            result = await response.json();
          } catch {
            lastFailure = {
              ok: false,
              code: "TURNSTILE_INVALID_RESPONSE",
              status: response.status,
              attempts: attempt,
            };
            if (attempt < attemptLimit && (response.ok || retryableHttpStatus(response.status))) {
              await pauseBeforeRetry(attempt);
              continue;
            }
            return lastFailure;
          }

          const errors = providerErrors(result);
          if (!response.ok) {
            if (errors.length) {
              const classified = classifiedProviderFailure(errors, attempt);
              if (
                classified.code === "TURNSTILE_UNAVAILABLE" &&
                attempt < attemptLimit
              ) {
                lastFailure = classified;
                await pauseBeforeRetry(attempt);
                continue;
              }
              return classified;
            }

            lastFailure = {
              ok: false,
              code: "TURNSTILE_UPSTREAM_ERROR",
              status: response.status,
              attempts: attempt,
            };
            if (attempt < attemptLimit && retryableHttpStatus(response.status)) {
              await pauseBeforeRetry(attempt);
              continue;
            }
            return lastFailure;
          }

          if (!result || typeof result !== "object") {
            lastFailure = {
              ok: false,
              code: "TURNSTILE_INVALID_RESPONSE",
              status: response.status,
              attempts: attempt,
            };
            if (attempt < attemptLimit) {
              await pauseBeforeRetry(attempt);
              continue;
            }
            return lastFailure;
          }

          if (!result.success) {
            const classified = classifiedProviderFailure(errors, attempt);
            if (
              classified.code === "TURNSTILE_UNAVAILABLE" &&
              attempt < attemptLimit
            ) {
              lastFailure = classified;
              await pauseBeforeRetry(attempt);
              continue;
            }
            return classified;
          }

          if (action && result.action !== action) {
            return {
              ok: false,
              code: "TURNSTILE_ACTION_MISMATCH",
              attempts: attempt,
            };
          }
          if (expectedHostname && result.hostname !== expectedHostname) {
            return {
              ok: false,
              code: "TURNSTILE_HOSTNAME_MISMATCH",
              attempts: attempt,
            };
          }
          return { ok: true };
        } catch (error) {
          lastFailure = {
            ok: false,
            code: timeoutError(error)
              ? "TURNSTILE_TIMEOUT"
              : "TURNSTILE_NETWORK_ERROR",
            attempts: attempt,
          };
          if (attempt < attemptLimit) {
            await pauseBeforeRetry(attempt);
            continue;
          }
          return lastFailure;
        }
      }

      return lastFailure;
    },
  };
}
