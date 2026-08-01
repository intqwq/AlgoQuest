import assert from "node:assert/strict";
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
