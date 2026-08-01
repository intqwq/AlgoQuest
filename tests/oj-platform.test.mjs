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
  assert.match(hub, /EditorialComposer/);
  assert.match(hub, /EditorialRichText/);
  assert.match(hub, /visibleTagCategories/);
  assert.match(hub, /sampleIndex/);
  assert.match(hub, /archiveOjProblem/);
  assert.match(hub, /deleteOjProblem/);
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

test("OJ and quest samples run individually with bounded detailed diagnostics", async () => {
  const [hub, mission, judgeServer, sampleSelection, runner] = await Promise.all([
    readFile(new URL("../components/oj-hub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/mission-terminal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../judge/src/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../judge/src/sample-selection.mjs", import.meta.url), "utf8"),
    readFile(new URL("../judge/runner/submission_runner.py", import.meta.url), "utf8"),
  ]);
  assert.match(hub, /RUN THIS SAMPLE/);
  assert.match(hub, /EXPECTED OUTPUT/);
  assert.match(hub, /RUNTIME DIAGNOSTICS/);
  assert.match(mission, /runSample\(index\)/);
  assert.match(mission, /ACTUAL OUTPUT/);
  assert.match(judgeServer, /UNKNOWN_SAMPLE/);
  assert.match(sampleSelection, /diagnostics: true/);
  assert.match(runner, /manifest\.get\("diagnostics"\) is True/);
  assert.match(runner, /result\["expected"\]/);
  assert.match(runner, /MAX_OUTPUT_BYTES = 64 \* 1024/);
});
