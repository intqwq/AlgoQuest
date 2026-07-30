import crypto from "node:crypto";

const TERMINAL_STATES = new Set(["DONE", "ERROR"]);

export class QueueError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}

export class SubmissionQueue {
  constructor({
    executor,
    maxParallel = 2,
    maxQueued = 1000,
    cooldownMs = 5000,
    resultTtlMs = 10 * 60 * 1000,
    now = () => Date.now(),
  }) {
    this.executor = executor;
    this.maxParallel = Math.max(1, maxParallel);
    this.maxQueued = Math.max(1, maxQueued);
    this.cooldownMs = Math.max(0, cooldownMs);
    this.resultTtlMs = Math.max(1000, resultTtlMs);
    this.now = now;
    this.active = 0;
    this.pending = [];
    this.jobs = new Map();
    this.activeByOwner = new Map();
    this.lastSubmittedAt = new Map();

    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      Math.min(this.resultTtlMs, 60_000),
    );
    this.cleanupTimer.unref();
  }

  create({ owner, source, language, questId, quest, mode }) {
    const activeId = this.activeByOwner.get(owner);
    if (activeId) {
      throw new QueueError("ACTIVE_SUBMISSION", {
        submission: this.get(activeId),
      });
    }

    const now = this.now();
    const lastSubmittedAt = this.lastSubmittedAt.get(owner) ?? -Infinity;
    const retryAfterMs = this.cooldownMs - (now - lastSubmittedAt);
    if (retryAfterMs > 0) {
      throw new QueueError("SUBMISSION_COOLDOWN", {
        retryAfterMs: Math.ceil(retryAfterMs),
      });
    }
    if (this.pending.length >= this.maxQueued) {
      throw new QueueError("QUEUE_FULL", {
        queueCapacity: this.maxQueued,
      });
    }

    const id = crypto.randomUUID();
    const job = {
      id,
      owner,
      payload: { source, language, questId, quest, mode },
      status: "QUEUED",
      verdict: undefined,
      compilerOutput: undefined,
      error: undefined,
      cases: [],
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      finishedAtMs: undefined,
    };
    this.jobs.set(id, job);
    this.pending.push(id);
    this.activeByOwner.set(owner, id);
    this.lastSubmittedAt.set(owner, now);
    queueMicrotask(() => this.drain());
    return this.publicJob(job);
  }

  get(id) {
    const job = this.jobs.get(id);
    return job ? this.publicJob(job) : undefined;
  }

  stats() {
    return {
      active: this.active,
      queued: this.pending.length,
      concurrency: this.maxParallel,
      queueCapacity: this.maxQueued,
    };
  }

  publicJob(job) {
    const queueIndex =
      job.status === "QUEUED" ? this.pending.indexOf(job.id) : -1;
    const queuePosition = queueIndex >= 0 ? queueIndex + 1 : 0;
    const pollAfterMs =
      job.status === "QUEUED"
        ? Math.min(5000, 1000 + queuePosition * 20)
        : TERMINAL_STATES.has(job.status)
          ? undefined
          : 350;
    return {
      id: job.id,
      status: job.status,
      queuePosition,
      pollAfterMs,
      verdict: job.verdict,
      score: job.score,
      passScore: job.passScore,
      compilerOutput: job.compilerOutput,
      error: job.error,
      cases: job.cases,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  update(job, patch) {
    Object.assign(job, patch, {
      updatedAt: new Date(this.now()).toISOString(),
    });
  }

  async run(job) {
    this.update(job, { status: "COMPILING" });
    try {
      const result = await this.executor(job.payload, (event) => {
        if (event.type === "phase") {
          this.update(job, { status: event.phase });
        }
        if (event.type === "case" && event.case) {
          const cases = job.cases.filter((item) => item.id !== event.case.id);
          cases.push(event.case);
          this.update(job, { cases });
        }
      });
      this.update(job, {
        status: "DONE",
        verdict: result.verdict,
        score: result.score,
        passScore: result.passScore,
        compilerOutput: result.compilerOutput,
        error: result.error,
        cases: result.cases ?? job.cases,
        finishedAtMs: this.now(),
      });
    } catch {
      this.update(job, {
        status: "ERROR",
        error: "JUDGE_FAILURE",
        finishedAtMs: this.now(),
      });
    } finally {
      this.active -= 1;
      this.activeByOwner.delete(job.owner);
      this.drain();
    }
  }

  drain() {
    while (this.active < this.maxParallel && this.pending.length) {
      const id = this.pending.shift();
      const job = this.jobs.get(id);
      if (!job) continue;
      this.active += 1;
      void this.run(job);
    }
  }

  cleanup() {
    const cutoff = this.now() - this.resultTtlMs;
    for (const [id, job] of this.jobs) {
      if (
        TERMINAL_STATES.has(job.status) &&
        job.finishedAtMs !== undefined &&
        job.finishedAtMs < cutoff
      ) {
        this.jobs.delete(id);
      }
    }
  }
}
