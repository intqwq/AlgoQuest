import assert from "node:assert/strict";
import test from "node:test";
import { selectedQuest } from "../src/sample-selection.mjs";

const quest = {
  passScore: 60,
  tests: [
    { id: "01", input: "hidden", expected: "hidden", sample: false },
    { id: "02", input: "sample-a", expected: "A", sample: true },
    { id: "03", input: "sample-b", expected: "B", sample: true },
  ],
};

test("sample mode selects exactly the requested public sample", () => {
  const selected = selectedQuest(quest, "sample", 1);
  assert.equal(selected.tests.length, 1);
  assert.equal(selected.tests[0].id, "03");
  assert.equal(selected.passScore, 100);
  assert.equal(selected.diagnostics, true);
});

test("sample mode rejects out-of-range indexes instead of running hidden data", () => {
  assert.throws(() => selectedQuest(quest, "sample", 2), /UNKNOWN_SAMPLE/);
  assert.equal(selectedQuest(quest, "submit", 99), quest);
});
