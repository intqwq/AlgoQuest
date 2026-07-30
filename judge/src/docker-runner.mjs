import { spawn } from "node:child_process";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const IMAGE = process.env.JUDGE_RUNNER_IMAGE ?? "algoquest-runner:cpp14";
const WORK_ROOT = process.env.JUDGE_WORK_ROOT ?? tmpdir();
const WORK_VOLUME = process.env.JUDGE_WORK_VOLUME ?? "";
const CACHE_ROOT =
  process.env.JUDGE_CACHE_ROOT ?? path.join(WORK_ROOT, "algoquest-compile-cache");
const CACHE_ENTRIES = Math.max(
  0,
  Number(process.env.JUDGE_COMPILE_CACHE_ENTRIES ?? 256),
);
const MAX_PROTOCOL_BYTES = 256 * 1024;

function docker(args, { input, onLine } = {}) {
  return new Promise((resolve) => {
    const child = spawn("docker", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let lineBuffer = "";
    let protocolExceeded = false;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= MAX_PROTOCOL_BYTES) stdout.push(chunk);
      else {
        protocolExceeded = true;
        child.kill("SIGKILL");
      }

      lineBuffer += chunk.toString("utf8");
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) onLine?.(line);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= MAX_PROTOCOL_BYTES) stderr.push(chunk);
      else {
        protocolExceeded = true;
        child.kill("SIGKILL");
      }
    });
    child.on("error", (error) =>
      finish({
        code: -1,
        stdout: "",
        stderr: error.message,
        protocolExceeded,
      }),
    );
    child.on("close", (code, signal) => {
      if (lineBuffer.trim()) onLine?.(lineBuffer);
      finish({
        code: code ?? -1,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        protocolExceeded,
      });
    });
    child.stdin.end(input);
  });
}

async function forceRemove(name) {
  await docker(["rm", "-f", name]);
}

