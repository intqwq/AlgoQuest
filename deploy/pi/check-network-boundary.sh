#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"

die() {
  printf '[AlgoQuest] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -r "${env_file}" ]] || die "Missing or unreadable ${env_file}."

get_env_value() {
  local key="$1" fallback="$2" value
  value="$(sed -n "s/^${key}=//p" "${env_file}" | tail -n 1)"
  printf '%s' "${value:-${fallback}}"
}

# The Raspberry Pi deployment is a Bridge-managed single-host production shape.
# Every host-published AlgoQuest service must stay on loopback. Split-host
# deployments need a separate, explicitly secured deployment shape instead of
# weakening this production contract.
for key in WEB_BIND_ADDRESS API_BIND_ADDRESS JUDGE_BIND_ADDRESS DB_BIND_ADDRESS; do
  value="$(get_env_value "${key}" 127.0.0.1)"
  [[ "${value}" == "127.0.0.1" ]] || \
    die "${key} must be 127.0.0.1 on the Bridge-managed Raspberry Pi deployment; found '${value}'."
done

web_port="$(get_env_value WEB_PORT 18081)"
[[ "${web_port}" =~ ^[0-9]+$ ]] || die "WEB_PORT must be an integer."
(( web_port >= 1 && web_port <= 65535 )) || die "WEB_PORT must be between 1 and 65535."

printf '[AlgoQuest] private network boundary OK: Bridge origin is 127.0.0.1:%s\n' "${web_port}"
