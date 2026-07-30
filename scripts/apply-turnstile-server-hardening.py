from pathlib import Path


SECURITY_SOURCE = r'''import crypto from "node:crypto";

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
'''


SECURITY_TESTS = r'''import assert from "node:assert/strict";
import test from "node:test";
import {
  createTurnstileVerifier,
  turnstileFailureResponse,
} from "../src/security.mjs";

test("Turnstile verification is server-side and checks action and hostname", async () => {
  let requestBody;
  const verifier = createTurnstileVerifier({
    secretKey: "secret",
    expectedHostname: "game.intqwq.com",
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          success: true,
          action: "login",
          hostname: "game.intqwq.com",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assert.deepEqual(
    await verifier.verify({
      token: "client-token",
      remoteIp: "203.0.113.8",
      action: "login",
    }),
    { ok: true },
  );
  assert.equal(requestBody.secret, "secret");
  assert.equal(requestBody.response, "client-token");
  assert.equal(requestBody.remoteip, "203.0.113.8");
  assert.match(requestBody.idempotency_key, /^[0-9a-f-]{36}$/i);
});

test("Turnstile rejects action mismatches and missing tokens", async () => {
  const verifier = createTurnstileVerifier({
    secretKey: "secret",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ success: true, action: "register", hostname: "test" }),
        { status: 200 },
      ),
  });

  assert.deepEqual(await verifier.verify({ token: "", action: "login" }), {
    ok: false,
    code: "TURNSTILE_TOKEN_REQUIRED",
    attempts: 0,
  });
  assert.deepEqual(
    await verifier.verify({ token: "valid", action: "login" }),
    { ok: false, code: "TURNSTILE_ACTION_MISMATCH", attempts: 1 },
  );
});

test("Turnstile retries transient responses with one idempotency key", async () => {
  const requestBodies = [];
  const delays = [];
  let calls = 0;
  const verifier = createTurnstileVerifier({
    secretKey: "secret",
    maxAttempts: 3,
    retryBaseMs: 25,
    sleepImpl: async (delay) => delays.push(delay),
    fetchImpl: async (_url, init) => {
      calls += 1;
      requestBodies.push(JSON.parse(init.body));
      if (calls === 1) {
        return new Response(JSON.stringify({ success: false, "error-codes": ["internal-error"] }), {
          status: 200,
        });
      }
      if (calls === 2) {
        return new Response("temporarily unavailable", { status: 503 });
      }
      return new Response(
        JSON.stringify({ success: true, action: "login", hostname: "test" }),
        { status: 200 },
      );
    },
  });

  assert.deepEqual(
    await verifier.verify({ token: "valid", action: "login" }),
    { ok: true },
  );
  assert.equal(calls, 3);
  assert.deepEqual(delays, [25, 50]);
  assert.equal(
    new Set(requestBodies.map((body) => body.idempotency_key)).size,
    1,
  );
});

test("Turnstile classifies exhausted timeouts and network errors", async () => {
  const delays = [];
  const verifier = createTurnstileVerifier({
    secretKey: "secret",
    maxAttempts: 2,
    retryBaseMs: 10,
    sleepImpl: async (delay) => delays.push(delay),
    fetchImpl: async () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    },
  });

  assert.deepEqual(await verifier.verify({ token: "valid", action: "login" }), {
    ok: false,
    code: "TURNSTILE_TIMEOUT",
    attempts: 2,
  });
  assert.deepEqual(delays, [10]);
});

test("Turnstile maps provider errors without retrying permanent failures", async () => {
  let calls = 0;
  const verifier = createTurnstileVerifier({
    secretKey: "secret",
    maxAttempts: 3,
    retryBaseMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          success: false,
          "error-codes": ["timeout-or-duplicate"],
        }),
        { status: 200 },
      );
    },
  });

  assert.deepEqual(await verifier.verify({ token: "expired", action: "login" }), {
    ok: false,
    code: "TURNSTILE_TOKEN_EXPIRED",
    errors: ["timeout-or-duplicate"],
    attempts: 1,
  });
  assert.equal(calls, 1);
});

test("Turnstile API failures preserve compatibility and expose a reason", () => {
  assert.deepEqual(
    turnstileFailureResponse({
      ok: false,
      code: "TURNSTILE_TIMEOUT",
      attempts: 3,
    }),
    {
      status: 503,
      code: "HUMAN_VERIFICATION_UNAVAILABLE",
      details: {
        reason: "TURNSTILE_TIMEOUT",
        retryable: true,
        resetWidget: false,
        attempts: 3,
        retryAfterMs: 1000,
      },
    },
  );

  assert.deepEqual(
    turnstileFailureResponse({
      ok: false,
      code: "TURNSTILE_TOKEN_EXPIRED",
      errors: ["timeout-or-duplicate"],
      attempts: 1,
    }),
    {
      status: 400,
      code: "HUMAN_VERIFICATION_FAILED",
      details: {
        reason: "TURNSTILE_TOKEN_EXPIRED",
        retryable: true,
        resetWidget: true,
        attempts: 1,
        providerErrors: ["timeout-or-duplicate"],
      },
    },
  );
});
'''


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Patch anchor not found in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


