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

get_env_value() {
  local key="$1"
  local fallback="$2"
  local value
  value="$(sed -n "s/^${key}=//p" "${env_file}" | tail -n 1)"
  printf '%s' "${value:-${fallback}}"
}

health_host() {
  case "$1" in
    0.0.0.0|127.0.0.1|localhost) printf '127.0.0.1' ;;
    ::|::0|::1|'[::]'|'[::1]') printf '[::1]' ;;
    *) printf '%s' "$1" ;;
  esac
}

docker compose --env-file "${env_file}" ps

web_host="$(health_host "$(get_env_value WEB_BIND_ADDRESS 127.0.0.1)")"
api_host="$(health_host "$(get_env_value API_BIND_ADDRESS 127.0.0.1)")"
judge_host="$(health_host "$(get_env_value JUDGE_BIND_ADDRESS 127.0.0.1)")"
web_port="$(get_env_value WEB_PORT 8080)"
api_port="$(get_env_value API_PORT 8787)"
judge_port="$(get_env_value JUDGE_PORT 8788)"

failed=0
check_url() {
  local url="$1"
  if curl --fail --silent --show-error --max-time 5 "${url}" >/dev/null; then
    echo "healthy <- ${url}"
  else
    echo "offline <- ${url}" >&2
    failed=1
  fi
}

check_url "http://${web_host}:${web_port}/healthz"
check_url "http://${api_host}:${api_port}/health"
check_url "http://${judge_host}:${judge_port}/health"

if [[ ${failed} -ne 0 ]]; then
  echo "[AlgoQuest] one or more health checks failed" >&2
  exit 1
fi
