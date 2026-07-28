#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo: sudo $0" >&2
  exit 77
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
docker_path="$(command -v docker)"
unit_path="/etc/systemd/system/algoquest.service"

{
  echo "[Unit]"
  echo "Description=AlgoQuest container stack"
  echo "Requires=docker.service"
  echo "After=docker.service network-online.target"
  echo "Wants=network-online.target"
  echo ""
  echo "[Service]"
  echo "Type=oneshot"
  echo "RemainAfterExit=yes"
  echo "WorkingDirectory=${project_root}"
  echo "ExecStart=${docker_path} compose --env-file ${project_root}/.env.pi --profile all up -d"
  echo "ExecStop=${docker_path} compose --env-file ${project_root}/.env.pi --profile all down"
  echo "TimeoutStartSec=0"
  echo ""
  echo "[Install]"
  echo "WantedBy=multi-user.target"
} > "${unit_path}"

systemctl daemon-reload
systemctl enable --now algoquest.service
systemctl status --no-pager algoquest.service
