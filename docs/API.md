# AlgoQuest API reference

This document describes the HTTP contract implemented by the current Core API and
private Judge service.

## Base URLs

Normal browser deployment through Nginx:

```text
http://localhost:8080/api/v1
```

Direct Core API access:

```text
http://localhost:8787/v1
```

Direct Core API health endpoint:

```text
http://localhost:8787/health
```

Private Judge service:

```text
http://localhost:8788
```

Nginx removes the `/api` prefix before forwarding. For example,
`/api/v1/me` becomes `/v1/me` at the Core API.

## Conventions

### Content type

JSON requests should use:

```http
Content-Type: application/json
```

JSON responses use:

```http
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

### Authentication

Core API session authentication:

```http
Authorization: Bearer <opaque-session-token>
```

The token is returned by session, verification, login, or password-reset
endpoints. Only a SHA-256 hash is stored by the server.

Private Judge authentication:

```http
Authorization: Bearer <JUDGE_API_TOKEN>
```

`GET /health` on the Judge does not require this token. The submission endpoints
do when `JUDGE_API_TOKEN` is configured.

### Authorization levels

| Level | Meaning |
|---|---|
| Public | No session required |
| Optional guest | A guest bearer token may be supplied to upgrade or preserve guest state |
| Session | Any valid guest or account session |
| Playable account | Verified, non-guest account |
| Admin | `admin` or `owner` role |
| Owner | `owner` role only |
| Private Judge | Matching `JUDGE_API_TOKEN` |

### Error envelope

Most Core API errors use:

```json
{
  "error": "ERROR_CODE"
}
```

Some errors add fields such as `retryAfterMs` or `missingPrerequisites`.

Common status meanings:

| Status | Meaning |
|---:|---|
| `400` | Invalid JSON, validation failure, bad token, or unsupported value |
| `401` | Missing or invalid session/Judge token |
| `403` | Account, role, verification, or quest prerequisite failure |
| `404` | Unknown resource |
| `409` | State conflict, duplicate quest, or progress without accepted submission |
| `413` | Payload or source too large |
| `429` | Rate limit or submission cooldown |
| `502` | Email or upstream delivery failure |
| `503` | Disabled feature, unavailable dependency, or full Judge queue |

### Player object

```json
{
  "id": "uuid",
  "displayName": "INLINEINT",
  "email": "player@example.com",
  "emailVerified": true,
  "isGuest": false,
  "role": "player",
  "learningProfile": {
    "hasCppFoundation": true,
    "hasAlgorithmFoundation": false,
    "configured": true
  },
  "tutorialCompleted": false,
  "recommendedQuestId": "sorting-ruins"
}
```

`role` is one of `player`, `admin`, or `owner`.
`recommendedQuestId` is advisory: skipped introductory quests remain available.

## Endpoint index

### Public and authentication

| Method | Path | Authorization | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Core API, PostgreSQL, Judge, and account configuration health |
| `GET` | `/v1/auth/config` | Public | Public account configuration and maintenance state |
| `GET` | `/v1/quests` | Public | Database quest overrides, custom quests, archived IDs, and map layout |
| `POST` | `/v1/sessions` | Public | Create a guest identity and session |
| `POST` | `/v1/auth/register` | Optional guest | Register or upgrade a guest and send verification email |
| `POST` | `/v1/auth/resend-verification` | Public | Send a fresh verification email when eligible |
| `POST` | `/v1/auth/verify-email` | Public | Consume verification token and create account session |
| `POST` | `/v1/auth/login` | Optional guest | Authenticate a verified account |
| `POST` | `/v1/auth/logout` | Session | Revoke current session |
| `POST` | `/v1/auth/forgot-password` | Public | Send generic password-reset response |
| `POST` | `/v1/auth/reset-password` | Public | Replace password, revoke old sessions, create new session |

### Player and save

| Method | Path | Authorization | Purpose |
|---|---|---|---|
| `GET` | `/v1/me` | Session | Load current player |
| `PUT` | `/v1/me/profile` | Session | Update display name and learning profile |
| `PUT` | `/v1/me/learning/tutorial` | Playable account | Mark the first-use interface tutorial complete |
| `GET` | `/v1/me/learning/stories` | Playable account | List completed quest prologues |
| `PUT` | `/v1/me/learning/stories/:questId` | Playable account | Mark an accessible quest prologue complete |
| `GET` | `/v1/me/progress` | Playable account | Load quest progress |
| `PUT` | `/v1/me/progress/:questId` | Playable account | Save started/cleared state; clears require accepted submission |
| `GET` | `/v1/me/save` | Playable account | Load canonical cloud save |
| `PUT` | `/v1/me/drafts/:questId` | Playable account | Upsert current source draft |
| `POST` | `/v1/me/save/resolve` | Playable account | Choose local or cloud state and resolve guest transfer |

### Judge orchestration

| Method | Path | Authorization | Purpose |
|---|---|---|---|
| `POST` | `/v1/judge/submissions` | Playable account | Validate and queue an owned Judge job |
| `GET` | `/v1/judge/submissions/:id` | Playable account | Poll an owned job and persist terminal result |

### Editorial

| Method | Path | Authorization | Purpose |
|---|---|---|---|
| `GET` | `/v1/editorial/quests/:questId` | Playable account | List visible posts and publishing eligibility |
| `POST` | `/v1/editorial/quests/:questId` | Playable account | Create discussion or solution |
| `GET` | `/v1/admin/editorial` | Admin | List posts by moderation status |
| `PATCH` | `/v1/admin/editorial/:postId` | Admin | Publish or reject a post |

### Administration

| Method | Path | Authorization | Purpose |
|---|---|---|---|
| `GET` | `/v1/admin/users` | Admin | Search and paginate verified accounts |
| `PUT` | `/v1/admin/users/:userId` | Admin | Update display name, verification, and permitted role |
| `GET` | `/v1/admin/quests` | Admin | Load complete quest records including hidden Judge definitions |
| `POST` | `/v1/admin/quests` | Admin | Create a custom quest |
| `PUT` | `/v1/admin/quests/:questId` | Admin | Replace custom quest or override a built-in quest |
| `DELETE` | `/v1/admin/quests/:questId` | Admin | Archive quest record |
| `PUT` | `/v1/admin/quest-map-layout` | Admin | Persist quest coordinates |

### Owner

| Method | Path | Authorization | Purpose |
|---|---|---|---|
| `GET` | `/v1/owner/server` | Owner | Settings, statistics, runtime, and Judge health |
| `PUT` | `/v1/owner/server` | Owner | Update server switches and cooldown |

## Public and authentication endpoints

### `GET /health`

Returns `200` when PostgreSQL and Judge are reachable, otherwise `503`.

```json
{
  "status": "ok",
  "database": "ok",
  "judge": "ok",
  "accounts": "ready"
}
```

`accounts` is `configuration_required` when the public Turnstile site key is not
configured.

### `GET /v1/auth/config`

```json
{
  "turnstileSiteKey": "1x00000000000000000000AA",
  "emailDelivery": "local-log",
  "registrationEnabled": true,
  "maintenanceMessage": ""
}
```

`emailDelivery` is `resend` or `local-log`.

### `GET /v1/quests`

Returns only public quest definitions. Hidden tests are never included.

```json
{
  "quests": [],
  "archivedQuestIds": [],
  "mapLayout": {
    "signal-fire": { "x": 10, "y": 18 }
  }
}
```

The Web client merges these records with its built-in quest definitions. A record
with the same ID overrides the built-in public definition. New IDs become custom
quests. Archived IDs suppress matching built-ins or custom records.

### `POST /v1/sessions`

Request:

```json
{
  "displayName": "INLINEINT"
}
```

Response `201`:

```json
{
  "sessionToken": "opaque-token",
  "player": {
    "id": "uuid",
    "displayName": "INLINEINT",
    "email": null,
    "emailVerified": false,
    "isGuest": true,
    "role": "player"
  }
}
```

Guest creation is rate-limited by client IP.

### `POST /v1/auth/register`

Optional header: existing guest bearer token.

Request:

```json
{
  "displayName": "INLINEINT",
  "email": "player@example.com",
  "password": "correct horse battery staple",
  "hasCppFoundation": true,
  "hasAlgorithmFoundation": false,
  "turnstileToken": "turnstile-response"
}
```

Response `202`:

```json
{
  "status": "VERIFICATION_SENT"
}
```

The response is intentionally generic for existing unverified accounts. Important
errors include `REGISTRATION_DISABLED`, password policy errors,
`HUMAN_VERIFICATION_FAILED`, `HUMAN_VERIFICATION_UNAVAILABLE`, `RATE_LIMITED`,
and `EMAIL_DELIVERY_FAILED`.

### `POST /v1/auth/resend-verification`

Request:

```json
{
  "email": "player@example.com",
  "turnstileToken": "turnstile-response"
}
```

Response `202`:

```json
{
  "status": "VERIFICATION_SENT"
}
```

The same response is returned when the account does not exist or is already
verified.

### `POST /v1/auth/verify-email`

Request:

```json
{
  "token": "verification-token"
}
```

Response `200` contains `sessionToken` and `player`. Invalid, expired, used, or
malformed tokens return `INVALID_OR_EXPIRED_TOKEN`.

### `POST /v1/auth/login`

Optional header: guest bearer token retained by the browser for later save
resolution.

Request:

```json
{
  "email": "player@example.com",
  "password": "correct horse battery staple",
  "turnstileToken": "turnstile-response"
}
```

Response `200` contains `sessionToken` and `player`.

Common errors:

- `INVALID_CREDENTIALS`
- `EMAIL_NOT_VERIFIED`
- `HUMAN_VERIFICATION_FAILED`
- `RATE_LIMITED`

### `POST /v1/auth/logout`

Requires a session. Returns `204` after revoking the current token.

### `POST /v1/auth/forgot-password`

Request:

```json
{
  "email": "player@example.com",
  "turnstileToken": "turnstile-response"
}
```

Response `202`:

```json
{
  "status": "RESET_SENT"
}
```

The response does not reveal whether the email exists.

### `POST /v1/auth/reset-password`

Request:

```json
{
  "token": "password-reset-token",
  "password": "new strong password",
  "turnstileToken": "turnstile-response"
}
```

Response `200` contains a new `sessionToken` and `player`. Existing sessions are
revoked.

## Player and save endpoints

### `GET /v1/me`

Response `200`:

```json
{
  "player": {
    "id": "uuid",
    "displayName": "INLINEINT",
    "email": "player@example.com",
    "emailVerified": true,
    "isGuest": false,
    "role": "player",
    "learningProfile": {
      "hasCppFoundation": true,
      "hasAlgorithmFoundation": false,
      "configured": true
    },
    "tutorialCompleted": false,
    "recommendedQuestId": "sorting-ruins"
  }
}
```

### `PUT /v1/me/profile`

Request:

```json
{
  "displayName": "NEW_NAME",
  "hasCppFoundation": true,
  "hasAlgorithmFoundation": true
}
```

Response `200` returns the updated `player`.

### `PUT /v1/me/learning/tutorial`

Marks the mandatory first-use interface tutorial complete and returns the updated
`player`. Repeated calls are idempotent.

### `GET /v1/me/learning/stories`

Returns the quest prologues completed by the current player:

```json
{
  "stories": [
    {
      "questId": "signal-fire",
      "completedAt": "2026-08-01T00:00:00.000Z"
    }
  ]
}
```

### `PUT /v1/me/learning/stories/:questId`

Marks an accessible quest's prologue complete and returns the stored `story`
record. Unknown or inaccessible quests are rejected; repeated calls are
idempotent.

### `GET /v1/me/progress`

Response:

```json
{
  "progress": [
    {
      "questId": "signal-fire",
      "status": "cleared",
      "bestScore": 100,
      "updatedAt": "2026-07-31T00:00:00.000Z"
    }
  ]
}
```

### `PUT /v1/me/progress/:questId`

Request:

```json
{
  "status": "cleared",
  "score": 100
}
```

`status` is normalized to `started` unless it is exactly `cleared`. `score` is
clamped to `0..100`.

Returns `204`. A clear without an accepted persisted submission returns `409`:

```json
{
  "error": "PROGRESS_REQUIRES_ACCEPTED_SUBMISSION"
}
```

### `GET /v1/me/save`

Response:

```json
{
  "save": {
    "version": 2,
    "accountId": "uuid",
    "updatedAt": "2026-07-31T00:00:00.000Z",
    "progress": [],
    "drafts": [],
    "submissions": []
  }
}
```

A draft contains `questId`, `source`, and `updatedAt`. A submission contains the
owned Judge ID, quest, source snapshot, mode, status, verdict, score, details, and
timestamps.

### `PUT /v1/me/drafts/:questId`

Request:

```json
{
  "source": "#include <bits/stdc++.h>\n..."
}
```

Source is limited to 64 KiB. Response:

```json
{
  "draft": {
    "questId": "signal-fire",
    "source": "#include <bits/stdc++.h>\n...",
    "updatedAt": "2026-07-31T00:00:00.000Z"
  }
}
```

### `POST /v1/me/save/resolve`

Choose the canonical save after login.

Use cloud state:

```json
{
  "choice": "cloud",
  "guestToken": "optional-old-guest-token"
}
```

Use local state:

```json
{
  "choice": "local",
  "guestToken": "optional-old-guest-token",
  "localSave": {
    "drafts": [
      {
        "questId": "signal-fire",
        "source": "..."
      }
    ],
    "clearedQuestIds": ["signal-fire"]
  }
}
```

Local drafts replace cloud drafts. A requested local clear is imported only when
the account already owns an accepted submission for that quest. The response is
the canonical `save` object.

## Core Judge endpoints

### `POST /v1/judge/submissions`

Request:

```json
{
  "questId": "signal-fire",
  "language": "cpp14",
  "mode": "submit",
  "source": "#include <bits/stdc++.h>\n..."
}
```

`mode` is `sample` or `submit`.

Before forwarding the job, the Core API verifies:

- playable account;
- global Judge switch;
- known, non-archived quest;
- all quest prerequisites;
- persisted account cooldown.

Response is passed through from the private Judge. Successful creation returns
`202` and a `Location` header:

```json
{
  "submission": {
    "id": "uuid",
    "status": "QUEUED",
    "queuePosition": 1,
    "pollAfterMs": 1020,
    "cases": [],
    "createdAt": "2026-07-31T00:00:00.000Z",
    "updatedAt": "2026-07-31T00:00:00.000Z"
  }
}
```

Core-specific errors include:

- `JUDGE_DISABLED`
- `UNKNOWN_QUEST`
- `QUEST_LOCKED` with `missingPrerequisites`
- `SUBMISSION_COOLDOWN` with `retryAfterMs` and `Retry-After`

### `GET /v1/judge/submissions/:id`

The Core API first verifies that the authenticated player owns the ID.

Possible submission statuses include:

```text
QUEUED
COMPILING
RUNNING
DONE
ERROR
```

A terminal example:

```json
{
  "submission": {
    "id": "uuid",
    "status": "DONE",
    "queuePosition": 0,
    "verdict": "AC",
    "score": 100,
    "passScore": 100,
    "cases": [
      {
        "id": "01",
        "verdict": "AC",
        "timeMs": 4,
        "memoryKb": 3200
      }
    ],
    "createdAt": "2026-07-31T00:00:00.000Z",
    "updatedAt": "2026-07-31T00:00:01.000Z"
  }
}
```

When a terminal result reaches or exceeds `passScore`, the Core API persists the
result and marks the quest cleared. If the private Judge is temporarily
unavailable, a previously persisted terminal result may be returned. Otherwise
the endpoint returns `JUDGE_STATUS_UNAVAILABLE` with `retryAfterMs`.

## Editorial endpoints

### `GET /v1/editorial/quests/:questId`

Response:

```json
{
  "posts": [],
  "eligibility": {
    "discussion": true,
    "solution": false,
    "directPublish": false
  }
}
```

Players see published posts plus their own posts. Administrators and owners also
see moderation states.

### `POST /v1/editorial/quests/:questId`

Request:

```json
{
  "kind": "discussion",
  "title": "Why lower_bound works here",
  "contentFormat": "tiptap-json-v1",
  "content": "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"The invariant is ...\"}]}]}"
}
```

Rules:

- `kind` is `discussion` or `solution`;
- title length after trimming must be at least 3 and is capped at 160 characters;
- `contentFormat` is `tiptap-json-v1` for new rich posts or `plain` for
  backward-compatible plain text;
- visible text and LaTeX content must total at least 10 and at most 60 KiB;
- rich documents are capped at 96 KiB serialized and may contain only the
  server allowlist of headings, paragraphs, lists, quotes, links, text styles,
  highlighted code blocks, and inline/block mathematics;
- links are restricted to `http`, `https`, and `mailto`;
- player discussion requires at least one submission for the quest;
- player solution requires the quest to be cleared;
- discussions and moderator-authored posts are published immediately;
- player solutions are created as `pending`.

Response `201`:

```json
{
  "post": {
    "id": "uuid",
    "questId": "binary-gate",
    "kind": "solution",
    "title": "First occurrence with lower_bound",
    "content": "...",
    "contentFormat": "tiptap-json-v1",
    "status": "pending",
    "author": {
      "id": "uuid",
      "displayName": "INLINEINT",
      "role": "player"
    },
    "createdAt": "2026-07-31T00:00:00.000Z",
    "updatedAt": "2026-07-31T00:00:00.000Z",
    "moderatedAt": null
  }
}
```

### `GET /v1/admin/editorial?status=pending`

`status` may be `pending`, `published`, or `rejected`; invalid values default to
`pending`.

Response:

```json
{
  "posts": []
}
```

### `PATCH /v1/admin/editorial/:postId`

Request:

```json
{
  "status": "published"
}
```

`status` must be `published` or `rejected`. Response contains the updated `post`.

## Administration endpoints

### `GET /v1/admin/users`

Query parameters:

| Parameter | Default | Limits |
|---|---:|---|
| `query` | empty | display-name or email substring, max 120 characters |
| `page` | `1` | minimum `1` |
| `limit` | `50` | `1..100` |

Response:

```json
{
  "users": [
    {
      "id": "uuid",
      "displayName": "INLINEINT",
      "email": "player@example.com",
      "emailVerified": true,
      "isGuest": false,
      "role": "player",
      "createdAt": "2026-07-31T00:00:00.000Z",
      "updatedAt": "2026-07-31T00:00:00.000Z",
      "lastLoginAt": null,
      "clearedCount": 3,
      "submissionCount": 12
    }
  ],
  "page": 1,
  "limit": 50
}
```

### `PUT /v1/admin/users/:userId`

Request:

```json
{
  "displayName": "NEW_NAME",
  "emailVerified": true,
  "role": "admin"
}
```

An owner may set `player` or `admin`. An administrator cannot change roles and
cannot modify another administrator or owner. Owner accounts are protected.

### `GET /v1/admin/quests`

Returns complete records, including archived entries and private Judge
definitions:

```json
{
  "quests": [
    {
      "id": "custom-quest",
      "publicDefinition": {},
      "judgeDefinition": {},
      "archived": false,
      "createdAt": "2026-07-31T00:00:00.000Z",
      "updatedAt": "2026-07-31T00:00:00.000Z"
    }
  ]
}
```

Never expose this endpoint to untrusted clients because `judgeDefinition` contains
hidden tests.

### `POST /v1/admin/quests`

Request:

```json
{
  "id": "custom-quest",
  "publicDefinition": {
    "id": "custom-quest",
    "index": "08",
    "title": "Custom Quest",
    "subtitle": "A new route",
    "difficulty": 2,
    "xp": 300,
    "status": "locked",
    "prerequisites": ["prefix-beacon"],
    "chapter": "CH.03 / SIGNAL STRUCTURES",
    "gridArea": "custom-quest",
    "mapPosition": { "x": 30, "y": 80 },
    "description": "...",
    "skills": ["stack"],
    "sortOrder": 800,
    "problem": {
      "story": ["..."],
      "guidance": ["..."],
      "input": "...",
      "constraints": "...",
      "output": "...",
      "sampleInput": "...",
      "sampleOutput": "...",
      "hint": "...",
      "hintMarker": "...",
      "hintCode": "...",
      "starterCode": "...",
      "testCaseCount": 2,
      "passScore": 100,
      "timeLimitSeconds": 1,
      "memoryLimitMb": 64
    }
  },
  "judgeDefinition": {
    "language": "cpp14",
    "compileLimitMs": 15000,
    "timeLimitMs": 1000,
    "memoryLimitMb": 64,
    "passScore": 100,
    "tests": [
      { "id": "01", "input": "...", "expected": "..." },
      { "id": "02", "input": "...", "expected": "..." }
    ]
  }
}
```

The server regenerates test IDs and requires `tests.length` to match
`publicDefinition.problem.testCaseCount`. IDs must match
`[a-z0-9-]{1,96}`. Creating an existing built-in or database quest returns
`QUEST_ALREADY_EXISTS`.

### `PUT /v1/admin/quests/:questId`

Uses the same `publicDefinition` and `judgeDefinition` fields. For a built-in
quest override, `judgeDefinition` may be `null`, which keeps the built-in Judge
tests. A custom quest requires a valid private Judge definition.

### `DELETE /v1/admin/quests/:questId`

Archives the database record and returns `204`. Archived IDs are returned by the
public catalog so the Web can hide matching built-in quests.

### `PUT /v1/admin/quest-map-layout`

Request:

```json
{
  "positions": [
    { "id": "signal-fire", "x": 10, "y": 18 },
    { "id": "forked-path", "x": 30, "y": 18 }
  ]
}
```

Rules:

- maximum 128 positions;
- IDs must be known quests and unique in the request;
- `x` and `y` must be finite and within `2..98`;
- coordinates are rounded to two decimal places.

Response:

```json
{
  "mapLayout": {
    "signal-fire": { "x": 10, "y": 18 }
  }
}
```

## Owner endpoints

### `GET /v1/owner/server`

Response:

```json
{
  "settings": {
    "registrationEnabled": true,
    "judgeEnabled": true,
    "maintenanceMessage": "",
    "submissionCooldownSeconds": 5,
    "updatedAt": "2026-07-31T00:00:00.000Z"
  },
  "statistics": {
    "players": 10,
    "admins": 1,
    "owners": 1,
    "submissions": 120,
    "accepted": 42,
    "quests": 7,
    "databaseBytes": 10485760
  },
  "runtime": {
    "node": "v22.x.x",
    "platform": "linux",
    "architecture": "arm64",
    "uptimeSeconds": 3600,
    "judge": {
      "status": "ok"
    }
  }
}
```

### `PUT /v1/owner/server`

Request:

```json
{
  "registrationEnabled": true,
  "judgeEnabled": true,
  "maintenanceMessage": "Scheduled maintenance at 22:00 UTC.",
  "submissionCooldownSeconds": 10
}
```

The maintenance message is capped at 240 characters. Cooldown is clamped to
`5..300` seconds. Response contains updated `settings`.

## Private Judge API

The Core API is the intended client. Direct browser use is unsupported.

### `GET /health`

Response `200`:

```json
{
  "status": "ok",
  "active": 0,
  "queued": 0,
  "concurrency": 2,
  "queueCapacity": 1000,
  "isolation": "one-container-per-submission"
}
```

### `POST /v1/submissions`

Requires the private Judge bearer token when configured.

Request from the Core API:

```json
{
  "questId": "signal-fire",
  "language": "cpp14",
  "mode": "submit",
  "source": "#include <bits/stdc++.h>\n...",
  "trustedQuest": null
}
```

`trustedQuest` is accepted only when the private token is configured and valid.
It contains the hidden definition for a dynamic quest. Limits:

- source: 64 KiB;
- request body: 4 MiB;
- tests: maximum 50;
- input and expected output: 64 KiB each;
- time limit: `100..10000` ms;
- memory limit: `16..512` MiB;
- compile limit: `5000..30000` ms;
- pass score: `1..100`.

Response `202` contains `submission` and a `Location` header.

Queue errors:

| Error | Status | Extra fields |
|---|---:|---|
| `ACTIVE_SUBMISSION` | `409` | current `submission` |
| `SUBMISSION_COOLDOWN` | `429` | `retryAfterMs`, `Retry-After` |
| `QUEUE_FULL` | `503` | `queueCapacity` |

Validation errors include `UNKNOWN_QUEST`, `UNSUPPORTED_LANGUAGE`, `UNKNOWN_MODE`,
`EMPTY_SOURCE`, and `SOURCE_TOO_LARGE`.

### `GET /v1/submissions/:id`

Requires the private Judge bearer token when configured.

Response:

```json
{
  "submission": {
    "id": "uuid",
    "status": "RUNNING",
    "queuePosition": 0,
    "pollAfterMs": 350,
    "cases": [],
    "createdAt": "2026-07-31T00:00:00.000Z",
    "updatedAt": "2026-07-31T00:00:00.500Z"
  }
}
```

Terminal states are `DONE` and `ERROR`. Terminal entries expire from Judge memory
after `JUDGE_RESULT_TTL_MS`; the default is ten minutes. The Core API persists
owned terminal results in PostgreSQL.

## Size and validation limits

| Data | Limit |
|---|---:|
| Normal Core JSON request | 70 KiB |
| Guest session request | 4 KiB |
| Account request | 4 to 12 KiB depending on endpoint |
| Draft source | 64 KiB |
| Save-resolution request | 1 MiB |
| Quest create/update request | 1 MiB |
| Editorial create request | 160 KiB request / 96 KiB serialized document |
| Private Judge request | 4 MiB |
| Submission source | 64 KiB |
| Dynamic quest tests | 50 |
| Test input or expected output | 64 KiB each |

## Retry guidance

Clients may retry transient `429`, `502`, `503`, and `504` responses with bounded
exponential backoff. Honor `Retry-After` when present. Do not create a second
submission merely because status polling failed; continue polling the same ID.

The Web client currently retries transient API calls up to three attempts and uses
the Judge-provided `pollAfterMs` for submission polling.
