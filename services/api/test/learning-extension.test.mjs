import assert from "node:assert/strict";
import test from "node:test";
import {
  computeStreak,
  diffLines,
  evaluateRule,
} from "../src/learning-extension.mjs";

test("continuous learning streak counts consecutive UTC activity days", () => {
  const streak = computeStreak([
    new Date(),
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  ]);
  assert.equal(streak.current, 3);
  assert.equal(streak.longest, 3);
});

test("hidden quest rule engine composes all, any and not nodes", () => {
  const metrics = {
    clearedCount: 6,
    submissionCount: 12,
    acceptedCount: 7,
    currentStreak: 3,
    totalXp: 1800,
    clearedQuestIds: new Set(["signal-fire"]),
    achievementIds: new Set(["first-ac"]),
    verdictCounts: { AC: 7, WA: 5 },
  };
  assert.equal(
    evaluateRule(
      {
        all: [
          { clearedAtLeast: 5 },
          { any: [{ streakAtLeast: 7 }, { achievement: "first-ac" }] },
          { not: { verdictCount: { verdict: "WA", count: 10 } } },
        ],
      },
      metrics,
    ),
    true,
  );
});

test("submission diff reports line additions and removals", () => {
  const diff = diffLines("int x = 1;\ncout << x;", "int x = 2;\ncout << x;\nreturn 0;");
  assert.equal(diff.summary.added, 2);
  assert.equal(diff.summary.removed, 1);
  assert.equal(diff.summary.unchanged, 1);
});

