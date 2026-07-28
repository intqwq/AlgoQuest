import assert from "node:assert/strict";
import test from "node:test";
import {
  cachedTerminalSubmission,
  upstreamFailure,
} from "../src/judge-status.mjs";
import { missingPrerequisites } from "../src/quests.mjs";

test("returns a durable terminal submission when the Judge link is down", () => {
  const submission = {
    id: "8e3d2dd0-8520-45b0-8a8a-d53906928ee2",
    status: "DONE",
    verdict: "AC",
    cases: [],
  };
  assert.deepEqual(
    cachedTerminalSubmission({
      status: "DONE",
      details: submission,
    }),
    submission,
  );
  assert.equal(
    cachedTerminalSubmission({
      status: "RUNNING",
      details: { ...submission, status: "RUNNING" },
    }),
    undefined,
  );
});

test("normalizes temporary upstream failures to a retryable 503", () => {
  assert.deepEqual(upstreamFailure(502), {
    status: 503,
    body: {
      error: "JUDGE_STATUS_UNAVAILABLE",
      retryAfterMs: 1000,
      upstreamStatus: 502,
    },
  });
  assert.deepEqual(upstreamFailure(404, { error: "UNKNOWN_SUBMISSION" }), {
    status: 404,
    body: { error: "UNKNOWN_SUBMISSION" },
  });
});

test("enforces the campaign prerequisites in order", () => {
  const noProgress = [];
  assert.deepEqual(missingPrerequisites("signal-fire", noProgress), []);
  assert.deepEqual(missingPrerequisites("forked-path", noProgress), [
    "signal-fire",
  ]);
  assert.deepEqual(
    missingPrerequisites("forked-path", [
      { questId: "signal-fire", status: "cleared" },
    ]),
    [],
  );
  assert.equal(missingPrerequisites("unknown", noProgress), undefined);
});
