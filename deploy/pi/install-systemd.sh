#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo $0" >&2
  exit 77
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"
unit_path="/etc/systemd/system/algoquest.service"
wait_timeout="${ALGOQUEST_COMPOSE_WAIT_TIMEOUT:-180}"

die() {
  echo "[AlgoQuest] ERROR: $*" >&2
  exit 1
}

command -v docker >/dev/null || die "Docker is missing."
docker_path="$(command -v docker)"
[[ -r "${env_file}" ]] || die "Missing or unreadable ${env_file}."
[[ "${wait_timeout}" =~ ^[1-9][0-9]*$ ]] || die "ALGOQUEST_COMPOSE_WAIT_TIMEOUT must be a positive integer."
docker compose up --help 2>&1 | grep -q -- '--wait' || \
  die "Docker Compose is too old. Install a version that supports 'compose up --wait'."

if [[ "${project_root}" == *$'\n'* || "${project_root}" == *'"'* ]]; then
  die "The project path cannot contain a newline or double quote."
fi

timeout_start=$((wait_timeout + 60))
cat > "${unit_path}" <<SYSTEMD_UNIT
[Unit]
Description=AlgoQuest container stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory="${project_root}"
ExecStart=${docker_path} compose --env-file "${env_file}" --profile all up -d --remove-orphans --wait --wait-timeout ${wait_timeout}
ExecStop=${docker_path} compose --env-file "${env_file}" --profile all down --remove-orphans
TimeoutStartSec=${timeout_start}
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
SYSTEMD_UNIT

systemctl daemon-reload
systemctl enable algoquest.service
systemctl restart algoquest.service
systemctl status --no-pager algoquest.service
