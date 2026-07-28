import test from "node:test";
import assert from "node:assert/strict";
import { QueueError, SubmissionQueue } from "../src/submission-queue.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("queue caps execution concurrency and reports positions", async () => {
  const releases = [];
  let concurrent = 0;
  let peak = 0;
  const queue = new SubmissionQueue({
    maxParallel: 2,
    maxQueued: 10,
    cooldownMs: 0,
    executor: async (_payload, onProgress) => {
      concurrent += 1;
      peak = Math.max(peak, concurrent);
      onProgress({ type: "phase", phase: "RUNNING" });
      await new Promise((resolve) => releases.push(resolve));
      concurrent -= 1;
      return { verdict: "AC", cases: [] };
    },
  });

  const jobs = ["a", "b", "c", "d"].map((owner) =>
    queue.create({
      owner,
      source: "int main(){}",
      language: "cpp14",
      questId: "signal-fire",
      quest: {},
      mode: "submit",
    }),
  );
  await tick();
  assert.equal(queue.stats().active, 2);
  assert.equal(queue.stats().queued, 2);
  assert.equal(queue.get(jobs[2].id).queuePosition, 1);
  assert.equal(queue.get(jobs[3].id).queuePosition, 2);

  releases.shift()();
  await tick();
  assert.equal(queue.stats().active, 2);
  assert.equal(queue.stats().queued, 1);
  assert.equal(peak, 2);
  while (releases.length) {
    releases.shift()();
    await tick();
  }
});

test("one owner cannot occupy multiple queue slots", () => {
  const queue = new SubmissionQueue({
    cooldownMs: 0,
    executor: () => new Promise(() => {}),
  });
  const payload = {
    owner: "same-player",
    source: "int main(){}",
    language: "cpp14",
    questId: "signal-fire",
    quest: {},
    mode: "submit",
  };
  queue.create(payload);
  assert.throws(
    () => queue.create(payload),
    (error) =>
      error instanceof QueueError && error.code === "ACTIVE_SUBMISSION",
  );
});

test("bounded queue rejects excess work", async () => {
  const queue = new SubmissionQueue({
    maxParallel: 1,
    maxQueued: 1,
    cooldownMs: 0,
    executor: () => new Promise(() => {}),
  });
  queue.create({
    owner: "active",
    source: "a",
    language: "cpp14",
    questId: "signal-fire",
    quest: {},
    mode: "submit",
  });
  await tick();
  queue.create({
    owner: "queued",
    source: "b",
    language: "cpp14",
    questId: "signal-fire",
    quest: {},
    mode: "submit",
  });
  assert.throws(
    () =>
      queue.create({
        owner: "rejected",
        source: "c",
        language: "cpp14",
        questId: "signal-fire",
        quest: {},
        mode: "submit",
      }),
    (error) => error instanceof QueueError && error.code === "QUEUE_FULL",
  );
});

test("the Raspberry Pi profile safely absorbs a 1,000-job burst", async () => {
  const queue = new SubmissionQueue({
    maxParallel: 2,
    maxQueued: 1000,
    cooldownMs: 0,
    executor: () => new Promise(() => {}),
  });
  for (let index = 0; index < 2; index += 1) {
    queue.create({
      owner: `load-user-${index}`,
      source: "int main(){}",
      language: "cpp14",
      questId: "signal-fire",
      quest: {},
      mode: "submit",
    });
  }
  await tick();
  for (let index = 2; index < 1002; index += 1) {
    queue.create({
      owner: `load-user-${index}`,
      source: "int main(){}",
      language: "cpp14",
      questId: "signal-fire",
      quest: {},
      mode: "submit",
    });
  }
  assert.deepEqual(queue.stats(), {
    active: 2,
    queued: 1000,
    concurrency: 2,
    queueCapacity: 1000,
  });
  assert.throws(
    () =>
      queue.create({
        owner: "one-too-many",
        source: "int main(){}",
        language: "cpp14",
        questId: "signal-fire",
        quest: {},
        mode: "submit",
      }),
    (error) => error instanceof QueueError && error.code === "QUEUE_FULL",
  );
});
