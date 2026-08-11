# Deploy on Raspberry Pi

## Recommended host

- Raspberry Pi 5
- 64-bit Ubuntu 24.04 or later
- NVMe storage for Docker data when available
- Resend and Turnstile production credentials

Keep the system, Docker, and Compose packages from one packaging source. Mixing
the distro `docker-compose-v2` package with Docker's
`docker-compose-plugin` package can cause file conflicts.

## One-click Ubuntu deployment

Clone the repository, then run the root installer as root:

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
sudo bash install.sh
```

The script performs the complete production setup:

1. Installs Docker Engine, Buildx, and Docker Compose v2 from the official APT
   repository.
2. Creates `.env.pi`, generates the PostgreSQL and Judge secrets, and prompts
   for Resend, Turnstile, and site-owner credentials.
3. Binds the Dockerized Nginx origin gateway to `127.0.0.1:18081`, keeping the API,
   Judge, database, and origin gateway off the public LAN.
4. Builds all ARM64 images and runs the isolated Judge and Core API smoke tests.
5. Installs `algoquest.service` for the application stack.
6. Leaves public routing to the independent
   [Bridge](https://github.com/intqwq/Bridge) deployment.

To use another hostname or private origin port:

```bash
sudo env \
  ALGOQUEST_DOMAIN=game.intqwq.com \
  ALGOQUEST_WEB_PORT=18081 \
  bash install.sh
```

For a non-interactive environment setup, pass the required account values as
environment variables.

```bash
sudo env \
  RESEND_API_KEY='re_...' \
  TURNSTILE_SITE_KEY='...' \
  TURNSTILE_SECRET_KEY='...' \
  SITE_OWNER_EMAIL='owner@example.com' \
  bash install.sh
```

Do not put these secrets into shell history on a shared machine. An existing
`.env.pi` is reused, so entering the credentials interactively is the safer
default.

## Uninstall

Preview a complete host cleanup first:

```bash
sudo bash uninstall.sh --plan
```

Then remove the AlgoQuest runtime, systemd units, Compose resources, PostgreSQL
and Judge volumes, local deployment configuration, runtime data and legacy
AlgoQuest Cloudflare files:

```bash
sudo bash uninstall.sh
```

The interactive confirmation phrase is `ERASE-ALGOQUEST`. The installer and
uninstaller deliberately do **not** stop or remove Bridge. `bridge-edge.service`,
`bridge-cloudflared.service`, `~/.cloudflared/bridge.yml`, and the remote tunnel
named `bridge` remain untouched. Use `--remove-legacy-tunnel` only when the old
remote tunnel named exactly `algoquest` should also be deleted. Use
`--purge-source` only when this Git checkout should be removed after uninstall.

## Manual first deployment

Use this path when Docker is already managed:

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
chmod +x install.sh uninstall.sh deploy/pi/*.sh
cp .env.pi.example .env.pi
```

Before the first deployment, configure the Resend API key and Cloudflare
Turnstile site/secret keys in `.env.pi`. The production script intentionally
refuses placeholder account credentials. Follow
[Player account security](ACCOUNT_SECURITY.md), then run:

```bash
chmod 600 .env.pi
./deploy/pi/deploy.sh
```

The script fills the database and Judge secrets, builds the ARM64 C++ runner,
and starts every service. Before reporting success, it verifies both the
isolated runner and the complete Core API submission/poll/progress path.

```bash
./deploy/pi/status.sh
docker compose --env-file .env.pi logs --tail 100 api judge
```

## Services and health checks

```bash
sudo systemctl status algoquest
docker compose --env-file .env.pi ps
docker compose --env-file .env.pi logs -f
curl -fsS http://127.0.0.1:18081/healthz
```

After the Bridge deployment is also complete, the public endpoint is:

```text
https://game.intqwq.com
```

## Start at boot

For a manual deployment, install the application systemd unit after the first
successful deployment:

```bash
sudo ./deploy/pi/install-systemd.sh
```

The generated unit uses the repository's current absolute path, so the project
does not have to live under a fixed directory. The one-click installer installs
only the application unit.

## Publish through Bridge

Bridge owns one Cloudflare Tunnel and one hostname-routing Nginx service for
both websites. It reaches AlgoQuest through this private contract:

```dotenv
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=18081
API_ALLOWED_ORIGIN=https://game.intqwq.com
PUBLIC_APP_URL=https://game.intqwq.com
TURNSTILE_EXPECTED_HOSTNAME=game.intqwq.com
```

Do not expose `18081`, `5432`, `8787`, `8788`, or the Docker socket publicly.
After both origins are installed, follow the Bridge repository's Raspberry Pi
bootstrap. An AlgoQuest restart then affects only this origin; it no longer
recreates a shared edge or restarts intqwq.com.

AlgoQuest still contains its own Dockerized Nginx **origin gateway**. That
application-local gateway combines Web and Core API behind one same-origin
endpoint. It is separate from Bridge's shared public Nginx edge and must remain
part of the AlgoQuest Compose stack.

## Split the Pi and Windows roles

A useful test layout is:

```text
Windows: Web + Core API + PostgreSQL
Pi:      Judge only
```

On the Pi:

```bash
./deploy/pi/deploy.sh judge
```

Set `JUDGE_BIND_ADDRESS=0.0.0.0` in `.env.pi`, use a strong
`JUDGE_API_TOKEN`, and allow port `8788` only from the Windows machine or VPN
address.

On Windows, set:

```text
JUDGE_API_URL=http://PI_PRIVATE_IP:8788
JUDGE_API_TOKEN=the_same_value_as_the_pi
```

Then redeploy the API profile.

The inverse layout is also supported: set `API_UPSTREAM`, `DATABASE_URL`, and
`JUDGE_API_URL` to the appropriate private addresses.

## Pi tuning

The defaults are conservative:

```text
JUDGE_MAX_PARALLEL=2
JUDGE_QUEUE_CAPACITY=1000
```

Use NVMe-backed Docker storage, retain at least one CPU core for Web/API/DB, and
measure real submissions before increasing concurrency. A queue capacity of
1,000 absorbs a burst; it does not mean 1,000 programs execute simultaneously.

## Backup

Create a logical PostgreSQL backup:

```bash
docker compose --env-file .env.pi exec -T db \
  pg_dump -U algoquest algoquest > algoquest.sql
```

Restore into a fresh database only after stopping write traffic. Judge work and
compile-cache volumes are disposable; PostgreSQL is the durable state.
