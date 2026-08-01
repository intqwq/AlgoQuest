# AlgoQuest continuous learning system

This document covers the persisted learning features added to AlgoQuest: learning goals and activity, achievements, hidden-quest rules, public profiles, submission analytics, quest authoring versions, and custom Codex entries.

## User surface

The global **Learning OS** dock is mounted from `app/layout.tsx` and is available on every page after a verified account session is loaded.

| Tab | Capability |
|---|---|
| Learn | Daily minute goal, weekly clear target, session logging, streaks, 30-day activity, next-route recommendation, and weak-area review queue |
| Badges | Server-derived achievements with durable unlock timestamps |
| Profile | Public handle, biography, publish/unpublish control, and a shareable `/player/:handle` page |
| Submissions | Pagination, quest/verdict/mode/date filters, aggregate statistics, and source diff against the previous attempt or latest accepted attempt |
| Codex+ | Published database-backed Codex entries |
| Admin | Quest drafts, preview, publish, version history, rollback, hidden rules, and custom Codex management |

The normal campaign page still owns the main world map and mission workbench. A small authenticated fetch bridge adds the current bearer token to `/api/v1/quests`, allowing the Core API to personalize hidden-quest visibility without putting rule logic in the browser.

## Database schema

Migration `services/api/migrations/099_learning_system.sql` adds:

| Table | Purpose |
|---|---|
| `learning_goals` | Per-player daily minutes and weekly quest target |
| `learning_sessions` | Explicit study, practice, and review records |
| `player_profiles` | Unique public handle, biography, and visibility state |
| `player_achievements` | Durable achievement unlock timestamps |
| `quest_unlock_rules` | JSON rule expression for hidden or conditional quests |
| `quest_content_drafts` | Mutable administrator authoring workspace with revision counter |
| `quest_versions` | Immutable published quest snapshots |
| `codex_entries` | Localized database-backed Codex content |

Submission-derived statistics continue to use the existing `submissions` and `quest_progress` tables. There is no duplicate analytics ledger.

## Learning metrics

Activity days are the union of:

- judged submissions,
- quest progress updates,
- explicit learning sessions.

A current streak continues when the latest activity is today or yesterday in UTC. The dashboard also derives acceptance rate, XP, clear count, weak quests, daily completion, and the next uncleared route.

Achievements are evaluated from current durable state and inserted with `ON CONFLICT DO NOTHING`. Unlocks therefore remain recorded even when a later statistic drops below its original threshold.

## Hidden-quest rule engine

Rules are JSON objects with exactly one operator per node. Nesting is limited to eight levels and list operators accept at most sixteen children.

### Boolean operators

```json
{ "all": [RULE, RULE] }
{ "any": [RULE, RULE] }
{ "not": RULE }
```

### Metric predicates

```json
{ "clearedAtLeast": 5 }
{ "submissionCountAtLeast": 10 }
{ "acceptedCountAtLeast": 5 }
{ "streakAtLeast": 2 }
{ "totalXpAtLeast": 1000 }
{ "clearedQuest": "binary-gate" }
{ "achievement": "first-ac" }
{ "verdictCount": { "verdict": "AC", "count": 5 } }
```

The seeded `nameless-room` rule is:

```json
{
  "all": [
    { "clearedAtLeast": 5 },
    { "acceptedCountAtLeast": 5 },
    { "streakAtLeast": 2 }
  ]
}
```

Rule evaluation occurs in two places:

1. `GET /v1/quests` decides whether a conditional quest is secret or available.
2. `POST /v1/judge/submissions` re-evaluates the rule before the existing Judge orchestration receives the body.

The second check is authoritative and prevents a player from bypassing the map with a handcrafted request. Administrators and owners bypass enabled unlock rules for authoring and verification.

## Public profiles

A profile starts private. The player chooses a unique lowercase handle matching:

```text
[a-z0-9][a-z0-9-]{1,30}[a-z0-9]
```

Private records are available only through `GET /v1/me/public-profile`. Public records are exposed at `GET /v1/players/:handle` and rendered by `/player/[handle]`.

The public response includes display name, biography, join date, clear/XP/submission/streak statistics, unlocked badges, and recent clears. Email addresses and source code are never included.

## Submission history

`GET /v1/me/submissions` accepts:

