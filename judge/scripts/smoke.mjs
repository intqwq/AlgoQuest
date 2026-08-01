const judgeBase = (process.env.JUDGE_SMOKE_URL ?? "http://127.0.0.1:8788")
  .replace(/\/$/, "");
const apiToken = process.env.JUDGE_API_TOKEN ?? "";
const terminalStatuses = new Set(["DONE", "ERROR"]);

const correctSource = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int a, b;
    cin >> a >> b;
    cout << a + b;

    return 0;
}`;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function responseJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function headers(owner) {
  return {
    "content-type": "application/json",
    "x-real-ip": owner,
    ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}),
  };
}

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${judgeBase}/health`);
      if (response.ok) return;
    } catch {
      // Compose may still be starting the API or Redis dependency.
    }
    await sleep(500);
  }
  throw new Error("Judge API did not become ready within 30 seconds.");
}

async function judge(source, owner) {
  const created = await responseJson(
    await fetch(`${judgeBase}/v1/submissions`, {
      method: "POST",
      headers: headers(owner),
      body: JSON.stringify({
        questId: "signal-fire",
        language: "cpp14",
        source,
        mode: "submit",
      }),
    }),
  );

  let submission = created.submission;
  const deadline = Date.now() + 90_000;
  while (!terminalStatuses.has(submission.status)) {
    if (Date.now() >= deadline) {
      throw new Error(`Submission ${submission.id} did not finish within 90 seconds.`);
    }
    await sleep(Math.max(200, Number(submission.pollAfterMs) || 500));
    const polled = await responseJson(
      await fetch(`${judgeBase}/v1/submissions/${submission.id}`, {
        headers: headers(owner),
      }),
    );
    submission = polled.submission;
  }
  return submission;
}

await waitUntilReady();

const accepted = await judge(correctSource, "127.0.0.254");
if (accepted.verdict !== "AC") {
  console.error("[judge smoke] expected AC, received:");
  console.error(JSON.stringify(accepted, null, 2));
  process.exitCode = 1;
} else {
  const wrong = await judge(
    correctSource.replace("a + b", "a - b"),
    "127.0.0.253",
  );
  if (
    wrong.verdict !== "WA" ||
    wrong.cases.length !== accepted.cases.length ||
    wrong.cases.some((item) => "expected" in item || "received" in item)
  ) {
    console.error("[judge smoke] WA privacy/full-run contract failed:");
    console.error(JSON.stringify(wrong, null, 2));
    process.exitCode = 1;
  } else {
    const peakMemoryKb = Math.max(
      0,
      ...accepted.cases.map((item) => item.memoryKb),
    );
    console.log(
      `[judge smoke] queue + worker AC/full WA (${accepted.cases.length} cases, ${accepted.containerStarts} container, ${peakMemoryKb} KiB peak RSS)`,
    );
  }
}
