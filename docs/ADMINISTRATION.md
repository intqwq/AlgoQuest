# AlgoQuest administration

AlgoQuest has three account roles:

- `player`: plays quests, keeps cloud/local saves, drafts and submissions.
- `admin`: can inspect and update player profiles, create, edit or archive quests,
  and manage the Algorithm Codex.
- `owner`: has every admin permission plus server status and safe runtime controls.

Role checks are enforced by the Core API. Hiding a button in the browser is not
treated as authorization.

## First site owner

Set `SITE_OWNER_EMAIL` in the deployment environment to the verified AlgoQuest
account that should receive the owner role:

```dotenv
SITE_OWNER_EMAIL=owner@example.com
```

When this value is omitted and no owner exists, the oldest verified non-guest
account is promoted once. After an owner exists, later accounts are never
promoted automatically.

The owner assignment is applied when the API starts and is returned by every
existing session immediately; signing out is not required after changing
`SITE_OWNER_EMAIL`, but the API container must be recreated by the deployment
script.

An owner may promote players to admins or return admins to the player role.
Owners cannot be created, demoted or edited through ordinary admin endpoints.

## Quest management

Built-in quests keep their hidden tests inside the Judge service. Admins can
change their public title, story, guidance, limits, prerequisites and map
position without exposing those tests. The quest editor also exposes the
player-facing `CODEX WHISPER`, its starter-code insertion marker, and the code
snippet inserted when the player applies the hint.

New custom quests require:

- English public content plus optional Simplified Chinese and Japanese content;
- starter code, sample input/output and step-by-step guidance;
- one to fifty trusted input/expected-output test pairs;
- a pass score from 1 to 100;
- C++14 time and memory limits.

Custom hidden tests are stored in PostgreSQL and are sent only from the Core API
to the token-protected Judge service. They are never returned by the public
quest catalog endpoint.

Archiving is the safe form of removing a quest. It disappears from the player
map and cannot be submitted, while existing drafts, submissions and progress
remain available for audit.

Admins and owners can also use **Edit map** above the campaign map. Quest cards
can be dragged without overlapping; **Save map** persists the layout in
PostgreSQL for every player. **Cancel** discards the unsaved drag operation.

## Algorithm Codex management

Admins and owners can open **CODEX** in the main control deck. The editor
supports localized titles, summaries, explanations and checkpoints, together
with category, linked quest, complexity, tags and the C++14 reference code.

Saving a built-in entry creates a database override while keeping the
source-controlled default available. Deleting that override restores the
default. New entries are database-backed and can remain unpublished until they
are ready; published entries are merged into the main searchable Codex for all
players.

## Owner server controls

The owner console exposes:

- registration enable/disable;
- Judge enable/disable;
- maintenance message;
- submission cooldown, with a hard minimum of five seconds;
- safe runtime metadata, queue health and aggregate database counts.

It does not expose a shell, Docker socket, environment secrets or arbitrary
process control.
