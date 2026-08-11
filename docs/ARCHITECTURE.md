# AlgoQuest service architecture

This document describes AlgoQuest's runtime and trust boundaries. Endpoint-level
request and response details live in [API.md](API.md). Raspberry Pi deployment
steps live in [DEPLOY_RASPBERRY_PI.md](DEPLOY_RASPBERRY_PI.md).

## Ownership boundary

AlgoQuest is an application stack, not an Internet edge.

On the production Raspberry Pi, the independent
[Bridge](https://github.com/intqwq/Bridge) repository owns all public networking:
public hostnames, Cloudflare DNS routes, the shared public Nginx edge, and the
single Cloudflare Tunnel process. AlgoQuest exposes one loopback-only application
origin and registers that origin with Bridge after the application is healthy.

```text
Internet
  -> Cloudflare
  -> Bridge tunnel
  -> Bridge edge 127.0.0.1:18080
  -> Bridge service registry
  -> AlgoQuest origin 127.0.0.1:18081
       -> Gateway
            -> Web
            -> Core API
                 -> PostgreSQL
                 -> Resend
                 -> Cloudflare Turnstile
                 -> Judge API
                      -> Redis
                      -> Judge worker
                           -> disposable C++14 runner
```

The AlgoQuest Gateway is intentionally retained. It is an **application-origin
router** that keeps the browser UI and `/api` on one origin. It does not own
public DNS, TLS/tunnel lifecycle, Cloudflare Tunnel, or routing for other
projects. Moving its application-specific rewrites and rate limits into Bridge
would couple the shared edge to AlgoQuest internals, so those concerns stay here.

For local Windows development, the same Gateway is the developer-facing entry
point. For the Bridge-managed Pi deployment, `deploy/pi/check-network-boundary.sh`
requires every host-published AlgoQuest service to use `127.0.0.1`.

## Design principles

1. **One Internet owner.** In production, Bridge is the only component that
   receives tunnel traffic or owns public hostname routing.
2. **One application origin.** Bridge reaches AlgoQuest only through the Gateway
   origin on `127.0.0.1:18081`; browsers do not connect directly to API, Judge,
   Redis, PostgreSQL, or the Docker socket.
3. **Declarative registration.** AlgoQuest owns its hostname and origin settings
   and supplies them to Bridge through the generic registration interface. Bridge
   contains no AlgoQuest-specific hostname, port, or lifecycle knowledge.
4. **Single data owner.** Only the Core API reads or writes player/platform data
   in PostgreSQL.
5. **Single execution owner.** Only the Judge worker receives the Docker socket.
   The Judge API is socket-free.
6. **Server-authoritative progression.** A quest is cleared only after a
   persisted accepted submission meets the quest's pass threshold.
7. **Public and secret quest data are separated.** Statements and map metadata
   may reach browsers; hidden tests remain server-side.
8. **Roles are enforced by the Core API.** UI visibility is convenience, not an
   authorization boundary.
9. **Fail closed on networking.** A Bridge-managed Pi deployment refuses
   non-loopback application bind addresses before Compose starts and at boot.

## Service topology

### Gateway

The `gateway` service is an Nginx container. It:

- exposes the single AlgoQuest application origin;
- proxies page and asset requests to `web`;
- proxies `/api/*` to `api`;
- applies application-specific request-size and rate-limit policy;
- hides API metrics from the browser-facing origin;
- forwards proxy metadata to the Core API;
- reads internal upstreams from `WEB_UPSTREAM` and `API_UPSTREAM`; and
- runs read-only with tmpfs runtime directories and `no-new-privileges`.

The Gateway has no database, Judge, Resend, or Turnstile secrets.

In production it is not an Internet listener. Bridge is the only supported
public route to it.

### Web

The `web` service builds and serves the Vinext/React application. It contains the
quest map, Monaco workbench, account and administration UI, editorial features,
Codex, localization, tutorials, and client-side save reconciliation.

`NEXT_PUBLIC_API_BASE_URL` defaults to `/api/v1`. The browser therefore talks to
the Gateway on one origin; the Gateway maps that path to the Core API's `/v1`
namespace.

The Web service never receives `DATABASE_URL`, `JUDGE_API_TOKEN`, Resend secrets,
or the Turnstile secret key.

### Core API

The Core API listens on container port `8787` and owns application policy:

- account creation, verification, login, logout, reset, and session lifecycle;
- role and owner enforcement;
- player progress, drafts, submissions, and cloud-save reconciliation;
- quest catalog, map layout, editorial content, and moderation;
- server settings and owner controls;
- Resend email delivery;
- Turnstile verification;
- PostgreSQL migrations and data access; and
- authenticated Judge orchestration.

The production Pi may publish this port to host loopback for local operations,
but Bridge never routes to it directly. The public application path remains
Bridge -> Gateway -> Core API.

### Judge API

The Judge API listens on container port `8788`. It owns validation, durable
queueing, result lifecycle, and Judge-facing observability. It does **not** have
the Docker socket.

Submission requests are authenticated with `JUDGE_API_TOKEN`. Jobs and transient
result state are persisted through Redis.

Supported language and verdicts:

```text
Language: cpp14
Verdicts: AC, CE, WA, RE, TLE, MLE, OLE, JE
```

### Judge worker and runner

The Judge worker is the only long-lived service with `/var/run/docker.sock`. It
consumes queued jobs and launches one disposable runner container per
submission.

Runner containers:

- have no network;
- use a read-only root filesystem;
- enable `no-new-privileges`;
- use bounded tmpfs workspaces;
- enforce process, CPU, memory, swap, file, output, and wall-clock limits;
- compile once and execute test cases sequentially; and
- are forcibly removed after completion or timeout.

The container boundary substantially limits untrusted submissions, but it still
shares the host kernel. A high-risk public Judge can be moved to a dedicated,
replaceable host without changing the API contract.

## Hidden-test transport

Hidden test inputs remain server-side throughout the submission lifecycle. The
Core API supplies trusted quest or OJ test definitions to the Judge API, which
queues the job for a Judge worker. The worker passes hidden test payloads to the
disposable runner through the runner supervisor's standard input rather than
placing them in browser-visible assets or command-line arguments. Runner output
is reduced to bounded verdict, timing, memory, and diagnostic data before being
returned to the application.

### Redis

Redis is internal to the Judge subsystem. It is not host-published in the normal
Compose model. It stores the persistent Judge queue and short-lived lifecycle
state.

### PostgreSQL

PostgreSQL is the durable source of truth. Only the Core API is an application
client. The production Pi binds its optional host port to loopback only.

Durable data includes users, sessions, progress, source snapshots, drafts,
account tokens, rate-limit state, quest catalog and private Judge definitions,
map layout, server settings, cooldowns, and editorial content.

## Trust boundaries

### Internet -> Bridge

This is the public network trust boundary. Cloudflare and Bridge validate and
route public hostname traffic. AlgoQuest does not create or run a tunnel.

### Bridge -> Gateway

This is the application-origin boundary. The contract is a single HTTP origin at
`127.0.0.1:18081`. Bridge does not know the Web/API container topology.
AlgoQuest owns the registration data that associates its public hostname with
this origin.

### Gateway -> Core API

The Gateway translates the same-origin browser path into the private API
namespace and supplies proxy metadata. API authorization remains authoritative.

### Core API -> PostgreSQL

Only the Core API has database credentials. Browsers, Web, Gateway, Judge, and
Bridge cannot query PostgreSQL directly through an application contract.

### Core API -> Judge API

The private Judge contract uses a bearer token. The Core API attaches trusted
quest data when needed and persists user-owned submission state independently of
short-lived Judge status.

### Judge API -> queue -> Judge worker

The API process is socket-free. Docker capability exists only in the worker, so
HTTP request handling and container execution are separated.

## Raspberry Pi network invariants

The standard production environment is:

```dotenv
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=18081
API_BIND_ADDRESS=127.0.0.1
API_PORT=8787
JUDGE_BIND_ADDRESS=127.0.0.1
JUDGE_PORT=8788
DB_BIND_ADDRESS=127.0.0.1
DB_PORT=5432
```

`deploy/pi/check-network-boundary.sh` rejects any non-loopback bind. The deploy
script runs the check before Compose starts, and `algoquest.service` repeats it
with `ExecStartPre` on every boot.

This Pi deployment is deliberately not the place to enable cross-machine
service exposure. A split-host topology needs a separate explicitly secured
network design, such as an authenticated private overlay, rather than changing
these production bind addresses.

## Availability and lifecycle

Bridge is a platform prerequisite for the production Pi deployment. It installs
and starts independently, and it remains healthy with zero registered
applications. AlgoQuest requires the Bridge edge to exist, but it does not edit
Bridge source or own Bridge's tunnel lifecycle. Bridge never requires
`algoquest.service` to start.

Normal same-host deployment order is:

```text
1. Bridge edge, registry, and tunnel
2. AlgoQuest private origin, then AlgoQuest registration
3. intqwq.com private origin, then intqwq.com registration
4. Any future application origin, followed by its own registration
```

Each application starts and verifies its loopback origin before calling the
generic `bridge register` interface. Adding another subdomain therefore requires
no Bridge source change.

## Scaling constraints

The service contracts intentionally allow later separation:

- `WEB_UPSTREAM` and `API_UPSTREAM` separate Gateway from Web/API;
- `DATABASE_URL` separates Core API from PostgreSQL;
- `JUDGE_API_URL` and `JUDGE_API_TOKEN` separate API from Judge;
- Redis separates Judge request handling from execution workers.

Those are application topology seams, not permission to bypass Bridge for public
traffic. Any Internet-facing deployment must still have one explicit edge owner.
