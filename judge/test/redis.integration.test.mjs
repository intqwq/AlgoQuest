import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "redis";
import { RedisSubmissionQueue } from "../src/redis-submission-queue.mjs";

const redisUrl = process.env.TEST_REDIS_URL;

test(
  "queued jobs and terminal results survive queue object replacement",
  { skip: !redisUrl },
  async () => {
    const client = createClient({ url: redisUrl });
    await client.connect();
    await client.flushDb();
    const options = {
      client,
      prefix: "algoquest:test",
      cooldownMs: 0,
      resultTtlMs: 60_000,
      jobTtlMs: 60_000,
    };
    const first = new RedisSubmissionQueue(options);
    const created = await first.create({
      owner: "integration-player",
      source: "int main(){}",
      language: "cpp14",
      questId: "signal-fire",
      quest: { tests: [] },
      mode: "submit",
    });

    const replacement = new RedisSubmissionQueue(options);
    assert.equal((await replacement.get(created.id)).status, "QUEUED");
    assert.equal(await replacement.take(1), created.id);
    const job = await replacement.rawJob(created.id);
    Object.assign(job, { status: "DONE", verdict: "AC", score: 100 });
    await replacement.finish(job);
    assert.equal((await replacement.get(created.id)).verdict, "AC");
    assert.deepEqual(await replacement.stats(), {
      active: 0,
      queued: 0,
      concurrency: 2,
      queueCapacity: 1000,
      persistence: "redis",
    });
    await client.quit();
  },
);
