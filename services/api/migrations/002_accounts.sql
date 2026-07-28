ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email varchar(254),
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(24) NOT NULL CHECK (kind IN ('verify_email', 'password_reset')),
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS account_tokens_user_kind_idx
  ON account_tokens(user_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS account_tokens_expiry_idx
  ON account_tokens(expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  action varchar(32) NOT NULL,
  key_hash char(64) NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY (action, key_hash)
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_window_idx
  ON auth_rate_limits(window_started_at);
