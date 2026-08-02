#!/usr/bin/env bash
set -Eeuo pipefail

die() {
  printf '[AlgoQuest] ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  die "Run with sudo: sudo $0"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"
docker_path="$(command -v docker || true)"
unit_path="/etc/systemd/system/algoquest.service"
startup_timeout="${ALGOQUEST_STARTUP_TIMEOUT_SECONDS:-300}"

[[ -n "${docker_path}" ]] || die "Docker is missing."
[[ -f "${project_root}/compose.yml" ]] || die "Missing ${project_root}/compose.yml."
[[ -f "${env_file}" ]] || die "Missing ${env_file}. Run deploy/pi/deploy.sh first."
[[ "${startup_timeout}" =~ ^[0-9]+$ ]] && ((startup_timeout >= 1)) ||
  die "ALGOQUEST_STARTUP_TIMEOUT_SECONDS must be a positive integer."

cd "${project_root}"
docker compose --env-file "${env_file}" --profile all config --quiet

tmp_unit="$(mktemp)"
trap 'rm -f "${tmp_unit}"' EXIT
cat > "${tmp_unit}" <<SYSTEMD_UNIT
[Unit]
Description=AlgoQuest container stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=${docker_path} compose --project-directory "${project_root}" --env-file "${env_file}" --profile all up -d --wait --wait-timeout ${startup_timeout}
ExecStop=${docker_path} compose --project-directory "${project_root}" --env-file "${env_file}" --profile all down --timeout 30
TimeoutStartSec=$((startup_timeout + 60))
TimeoutStopSec=60
UMask=0077

[Install]
WantedBy=multi-user.target
SYSTEMD_UNIT

unit_changed=1
if [[ -f "${unit_path}" ]] && cmp -s "${tmp_unit}" "${unit_path}"; then
  unit_changed=0
else
  install -m 0644 "${tmp_unit}" "${unit_path}"
fi

systemctl daemon-reload
systemd-analyze verify "${unit_path}"
systemctl enable algoquest.service

if ! systemctl is-active --quiet algoquest.service; then
  systemctl start algoquest.service
elif ((unit_changed)); then
  systemctl restart algoquest.service
fi

systemctl status --no-pager algoquest.service
