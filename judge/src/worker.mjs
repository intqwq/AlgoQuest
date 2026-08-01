import { hostname } from "node:os";
import { createClient } from "redis";
import { judgeCpp14 } from "./docker-runner.mjs";
import { RedisSubmissionQueue } from "./redis-submission-queue.mjs";

const maxParallel = Math.max(1, Number(process.env.JUDGE_MAX_PARALLEL ?? 2));
const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
});
redis.on("error", (error) => {
  console.error(JSON.stringify({
    level: "error",
    service: "judge-worker",
    event: "redis_error",
    message: error.message,
  }));
});
await redis.connect();

const queue = new RedisSubmissionQueue({
  client: redis,
  maxParallel,
  maxQueued: Number(process.env.JUDGE_QUEUE_CAPACITY ?? 1000),
  cooldownMs: Number(process.env.JUDGE_COOLDOWN_MS ?? 5000),
  resultTtlMs: Number(process.env.JUDGE_RESULT_TTL_MS ?? 10 * 60 * 1000),
  jobTtlMs: Number(process.env.JUDGE_JOB_TTL_MS ?? 24 * 60 * 60 * 1000),
});

const restored = await queue.requeueInterrupted();
console.log(JSON.stringify({
  level: "info",
  service: "judge-worker",
  event: "worker_started",
  worker: `${hostname()}:${process.pid}`,
  concurrency: maxParallel,
  restored,
}));

async function runOne() {
  const blockingClient = redis.duplicate();
  await blockingClient.connect();
  while (true) {
    const id = await queue.take(0, blockingClient);
    if (!id) continue;
    const job = await queue.rawJob(id);
    if (!job) {
      await redis.lRem(queue.key("processing"), 1, id);
      continue;
    }
    job.status = "COMPILING";
    await queue.save(job);
    try {
      const result = await judgeCpp14(job.payload.source, job.payload.quest, {
        onProgress(event) {
          if (event.type === "phase") job.status = event.phase;
          if (event.type === "case" && event.case) {
            job.cases = (job.cases ?? []).filter(
              (item) => item.id !== event.case.id,
            );
            job.cases.push(event.case);
          }
          void queue.save(job);
        },
      });
      Object.assign(job, result, { status: "DONE" });
    } catch (error) {
      job.status = "ERROR";
      job.error = "JUDGE_FAILURE";
      console.error(JSON.stringify({
        level: "error",
        service: "judge-worker",
        event: "job_failed",
        jobId: job.id,
        message: error.message,
      }));
    }
    await queue.finish(job);
  }
}

await Promise.all(Array.from({ length: maxParallel }, () => runOne()));
