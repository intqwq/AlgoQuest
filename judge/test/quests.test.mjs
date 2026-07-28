import test from "node:test";
import assert from "node:assert/strict";
import { quests } from "../src/quests.mjs";

test("signal-fire contains boundary and signed cases", () => {
  const inputs = quests["signal-fire"].tests.map((item) => item.input);
  assert.ok(inputs.includes("-19 8\n"));
  assert.ok(inputs.includes("1000000000 1000000000\n"));
  assert.ok(inputs.includes("-1000000000 1000000000\n"));
});
