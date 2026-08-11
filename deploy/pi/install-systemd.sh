#!/usr/bin/env bash
set -Eeuo pipefail

dry_run="${ALGOQUEST_SYSTEMD_DRY_RUN:-0}"
if [[ "${EUID}" -ne 0 ]]; then echo "Run with sudo: sudo $0" >&2; exit 77; fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"
unit_path="${ALGOQUEST_SYSTEMD_UNIT_PATH:-/etc/systemd/system/algoquest.service}"
wait_timeout="${ALGOQUEST_COMPOSE_WAIT_TIMEOUT:-180}"
die() { echo "[AlgoQuest] ERROR: $*" >&2; exit 1; }

[[ "${dry_run}" == "0" || "${dry_run}" == "1" ]] || die "ALGOQUEST_SYSTEMD_DRY_RUN must be 0 or 1."
[[ "${unit_path}" == /* ]] || die "ALGOQUEST_SYSTEMD_UNIT_PATH must be absolute."
[[ "${project_root}" == /* ]] || die "The project path must be absolute."
[[ ! "${project_root}" =~ [[:space:]\\\"] ]] || die "The project path cannot contain whitespace, backslashes, or double quotes."
command -v docker >/dev/null || die "Docker is missing."
command -v systemd-analyze >/dev/null || die "systemd-analyze is missing."
command -v bridge >/dev/null || die "Bridge is not installed."
[[ -r "${env_file}" ]] || die "Missing or unreadable ${env_file}."
[[ "${wait_timeout}" =~ ^[1-9][0-9]*$ ]] || die "ALGOQUEST_COMPOSE_WAIT_TIMEOUT must be a positive integer."
docker compose up --help 2>&1 | grep -q -- '--wait' || die "Docker Compose must support 'compose up --wait'."
bash "${script_dir}/check-network-boundary.sh"

docker_path="$(command -v docker)"
timeout_start=$((wait_timeout + 60))
cat > "${unit_path}" <<SYSTEMD_UNIT
[Unit]
Description=AlgoQuest private application stack
Requires=docker.service bridge-edge.service
After=docker.service bridge-edge.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${project_root}
ExecStartPre=/bin/bash ${project_root}/deploy/pi/check-network-boundary.sh
ExecStart=${docker_path} compose --env-file ${env_file} --profile all up -d --remove-orphans --wait --wait-timeout ${wait_timeout}
ExecStop=${docker_path} compose --env-file ${env_file} --profile all down --remove-orphans
TimeoutStartSec=${timeout_start}
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
SYSTEMD_UNIT

if ! systemd-analyze verify "${unit_path}"; then rm -f "${unit_path}"; die "Generated systemd unit failed validation."; fi
if [[ "${dry_run}" == "1" ]]; then echo "[AlgoQuest] Verified ${unit_path}."; exit 0; fi
systemctl daemon-reload
systemctl enable algoquest.service
systemctl reset-failed algoquest.service 2>/dev/null || true
systemctl restart algoquest.service
systemctl status --no-pager algoquest.service
