import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function isMissing(path) {
  try {
    await access(new URL(`../${path}`, import.meta.url));
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

test("temporary branch-rewriting workflows are not shipped", async () => {
  for (const path of [
    ".github/workflows/apply-codebase-cleanup.yml",
    ".github/workflows/cleanup-on-workflow-run.yml",
  ]) {
    assert.equal(await isMissing(path), true, path);
  }
});

test("the API loads learning routes on every startup path", async () => {
  const [server, packageJson, dockerfile] = await Promise.all([
    read("services/api/src/server.mjs"),
    read("services/api/package.json"),
    read("services/api/Dockerfile"),
  ]);
  assert.match(server, /from "\.\/learning-router\.mjs"/);
  assert.match(server, /handleLearningRequest\(request, response\)/);
  assert.equal(JSON.parse(packageJson).scripts.start, "node src/server.mjs");
  assert.match(dockerfile, /CMD \["node", "src\/server\.mjs"\]/);
  assert.match(server, /ensureQuestRuleAccess\(player\.id, body\.questId\)/);
});

test("Judge API is separated from the Docker-capable worker", async () => {
  const [compose, apiImage, workerImage, queue] = await Promise.all([
    read("compose.yml"),
    read("judge/Dockerfile.service"),
    read("judge/Dockerfile.worker"),
    read("judge/src/redis-submission-queue.mjs"),
  ]);
  assert.doesNotMatch(apiImage, /docker\.io|docker\.sock/);
  assert.match(workerImage, /docker\.io/);
  assert.match(compose, /judge-worker:/);
  assert.match(compose, /redis:/);
  assert.match(queue, /CREATE_JOB_SCRIPT/);
});

test("Vinext is the only Web runtime and the unused D1 stack is absent", async () => {
  const [packageJson, vite, worker] = await Promise.all([
    read("package.json"),
    read("vite.config.ts"),
    read("worker/index.ts"),
  ]);
  const packageData = JSON.parse(packageJson);
  assert.equal(packageData.scripts.dev.includes("vite"), true);
  assert.equal(packageData.scripts.start.includes("vinext"), true);
  assert.equal("drizzle-orm" in packageData.dependencies, false);
  assert.equal("drizzle-kit" in packageData.devDependencies, false);
  assert.equal("next" in packageData.dependencies, false);
  assert.equal(await isMissing("drizzle.config.ts"), true);
  assert.equal(await isMissing("db/index.ts"), true);
  assert.match(vite, /vinext\(\)/);
  assert.doesNotMatch(worker, /D1Database/);
});

test("route families and OJ persistence are explicit modules", async () => {
  for (const path of [
    "services/api/src/routes/auth-routes.mjs",
    "services/api/src/routes/oj-routes.mjs",
    "services/api/src/repositories/oj-repository.mjs",
    "services/api/src/learning-router.mjs",
  ]) {
    assert.equal(await isMissing(path), false, path);
  }
  const learning = await read("services/api/src/learning-router.mjs");
  assert.doesNotMatch(learning, /http\.createServer|data:text\/javascript|jsfrag/);
});

test("CI includes browser, PostgreSQL, Redis and security gates", async () => {
  const [ci, codeql, dependabot] = await Promise.all([
    read(".github/workflows/ci.yml"),
    read(".github/workflows/codeql.yml"),
    read(".github/dependabot.yml"),
  ]);
  assert.match(ci, /playwright/);
  assert.match(ci, /TEST_DATABASE_URL/);
  assert.match(ci, /TEST_REDIS_URL/);
  assert.match(ci, /npm audit --omit=dev --audit-level=high/);
  assert.match(codeql, /github\/codeql-action\/analyze@v3/);
  assert.match(dependabot, /package-ecosystem: npm/);
});

test("private metrics and structured request logging are wired", async () => {
  const [api, apiMetrics, judge, gateway] = await Promise.all([
    read("services/api/src/server.mjs"),
    read("services/api/src/observability.mjs"),
    read("judge/src/observability.mjs"),
    read("deploy/nginx/default.conf.template"),
  ]);
  assert.match(api, /url\.pathname === "\/metrics"/);
  assert.match(apiMetrics, /x-request-id/);
  assert.match(judge, /algoquest_judge_queue_depth/);
  assert.match(gateway, /location = \/api\/metrics/);
});

test("migrations are serialized, checksummed and applied once", async () => {
  const database = await read("services/api/src/database.mjs");
  assert.match(database, /CREATE TABLE IF NOT EXISTS schema_migrations/);
  assert.match(database, /pg_advisory_lock/);
  assert.match(database, /MIGRATION_CHANGED_AFTER_APPLY/);
});

test("Judge reports observed peak RSS without a synthetic baseline", async () => {
  const [runner, dockerfile] = await Promise.all([
    read("judge/runner/submission_runner.py"),
    read("judge/Dockerfile.runner"),
  ]);
  assert.match(runner, /memory_kb = raw_memory_kb/);
  assert.doesNotMatch(runner, /measure_memory_baseline|memory_overhead_kb/);
  assert.doesNotMatch(dockerfile, /memory_baseline/);
});

test("gateway upload limits and baseline headers match application behavior", async () => {
  const nginx = await read("deploy/nginx/default.conf.template");
  assert.match(nginx, /client_max_body_size 1m/);
  assert.match(nginx, /X-Content-Type-Options "nosniff"/);
  assert.match(nginx, /X-Frame-Options "DENY"/);
});
