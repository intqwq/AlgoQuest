# AlgoQuest

AlgoQuest is an ASCII-art competitive-programming adventure. The current
vertical slice contains a playable world map, three unlockable C++14 missions
(I/O, conditionals, and loops), an asynchronous Docker-isolated judge, and
persistent player progress.

The hosted preview is available at
[algoquest.intqwq.chatgpt.site](https://algoquest.intqwq.chatgpt.site). The
self-hosted stack is designed for Windows testing now and Raspberry Pi 5
deployment later.

## Architecture

The self-hosted runtime is split into independently deployable services:

| Service | Default port | Responsibility |
|---|---:|---|
| Gateway + Web | `8080` on Windows, `80` on Pi | UI, same-origin `/api` proxy |
| Core API | `8787` | Sessions, progress, submission history, Judge orchestration |
| Judge | `8788` | Queue, GNU C++14 compilation, isolated execution |
| PostgreSQL | `5432` | Users, sessions, progress, submissions |

The browser never connects to PostgreSQL or the Docker socket. It talks to the
Core API, and the Core API calls the Judge with a private shared token.

See [Architecture](docs/ARCHITECTURE.md) for the API boundary and split-host
configuration.

## Windows quick start

Requirements: Docker Desktop with Linux containers and PowerShell.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\windows\deploy.ps1
```

Open <http://localhost:8080>. The first run builds the web, API, Judge service,
C++ runner, and PostgreSQL images, then creates `.env.windows` with random local
secrets.

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
- API and Judge: the same `JUDGE_API_TOKEN`

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

The Windows and Raspberry Pi `all` deployment commands also run two live smoke
tests: the isolated runner must accept known-correct C++, then the Core API must
submit, poll, receive `AC`, and persist the cleared quest.

## Repository layout

```text
app/                  Web route
components/           Mission UI and editor
lib/                  Quest data and browser API client
services/api/         User/progress API and PostgreSQL migration
judge/                Queue, sandbox runner, tests, stress tool
deploy/docker/        Web container
deploy/nginx/         Same-origin gateway
deploy/windows/       PowerShell deployment commands
deploy/pi/            Raspberry Pi deployment and systemd commands
compose.yml           All services and component profiles
docs/                 Architecture and deployment guides
```

## Judge security

Each submission receives one fresh container. It compiles once, executes test
cases as separately limited child processes, stops at the first failure, and
then destroys the container. Runner containers have no network, a read-only
root filesystem, dropped capabilities, process/CPU/memory/output limits, and a
wall-clock timeout.

Docker shares the host kernel. Keep the Judge on a dedicated or replaceable
machine before accepting arbitrary public submissions at scale.
