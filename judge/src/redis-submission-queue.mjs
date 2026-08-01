import crypto from "node:crypto";
import { QueueError } from "./submission-queue.mjs";

const CREATE_JOB_SCRIPT = `
local active = redis.call("GET", KEYS[1])
if active then return {2, active} end
local cooldown = redis.call("PTTL", KEYS[2])
if cooldown > 0 then return {3, tostring(cooldown)} end
if redis.call("LLEN", KEYS[3]) >= tonumber(ARGV[4]) then return {4, ""} end
redis.call("SET", KEYS[4], ARGV[2], "PX", ARGV[3])
redis.call("LPUSH", KEYS[3], ARGV[1])
redis.call("SET", KEYS[1], ARGV[1], "PX", ARGV[5])
if tonumber(ARGV[6]) > 0 then
  redis.call("SET", KEYS[2], "1", "PX", ARGV[6])
end
return {1, ARGV[1]}
`;

const RELEASE_OWNER_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

function ownerHash(owner) {
  return crypto.createHash("sha256").update(owner).digest("hex");
}

export class RedisSubmissionQueue {
  constructor({
    client,
    prefix = "algoquest:judge",
    maxParallel = 2,
    maxQueued = 1000,
    cooldownMs = 5000,
    resultTtlMs = 10 * 60 * 1000,
    jobTtlMs = 24 * 60 * 60 * 1000,
  }) {
    this.client = client;
    this.prefix = prefix;
    this.maxParallel = Math.max(1, maxParallel);
    this.maxQueued = Math.max(1, maxQueued);
    this.cooldownMs = Math.max(0, cooldownMs);
    this.resultTtlMs = Math.max(60_000, resultTtlMs);
    this.jobTtlMs = Math.max(this.resultTtlMs, jobTtlMs);
  }

  key(suffix) {
    return `${this.prefix}:${suffix}`;
  }

  jobKey(id) {
    return this.key(`job:${id}`);
  }

  ownerKey(owner) {
    return this.key(`owner:${ownerHash(owner)}`);
  }

  cooldownKey(owner) {
    return this.key(`cooldown:${ownerHash(owner)}`);
  }

  publicJob(job, queuePosition = 0) {
    return {
      id: job.id,
      status: job.status,
      queuePosition,
      pollAfterMs:
        job.status === "QUEUED"
          ? Math.min(5000, 1000 + queuePosition * 20)
          : ["DONE", "ERROR"].includes(job.status)
            ? undefined
            : 350,
      verdict: job.verdict,
      score: job.score,
      passScore: job.passScore,
      compilerOutput: job.compilerOutput,
      error: job.error,
      cases: job.cases ?? [],
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async create({ owner, source, language, questId, quest, mode }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const job = {
      id,
      owner,
      payload: { source, language, questId, quest, mode },
      status: "QUEUED",
      cases: [],
      createdAt: now,
      updatedAt: now,
    };
    const response = await this.client.eval(CREATE_JOB_SCRIPT, {
      keys: [
        this.ownerKey(owner),
        this.cooldownKey(owner),
        this.key("pending"),
        this.jobKey(id),
      ],
      arguments: [
        id,
        JSON.stringify(job),
        String(this.jobTtlMs),
        String(this.maxQueued),
        String(this.jobTtlMs),
        String(this.cooldownMs),
      ],
    });
    const code = Number(response?.[0]);
    if (code === 2) {
      throw new QueueError("ACTIVE_SUBMISSION", {
        submission: await this.get(String(response[1])),
      });
    }
    if (code === 3) {
      throw new QueueError("SUBMISSION_COOLDOWN", {
        retryAfterMs: Math.max(1, Number(response[1])),
      });
    }
    if (code === 4) {
      throw new QueueError("QUEUE_FULL", {
        queueCapacity: this.maxQueued,
      });
    }
    if (code !== 1) throw new Error("REDIS_QUEUE_CREATE_FAILED");
    const queuePosition = await this.client.lLen(this.key("pending"));
    return this.publicJob(job, queuePosition);
  }

  async get(id) {
    const raw = await this.client.get(this.jobKey(id));
    if (!raw) return undefined;
    const job = JSON.parse(raw);
    if (job.status !== "QUEUED") return this.publicJob(job);
    const [index, length] = await Promise.all([
      this.client.lPos(this.key("pending"), id),
      this.client.lLen(this.key("pending")),
    ]);
    const queuePosition = index === null ? 0 : Math.max(1, length - index);
    return this.publicJob(job, queuePosition);
  }

  async rawJob(id) {
    const raw = await this.client.get(this.jobKey(id));
    return raw ? JSON.parse(raw) : undefined;
  }

  async save(job, { terminal = false } = {}) {
    job.updatedAt = new Date().toISOString();
    await this.client.set(this.jobKey(job.id), JSON.stringify(job), {
      PX: terminal ? this.resultTtlMs : this.jobTtlMs,
    });
  }

  async stats() {
    const [queued, active] = await Promise.all([
      this.client.lLen(this.key("pending")),
      this.client.lLen(this.key("processing")),
    ]);
    return {
      active,
      queued,
      concurrency: this.maxParallel,
      queueCapacity: this.maxQueued,
      persistence: "redis",
    };
  }

  async requeueInterrupted() {
    let restored = 0;
    while (await this.client.rPopLPush(
      this.key("processing"),
      this.key("pending"),
    )) {
      restored += 1;
    }
    return restored;
  }

  async take(blockSeconds = 0, client = this.client) {
    return client.brPopLPush(
      this.key("pending"),
      this.key("processing"),
      blockSeconds,
    );
  }

  async finish(job) {
    await this.save(job, { terminal: true });
    await Promise.all([
      this.client.lRem(this.key("processing"), 1, job.id),
      this.client.eval(RELEASE_OWNER_SCRIPT, {
        keys: [this.ownerKey(job.owner)],
        arguments: [job.id],
      }),
    ]);
  }
}
