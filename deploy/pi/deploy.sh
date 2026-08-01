#!/usr/bin/env bash
set -euo pipefail

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

command -v docker >/dev/null || {
  echo "Docker is missing. Install Docker Engine and Compose v2 first." >&2
  exit 69
}
docker info >/dev/null 2>&1 || {
  echo "Docker is not reachable. Start it or add this user to the docker group." >&2
  exit 69
}
docker compose version >/dev/null || {
  echo "Docker Compose v2 is missing." >&2
  exit 69
}
command -v openssl >/dev/null || {
  echo "OpenSSL is missing and is required to generate deployment secrets." >&2
  exit 69
}

architecture="$(uname -m)"
if [[ "${architecture}" != "aarch64" && "${architecture}" != "arm64" ]]; then
  echo "Warning: expected a 64-bit Raspberry Pi, found ${architecture}." >&2
fi

if [[ ! -f "${env_file}" ]]; then
  cp "${example_env}" "${env_file}"
  echo "Created .env.pi."
fi

if grep -q "CHANGE_ME_DATABASE_PASSWORD" "${env_file}" ||
  grep -q "CHANGE_ME_JUDGE_TOKEN" "${env_file}"; then
  database_password="$(openssl rand -hex 24)"
  judge_token="$(openssl rand -hex 32)"
  sed -i "s/CHANGE_ME_DATABASE_PASSWORD/${database_password}/g" "${env_file}"
  sed -i "s/CHANGE_ME_JUDGE_TOKEN/${judge_token}/g" "${env_file}"
  chmod 600 "${env_file}"
  echo "Filled .env.pi with generated local secrets."
fi

if [[ "${mode}" == "all" || "${mode}" == "api" ]]; then
  if grep -Eq '^RESEND_API_KEY=(|CHANGE_ME_)' "${env_file}" ||
    grep -Eq '^TURNSTILE_SITE_KEY=(|CHANGE_ME_)' "${env_file}" ||
    grep -Eq '^TURNSTILE_SECRET_KEY=(|CHANGE_ME_)' "${env_file}"; then
    echo "Account security is not configured in .env.pi." >&2
    echo "Add the Resend API key and the game.intqwq.com Turnstile site/secret keys." >&2
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

docker compose \
  --env-file "${env_file}" \
  --profile "${mode}" \
  up -d --build --remove-orphans

if [[ "${mode}" == "all" || "${mode}" == "judge" ]]; then
  echo "Running the isolated Judge smoke test..."
  if ! docker compose \
    --env-file "${env_file}" \
    exec -T judge node scripts/smoke.mjs; then
    docker compose --env-file "${env_file}" logs --tail 100 judge judge-worker redis
    echo "Judge smoke test failed. Inspect the Judge API, worker, and Redis logs above." >&2
    exit 1
  fi
fi

if [[ "${mode}" == "all" ]]; then
  echo "Running the Core API end-to-end smoke test..."
  if ! docker compose \
    --env-file "${env_file}" \
    exec -T api node scripts/smoke.mjs; then
    docker compose --env-file "${env_file}" logs --tail 100 api judge
    echo "Core API smoke test failed. Submission polling or progress persistence is unavailable." >&2
    exit 1
  fi
fi

docker compose --env-file "${env_file}" ps

if [[ "${mode}" == "all" || "${mode}" == "web" ]]; then
  echo "AlgoQuest is listening on http://$(hostname -I | awk '{print $1}')"
fi

if [[ "${mode}" == "all" && "${ALGOQUEST_NO_CONSOLE:-0}" != "1" && -t 0 && -t 1 ]]; then
  if command -v node >/dev/null; then
    node scripts/ops-console.mjs --env-file .env.pi
  else
    echo "Node.js is not in PATH; skipping the interactive operations console." >&2
  fi
fi
