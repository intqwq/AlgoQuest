# Deploy on Raspberry Pi

## Recommended host

- Raspberry Pi 5
- 64-bit Ubuntu 24.04 or later
- NVMe storage for Docker data when available
- A Cloudflare account with `intqwq.com` active in Cloudflare DNS
- Resend and Turnstile production credentials

Keep the system, Docker, and Compose packages from one packaging source. Mixing
the distro `docker-compose-v2` package with Docker's
`docker-compose-plugin` package can cause file conflicts.

## One-click Ubuntu deployment

Clone the repository, then run the Ubuntu bootstrap as root:

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
sudo bash deploy/pi/bootstrap-ubuntu.sh
```

The script performs the complete production setup:

1. Installs Docker Engine, Buildx, Docker Compose v2, and `cloudflared` from
   their official APT repositories.
2. Creates `.env.pi`, generates the PostgreSQL and Judge secrets, and prompts
   for Resend, Turnstile, and site-owner credentials.
3. Binds the Dockerized Nginx gateway to `127.0.0.1:8080`, keeping the API,
   Judge, database, and origin gateway off the public LAN.
4. Builds all ARM64 images and runs the isolated Judge and Core API smoke tests.
5. Installs `algoquest.service` for the application stack.
6. Opens the Cloudflare authorization flow, creates or reuses the `algoquest`
   tunnel, routes `game.intqwq.com` to the local Nginx gateway, and installs
   `algoquest-cloudflared.service`.

The Cloudflare login requires one browser approval on the first run. Select the
`intqwq.com` zone when Cloudflare asks which domain to authorize.

To use another hostname or tunnel name:

```bash
sudo env \
  ALGOQUEST_DOMAIN=game.intqwq.com \
  CLOUDFLARE_TUNNEL_NAME=algoquest \
  bash deploy/pi/bootstrap-ubuntu.sh
```

For a non-interactive environment setup, pass the required account values as
environment variables. Cloudflare authorization is skipped automatically when
the operator already has `~/.cloudflared/cert.pem`.

```bash
sudo env \
  RESEND_API_KEY='re_...' \
  TURNSTILE_SITE_KEY='...' \
  TURNSTILE_SECRET_KEY='...' \
  SITE_OWNER_EMAIL='owner@example.com' \
  bash deploy/pi/bootstrap-ubuntu.sh
```

Do not put these secrets into shell history on a shared machine. An existing
`.env.pi` is reused, so entering the credentials interactively is the safer
default.

## Manual first deployment

Use this path when Docker and the tunnel are managed separately:

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
chmod +x deploy/pi/*.sh
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
sudo systemctl status algoquest-cloudflared
docker compose --env-file .env.pi ps
docker compose --env-file .env.pi logs -f
curl -fsS http://127.0.0.1:8080/healthz
```

The public endpoint should become available at:

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
does not have to live under a fixed directory. The one-click bootstrap installs
both the application and Cloudflare Tunnel units automatically.

## Publish through Cloudflare Tunnel manually

The one-click bootstrap configures a locally managed tunnel and writes:

```text
~/.cloudflared/algoquest.yml
/etc/systemd/system/algoquest-cloudflared.service
```

Its ingress route is:

```text
game.intqwq.com -> http://127.0.0.1:8080
```

For a manual tunnel, point Cloudflare only at the configured `WEB_PORT` on
`127.0.0.1`. Keep these values aligned in `.env.pi`:

```dotenv
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=8080
API_ALLOWED_ORIGIN=https://game.intqwq.com
PUBLIC_APP_URL=https://game.intqwq.com
TURNSTILE_EXPECTED_HOSTNAME=game.intqwq.com
```

TLS terminates at Cloudflare. Do not create public routes for ports `5432`,
`8787`, `8788`, or the Docker socket.

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
