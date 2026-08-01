# AlgoQuest

AlgoQuest is an ASCII-art competitive-programming adventure built around a real,
Docker-isolated GNU C++14 judge. Players explore a branching quest map, write code
in a self-hosted Monaco editor, run samples, submit against hidden tests, and keep
progress, drafts, and submission history in a verified account.

The current build includes 22 built-in missions from first C++ input through
maximum flow, adaptive starting points for players with prior C++ or algorithm
experience, animated quest prologues, an interactive algorithm Codex,
English/Simplified Chinese/Japanese UI, dynamic administrator-managed quests,
editable map positions, discussions and solutions, role-based administration,
and owner-level runtime controls.

The hosted preview is available at
[algoquest.intqwq.chatgpt.site](https://algoquest.intqwq.chatgpt.site). The same
Compose stack supports Windows development and Raspberry Pi 5 deployment.

## What is implemented

| Area | Current behavior |
|---|---|
| Campaign | 22 built-in C++14 missions, adaptive recommended starting points, prerequisite unlocking, XP totals, branching-ready map data, and support for database-backed custom quests |
| Learning journey | Registration records prior C++ and algorithm experience; every player receives the first-use site tutorial, while every quest has a skippable and replayable animated prologue |
| Mission workbench | Lazy-loaded Monaco editor, local and cloud draft autosave, sample runs, hidden-test submissions, per-case verdicts, time and memory reporting |
| Judge | Bounded in-memory queue, one active submission per player, configurable cooldown, compile cache, and one disposable Docker container per submission |
| Accounts | Guest bootstrap, registration, email verification, login/logout, password reset, hashed bearer sessions, Resend email, and Cloudflare Turnstile |
| Saves | PostgreSQL-backed progress, drafts, exact submitted source snapshots, durable terminal results, and explicit local-versus-cloud conflict resolution |
| Editorial | Per-quest discussions and solutions with rich text, font controls, highlighted code blocks, links, lists, and KaTeX formulas; discussions require a submission, solutions require a clear, and player solutions enter moderation |
| Administration | User management, quest create/edit/archive, hidden judge tests, draggable map layout, and editorial moderation |
| Owner controls | Registration and Judge switches, maintenance message, submission cooldown, service statistics, runtime information, and Judge health |
| Codex | Searchable and filterable algorithm reference with explanations, complexity, checklists, C++14 templates, and linked quests |
| Locales | English, Simplified Chinese, and Japanese interface copy |

## Architecture

The public application is split into four independently deployable services:

| Service | Default port | Responsibility |
|---|---:|---|
| Gateway + Web | `8080` on Windows, `80` on manual Pi, loopback `8080` on tunneled Pi | Nginx origin, Vinext/React UI, same-origin `/api` proxy |
| Core API | `8787` | Accounts, roles, saves, quests, editorial, administration, and Judge orchestration |
| Judge | `8788` | Queueing, GNU C++14 compilation, isolated execution, result lifecycle |
| PostgreSQL | `5432` | Users, sessions, progress, drafts, submissions, quest catalog, moderation, and settings |

The browser never receives database credentials or the private Judge token. The
Core API is the only application client of PostgreSQL, while the Judge is the only
service with access to the Docker socket.

```text
Browser
  -> Gateway (Nginx)
       -> Web (Vinext / React)
       -> Core API
            -> PostgreSQL
            -> Resend
            -> Cloudflare Turnstile
            -> Judge API
                 -> disposable runner container
```

See [Architecture](docs/ARCHITECTURE.md) for trust boundaries, data ownership,
deployment shapes, and scaling constraints. See [API reference](docs/API.md) for
the public Core API and private Judge contract.

## Windows quick start

Requirements: Docker Desktop using Linux containers and PowerShell.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\windows\deploy.ps1
```

Open <http://localhost:8080>. The first run builds the Web, API, Judge service,
C++14 runner, and PostgreSQL images, then creates `.env.windows` with randomized
local secrets.

```powershell
.\deploy\windows\status.ps1
.\deploy\windows\stop.ps1
```

Full instructions: [Windows deployment](docs/DEPLOY_WINDOWS.md).

## Raspberry Pi Ubuntu one-click deployment

Requirements: Raspberry Pi 5 with 64-bit Ubuntu, a Cloudflare-managed domain,
and production Resend and Turnstile credentials.

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
sudo bash deploy/pi/bootstrap-ubuntu.sh
```

The bootstrap installs Docker Engine, Compose v2, the Dockerized Nginx gateway,
and `cloudflared`; generates local database and Judge secrets; builds and smoke
tests the complete stack; creates the `game.intqwq.com` DNS tunnel route; and
enables the application and tunnel at boot. The first run prints one Cloudflare
authorization URL for browser approval.

For an already prepared Docker host, the lower-level deployment command remains
available:

```bash
chmod +x deploy/pi/*.sh
./deploy/pi/deploy.sh
```

Manual Pi deployment defaults to port `80`; the one-click tunneled deployment
uses loopback port `8080`. Both use Judge concurrency `2` and named Docker
volumes for PostgreSQL, Judge work files, and the compile cache.

```bash
./deploy/pi/status.sh
sudo systemctl status algoquest
sudo systemctl status algoquest-cloudflared
```

Full instructions: [Raspberry Pi deployment](docs/DEPLOY_RASPBERRY_PI.md).
Production account setup: [Resend and Turnstile](docs/ACCOUNT_SECURITY.md).

## Split-host deployment

Every deployment script accepts one component:

```text
all | web | api | judge | database
```

Examples:

```powershell
.\deploy\windows\deploy.ps1 -Mode web
.\deploy\windows\deploy.ps1 -Mode api
.\deploy\windows\deploy.ps1 -Mode judge
```

```bash
./deploy/pi/deploy.sh web
./deploy/pi/deploy.sh api
./deploy/pi/deploy.sh judge
```

For cross-machine deployment, change the relevant values in `.env.windows` or
`.env.pi`:

- Web host: `API_UPSTREAM`
- API host: `DATABASE_URL` and `JUDGE_API_URL`
- API and Judge: matching `JUDGE_API_TOKEN`
- Account/API host: `PUBLIC_APP_URL`, Resend credentials, and Turnstile credentials

Do not expose PostgreSQL or the Judge directly to the public internet. Use a
private LAN, Tailnet/VPN, or a mutually authenticated TLS tunnel between hosts.

## Account and role model

A browser may create a short-lived guest session, but missions, cloud saves,
editorial posting, and Judge submissions require a verified non-guest account.

| Role | Capabilities |
|---|---|
| `player` | Play unlocked quests, save drafts, submit code, publish eligible discussions, and submit eligible solutions for review |
| `admin` | Player capabilities plus user management, quest management, map editing, direct editorial publishing, and moderation |
| `owner` | Administrator capabilities plus server settings, runtime statistics, role promotion, and protected owner authority |

`SITE_OWNER_EMAIL` can select the verified account that becomes owner. If it is
not set and no owner exists, the earliest verified account is bootstrapped as the
owner. Owner accounts cannot be modified through normal administrator actions.

## Editorial rules

- A player may create a **discussion** after making at least one submission for
  the quest. Discussions are published immediately.
- A player may create a **solution** only after clearing the quest. Player
  solutions start as `pending` and require administrator or owner moderation.
- Administrators and owners may publish either kind directly.
- Moderators may move pending posts to `published` or `rejected`.
- New posts use a validated structured rich-text document. Legacy plain-text
  posts remain readable. The server accepts only the editor's known nodes,
  approved style values, and safe `http`, `https`, or `mailto` links.

## Local development

Web:

```bash
npm ci
npm run dev
```

Core API:

```bash
npm --prefix services/api ci
DATABASE_URL=postgres://algoquest:algoquest@127.0.0.1:5432/algoquest \
JUDGE_API_URL=http://127.0.0.1:8788 \
npm --prefix services/api start
```

Judge:

```bash
docker build -f judge/Dockerfile.runner -t algoquest-runner:cpp14 judge
npm --prefix judge start
```

The Web client uses `/api/v1` by default. When calling the Core API directly on
port `8787`, use `/v1` paths instead.

## Reliability hardening

- Trusted Judge manifests are JSON-serialized to the disposable container's
  stdin and retained only in the root supervisor's memory. The single-job
  `/submission` mount is read-only, fd 0 is sealed to `/dev/null`, and fresh
  binaries are exported for cache reuse only after the container has stopped.
- The real Docker regression suite covers `AC`, `CE`, `WA`, `TLE`, `RE`, `MLE`,
  and `OLE`, verifies one container start per submission, and probes the old
  manifest path, PID 1 command line/stdin, hidden output fields, and write access.
- Turnstile Siteverify uses a four-second deadline per attempt, up to three
  bounded transient retries with one idempotency key, classified machine-readable
  reasons, and `Retry-After` metadata for temporary outages.
- GitHub Actions exposes the stable `required-ci` check for pull requests, merge
  groups, and pushes to `main`. See [CI and branch protection](docs/CI.md).

## Validation

```bash
npm test
npm --prefix services/api test
npm --prefix judge test
docker compose --env-file .env.windows.example --profile all config
```

Run the real Docker Judge regression suite on a Docker host:

```bash
JUDGE_DOCKER_TEST=1 npm --prefix judge test
```

The Windows and Raspberry Pi `all` deployment commands also run live smoke tests:
the isolated runner must accept known-correct C++, then the Core API must submit,
poll, receive an accepted score, persist the submission, and clear the quest.

## Repository layout

```text
app/                  Vinext/React route and global styling
components/           Account, map, mission, Codex, editorial, and admin UI
lib/                  Quest/Codex data, localization, save logic, and API client
services/api/         Core HTTP API, PostgreSQL access, migrations, tests
judge/                Queue, private Judge API, runner image, tests, stress tool
deploy/docker/        Web container
deploy/nginx/         Same-origin gateway configuration
deploy/windows/       PowerShell deployment commands
deploy/pi/            Raspberry Pi deployment and systemd commands
docs/                 Architecture, API, security, and deployment guides
compose.yml           Service definitions and component profiles
```

## Judge security and limits

Each submission receives one fresh container. Source is compiled once, test cases
run sequentially with early stop, and the container is destroyed afterward. The
runner uses no network, a read-only root filesystem, dropped capabilities,
`no-new-privileges`, PID/CPU/memory/file/output limits, tmpfs workspaces, and an
outer wall-clock timeout.

This is strong process isolation for a self-hosted learning platform, not a
separate-kernel security boundary. Docker shares the host kernel, and the Judge
service holds the Docker socket. Run public untrusted submissions on a dedicated,
replaceable host with timely kernel and Docker updates.

The current queue and result cache live in Judge memory. Restarting the Judge
loses queued/running jobs, although terminal results already persisted by the Core
API remain available. The next scaling step is a durable queue such as Redis plus
multiple Judge workers; the existing Core API boundary is designed to permit that
replacement.
