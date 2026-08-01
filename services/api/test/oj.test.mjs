import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  oiAlgorithmTagCategories,
  oiAlgorithmTags,
  OjValidationError,
  publicOjProblem,
  trustedOjQuest,
  validateOjProblem,
} from "../src/oj.mjs";

const validProblem = {
  title: "Range Signal",
  statement: "Given an integer sequence, answer every requested range sum query.",
  statementFormat: "plain",
  timeLimitMs: 1000,
  memoryLimitMb: 128,
  difficulty: 4,
  tags: ["前缀和", "数组"],
  tests: [
    { input: "3 1\n1 2 3\n1 3\n", expected: "6\n", sample: true },
    { input: "1 1\n-5\n1 1\n", expected: "-5\n", sample: false },
  ],
  stdSource: "#include <bits/stdc++.h>\nint main(){return 0;}",
};

test("OJ validation accepts bounded problems from the fixed OI taxonomy", () => {
  const problem = validateOjProblem(validProblem);
  assert.deepEqual(problem.tags, ["前缀和", "数组"]);
  assert.equal(problem.tests.length, 2);
  assert.equal(problem.tests[0].id, "01");
  assert.ok(oiAlgorithmTags.length >= 220);
  assert.equal(new Set(oiAlgorithmTags).size, oiAlgorithmTags.length);
  assert.ok(oiAlgorithmTagCategories.length >= 10);
  assert.deepEqual(
    new Set(oiAlgorithmTagCategories.flatMap((category) => category.tags)),
    new Set(oiAlgorithmTags),
  );
});

test("OJ validation rejects forged tags and problems without a public sample", () => {
  assert.throws(
    () => validateOjProblem({ ...validProblem, tags: ["totally-not-a-tag"] }),
    (error) => error instanceof OjValidationError && error.code === "INVALID_OJ_TAGS",
  );
  assert.throws(
    () => validateOjProblem({ ...validProblem, tests: validProblem.tests.map((item) => ({ ...item, sample: false })) }),
    (error) => error instanceof OjValidationError && error.code === "OJ_SAMPLE_REQUIRED",
  );
});

test("public OJ payload exposes samples but never hidden answers or std source", () => {
  const stored = {
    ...validProblem,
    publicId: 1000,
    author: { id: "author", displayName: "AUTHOR" },
    submissionCount: 4,
    acceptedCount: 2,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  };
  const publicProblem = publicOjProblem(stored);
  assert.deepEqual(publicProblem.samples, [{ id: "01", input: validProblem.tests[0].input, output: validProblem.tests[0].expected }]);
  assert.equal(publicProblem.statementFormat, "plain");
  assert.equal("tests" in publicProblem, false);
  assert.equal("stdSource" in publicProblem, false);
  assert.equal(trustedOjQuest(stored).tests.length, 2);
});

test("OJ migrations preserve public versions while author edits await review", async () => {
  const [migration, revisionMigration, repository, routes, server] = await Promise.all([
    readFile(new URL("../migrations/100_oj_platform.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/101_oj_revisions_and_rich_text.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/repositories/oj-repository.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/oj-routes.mjs", import.meta.url), "utf8"),
    readFile(new URL("../src/server.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(migration, /public_id bigint UNIQUE/);
  assert.match(migration, /status = 'published' AND public_id IS NOT NULL/);
  assert.match(revisionMigration, /pending_revision jsonb/);
  assert.match(revisionMigration, /statement_format/);
  assert.match(repository, /nextval\('oj_problem_public_id_seq'\)/);
  assert.match(repository, /status IN \('pending', 'rejected'\)/);
  assert.match(repository, /revision_status = 'pending'/);
  assert.match(repository, /adminUpdateOjProblem/);
  assert.match(repository, /archiveOjProblem/);
  assert.match(repository, /deleteOjProblem/);
  assert.match(routes, /requireAdmin\(player\)[\s\S]*moderateOjProblem/);
  assert.match(server, /trustedQuest: trustedOjQuest\(problem\)/);
  assert.match(server, /!record\.questId\.startsWith\("oj-"\)/);
  assert.match(routes, /oj_problem_submit:user/);
});
