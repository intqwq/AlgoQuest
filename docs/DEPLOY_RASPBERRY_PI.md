# Deploy on Raspberry Pi

## Recommended host

- Raspberry Pi 5
- 64-bit Ubuntu or Raspberry Pi OS
- NVMe storage for Docker data when available
- Docker Engine and Docker Compose v2
- OpenSSL and curl

Keep the system, Docker, and Compose packages from one packaging source. Mixing
the distro `docker-compose-v2` package with Docker's
`docker-compose-plugin` package can cause file conflicts.

## First deployment

```bash
git clone https://github.com/intqwq/AlgoQuest.git
cd AlgoQuest
chmod +x deploy/pi/*.sh
./deploy/pi/deploy.sh
```

The script creates `.env.pi` with mode `0600`, builds the ARM64 C++ runner, and
starts every service. Before reporting success, it verifies both the isolated
runner and the complete Core API submission/poll/progress path. Open the Pi's
LAN address in a browser.

```bash
./deploy/pi/status.sh
docker compose --env-file .env.pi logs --tail 100 api judge
```

## Start at boot

After the first successful deployment:

```bash
sudo ./deploy/pi/install-systemd.sh
```

The generated systemd unit uses the repository's current absolute path, so the
project does not have to live under a fixed directory.

## Publish through a tunnel

The Gateway listens on `127.0.0.1:80` from the tunnel's point of view. Configure
either cpolar or Cloudflare Tunnel to use this origin:

```text
http://127.0.0.1:80
```

Set `API_ALLOWED_ORIGIN=https://game.intqwq.com` in `.env.pi`. TLS should
terminate at the tunnel provider. Do not create public tunnel routes for ports
`5432`, `8787`, `8788`, or the Docker socket.

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
