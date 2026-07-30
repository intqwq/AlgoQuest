# AlgoQuest service architecture

## Runtime boundary

```mermaid
flowchart TD
    B["Browser"] -->|HTTPS| G["Gateway + Web"]
    G -->|"/api/v1"| A["Core API"]
    A -->|SQL| D[("PostgreSQL")]
    A -->|Private REST| J["Judge API"]
    J -->|Docker socket| R["Disposable runner"]
    A -->|Token validation| T["Cloudflare Turnstile"]
    A -->|Verification mail| E["Resend"]
```

The public boundary ends at the Gateway. Only the Core API owns user data, and
only the Judge owns access to the Docker socket.

## Services

### Gateway and Web

- Serves the Vinext/React application.
- Shows only the welcome/introduction surface until a verified account is
  active and its save choice is resolved.
- Uses a self-hosted Monaco editor for C++ drafts; Monaco is lazy-loaded only
  after a mission opens.
- Proxies `/api/*` to the Core API so a single-machine deployment is
  same-origin.
- Does not contain database credentials or the Judge token.
- Bakes `NEXT_PUBLIC_API_BASE_URL` into the browser bundle at image-build time.

### Core API

- Creates short-lived guest identities only as part of registration.
- Upgrades guests into email/password accounts after verification.
- Rejects progress and Judge calls from guests or unverified accounts.
- Returns local/cloud save metadata and waits for an explicit conflict choice.
- Stores the latest source draft for every started quest.
- Sends verification and password-reset mail through Resend.
- Validates Turnstile tokens, action, and hostname on the server.
- Applies persistent per-IP and per-email authentication limits.
- Hashes passwords with salted `scrypt`.
- Stores only SHA-256 hashes of session tokens.
- Loads and saves quest progress.
- Proxies submission creation and polling to the Judge.
- Records every Judge result together with its exact source snapshot and marks
  a quest cleared after `AC`.
- Retries transient status-link failures without creating a second submission.
- Falls back to the last durable terminal result if the Judge restarts.
- Enforces campaign prerequisites before forwarding a submission.
- Applies the private `JUDGE_API_TOKEN` to every Judge request.

### Judge

- Owns the bounded in-memory queue.
- Allows one in-flight submission per player and applies a cooldown.
- Creates one Docker container per submission.
- Compiles once, runs cases sequentially with early stop, and returns
  `CE/WA/RE/TLE/MLE/OLE/AC`.
- Never receives database credentials.

### PostgreSQL

The migrations create:

| Table | Purpose |
|---|---|
| `users` | Guest and authenticated player identities |
| `sessions` | Hashed bearer tokens and expiry |
| `quest_progress` | Clear state and best score |
| `submissions` | User-owned Judge job and verdict history |
| `quest_drafts` | Latest cloud source draft for each started quest |
| `account_tokens` | Hashed, expiring email verification and reset tokens |
| `auth_rate_limits` | Persistent abuse counters by hashed IP/email key |

PostgreSQL is not an HTTP service. The phrase “database service” means an
independently deployable database with the Core API as its only application
client.

## HTTP contract

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /health` | None | API, database, and Judge readiness |
| `POST /v1/sessions` | None | Create a player and return an opaque token |
| `GET /v1/auth/config` | None | Return the public Turnstile site key |
| `POST /v1/auth/register` | Guest optional + Turnstile | Upgrade/create an account and send verification |
| `POST /v1/auth/verify-email` | Email token | Verify email and create a session |
| `POST /v1/auth/login` | Guest optional + Turnstile | Login without silently choosing a save |
| `POST /v1/auth/logout` | Player bearer token | Revoke the current session |
| `POST /v1/auth/forgot-password` | Turnstile | Send a generic reset response |
| `POST /v1/auth/reset-password` | Reset token + Turnstile | Replace password and revoke old sessions |
| `GET /v1/me` | Player bearer token | Load the current player record |
| `PUT /v1/me/profile` | Player bearer token | Update the display name |
| `GET /v1/me/progress` | Verified account | Load saved progress |
| `PUT /v1/me/progress/:questId` | Verified account | Sync progress backed by an accepted submission |
| `GET /v1/me/save` | Verified account | Load progress, drafts and source-bearing submission history |
| `PUT /v1/me/drafts/:questId` | Verified account | Autosave the current source draft |
| `POST /v1/me/save/resolve` | Verified account | Choose local or cloud drafts and finish legacy guest transfer |
| `POST /v1/judge/submissions` | Verified account | Queue a Judge job |
| `GET /v1/judge/submissions/:id` | Verified account | Poll an owned job |

The Judge's `/v1/submissions` endpoints require the internal Judge token. The
Core API also verifies ownership before returning a submission status.
Temporary Judge or gateway failures are returned as retryable `503` responses;
the browser keeps polling the same job with bounded exponential backoff.

## Deployment shapes

### Windows single-machine test

All services share the Compose network:

```text
Browser -> localhost:8080 -> gateway -> api -> judge
                                      \-> postgres
```

Only the Gateway is intended for normal browser access. The loopback API,
Judge, and database ports remain available for diagnostics.

### Raspberry Pi single-machine production

The same images run on ARM64. Port 80 is the origin for Nginx, cpolar, or
Cloudflare Tunnel. Persistent data lives in named Docker volumes, which avoids
SD-card-relative bind paths and works with the Judge's sibling runner
containers.

### Split machines

Run a profile on each host and set explicit addresses:

```text
Web host:
  API_UPSTREAM=https://api.internal.example

API host:
  DATABASE_URL=postgres://...@database.internal:5432/algoquest
  JUDGE_API_URL=https://judge.internal.example

Judge host:
  JUDGE_BIND_ADDRESS=0.0.0.0
```

`JUDGE_API_TOKEN` must match on API and Judge. If PostgreSQL crosses machines,
use TLS and a dedicated database user. Prefer a LAN or VPN/Tailnet and firewall
the API, Judge, and database ports to exact peer addresses.

Resend and Turnstile are outbound HTTPS dependencies of the Core API. Their
secret credentials never enter the Web image or browser bundle.

## Scaling path

The current queue is deliberately local and simple. The next scale milestone is
Redis-backed durable jobs plus multiple Judge workers. The API boundary already
allows that replacement without changing the Web client or PostgreSQL schema.
