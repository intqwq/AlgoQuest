# AlgoQuest HTTP API

The public browser origin is the Nginx Gateway. Browser requests use
`/api/v1/...`; Nginx removes `/api` and forwards the request to the Core API.
Direct service paths shown below therefore begin with `/v1`.

JSON responses use UTF-8 and `Cache-Control: no-store`. Errors normally use:

```json
{ "error": "MACHINE_READABLE_CODE" }
```

Authenticated endpoints require:

```http
Authorization: Bearer <session-token>
```

A playable account is a non-guest account with a verified email address.
Administrative and owner checks are enforced server-side.

## Health and catalog

| Method | Path | Access | Response |
|---|---|---|---|
| `GET` | `/health` | Public | API/database/Judge readiness; `200` when healthy, `503` when degraded |
| `GET` | `/v1/auth/config` | Public | Public Turnstile site key, email mode, registration state, maintenance message |
| `GET` | `/v1/quests` | Public | Active custom quest definitions, archived IDs, and persisted map layout |

Built-in quests ship in the Web and Judge images. Custom public definitions are
returned by `/v1/quests`; custom hidden tests are never returned there.

## Account lifecycle

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/v1/sessions` | Public, rate limited | Create a temporary guest identity used during registration/save transfer |
| `POST` | `/v1/auth/register` | Public/guest + Turnstile | Create or upgrade an account and send verification email |
| `POST` | `/v1/auth/resend-verification` | Public + Turnstile | Send a fresh verification link |
| `POST` | `/v1/auth/verify-email` | Verification token | Verify email and return a session |
| `POST` | `/v1/auth/login` | Public/guest + Turnstile | Authenticate a verified account and return a session |
| `POST` | `/v1/auth/forgot-password` | Public + Turnstile | Send a generic password-reset response |
| `POST` | `/v1/auth/reset-password` | Reset token + Turnstile | Replace password, revoke old sessions, return a new session |
| `POST` | `/v1/auth/logout` | Bearer session | Revoke the current session |
| `GET` | `/v1/me` | Bearer session | Return the current player record |
| `PUT` | `/v1/me/profile` | Bearer session | Update the display name |

Registration, login, resend, forgot-password, and reset operations use both
Gateway per-IP limits and persistent API rate limits. Turnstile tokens are
single-use and are validated by the Core API for the expected action and
hostname.

## Saves, drafts, and progress

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/v1/me/progress` | Playable account | List quest progress |
| `PUT` | `/v1/me/progress/:questId` | Playable account | Save `started`/`cleared`; clearing requires a durable accepted submission |
| `GET` | `/v1/me/save` | Playable account | Return progress, drafts, and source-bearing submission history |
| `PUT` | `/v1/me/drafts/:questId` | Playable account | Autosave up to 64 KiB of source |
| `POST` | `/v1/me/save/resolve` | Playable account | Select local or cloud state and resolve guest-save transfer |

`POST /v1/me/save/resolve` accepts `choice: "local" | "cloud"`, an optional guest
token, and local draft/progress metadata. Client-reported clears are imported
only when PostgreSQL already has an accepted submission for that player and
quest.

## Editorial

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/v1/editorial/quests/:questId` | Playable account | List visible posts and posting eligibility |
| `POST` | `/v1/editorial/quests/:questId` | Eligible account | Publish a discussion or submit/publish a solution |
| `GET` | `/v1/admin/editorial?status=...` | Admin/owner | List moderation items |
| `PATCH` | `/v1/admin/editorial/:postId` | Admin/owner | Set status to `published` or `rejected` |

Players need at least one submission to post a discussion and a cleared quest
to post a solution. Player discussions publish immediately; player solutions
enter moderation. Admin and owner posts publish directly.

## Administration

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/v1/admin/users` | Admin/owner | Search and paginate players |
| `PUT` | `/v1/admin/users/:userId` | Admin/owner | Update display name, verification state, and permitted role fields |
| `GET` | `/v1/admin/quests` | Admin/owner | List active and archived custom quest records |
| `POST` | `/v1/admin/quests` | Admin/owner | Create a custom quest with trusted tests |
| `PUT` | `/v1/admin/quests/:questId` | Admin/owner | Update a built-in override or custom quest |
| `DELETE` | `/v1/admin/quests/:questId` | Admin/owner | Archive a custom quest |
| `PUT` | `/v1/admin/quest-map-layout` | Admin/owner | Persist up to 128 map positions |
| `GET` | `/v1/owner/server` | Owner | Read settings, aggregate statistics, runtime and Judge health |
| `PUT` | `/v1/owner/server` | Owner | Change registration, Judge, maintenance, and cooldown settings |

The owner account is protected from ordinary role-management endpoints. Hidden
tests for custom quests are accepted only on token-protected admin paths and are
stored in PostgreSQL separately from public definitions.

## Submission API exposed to players

### Create

```http
POST /v1/judge/submissions
Authorization: Bearer <session-token>
Content-Type: application/json
```

```json
{
  "questId": "signal-fire",
  "language": "cpp14",
  "mode": "sample",
  "source": "#include <bits/stdc++.h>\n..."
}
```

`mode` is `sample` or `submit`. The API checks account state, server settings,
quest existence, prerequisites, source limits, and the durable per-player
cooldown before forwarding the job. A successful request returns `202` with a
submission object.

### Poll

```http
GET /v1/judge/submissions/:submissionId
Authorization: Bearer <session-token>
```

Statuses are `QUEUED`, `COMPILING`, `RUNNING`, `DONE`, or `ERROR`. Nonterminal
responses include `pollAfterMs`. Terminal results may include:

```json
{
  "submission": {
    "id": "uuid",
    "status": "DONE",
    "verdict": "AC",
    "score": 100,
    "passScore": 100,
    "cases": [
      { "id": "01", "verdict": "AC", "timeMs": 4, "memoryKb": 512 }
    ]
  }
}
```

Verdicts are `AC`, `CE`, `WA`, `TLE`, `RE`, `MLE`, `OLE`, or `JE`. Expected
output and received output are never returned for hidden cases. When a terminal
Judge response has already been persisted, the Core API can return that durable
result during a temporary Judge outage.

Common submission errors include `JUDGE_DISABLED`, `UNKNOWN_QUEST`,
`QUEST_LOCKED`, `SUBMISSION_COOLDOWN`, `ACTIVE_SUBMISSION`, `QUEUE_FULL`,
`SOURCE_TOO_LARGE`, and `JUDGE_STATUS_UNAVAILABLE`.

## Private Judge API

The Judge port is not a browser endpoint. Except for health, requests require:

```http
Authorization: Bearer <JUDGE_API_TOKEN>
```

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Queue depth, active workers, capacity, and isolation mode |
| `POST` | `/v1/submissions` | Validate and enqueue a built-in or trusted custom quest |
| `GET` | `/v1/submissions/:id` | Return the in-memory job state/result |

The Core API may include a `trustedQuest` only because it possesses the private
Judge token. The Judge validates test count, input/output sizes, time, memory,
compile limit, and pass score before accepting it.

For each job, the Judge writes only `main.cpp` and the compiled binary into the
contestant-visible mount. The trusted manifest is serialized to the disposable
container's stdin, read once by the root supervisor, and fd 0 is closed before
any contestant process starts. Test input is then supplied separately to each
UID/GID `10001` child process.

## Retry semantics

The Web retries transient `429`, `502`, `503`, and `504` responses with bounded
exponential backoff. Submission polling reuses the same job ID and respects
`pollAfterMs`/`retryAfterMs`; it must not create a duplicate submission merely
because status polling temporarily fails.