function cacheKey(source) {
  return crypto
    .createHash("sha256")
    .update("algoquest-cpp14:gcc14:-O2:-pipe\0")
    .update(source)
    .digest("hex");
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function pruneCache() {
  if (!CACHE_ENTRIES) return;
  const names = await readdir(CACHE_ROOT);
  if (names.length <= CACHE_ENTRIES) return;
  const entries = await Promise.all(
    names.map(async (name) => ({
      name,
      modified: (await stat(path.join(CACHE_ROOT, name))).mtimeMs,
    })),
  );
  entries.sort((a, b) => b.modified - a.modified);
  await Promise.all(
    entries
      .slice(CACHE_ENTRIES)
      .map(({ name }) => rm(path.join(CACHE_ROOT, name), { force: true })),
  );
}

async function storeCache(binaryPath, cachePath) {
  if (!CACHE_ENTRIES) return;
  const temporary = `${cachePath}.${crypto.randomUUID()}.tmp`;
  try {
    await copyFile(binaryPath, temporary);
    await chmod(temporary, 0o555);
    await rename(temporary, cachePath);
    await pruneCache();
  } catch {
    await rm(temporary, { force: true });
  }
}

async function runSubmissionContainer(jobDir, timeoutMs, onProgress) {
  const name = `aq-submit-${crypto.randomUUID()}`;
  const events = [];
  let finalResult;
  let timedOut = false;
  const runnerJobDir = WORK_VOLUME
    ? `/judge-data/jobs/${path.basename(jobDir)}`
    : "/submission";
  const jobMount = WORK_VOLUME
    ? `type=volume,src=${WORK_VOLUME},dst=/judge-data`
    : `type=bind,src=${jobDir},dst=/submission`;

  const parseLine = (line) => {
    try {
      const event = JSON.parse(line);
      events.push(event);
      if (event.type === "result") finalResult = event;
      else onProgress?.(event);
    } catch {
      // Non-protocol output is kept in stdout for judge diagnostics.
    }
  };

  const execution = docker(
    [
      "run",
      "--name",
      name,
      "--network",
      "none",
      "--read-only",
      "--cap-drop",
      "ALL",
      "--cap-add",
      "KILL",
      "--cap-add",
      "SETUID",
      "--cap-add",
      "SETGID",
      "--security-opt",
      "no-new-privileges",
      "--pids-limit",
      "64",
      "--memory",
      "640m",
      "--memory-swap",
      "640m",
      "--cpus",
      "1",
      "--ulimit",
      "nofile=64:64",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=32m,mode=1777",
      "--tmpfs",
      "/work:rw,exec,nosuid,size=96m,mode=755",
      "--mount",
      jobMount,
      IMAGE,
      "python3",
      "/opt/algoquest/submission_runner.py",
      runnerJobDir,
    ],
    { onLine: parseLine },
  );
  const timeout = setTimeout(async () => {
    timedOut = true;
    await forceRemove(name);
  }, timeoutMs);
  timeout.unref();

  const result = await execution;
  clearTimeout(timeout);
  const inspection = await docker([
    "inspect",
    name,
    "--format",
    "{{.State.OOMKilled}}",
  ]);
  await forceRemove(name);

  if (finalResult) return finalResult;
  if (timedOut) {
    return {
      verdict: "TLE",
      cases: [],
      error: "Submission container exceeded its wall-clock budget.",
      containerStarts: 1,
    };
  }
  if (inspection.stdout.trim() === "true") {
    return {
      verdict: "MLE",
      cases: [],
      error: "Submission container exceeded its memory budget.",
      containerStarts: 1,
    };
  }
  return {
    verdict: "JE",
    cases: [],
    error: result.protocolExceeded
      ? "Runner protocol output exceeded its safety limit."
      : result.stderr || "Runner exited without a result.",
    containerStarts: 1,
  };
}

export async function judgeCpp14(source, quest, { onProgress } = {}) {
  await mkdir(WORK_ROOT, { recursive: true });
  await mkdir(CACHE_ROOT, { recursive: true });
  const jobsRoot = path.join(WORK_ROOT, "jobs");
  await mkdir(jobsRoot, { recursive: true });
  const jobDir = await mkdtemp(path.join(jobsRoot, "submission-"));
  const sourcePath = path.join(jobDir, "main.cpp");
  const manifestPath = path.join(jobDir, "manifest.json");
  const binaryPath = path.join(jobDir, "main");
  const cachedBinary = path.join(CACHE_ROOT, cacheKey(source));
  const cacheHit = CACHE_ENTRIES > 0 && (await fileExists(cachedBinary));

  await chmod(jobDir, 0o777);
  await writeFile(sourcePath, source, { mode: 0o644 });
  if (cacheHit) {
    await copyFile(cachedBinary, binaryPath);
    await chmod(binaryPath, 0o555);
    await chmod(jobDir, 0o755);
  }
  await writeFile(
    manifestPath,
    JSON.stringify({
      cacheHit,
      compileLimitMs: quest.compileLimitMs,
      timeLimitMs: quest.timeLimitMs,
      memoryLimitMb: quest.memoryLimitMb,
      tests: quest.tests,
    }),
    { mode: 0o600 },
  );

  const totalTimeoutMs =
    quest.compileLimitMs +
    quest.tests.length * (quest.timeLimitMs + 500) +
    5_000;

  try {
    const result = await runSubmissionContainer(
      jobDir,
      totalTimeoutMs,
      onProgress,
    );
    if (
      result.compiled &&
      !cacheHit &&
      result.verdict !== "CE" &&
      (await fileExists(binaryPath))
    ) {
      await storeCache(binaryPath, cachedBinary);
    }
    const publicResult = { ...result };
    delete publicResult.compiled;
    delete publicResult.type;
    const completedCases = publicResult.cases ?? [];
    const acceptedCases = completedCases.filter(
      (item) => item.verdict === "AC",
    ).length;
    publicResult.score = quest.tests.length
      ? Math.round((acceptedCases / quest.tests.length) * 100)
      : 0;
    publicResult.passScore = Math.min(
      100,
      Math.max(1, Number(quest.passScore ?? 100)),
    );
    if (
      completedCases.length === quest.tests.length &&
      publicResult.score >= publicResult.passScore
    ) {
      publicResult.verdict = "AC";
    }
    return publicResult;
  } finally {
    await rm(jobDir, { recursive: true, force: true });
  }
}
