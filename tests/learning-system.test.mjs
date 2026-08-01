import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Learning OS exposes continuous learning and player tools", async () => {
  const dock = await read("components/learning-system-dock.tsx");
  const learning = await read("components/learning-system/learning-panel.tsx");
  const submissions = await read("components/learning-system/submissions-panel.tsx");
  const admin = await read("components/learning-system/admin-panel.tsx");
  const layout = await read("app/layout.tsx");
  const profile = await read("app/player/[handle]/page.tsx");

  assert.match(dock, /LEARNING OS/);
  assert.match(dock, /CODEX\+/);
  assert.match(learning, /DAILY FOCUS/);
  assert.match(learning, /30-DAY ACTIVITY/);
  assert.match(learning, /UNLOCKED/);
  assert.match(submissions, /CODE DIFF/);
  assert.match(submissions, /ALL VERDICTS/);
  assert.match(admin, /SAVE DRAFT/);
  assert.match(admin, /ROLLBACK/);
  assert.match(admin, /SAVE RULE/);
  assert.match(admin, /SAVE ENTRY/);
  assert.match(layout, /authenticatedQuestCatalogBridge/);
  assert.match(layout, /LearningSystemDock/);
  assert.match(profile, /PUBLIC PLAYER RECORD/);
});

