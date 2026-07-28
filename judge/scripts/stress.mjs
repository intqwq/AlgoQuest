const endpoint =
  process.env.JUDGE_STRESS_URL ?? "http://127.0.0.1:8788/v1/submissions";
const total = Math.max(1, Number(process.env.JUDGE_STRESS_SUBMISSIONS ?? 100));
const clients = Math.max(1, Number(process.env.JUDGE_STRESS_CLIENTS ?? 20));
const source = `#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a+b<<'\\n'; }`;

const started = performance.now();
let nextIndex = 0;
let accepted = 0;
let failed = 0;
const latencies = [];

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function submit(index) {
  const submissionStarted = performance.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": `10.20.${Math.floor(index / 250)}.${(index % 250) + 1}`,
    },
    body: JSON.stringify({
      questId: "signal-fire",
      language: "cpp14",
      mode: "submit",
      source,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${body.error}`);
  let submission = body.submission;
  while (!["DONE", "ERROR"].includes(submission.status)) {
    await wait(submission.pollAfterMs ?? 1000);
    const poll = await fetch(`${endpoint}/${submission.id}`, {
      headers: {
        "x-real-ip": `10.20.${Math.floor(index / 250)}.${(index % 250) + 1}`,
      },
    });
    submission = (await poll.json()).submission;
  }
  latencies.push(performance.now() - submissionStarted);
  if (submission.verdict === "AC") accepted += 1;
  else failed += 1;
}

async function worker() {
  while (nextIndex < total) {
    const index = nextIndex++;
    try {
      await submit(index);
    } catch (error) {
      failed += 1;
      console.error(`submission ${index}: ${error.message}`);
    }
  }
}

await Promise.all(
  Array.from({ length: Math.min(clients, total) }, () => worker()),
);
latencies.sort((a, b) => a - b);
const percentile = (value) =>
  latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))] ??
  0;
const elapsedSeconds = (performance.now() - started) / 1000;

console.log(
  JSON.stringify(
    {
      total,
      accepted,
      failed,
      clients,
      elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
      throughputPerSecond: Number((total / elapsedSeconds).toFixed(2)),
      p50Ms: Math.ceil(percentile(0.5)),
      p95Ms: Math.ceil(percentile(0.95)),
      p99Ms: Math.ceil(percentile(0.99)),
    },
    null,
    2,
  ),
);