Path("services/api/src/security.mjs").write_text(SECURITY_SOURCE, encoding="utf-8")
Path("services/api/test/security.test.mjs").write_text(SECURITY_TESTS, encoding="utf-8")

replace_once(
    "services/api/src/server.mjs",
    '''import {
  createTurnstileVerifier,
  turnstileTestSecretKey,
  turnstileTestSiteKey,
} from "./security.mjs";''',
    '''import {
  createTurnstileVerifier,
  turnstileFailureResponse,
  turnstileTestSecretKey,
  turnstileTestSiteKey,
} from "./security.mjs";''',
)
replace_once(
    "services/api/src/server.mjs",
    '''  if (!verification.ok) {
    const unavailable = verification.code === "TURNSTILE_UNAVAILABLE";
    throw new ApiError(
      unavailable ? 503 : 400,
      unavailable ? "HUMAN_VERIFICATION_UNAVAILABLE" : "HUMAN_VERIFICATION_FAILED",
    );
  }''',
    '''  if (!verification.ok) {
    const failure = turnstileFailureResponse(verification);
    throw new ApiError(failure.status, failure.code, failure.details);
  }''',
)
replace_once(
    "services/api/src/server.mjs",
    '''    if (error instanceof ApiError) {
      return json(response, error.status, {
        error: error.code,
        ...error.details,
      });
    }''',
    '''    if (error instanceof ApiError) {
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
    }''',
)

replace_once(
    "README.md",
    '''The browser never receives database credentials, the Judge token, or hidden test
cases. Only the Judge service owns Docker-socket access. Trusted test manifests
are delivered to the runner supervisor over stdin and are never written into the
contestant-visible submission mount.''',
    '''The browser never receives database credentials, the Judge token, or hidden test
cases. Only the Judge service owns Docker-socket access. Trusted test manifests
are delivered to the runner supervisor over stdin and are never written into the
contestant-visible submission mount. The Core API validates Turnstile with a
bounded timeout, reuses one idempotency key across transient retries, and returns
stable machine-readable failure reasons without exposing the secret key.''',
)

replace_once(
    "docs/ARCHITECTURE.md",
    '- Validates Turnstile token, action, and hostname server-side.',
    '- Validates Turnstile token, action, and hostname server-side with bounded timeouts, idempotent transient retries, and classified failure reasons.',
)
replace_once(
    "docs/ARCHITECTURE.md",
    '''The job directory mounted into the runner contains only contestant source and,
after compilation, the executable. The trusted manifest is JSON-serialized into
the Docker process stdin. The root supervisor reads it once with a bounded size,
closes fd 0, and retains the tests only in its own memory. Contestant processes
receive only the current test input through their own stdin.

This avoids host/container UID mismatches on a `0600` manifest and removes the
old contestant-visible `manifest.json` target entirely. A Docker regression
attempts to read both the old mount path and the supervisor stdin before the
change can be merged.''',
    '''The single-job `/submission` mount is read-only and contains contestant source
plus an optional host-prepared cached binary. The trusted manifest is
JSON-serialized into Docker stdin. The root supervisor reads it once with a
bounded size, seals fd 0 to `/dev/null`, and retains tests only in memory.
Contestant UID/GID `10001` children receive only the current test input through
their own stdin.

Fresh binaries remain in the private `/work` tmpfs while contestant code runs.
After the container stops, the Judge may export the binary with `docker cp` for
cache reuse, so submitted code never sees a writable host path. The Docker
regression probes the old manifest path, PID 1 command line and fd 0, and write
access to `/submission` before the change can merge.''',
)

