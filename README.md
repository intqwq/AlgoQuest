# AlgoQuest

AlgoQuest is an ASCII-art competitive-programming adventure with a branching
campaign, a searchable algorithm Codex, server-backed player accounts, community
editorials, and a Docker-isolated GNU C++14 Judge.

The current campaign contains 12 playable missions covering input/output,
conditionals, loops, arrays, sorting, binary search, prefix sums, stacks, BFS,
Dijkstra, disjoint sets, and topological sorting. Each mission has trusted hidden
tests, source autosave, submission history, score, time, and calibrated memory
results. Administrators can edit the map and quest content from the Control
Deck; site owners also receive safe server controls and the operations console.

The hosted preview is available at
[algoquest.intqwq.chatgpt.site](https://algoquest.intqwq.chatgpt.site). The
self-hosted stack supports Windows testing and Raspberry Pi 5 deployment.

## Product surfaces

- Branching world map with prerequisites, draggable admin layout editing, and XP.
- Monaco-based C++14 mission terminal with sample runs and asynchronous submits.
- 12-entry English, Simplified Chinese, and Japanese algorithm Codex.
- Verified accounts, cross-device saves, draft conflict resolution, and history.
- Discussion and solution areas with role-aware publishing and moderation.
- Player, admin, and site-owner roles enforced by the Core API.
- Admin quest authoring, hidden test management, archiving, and server settings.
- Whitelisted operations console for status, logs, roles, updates, and restarts.

## Architecture

The self-hosted runtime is split into independently deployable services:

| Service | Default port | Responsibility |
|---|---:|---|
| Gateway + Web | `8080` on Windows, `80` on Pi | UI and same-origin `/api` proxy |
| Core API | `8787` | Accounts, saves, quests, editorial, administration, Judge orchestration |
| Judge | `8788` | Bounded queue, C++14 compilation, disposable runner containers |
| PostgreSQL | `5432` | Accounts, sessions, content, progress, submissions, and settings |

The browser never receives database credentials, the Judge token, or hidden test
cases. Only the Judge service owns Docker-socket access. Trusted test manifests
are delivered to the runner supervisor over stdin and are never written into the
contestant-visible submission mount. The Core API validates Turnstile with a
bounded timeout, reuses one idempotency key across transient retries, and returns
stable machine-readable failure reasons without exposing the secret key.

See [Architecture](docs/ARCHITECTURE.md), [HTTP API](docs/API.md), and
[administration](docs/ADMINISTRATION.md).

## Windows quick start

Requirements: Docker Desktop with Linux containers and PowerShell.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\windows\deploy.ps1
```

Open <http://localhost:8080>. The first run builds the Web, Core API, Judge
service, C++ runner, and PostgreSQL images, then creates `.env.windows` with
random local secrets.

```powershell
.\deploy\windows\status.ps1
.\deploy\windows\stop.ps1
```

Full instructions: [Windows deployment](docs/DEPLOY_WINDOWS.md).

## Raspberry Pi quick start

Requirements: 64-bit Linux, Docker Engine, Docker Compose v2, OpenSSL, and curl.

```bash
chmod +x deploy/pi/*.sh
./deploy/pi/deploy.sh
```

The Pi defaults to port `80`, Judge concurrency `2`, and named Docker volumes
for PostgreSQL, Judge work files, and the compile cache.

```bash
./deploy/pi/status.sh
sudo ./deploy/pi/install-systemd.sh
```

Full instructions: [Raspberry Pi deployment](docs/DEPLOY_RASPBERRY_PI.md).
Production account setup: [Resend and Turnstile](docs/ACCOUNT_SECURITY.md).
Operations commands: [Operations console](docs/OPERATIONS_CONSOLE.md).

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

For cross-machine deployment, change only the URLs in `.env.windows` or
`.env.pi`:

- Web host: `API_UPSTREAM`
- API host: `DATABASE_URL` and `JUDGE_API_URL`
- API and Judge: matching `JUDGE_API_TOKEN`
- Account/API host: `PUBLIC_APP_URL`, Resend, and Turnstile credentials

Do not expose PostgreSQL or the Judge directly to the public internet. Use a
private LAN, Tailnet/VPN, or TLS-authenticated tunnel between machines.

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

## Validation and merge gate

Run the same major checks used by GitHub Actions:

```bash
npm ci
npm run lint
npm test
npm --prefix services/api ci
npm --prefix services/api test
npm --prefix judge test
docker compose --env-file .env.windows.example --profile all config --quiet
docker build -f judge/Dockerfile.runner -t algoquest-runner:cpp14 judge
JUDGE_DOCKER_TEST=1 npm --prefix judge test
```

The real Docker suite validates `AC`, `CE`, `WA`, `TLE`, `RE`, `MLE`, and `OLE`,
and verifies that contestant code cannot discover a persisted hidden-test
manifest. The stable required-check name is `required-ci`; repository rules
should require it before merging into `main`. See [CI and branch
protection](docs/CI.md).

The Windows and Raspberry Pi `all` deployment commands also run live Judge and
Core API smoke tests.

## Repository layout

```text
app/                  Web route and global presentation
components/           Map, mission, account, Codex, editorial, and admin UI
lib/                  Quest data, localization, saves, layout, and API client
services/api/         Core API, PostgreSQL migrations, tests, and ops commands
judge/                Queue, sandbox supervisor, runner image, tests, stress tool
deploy/docker/        Web container
deploy/nginx/         Same-origin gateway
deploy/windows/       PowerShell deployment commands
deploy/pi/            Raspberry Pi deployment and systemd commands
compose.yml           Service definitions and component profiles
docs/                 Architecture, API, security, administration, and operations
```

## Judge security

Each submission receives one fresh container. It compiles once, executes test
cases as separately limited child processes, and then destroys the container.
Runner containers have no network, a read-only root filesystem, dropped
capabilities, process/CPU/memory/output limits, and a host-enforced wall-clock
timeout. Hidden test data exists only in the root supervisor's memory; contestant
processes run as UID/GID `10001` and receive only their individual test input.

Docker shares the host kernel. Keep the Judge on a dedicated or replaceable
machine before accepting arbitrary public submissions at scale.
