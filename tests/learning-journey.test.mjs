import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("registration calibrates C++ and algorithm experience without deleting skipped quests", async () => {
  const [account, client, database, server] = await Promise.all([
    read("components/account-panel.tsx"),
    read("lib/api-client.ts"),
    read("services/api/src/database.mjs"),
    read("services/api/src/server.mjs"),
  ]);
  assert.match(account, /"hasCppFoundation"/);
  assert.match(account, /"hasAlgorithmFoundation"/);
  assert.match(account, /被跳过的关卡仍可随时进入学习/);
  assert.match(client, /hasCppFoundation: boolean/);
  assert.match(database, /recommendedQuestId/);
  assert.match(database, /"sorting-ruins"/);
  assert.match(database, /"knapsack-forge"/);
  assert.match(server, /player\?\.recommendedQuestId === questId \? \[\] : missing/);
});

test("the first mission tutorial is mandatory while every quest story is skippable and replayable", async () => {
  const [prologue, mission, page, css] = await Promise.all([
    read("components/quest-prologue.tsx"),
    read("components/mission-terminal.tsx"),
    read("app/page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(prologue, /tutorialRequired \? "tutorial" : "story"/);
  assert.match(prologue, /phase === "story" && \(/);
  assert.match(prologue, /ui\.skip/);
  assert.match(prologue, /await onTutorialComplete\(\)/);
  assert.match(mission, /tutorialRequired \|\| !storySeen/);
  assert.match(mission, /setPrologueOpen\(true\)/);
  assert.match(page, /completeWebTutorial/);
  assert.match(page, /completeQuestStory/);
  assert.match(css, /\.prologue-overlay/);
  assert.match(css, /@keyframes story-pulse/);
});

test("the campaign reaches advanced algorithms with localized lessons and trusted tests", async () => {
  const [quests, judge, prerequisites, codex] = await Promise.all([
    read("lib/advanced-quests.ts"),
    read("judge/src/quests.mjs"),
    read("services/api/src/quests.mjs"),
    read("lib/advanced-codex.ts"),
  ]);
  const advancedIds = [
    "recursive-mirror",
    "greedy-caravan",
    "knapsack-forge",
    "lis-observatory",
    "mst-skybridge",
    "fenwick-pulse",
    "segment-bastion",
    "lca-oracle",
    "scc-nexus",
    "maxflow-reactor",
  ];
  for (const questId of advancedIds) {
    assert.match(quests, new RegExp(`id: "${questId}"`));
    assert.match(judge, new RegExp(`"${questId}": \\{`));
    assert.match(prerequisites, new RegExp(`"${questId}": \\[`));
    assert.match(codex, new RegExp(`questId: "${questId}"`));
  }
  assert.match(quests, /translations: \{/);
  assert.match(quests, /"zh-CN":/);
  assert.match(quests, /ja:/);
});

test("learning progress is cloud-backed for the tutorial and story prologues", async () => {
  const [migration, server, client] = await Promise.all([
    read("services/api/migrations/009_learning_journey.sql"),
    read("services/api/src/server.mjs"),
    read("lib/api-client.ts"),
  ]);
  assert.match(migration, /web_tutorial_completed_at/);
  assert.match(migration, /quest_story_progress/);
  assert.match(server, /\/v1\/me\/learning\/tutorial/);
  assert.match(server, /\/v1\/me\/learning\/stories/);
  assert.match(client, /loadQuestStoryProgress/);
  assert.match(client, /completeQuestStory/);
});