replace_once(
    "docs/API.md",
    '''Registration, login, resend, forgot-password, and reset operations use both
Gateway per-IP limits and persistent API rate limits. Turnstile tokens are
single-use and are validated by the Core API for the expected action and
hostname.''',
    '''Registration, login, resend, forgot-password, and reset operations use both
Gateway per-IP limits and persistent API rate limits. Turnstile tokens are
single-use and are validated by the Core API for the expected action and
hostname. Siteverify uses a four-second per-attempt deadline and up to three
bounded retries for network failures, timeouts, `429`/`5xx`, malformed upstream
JSON, or Cloudflare `internal-error`; one idempotency key is reused across those
attempts.

Turnstile failures keep the compatible outer codes
`HUMAN_VERIFICATION_FAILED` (`400`) and `HUMAN_VERIFICATION_UNAVAILABLE` (`503`).
The response also includes `reason`, `retryable`, `resetWidget`, and `attempts`.
Possible reasons are `TURNSTILE_TOKEN_REQUIRED`, `TURNSTILE_TOKEN_EXPIRED`,
`TURNSTILE_REJECTED`, `TURNSTILE_ACTION_MISMATCH`,
`TURNSTILE_HOSTNAME_MISMATCH`, `TURNSTILE_TIMEOUT`,
`TURNSTILE_NETWORK_ERROR`, `TURNSTILE_UPSTREAM_ERROR`,
`TURNSTILE_INVALID_RESPONSE`, `TURNSTILE_UNAVAILABLE`, and
`TURNSTILE_MISCONFIGURED`. Retryable `503` responses include `retryAfterMs` and
a matching `Retry-After` header.''',
)
replace_once(
    "docs/API.md",
    '''For each job, the Judge writes only `main.cpp` and the compiled binary into the
contestant-visible mount. The trusted manifest is serialized to the disposable
container's stdin, read once by the root supervisor, and fd 0 is closed before
any contestant process starts. Test input is then supplied separately to each
UID/GID `10001` child process.''',
    '''For each job, the Judge exposes a read-only single-job `/submission` mount with
`main.cpp` and, on a cache hit, a host-prepared executable. The trusted manifest
is serialized to disposable-container stdin, read once by the root supervisor,
and fd 0 is then sealed to `/dev/null`. Fresh binaries stay in private `/work`
until the container stops; optional cache export happens afterward with
`docker cp`. Each UID/GID `10001` child receives only its current test input.''',
)
replace_once(
    "docs/API.md",
    '''The Web retries transient `429`, `502`, `503`, and `504` responses with bounded
exponential backoff. Submission polling reuses the same job ID and respects
`pollAfterMs`/`retryAfterMs`; it must not create a duplicate submission merely
because status polling temporarily fails.''',
    '''The Web retries transient `429`, `502`, `503`, and `504` responses with bounded
exponential backoff. The Core API independently retries only transient Turnstile
Siteverify failures and reuses the same idempotency key; permanent token or
policy failures are returned immediately so the browser can reset the widget.
Submission polling reuses the same job ID and respects
`pollAfterMs`/`retryAfterMs`; it must not create a duplicate submission merely
because status polling temporarily fails.''',
)

replace_once(
    "docs/ACCOUNT_SECURITY.md",
    '''The browser receives only the site key. The Core API keeps the secret and calls
Cloudflare's Siteverify endpoint for every registration, login, verification
resend, forgot-password, and password-reset request. It also verifies the
Turnstile action and configured hostname.''',
    '''The browser receives only the site key. The Core API keeps the secret and calls
Cloudflare's Siteverify endpoint for every registration, login, verification
resend, forgot-password, and password-reset request. It verifies the action and
configured hostname, applies a four-second deadline to each attempt, and retries
only transient transport/provider failures up to three times with one
idempotency key. Expired/duplicate tokens and policy mismatches are never retried
with the same token.''',
)
