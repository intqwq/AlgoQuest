import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Judge transports hidden tests through supervisor stdin", async () => {
  const [dockerRunner, supervisor] = await Promise.all([
    read("judge/src/docker-runner.mjs"),
    read("judge/runner/submission_runner.py"),
  ]);

  assert.match(dockerRunner, /input: JSON\.stringify\(manifest\)/);
  assert.match(dockerRunner, /Only source and the compiled binary enter/);
  assert.doesNotMatch(dockerRunner, /manifestPath/);
  assert.doesNotMatch(dockerRunner, /writeFile\([^)]*manifest\.json/);
  assert.match(supervisor, /sys\.stdin\.buffer\.read/);
  assert.match(supervisor, /sys\.stdin\.close\(\)/);
  assert.doesNotMatch(supervisor, /MANIFEST_PATH/);
});

test("real Docker regression covers all public verdict classes", async () => {
  const integration = await read("judge/test/docker.integration.test.mjs");
  for (const verdict of ["AC", "CE", "WA", "TLE", "RE", "MLE", "OLE"]) {
    assert.match(integration, new RegExp(`\\"${verdict}\\"`));
  }
  assert.match(integration, /hidden tests are never persisted/);
  assert.match(integration, /\/proc\/1\/fd\/0/);
  assert.match(integration, /\/submission\/manifest\.json/);
});

test("required CI runs every reliability gate with a stable check name", async () => {
  const [workflow, packageJson] = await Promise.all([
    read(".github/workflows/ci.yml"),
    read("package.json"),
  ]);

  assert.match(workflow, /name: Required CI/);
  assert.match(workflow, /merge_group:/);
  assert.match(workflow, /required-ci:/);
  assert.match(workflow, /name: required-ci/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /JUDGE_DOCKER_TEST=1 npm --prefix judge test/);
  assert.match(packageJson, /node --test tests\/\*\.test\.mjs/);
});

test("README, architecture and API documentation describe the current stack", async () => {
  const [readme, architecture, api, ci] = await Promise.all([
    read("README.md"),
    read("docs/ARCHITECTURE.md"),
    read("docs/API.md"),
    read("docs/CI.md"),
  ]);

  assert.match(readme, /22 built-in missions/);
  assert.match(readme, /AC.*CE.*WA.*TLE.*RE.*MLE.*OLE/s);
  assert.match(architecture, /Hidden-test transport/);
  assert.match(api, /Private Judge API/);
  assert.match(api, /\/v1\/admin\/quest-map-layout/);
  assert.match(ci, /required-ci/);
});
