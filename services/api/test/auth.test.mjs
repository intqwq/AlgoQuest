import assert from "node:assert/strict";
import test from "node:test";
import {
  bearerToken,
  cleanDisplayName,
  createOpaqueToken,
  hashToken,
} from "../src/auth.mjs";

test("opaque session tokens are URL safe and hash deterministically", () => {
  const token = createOpaqueToken();
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(hashToken(token), hashToken(token));
  assert.notEqual(hashToken(token), token);
});

test("bearerToken accepts only the expected token form", () => {
  const token = createOpaqueToken();
  assert.equal(
    bearerToken({ headers: { authorization: `Bearer ${token}` } }),
    token,
  );
  assert.equal(bearerToken({ headers: { authorization: "Basic abc" } }), undefined);
});

test("display names are bounded and control characters are removed", () => {
  assert.equal(cleanDisplayName("\u0000  INLINEINT  "), "INLINEINT");
  assert.equal(cleanDisplayName("x".repeat(100)).length, 64);
  assert.equal(cleanDisplayName(undefined), "PLAYER");
});
