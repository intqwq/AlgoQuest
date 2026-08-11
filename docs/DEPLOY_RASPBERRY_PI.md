# Deploy AlgoQuest on Raspberry Pi

## Production shape

The Raspberry Pi deployment is intentionally a **single-host Bridge-managed
origin**. AlgoQuest owns its application stack, but Bridge owns every Internet
entry point.

```text
Internet
  -> Cloudflare Tunnel owned by Bridge
  -> Bridge edge 127.0.0.1:18080
  -> AlgoQuest private origin 127.0.0.1:18081
       -> AlgoQuest origin gateway
            -> Web
            -> Core API
                 -> PostgreSQL
                 -> Judge API -> Redis -> Judge worker -> runner containers
```

The AlgoQuest Nginx gateway is application-local. It combines the Web UI and
`/api` into one same-origin application endpoint. It is not a public reverse
proxy and it does not manage Cloudflare, DNS, tunnels, TLS, or other projects.

For this Pi deployment, every host-published AlgoQuest service must bind to
`127.0.0.1`. `deploy/pi/check-network-boundary.sh` enforces that rule during
manual deploys and as an `ExecStartPre` check at boot. If a bind is changed to a
non-loopback address, deployment fails instead of bypassing Bridge.

## Recommended host

- Raspberry Pi 5
- 64-bit Ubuntu 24.04 or later
- NVMe storage for Docker data when available
- Resend and Turnstile production credentials

Keep Docker Engine and Compose packages from one packaging source. The installer
uses Docker's official APT repository when Docker is not already available.

## One-click deployment

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
sudo bash install.sh
```

The installer:

1. installs Docker Engine, Buildx, and Docker Compose v2 when needed;
2. creates `.env.pi` and generates the PostgreSQL and Judge secrets;
3. prompts for Resend, Turnstile, and site-owner values;
4. enforces the loopback-only network boundary;
5. builds the ARM64 images and C++14 runner;
6. runs Judge and Core API smoke tests;
7. exposes only the private application origin at `127.0.0.1:18081`; and
8. installs `algoquest.service` for boot.

To use a different public hostname or private origin port:

```bash
sudo env \
  ALGOQUEST_DOMAIN=game.intqwq.com \
  ALGOQUEST_WEB_PORT=18081 \
  bash install.sh
```

For unattended setup, the required account values may be supplied as environment
variables:

```bash
sudo env \
  RESEND_API_KEY='re_...' \
  TURNSTILE_SITE_KEY='...' \
  TURNSTILE_SECRET_KEY='...' \
  SITE_OWNER_EMAIL='owner@example.com' \
  bash install.sh
```

Entering secrets interactively is preferable on shared systems because shell
history may be retained.

## Bridge contract

The production `.env.pi` contract is:

```dotenv
WEB_BIND_ADDRESS=127.0.0.1
WEB_PORT=18081
API_BIND_ADDRESS=127.0.0.1
JUDGE_BIND_ADDRESS=127.0.0.1
DB_BIND_ADDRESS=127.0.0.1
API_ALLOWED_ORIGIN=https://game.intqwq.com
PUBLIC_APP_URL=https://game.intqwq.com
TURNSTILE_EXPECTED_HOSTNAME=game.intqwq.com
```

Bridge reaches only the origin gateway on `127.0.0.1:18081`. The Core API,
Judge, and PostgreSQL host ports stay loopback-only for local operations and
health checks. Redis is not host-published. The Docker socket is available only
to the dedicated Judge worker.

Do not add Cloudflare Tunnel services, public DNS automation, public hostname
routing, or public bind addresses to this repository. Those belong in
[Bridge](https://github.com/intqwq/Bridge).

## Manual deployment on a prepared Docker host

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
chmod +x install.sh uninstall.sh deploy/pi/*.sh
cp .env.pi.example .env.pi
chmod 600 .env.pi
```

Configure the production Resend and Turnstile values, then run:

```bash
./deploy/pi/deploy.sh all
```

The deployment generates any remaining internal secrets, checks the network
boundary, builds the C++ runner, starts the stack, and verifies both the Judge
and the complete Core API submission/poll/progress path.

For local maintenance, component profiles remain available:

```bash
./deploy/pi/deploy.sh web
./deploy/pi/deploy.sh api
./deploy/pi/deploy.sh judge
./deploy/pi/deploy.sh database
```

These Pi profiles still obey the loopback-only contract. Cross-machine service
exposure is deliberately outside this production deployment shape; use a
separate explicitly secured deployment design rather than weakening `.env.pi`.

## Health and operations

```bash
./deploy/pi/status.sh
sudo systemctl status algoquest
docker compose --env-file .env.pi ps
docker compose --env-file .env.pi logs -f
curl -fsS http://127.0.0.1:18081/healthz
```

After Bridge is installed, the public endpoint is:

```text
https://game.intqwq.com
```

For a manual first deployment, install the boot unit after the stack is healthy:

```bash
sudo ./deploy/pi/install-systemd.sh
```

The unit records the current repository path and rechecks the private network
boundary before every start.

## Install order with the other services

On a machine hosting all three repositories, install in this order:

```text
1. AlgoQuest   -> 127.0.0.1:18081
2. intqwq.com  -> 127.0.0.1:18082
3. Bridge      -> 127.0.0.1:18080 + Cloudflare Tunnel
```

Bridge is last because its normal bootstrap verifies both application origins
before publishing the shared Cloudflare routing.

## Backup

PostgreSQL is the durable application state. Create a logical backup with:

```bash
docker compose --env-file .env.pi exec -T db \
  pg_dump -U algoquest algoquest > algoquest.sql
```

Judge work and compile-cache volumes are disposable. Restore a database backup
only after stopping write traffic.

## Uninstall

Preview the destructive AlgoQuest cleanup first:

```bash
sudo bash uninstall.sh --plan
```

Then remove the AlgoQuest runtime, systemd units, Compose resources, PostgreSQL
and Judge volumes, deployment configuration, and legacy AlgoQuest leftovers:

```bash
sudo bash uninstall.sh
```

The confirmation phrase is `ERASE-ALGOQUEST`. The uninstaller deliberately does
not stop or remove `bridge-edge.service`, `bridge-cloudflared.service`,
`~/.cloudflared/bridge.yml`, or the remote tunnel named `bridge`. The optional
`--remove-legacy-tunnel` flag applies only to the obsolete tunnel named exactly
`algoquest`.
