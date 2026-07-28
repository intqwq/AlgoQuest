#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"

cd "${project_root}"
docker compose --env-file "${env_file}" ps

for url in \
  "http://127.0.0.1/healthz" \
  "http://127.0.0.1:8787/health" \
  "http://127.0.0.1:8788/health"; do
  if curl --fail --silent --show-error --max-time 3 "${url}"; then
    echo " <- ${url}"
  else
    echo "offline <- ${url}"
  fi
done
