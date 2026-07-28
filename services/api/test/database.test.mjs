import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimitQuery } from "../src/database.mjs";

test("rate-limit SQL uses a contiguous, explicitly typed parameter list", () => {
  const query = createRateLimitQuery("guest_session:ip", "203.0.113.8", 3600);
  const parameterIndexes = [
    ...new Set(
      [...query.text.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])),
    ),
  ].sort((left, right) => left - right);

  assert.deepEqual(parameterIndexes, [1, 2, 3]);
  assert.equal(Math.max(...parameterIndexes), query.values.length);
  assert.equal(query.values[0], "guest_session:ip");
  assert.match(query.values[1], /^[a-f0-9]{64}$/);
  assert.equal(query.values[2], 3600);
  assert.match(query.text, /\$3::integer/);
});
