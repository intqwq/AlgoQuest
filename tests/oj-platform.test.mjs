import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("top navigation exposes a complete localized community OJ", async () => {
  const [page, hub, api, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/oj-hub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /<OjHub/);
  assert.match(page, /\[ OJ \]/);
  assert.match(hub, /en:[\s\S]*"zh-CN":[\s\S]*ja:/);
  assert.match(hub, /loadOjProblems/);
  assert.match(hub, /loadOjProblem/);
  assert.match(hub, /submitOjProblem/);
  assert.match(hub, /loadOjModeration/);
  assert.match(hub, /submitOjSolution/);
  assert.match(hub, /<Editor/);
  assert.match(api, /OjProblemStatus = "pending" \| "published" \| "rejected"/);
  assert.match(css, /\.oj-problem-row/);
  assert.match(css, /\.oj-review-actions/);
});

test("problem authoring includes limits, ten difficulties, fixed tags, tests, samples and std", async () => {
  const hub = await readFile(new URL("../components/oj-hub.tsx", import.meta.url), "utf8");
  assert.match(hub, /difficultyNames/);
  assert.match(hub, /timeLimitMs/);
  assert.match(hub, /memoryLimitMb/);
  assert.match(hub, /form\.tags\.length < 1/);
  assert.match(hub, /form\.tags\.length > 12/);
  assert.match(hub, /form\.tests\.length >= 50/);
  assert.match(hub, /item\.sample/);
  assert.match(hub, /stdSource/);
  assert.match(hub, /APPROVE & ASSIGN ID/);
});
