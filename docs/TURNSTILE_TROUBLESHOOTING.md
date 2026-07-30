# Turnstile display troubleshooting

AlgoQuest loads Cloudflare Turnstile from:

```text
https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit
```

## Verify the browser configuration

Open this URL through the same hostname used for the website:

```text
/api/v1/auth/config
```

`turnstileSiteKey` must be non-empty. The site key is public; the secret key must remain only in the API environment.

If the page reports `Account security configuration is offline` and the gateway log contains `connect() failed (111: Connection refused) while connecting to upstream`, Turnstile has not been reached yet. The gateway cannot reach the Core API.

Older gateway configurations resolved Docker service names only when Nginx started. Recreating the API container could therefore leave Nginx pointing at its previous container IP. Restart both services once after updating:

```powershell
docker compose --env-file .env.windows --profile all up -d --build --force-recreate api gateway
```

```bash
docker compose --env-file .env.pi --profile all up -d --build --force-recreate api gateway
```

Then verify:

```text
http://localhost:8787/health
http://localhost:8080/api/v1/auth/config
```

The gateway template now uses Docker's embedded DNS resolver so later API or Web container replacements are re-resolved automatically.

## Local Windows deployment

When opening `http://localhost:8080`, use Cloudflare's official test key pair:

```dotenv
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_EXPECTED_HOSTNAME=
```

Do not combine a test site key with a production secret key.

## Production deployment

For `https://game.intqwq.com`, configure the Turnstile widget's Hostname Management entry as:

```text
game.intqwq.com
```

Do not include `https://`, a port, or a path. Set matching production credentials:

```dotenv
TURNSTILE_SITE_KEY=<production site key>
TURNSTILE_SECRET_KEY=<matching production secret key>
TURNSTILE_EXPECTED_HOSTNAME=game.intqwq.com
```

Then rebuild or recreate the API container so it receives the new environment:

```bash
docker compose --env-file .env.pi --profile api up -d --build --force-recreate api
```

For Windows:

```powershell
docker compose --env-file .env.windows --profile api up -d --build --force-recreate api
```

## Browser checks

In Developer Tools, verify that both requests are allowed:

```text
https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit
https://challenges.cloudflare.com/cdn-cgi/challenge-platform/...
```

Error `110200` means the current hostname is not authorized. Error `200500` means the Turnstile iframe could not load, commonly because a browser extension, proxy, DNS filter, or network rule blocked Cloudflare Challenges.

If a Content Security Policy is added later, allow `https://challenges.cloudflare.com` in both `script-src` and `frame-src`.
