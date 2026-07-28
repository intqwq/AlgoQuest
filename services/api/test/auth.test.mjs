import assert from "node:assert/strict";
import test from "node:test";
import {
  bearerToken,
  cleanDisplayName,
  createOpaqueToken,
  hashPassword,
  hashToken,
  normalizeEmail,
  passwordPolicyError,
  verifyPassword,
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

test("emails are normalized and malformed values are rejected", () => {
  assert.equal(normalizeEmail(" Player@Example.COM "), "player@example.com");
  assert.equal(normalizeEmail("missing-at.example.com"), undefined);
  assert.equal(normalizeEmail("a@b"), undefined);
});

test("password policy requires a bounded letter and number secret", () => {
  assert.equal(passwordPolicyError("short1"), "PASSWORD_TOO_SHORT");
  assert.equal(
    passwordPolicyError("only-letters-here"),
    "PASSWORD_NEEDS_LETTER_AND_NUMBER",
  );
  assert.equal(passwordPolicyError("correct-horse-42"), undefined);
});

test("password hashes are salted and verify in constant-time form", async () => {
  const first = await hashPassword("correct-horse-42");
  const second = await hashPassword("correct-horse-42");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct-horse-42", first), true);
  assert.equal(await verifyPassword("wrong-password-42", first), false);
  assert.equal(await verifyPassword("correct-horse-42", "broken"), false);
});
