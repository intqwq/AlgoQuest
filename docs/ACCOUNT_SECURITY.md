# Player accounts, Resend, and Turnstile

AlgoQuest supports account registration, email verification, login/logout,
player-name changes, forgotten-password email, and single-use password reset
links. Visitors can read the welcome page, but quests, source editing and the
Judge require a verified account.

Registering upgrades the temporary registration identity in place. Login never
silently chooses between a device save and the player database. When both
contain different data, the player sees clear counts, timestamps and latest
draft information and must choose local or cloud. Source drafts follow that
choice; verified Judge history is retained and merged so a prior result is not
lost.

## Production configuration

### 1. Verify `intqwq.com` in Resend

1. Add `intqwq.com` in the Resend Domains dashboard.
2. Add the exact DKIM and SPF records Resend provides to the domain's DNS.
3. Add a DMARC record if the domain does not already have one.
4. Wait until Resend reports the domain as verified.
5. Create a sending API key and place it only in `.env.pi`.

AlgoQuest sends with this exact identity:

```text
AlgoQuest <AlgoQuest@intqwq.com>
```

Relevant settings:

```dotenv
AUTH_EMAIL_MODE=resend
RESEND_API_KEY=re_replace_with_real_key
RESEND_FROM_EMAIL=AlgoQuest@intqwq.com
PUBLIC_APP_URL=https://game.intqwq.com
```

Never commit `.env.pi` or `.env.windows`.

### 2. Create a Cloudflare Turnstile widget

Create a Turnstile widget and restrict its production hostname to:

```text
game.intqwq.com
```

Put the public site key and secret key in `.env.pi`:

```dotenv
TURNSTILE_SITE_KEY=replace_with_real_site_key
TURNSTILE_SECRET_KEY=replace_with_real_secret_key
TURNSTILE_EXPECTED_HOSTNAME=game.intqwq.com
```

The browser receives only the site key. The Core API keeps the secret and calls
Cloudflare's Siteverify endpoint for every registration, login, verification
resend, forgot-password, and password-reset request. It also verifies the
Turnstile action and configured hostname.

### 3. Deploy

```bash
./deploy/pi/deploy.sh
```

The Raspberry Pi deployment refuses to start the API while Resend or Turnstile
still contains placeholder production credentials.

## Windows development

The default Windows environment uses Cloudflare's official always-pass testing
keys. Email runs in local log mode, so no real mail is sent:

```dotenv
AUTH_EMAIL_MODE=log
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

After registering, read the verification link:

```powershell
docker compose --env-file .env.windows logs -f api
```

To test real email on Windows, edit `.env.windows`, switch
`AUTH_EMAIL_MODE=resend`, set `RESEND_API_KEY`, and redeploy the API profile.

## Security model

- Passwords are salted with a fresh random value and hashed using `scrypt`.
- Session, verification, and reset tokens are never stored in plaintext.
- Verification links expire after 30 minutes.
- Password-reset links expire after 20 minutes and are single-use.
- Resetting a password revokes every existing session for that account.
- Account endpoints have both Nginx per-IP limits and PostgreSQL-backed
  per-IP/per-email limits.
- Turnstile is checked server-side; a client-only success is never trusted.
- Login errors do not reveal whether an email exists.
- Forgot-password responses are identical for existing and unknown emails.
- Guests and unverified accounts receive `403` from progress, save, draft and
  Judge endpoints even if they bypass the browser UI.
- Local progress can unlock a cloud quest only when PostgreSQL already contains
  a matching accepted submission.
- PostgreSQL and Judge remain private; only the Gateway is public.

## Browser recovery behavior

The account panel distinguishes Core API configuration failure from Turnstile
widget failure. Loading `/v1/auth/config` uses three bounded attempts for network
errors and transient `429`, `502`, `503`, or `504` responses. A persistent
failure displays a dedicated **Retry config** action instead of leaving the form
silently disabled.

The Turnstile script has a 12-second load deadline. The widget reports loading,
ready, verified, expired, interactive timeout, unsupported-browser, and error
states. Cloudflare error codes are shown to the player, transient widget errors
retain Turnstile's automatic retry, and a manual **Retry check** action rebuilds
the widget. Tokens are cleared after expiry, timeout, error, view changes, and
every account request.
