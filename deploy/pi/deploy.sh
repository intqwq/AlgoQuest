#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  printf '[AlgoQuest] ERROR: %s\n' "$*" >&2
  exit 1
}

mode="${1:-all}"
case "${mode}" in
  all|web|api|judge|database) ;;
  *)
    printf 'Usage: %s [all|web|api|judge|database]\n' "$0" >&2
    exit 64
    ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"
example_env="${project_root}/.env.pi.example"
startup_timeout="${ALGOQUEST_STARTUP_TIMEOUT_SECONDS:-300}"

[[ -f "${project_root}/compose.yml" ]] || die "Missing ${project_root}/compose.yml."
[[ -f "${example_env}" ]] || die "Missing ${example_env}."
[[ "${startup_timeout}" =~ ^[0-9]+$ ]] && ((startup_timeout >= 1)) ||
  die "ALGOQUEST_STARTUP_TIMEOUT_SECONDS must be a positive integer."

command -v docker >/dev/null || die "Docker is missing. Install Docker Engine and Compose v2 first."
docker info >/dev/null 2>&1 ||
  die "Docker is not reachable. Start it or add this user to the docker group."
docker compose version >/dev/null ||
  die "Docker Compose v2 is missing."
command -v openssl >/dev/null ||
  die "OpenSSL is missing and is required to generate deployment secrets."

architecture="$(uname -m)"
if [[ "${architecture}" != "aarch64" && "${architecture}" != "arm64" ]]; then
  printf 'Warning: expected a 64-bit Raspberry Pi, found %s.\n' "${architecture}" >&2
fi

if [[ ! -f "${env_file}" ]]; then
  cp "${example_env}" "${env_file}"
  printf 'Created .env.pi.\n'
fi
chmod 600 "${env_file}"

set_env() {
  local key="$1"
  local value="$2"
  [[ "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] ||
    die "${key} must be a single-line value."

  local escaped="${value//\\/\\\\}"
  escaped="${escaped//&/\\&}"
  escaped="${escaped//|/\\|}"

  if grep -qE "^${key}=" "${env_file}"; then
    sed -i "s|^${key}=.*$|${key}=${escaped}|" "${env_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${env_file}"
  fi
}

get_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "${env_file}" | tail -n 1 | tr -d '\r'
}

is_missing_value() {
  local value="$1"
  [[ -z "${value}" || "${value}" == CHANGE_ME_* ]]
}

require_config() {
  local key="$1"
  local description="$2"
  local value
  value="$(get_env "${key}")"
  if is_missing_value "${value}"; then
    die "${description} (${key}) is missing in .env.pi."
  fi
}

database_password="$(get_env POSTGRES_PASSWORD)"
if is_missing_value "${database_password}"; then
  database_password="$(openssl rand -hex 24)"
  set_env POSTGRES_PASSWORD "${database_password}"
fi

database_url="$(get_env DATABASE_URL)"
if [[ -z "${database_url}" ]]; then
  set_env DATABASE_URL "postgres://algoquest:${database_password}@db:5432/algoquest"
elif [[ "${database_url}" == *CHANGE_ME_DATABASE_PASSWORD* ]]; then
  set_env DATABASE_URL "${database_url//CHANGE_ME_DATABASE_PASSWORD/${database_password}}"
fi

judge_token="$(get_env JUDGE_API_TOKEN)"
if is_missing_value "${judge_token}"; then
  judge_token="$(openssl rand -hex 32)"
  set_env JUDGE_API_TOKEN "${judge_token}"
fi
chmod 600 "${env_file}"

case "${mode}" in
  all)
    require_config POSTGRES_PASSWORD "Database password"
    require_config DATABASE_URL "Database connection URL"
    require_config JUDGE_API_TOKEN "Judge API token"
    require_config RESEND_API_KEY "Resend API key"
    require_config TURNSTILE_SITE_KEY "Cloudflare Turnstile site key"
    require_config TURNSTILE_SECRET_KEY "Cloudflare Turnstile secret key"
    require_config TURNSTILE_EXPECTED_HOSTNAME "Cloudflare Turnstile hostname"
    require_config SITE_OWNER_EMAIL "Site owner email"
    ;;
  database)
    require_config POSTGRES_PASSWORD "Database password"
    ;;
  api)
    require_config DATABASE_URL "Database connection URL"
    require_config JUDGE_API_TOKEN "Judge API token"
    require_config RESEND_API_KEY "Resend API key"
    require_config TURNSTILE_SITE_KEY "Cloudflare Turnstile site key"
    require_config TURNSTILE_SECRET_KEY "Cloudflare Turnstile secret key"
    require_config TURNSTILE_EXPECTED_HOSTNAME "Cloudflare Turnstile hostname"
    require_config SITE_OWNER_EMAIL "Site owner email"
    ;;
  judge)
    require_config JUDGE_API_TOKEN "Judge API token"
    ;;
esac

cd "${project_root}"

compose() {
  docker compose --env-file "${env_file}" "$@"
}

compose --profile "${mode}" config --quiet

if [[ "${mode}" == "all" || "${mode}" == "judge" ]]; then
  docker build \
    -f judge/Dockerfile.runner \
    -t algoquest-runner:cpp14 \
    judge
fi

printf 'Starting AlgoQuest profile %s and waiting up to %ss for health checks...\n' \
  "${mode}" "${startup_timeout}"
if ! compose \
  --profile "${mode}" \
  up -d --build --remove-orphans --wait --wait-timeout "${startup_timeout}"; then
  compose --profile "${mode}" ps || true
  compose --profile "${mode}" logs --tail 150 || true
  die "Compose startup or health checks failed."
fi

if [[ "${mode}" == "all" || "${mode}" == "judge" ]]; then
  printf 'Running the isolated Judge smoke test...\n'
  if ! compose exec -T judge node scripts/smoke.mjs; then
    compose logs --tail 150 judge judge-worker redis || true
    die "Judge smoke test failed. Inspect the Judge API, worker, and Redis logs above."
  fi
fi

if [[ "${mode}" == "all" ]]; then
  printf 'Running the Core API end-to-end smoke test...\n'
  if ! compose exec -T api node scripts/smoke.mjs; then
    compose logs --tail 150 api db judge judge-worker redis || true
    die "Core API smoke test failed. Submission polling or progress persistence is unavailable."
  fi
fi

compose --profile "${mode}" ps

if [[ "${mode}" == "all" || "${mode}" == "web" ]]; then
  web_bind="$(get_env WEB_BIND_ADDRESS)"
  web_port="$(get_env WEB_PORT)"
  web_bind="${web_bind:-0.0.0.0}"
  web_port="${web_port:-8080}"

  case "${web_bind}" in
    0.0.0.0)
      display_host="$(hostname -I 2>/dev/null | awk '{print $1}')"
      display_host="${display_host:-127.0.0.1}"
      ;;
    ::)
      display_host="::1"
      ;;
    *)
      display_host="${web_bind}"
      ;;
  esac

  if [[ "${display_host}" == *:* ]]; then
    display_host="[${display_host}]"
  fi
  printf 'AlgoQuest is listening on http://%s:%s\n' "${display_host}" "${web_port}"
fi

if [[ "${mode}" == "all" && "${ALGOQUEST_NO_CONSOLE:-0}" != "1" && -t 0 && -t 1 ]]; then
  if command -v node >/dev/null; then
    node scripts/ops-console.mjs --env-file .env.pi
  else
    printf 'Node.js is not in PATH; skipping the interactive operations console.\n' >&2
  fi
fi
