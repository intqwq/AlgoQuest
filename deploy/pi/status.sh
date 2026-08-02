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

[[ -f "${project_root}/compose.yml" ]] || die "Missing ${project_root}/compose.yml."
[[ -f "${env_file}" ]] || die "Missing ${env_file}. Run deploy/pi/deploy.sh first."
command -v docker >/dev/null || die "Docker is missing."
command -v curl >/dev/null || die "curl is missing."

get_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "${env_file}" | tail -n 1 | tr -d '\r'
}

loopback_host() {
  local bind_address="$1"
  case "${bind_address}" in
    ""|0.0.0.0) printf '127.0.0.1' ;;
    ::) printf '::1' ;;
    *) printf '%s' "${bind_address}" ;;
  esac
}

url_host() {
  local host="$1"
  if [[ "${host}" == *:* ]]; then
    printf '[%s]' "${host}"
  else
    printf '%s' "${host}"
  fi
}

cd "${project_root}"
compose() {
  docker compose --env-file "${env_file}" --profile "${mode}" "$@"
}

compose ps

case "${mode}" in
  all)
    expected_services=(gateway web api judge judge-worker redis db)
    ;;
  web)
    expected_services=(gateway web)
    ;;
  api)
    expected_services=(api)
    ;;
  judge)
    expected_services=(judge judge-worker redis)
    ;;
  database)
    expected_services=(db)
    ;;
esac

failed=0
for service in "${expected_services[@]}"; do
  container_id="$(compose ps -q "${service}")"
  if [[ -z "${container_id}" ]]; then
    printf 'missing <- service %s\n' "${service}" >&2
    failed=1
    continue
  fi

  state="$(docker inspect --format \
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
    "${container_id}" 2>/dev/null || true)"
  case "${state}" in
    healthy|running)
      printf '%-7s <- service %s\n' "${state}" "${service}"
      ;;
    *)
      printf '%-7s <- service %s\n' "${state:-unknown}" "${service}" >&2
      failed=1
      ;;
  esac
done

check_url() {
  local url="$1"
  if curl --fail --silent --show-error --max-time 5 "${url}" >/dev/null; then
    printf 'online  <- %s\n' "${url}"
  else
    printf 'offline <- %s\n' "${url}" >&2
    failed=1
  fi
}

web_bind="$(get_env WEB_BIND_ADDRESS)"
web_port="$(get_env WEB_PORT)"
api_bind="$(get_env API_BIND_ADDRESS)"
api_port="$(get_env API_PORT)"
judge_bind="$(get_env JUDGE_BIND_ADDRESS)"
judge_port="$(get_env JUDGE_PORT)"

web_host="$(url_host "$(loopback_host "${web_bind}")")"
api_host="$(url_host "$(loopback_host "${api_bind}")")"
judge_host="$(url_host "$(loopback_host "${judge_bind}")")"

web_port="${web_port:-8080}"
api_port="${api_port:-8787}"
judge_port="${judge_port:-8788}"

case "${mode}" in
  all)
    check_url "http://${web_host}:${web_port}/healthz"
    check_url "http://${api_host}:${api_port}/health"
    check_url "http://${judge_host}:${judge_port}/health"
    ;;
  web)
    check_url "http://${web_host}:${web_port}/healthz"
    ;;
  api)
    check_url "http://${api_host}:${api_port}/health"
    ;;
  judge)
    check_url "http://${judge_host}:${judge_port}/health"
    ;;
esac

exit "${failed}"
