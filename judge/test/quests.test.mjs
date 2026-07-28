import test from "node:test";
import assert from "node:assert/strict";
import { quests } from "../src/quests.mjs";

test("signal-fire contains boundary and signed cases", () => {
  const inputs = quests["signal-fire"].tests.map((item) => item.input);
  assert.ok(inputs.includes("-19 8\n"));
  assert.ok(inputs.includes("1000000000 1000000000\n"));
  assert.ok(inputs.includes("-1000000000 1000000000\n"));
});

test("the first campaign chapter has complete hidden test suites", () => {
  assert.equal(quests["signal-fire"].tests.length, 4);
  assert.equal(quests["forked-path"].tests.length, 5);
  assert.equal(quests["echo-loop"].tests.length, 5);
  assert.ok(
    quests["forked-path"].tests.some((item) => item.expected === "EQUAL\n"),
  );
  assert.ok(
    quests["echo-loop"].tests.some((item) => item.input === "1\n"),
  );
});
