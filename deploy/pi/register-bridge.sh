#!/usr/bin/env bash
set -Eeuo pipefail

[[ "${EUID}" -eq 0 ]] || { echo "Run as root: sudo bash deploy/pi/register-bridge.sh" >&2; exit 77; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"

[[ -f "${env_file}" ]] || { echo "[AlgoQuest] missing ${env_file}" >&2; exit 1; }
command -v bridge >/dev/null || { echo "[AlgoQuest] Bridge is not installed. Install https://github.com/intqwq/Bridge first." >&2; exit 1; }
command -v jq >/dev/null || { echo "[AlgoQuest] jq is missing; Bridge installation should provide it." >&2; exit 1; }
systemctl is-active --quiet bridge-edge.service || { echo "[AlgoQuest] bridge-edge.service is not active." >&2; exit 1; }

get_env() {
  local key="$1" fallback="$2" value
  value="$(sed -n "s/^${key}=//p" "${env_file}" | tail -n 1)"
  printf '%s' "${value:-${fallback}}"
}

hostname="$(get_env PUBLIC_HOSTNAME game.intqwq.com)"
web_port="$(get_env WEB_PORT 18081)"
manifest="$(mktemp)"
trap 'rm -f "${manifest}"' EXIT

jq -n \
  --arg hostname "${hostname}" \
  --arg origin "http://127.0.0.1:${web_port}" \
  '{
    version: 1,
    service: "algoquest",
    routes: [{
      hostname: $hostname,
      origin: $origin,
      health_path: "/healthz",
      client_max_body_size: "8m",
      proxy_read_timeout_seconds: 60
    }]
  }' > "${manifest}"

bridge register "${manifest}"
