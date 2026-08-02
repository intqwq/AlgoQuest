#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"

cd "${project_root}"

if [[ ! -f "${env_file}" ]]; then
  echo "[AlgoQuest] missing ${env_file}" >&2
  exit 1
fi

docker compose --env-file "${env_file}" ps

failed=0
check_url() {
  local url="$1"
  if curl --fail --silent --show-error --max-time 3 "${url}" >/dev/null; then
    echo "healthy <- ${url}"
  else
    echo "offline <- ${url}" >&2
    failed=1
  fi
}

check_url "http://127.0.0.1:8080/healthz"
check_url "http://127.0.0.1:8787/health"
check_url "http://127.0.0.1:8788/health"

if [[ ${failed} -ne 0 ]]; then
  echo "[AlgoQuest] one or more health checks failed" >&2
  exit 1
fi
