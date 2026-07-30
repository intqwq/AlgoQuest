import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("maximum XP is derived from the active quest catalog", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const maximumXp = questCatalog\.reduce/);
  assert.doesNotMatch(page, /totalXp\s*\/\s*420/);
});

test("map nodes expose management edit actions and smooth drop-time collision handling", async () => {
  const [map, page] = await Promise.all([
    readFile(new URL("../components/quest-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(map, /requestAnimationFrame/);
  assert.match(map, /quest-node-edit/);
  assert.match(map, /onPositionCommit/);
  assert.match(page, /algoquest:open-admin/);
  assert.match(page, /nearestOpenMapPosition/);
});

test("deployments enter the allowlisted operations console only in interactive terminals", async () => {
  const [windows, pi, consoleSource] = await Promise.all([
    readFile(new URL("../deploy/windows/deploy.ps1", import.meta.url), "utf8"),
    readFile(new URL("../deploy/pi/deploy.sh", import.meta.url), "utf8"),
    readFile(new URL("../scripts/ops-console.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(windows, /ops-console\.mjs/);
  assert.match(windows, /IsInputRedirected/);
  assert.match(pi, /-t 0 && -t 1/);
  assert.match(consoleSource, /git", \["pull", "--ff-only", "origin", "main"\]/);
  assert.doesNotMatch(consoleSource, /exec\(/);
});
