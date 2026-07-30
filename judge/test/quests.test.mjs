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

test("all twelve campaign quests have complete trusted Judge suites", () => {
  const campaignIds = [
    "signal-fire",
    "forked-path",
    "echo-loop",
    "array-vault",
    "sorting-ruins",
    "binary-gate",
    "prefix-beacon",
    "stack-sentinel",
    "grid-rescue",
    "dijkstra-citadel",
    "union-forge",
    "topological-crown",
  ];
  assert.equal(Object.keys(quests).length, campaignIds.length);
  for (const questId of campaignIds) {
    assert.ok(quests[questId], `${questId} is registered`);
    assert.ok(quests[questId].tests.length >= 4, `${questId} has hidden tests`);
    assert.ok(
      quests[questId].tests.every(
        (item, index) =>
          item.id === String(index + 1).padStart(2, "0") &&
          typeof item.input === "string" &&
          typeof item.expected === "string",
      ),
      `${questId} has normalized tests`,
    );
  }
});
