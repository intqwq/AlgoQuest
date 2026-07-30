import crypto from "node:crypto";
import pg from "pg";
import { createOpaqueToken, hashToken } from "../src/auth.mjs";

const { Pool } = pg;
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

const database = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://algoquest:algoquest@127.0.0.1:5432/algoquest",
});
const smokeUserId = crypto.randomUUID();
const sessionToken = createOpaqueToken();
await database.query(
  `INSERT INTO users
     (
       id, display_name, email, email_verified_at, is_guest,
       created_at, updated_at
     )
   VALUES ($1, 'DEPLOY_SMOKE', $2, now(), false, now(), now())`,
  [smokeUserId, `deploy-smoke-${smokeUserId}@invalid.local`],
);
await database.query(
  `INSERT INTO sessions (token_hash, user_id, expires_at)
   VALUES ($1, $2, now() + interval '10 minutes')`,
  [hashToken(sessionToken), smokeUserId],
);

const headers = {
  authorization: `Bearer ${sessionToken}`,
  "content-type": "application/json",
};

try {
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
  const save = await json(
    await fetch(`${apiBase}/me/save`, {
      headers: { authorization: headers.authorization },
    }),
  );
  const savedSubmission = save.save.submissions.find(
    (item) => item.judgeSubmissionId === submission.id,
  );
  if (savedSubmission?.source !== source) {
    throw new Error("Accepted submission did not retain its source snapshot.");
  }

  console.log(
    `[core smoke] AC + progress + source history (${submission.cases.length} cases)`,
  );
} finally {
  await database.query("DELETE FROM users WHERE id = $1", [smokeUserId]);
  await database.end();
}
