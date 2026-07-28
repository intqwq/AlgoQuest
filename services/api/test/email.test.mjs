import assert from "node:assert/strict";
import test from "node:test";
import { createEmailService } from "../src/email.mjs";

test("Resend payload uses the required AlgoQuest sender identity", async () => {
  let request;
  const service = createEmailService({
    apiKey: "re_test",
    fromEmail: "AlgoQuest@intqwq.com",
    appUrl: "https://game.intqwq.com",
    mode: "resend",
    fetchImpl: async (url, init) => {
      request = { url, init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ id: "email-id" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await service.sendVerification({
    email: "player@example.com",
    displayName: "INLINEINT",
    token: "verification-token",
    idempotencyKey: "token-hash",
  });

  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(
    request.body.from,
    "AlgoQuest <AlgoQuest@intqwq.com>",
  );
  assert.deepEqual(request.body.to, ["player@example.com"]);
  assert.match(request.body.html, /game\.intqwq\.com\/\?verify=verification-token/);
  assert.equal(
    request.init.headers["idempotency-key"],
    "algoquest-verify-token-hash",
  );
});
