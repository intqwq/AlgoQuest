import assert from "node:assert/strict";
import test from "node:test";
import { createTurnstileVerifier } from "../src/security.mjs";

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
  });
  assert.deepEqual(
    await verifier.verify({ token: "valid", action: "login" }),
    { ok: false, code: "TURNSTILE_ACTION_MISMATCH" },
  );
});
