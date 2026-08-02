#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:-all}"
case "${mode}" in
  all|web|api|judge|database) ;;
  *)
    echo "Usage: $0 [all|web|api|judge|database]" >&2
    exit 64
    ;;
esac

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"
example_env="${project_root}/.env.pi.example"
wait_timeout="${ALGOQUEST_COMPOSE_WAIT_TIMEOUT:-180}"

die() {
  echo "[AlgoQuest] ERROR: $*" >&2
  exit 1
}

get_env_value() {
  local key="$1"
  sed -n "s/^${key}=//p" "${env_file}" | tail -n 1
}

is_missing_value() {
  local value="$1"
  [[ -z "${value}" || "${value}" == CHANGE_ME_* ]]
}

command -v docker >/dev/null || die "Docker is missing. Install Docker Engine and Compose v2 first."
docker info >/dev/null 2>&1 || die "Docker is not reachable. Start it or add this user to the docker group."
docker compose version >/dev/null || die "Docker Compose v2 is missing."
docker compose up --help 2>&1 | grep -q -- '--wait' || \
  die "Docker Compose is too old. Install a version that supports 'compose up --wait'."
command -v openssl >/dev/null || die "OpenSSL is missing and is required to generate deployment secrets."
[[ "${wait_timeout}" =~ ^[1-9][0-9]*$ ]] || die "ALGOQUEST_COMPOSE_WAIT_TIMEOUT must be a positive integer."
[[ -f "${example_env}" ]] || die "Missing ${example_env}."

architecture="$(uname -m)"
if [[ "${architecture}" != "aarch64" && "${architecture}" != "arm64" ]]; then
  echo "Warning: expected a 64-bit Raspberry Pi, found ${architecture}." >&2
fi

if [[ ! -f "${env_file}" ]]; then
  cp "${example_env}" "${env_file}"
  echo "Created .env.pi."
fi
chmod 600 "${env_file}"

if grep -q "CHANGE_ME_DATABASE_PASSWORD" "${env_file}"; then
  database_password="$(openssl rand -hex 24)"
  sed -i "s/CHANGE_ME_DATABASE_PASSWORD/${database_password}/g" "${env_file}"
  echo "Generated the PostgreSQL deployment password."
fi
if grep -q "CHANGE_ME_JUDGE_TOKEN" "${env_file}"; then
  judge_token="$(openssl rand -hex 32)"
  sed -i "s/CHANGE_ME_JUDGE_TOKEN/${judge_token}/g" "${env_file}"
  echo "Generated the Judge API token."
fi

if [[ "${mode}" == "all" || "${mode}" == "api" ]]; then
  missing_keys=()
  for key in RESEND_API_KEY TURNSTILE_SITE_KEY TURNSTILE_SECRET_KEY; do
    value="$(get_env_value "${key}")"
    if is_missing_value "${value}"; then
      missing_keys+=("${key}")
    fi
  done

  if (( ${#missing_keys[@]} > 0 )); then
    echo "Account security is not configured in .env.pi." >&2
    echo "Missing or placeholder values: ${missing_keys[*]}" >&2
    exit 78
  fi
fi

cd "${project_root}"

if [[ "${mode}" == "all" || "${mode}" == "judge" ]]; then
  docker build \
    -f judge/Dockerfile.runner \
    -t algoquest-runner:cpp14 \
    judge
fi

compose=(docker compose --env-file "${env_file}" --profile "${mode}")
if ! "${compose[@]}" up \
  -d \
  --build \
  --remove-orphans \
  --wait \
  --wait-timeout "${wait_timeout}"; then
  "${compose[@]}" ps || true
  "${compose[@]}" logs --tail 150 || true
  die "The Compose stack did not become ready within ${wait_timeout} seconds."
fi

if [[ "${mode}" == "all" || "${mode}" == "judge" ]]; then
  echo "Running the isolated Judge smoke test..."
  if ! "${compose[@]}" exec -T judge node scripts/smoke.mjs; then
    "${compose[@]}" logs --tail 100 judge judge-worker redis
    die "Judge smoke test failed. Inspect the Judge API, worker, and Redis logs above."
  fi
fi

if [[ "${mode}" == "all" ]]; then
  echo "Running the Core API end-to-end smoke test..."
  if ! "${compose[@]}" exec -T api node scripts/smoke.mjs; then
    "${compose[@]}" logs --tail 100 api judge judge-worker db redis
    die "Core API smoke test failed. Submission polling or progress persistence is unavailable."
  fi
fi

"${compose[@]}" ps

if [[ "${mode}" == "all" || "${mode}" == "web" ]]; then
  web_port="$(get_env_value WEB_PORT)"
  echo "AlgoQuest gateway is listening on port ${web_port:-8080}."
fi

if [[ "${mode}" == "all" && "${ALGOQUEST_NO_CONSOLE:-0}" != "1" && -t 0 && -t 1 ]]; then
  if command -v node >/dev/null; then
    node scripts/ops-console.mjs --env-file .env.pi
  else
    echo "Node.js is not in PATH; skipping the interactive operations console." >&2
  fi
fi