| Parameter | Meaning |
|---|---|
| `page` | One-based page number |
| `limit` | Page size, clamped to 5–50 |
| `questId` | Exact quest ID |
| `verdict` | Exact uppercase verdict |
| `mode` | `sample` or `submit` |
| `language` | Exact language identifier |
| `from` / `to` | ISO timestamps |

The response includes the page, total count/pages, acceptance rate, average score, average reported case time, verdict counts, and a fourteen-day submission trend.

`GET /v1/me/submissions/:id/diff` compares the selected source with the previous attempt for the same quest. `?against=accepted` compares it with the latest other accepted attempt. An owned submission UUID may also be supplied as `against`.

Line diff uses longest-common-subsequence reconstruction for normal inputs. Very large line matrices switch to a bounded prefix/suffix diff so one comparison cannot allocate an unbounded table.

## Quest authoring lifecycle

1. `POST /v1/admin/quest-drafts` creates an isolated draft.
2. `PUT /v1/admin/quest-drafts/:id` updates it and increments `revision`.
3. `POST /v1/admin/quest-drafts/:id/preview` returns the public definition, Judge summary, and authoring warnings without changing the live campaign.
4. `POST /v1/admin/quest-drafts/:id/publish` creates the next immutable `quest_versions` row and upserts the live `quest_catalog` record in one database transaction.
5. `POST /v1/admin/quests/:questId/versions/:version/rollback` copies an old snapshot into a new version and makes that snapshot live. Existing history is never rewritten.

Hidden tests stay in `judge_definition` and are returned only by administrator endpoints.

## Custom Codex entries

Published custom entries are available through `GET /v1/codex`. Administrators use `/v1/admin/codex` CRUD endpoints.

Localized text fields are objects with `en`, `zh-CN`, and `ja` keys. Each entry stores category, linked quest, marker, summary, explanation, checkpoints, complexity labels, tags, C++14 code, publish state, and sort order.

Published entries appear in both the Learning OS `Codex+` reader and the main
searchable Codex. The main control deck provides a structured localized editor.
Using the ID of a built-in entry creates an editable database override; deleting
that record restores the source-controlled default.

## Core API endpoints

### Player

```text
GET  /v1/learning/dashboard
PUT  /v1/learning/goal
POST /v1/learning/sessions
GET  /v1/achievements
GET  /v1/me/public-profile
PUT  /v1/me/public-profile
GET  /v1/me/submissions
GET  /v1/me/submissions/:id
GET  /v1/me/submissions/:id/diff
GET  /v1/codex
GET  /v1/players/:handle
```

### Administrator

```text
GET    /v1/admin/quest-drafts
POST   /v1/admin/quest-drafts
GET    /v1/admin/quest-drafts/:id
PUT    /v1/admin/quest-drafts/:id
DELETE /v1/admin/quest-drafts/:id
POST   /v1/admin/quest-drafts/:id/preview
POST   /v1/admin/quest-drafts/:id/publish
GET    /v1/admin/quests/:questId/versions
POST   /v1/admin/quests/:questId/versions/:version/rollback
GET    /v1/admin/unlock-rules
PUT    /v1/admin/unlock-rules/:questId
GET    /v1/admin/codex
POST   /v1/admin/codex
PUT    /v1/admin/codex/:id
DELETE /v1/admin/codex/:id
```

## Runtime integration

The Core API imports `services/api/src/learning-router.mjs` directly and calls
its explicit request handler before the other route families. The learning
module is normal reviewable ESM: there is no generated `.jsfrag` source,
`data:` import, or `http.createServer` interception.

The router returns `false` for unrelated requests. Authentication, account,
editorial, save, administration, and Judge-status behavior remains owned by the
other Core API routes.

## Deployment

Rebuild/restart the Core API after merging so that:

1. migration `099_learning_system.sql` runs,
2. the explicit learning router is active,
3. the Web image includes the Learning OS and public profile route.

For Compose deployments, running the normal `all` deployment command is sufficient. Back up PostgreSQL before production schema changes.

## Validation

The implementation adds:

- `services/api/test/learning-extension.test.mjs` for streaks, rule composition, line diff, and explicit routing,
- `tests/learning-system.test.mjs` for the exposed Learning OS surfaces.

The extension loader and exported pure functions were also executed directly under Node.js 22 during implementation, and the new TypeScript/TSX modules were statically checked with TypeScript 5.8.
