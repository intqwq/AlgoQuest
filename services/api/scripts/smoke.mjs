const apiBase = process.env.API_SMOKE_URL ?? "http://127.0.0.1:8787/v1";
const source = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long a, b;
    cin >> a >> b;
    cout << a + b << '\\n';
    return 0;
}`;

async function json(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

const readyDeadline = Date.now() + 30_000;
while (true) {
  try {
    const response = await fetch(`${apiBase.replace(/\/v1$/, "")}/health`);
    if ([200, 503].includes(response.status)) break;
  } catch {
    // The API container may still be completing its database migration.
  }
  if (Date.now() > readyDeadline) {
    throw new Error("Core API did not become reachable within 30 seconds.");
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const session = await json(
  await fetch(`${apiBase}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ displayName: "DEPLOY_SMOKE" }),
  }),
);
const headers = {
  authorization: `Bearer ${session.sessionToken}`,
  "content-type": "application/json",
};
const created = await json(
  await fetch(`${apiBase}/judge/submissions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      questId: "signal-fire",
      language: "cpp14",
      source,
      mode: "submit",
    }),
  }),
);

let submission = created.submission;
const deadline = Date.now() + 60_000;
while (!["DONE", "ERROR"].includes(submission.status)) {
  if (Date.now() > deadline) throw new Error("Core API smoke test timed out.");
  await new Promise((resolve) =>
    setTimeout(resolve, Math.max(200, submission.pollAfterMs ?? 500)),
  );
  const response = await fetch(
    `${apiBase}/judge/submissions/${submission.id}`,
    { headers: { authorization: headers.authorization } },
  );
  if ([502, 503, 504].includes(response.status)) continue;
  submission = (await json(response)).submission;
}

if (submission.verdict !== "AC") {
  throw new Error(`Expected AC, received ${JSON.stringify(submission)}`);
}
const progress = await json(
  await fetch(`${apiBase}/me/progress`, {
    headers: { authorization: headers.authorization },
  }),
);
if (
  !progress.progress.some(
    (item) => item.questId === "signal-fire" && item.status === "cleared",
  )
) {
  throw new Error("Accepted submission did not persist quest progress.");
}

console.log(
  `[core smoke] AC + persisted progress (${submission.cases.length} cases)`,
);
