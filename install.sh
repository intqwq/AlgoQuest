#!/usr/bin/env bash
set -Eeuo pipefail

log() { printf '\n[AlgoQuest] %s\n' "$*"; }
die() { printf '\n[AlgoQuest] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die "Run this script as root: sudo bash install.sh"

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${project_root}/.env.pi"
example_env="${project_root}/.env.pi.example"
domain="${ALGOQUEST_DOMAIN:-game.intqwq.com}"
web_port="${ALGOQUEST_WEB_PORT:-18081}"
operator_user="${ALGOQUEST_OPERATOR_USER:-${SUDO_USER:-root}}"

[[ -f "${project_root}/compose.yml" ]] || die "Run from an AlgoQuest checkout."
[[ -f "${example_env}" ]] || die "Missing ${example_env}."
[[ "${domain}" =~ ^[A-Za-z0-9.-]+$ ]] || die "ALGOQUEST_DOMAIN contains unsupported characters."
[[ "${web_port}" =~ ^[0-9]+$ ]] || die "ALGOQUEST_WEB_PORT must be an integer."
(( web_port >= 1 && web_port <= 65535 )) || die "ALGOQUEST_WEB_PORT must be between 1 and 65535."
getent passwd "${operator_user}" >/dev/null || die "Operator user '${operator_user}' does not exist."

set_env() {
  local key="$1" value="$2" escaped
  [[ "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] || die "${key} cannot contain a newline."
  escaped="${value//\\/\\\\}"
  escaped="${escaped//&/\\&}"
  escaped="${escaped//|/\\|}"
  if grep -qE "^${key}=" "${env_file}"; then
    sed -i "s|^${key}=.*$|${key}=${escaped}|" "${env_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${env_file}"
  fi
}

get_env() { sed -n "s/^$1=//p" "${env_file}" | tail -n 1; }
is_missing_secret() { [[ -z "$1" || "$1" == CHANGE_ME_* ]]; }

require_value() {
  local key="$1" label="$2" current supplied value=""
  current="$(get_env "${key}")"
  supplied="${!key:-}"
  if [[ -n "${supplied}" ]]; then set_env "${key}" "${supplied}"; return; fi
  [[ -z "${current}" || "${current}" == CHANGE_ME_* ]] || return
  [[ -t 0 ]] || die "${key} is required for non-interactive deployment."
  while [[ -z "${value}" ]]; do read -r -p "${label}: " value; done
  set_env "${key}" "${value}"
}

require_secret() {
  local key="$1" label="$2" current supplied value=""
  current="$(get_env "${key}")"
  supplied="${!key:-}"
  if [[ -n "${supplied}" ]]; then set_env "${key}" "${supplied}"; return; fi
  is_missing_secret "${current}" || return
  [[ -t 0 ]] || die "${key} is required for non-interactive deployment."
  while is_missing_secret "${value}"; do read -r -p "${label}: " value; done
  set_env "${key}" "${value}"
}

source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "This bootstrap targets Ubuntu. Found '${ID:-unknown}'."
architecture="$(dpkg --print-architecture)"
[[ "${architecture}" == "arm64" ]] || log "Warning: Raspberry Pi Ubuntu is normally arm64; detected ${architecture}."

log "Installing base packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git gnupg openssl sudo

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  log "Installing Docker Engine and Compose v2"
  conflicting_packages=()
  for package in docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc; do
    dpkg-query -W -f='${db:Status-Abbrev}' "${package}" 2>/dev/null | grep -q '^ii ' && conflicting_packages+=("${package}")
  done
  (( ${#conflicting_packages[@]} == 0 )) || DEBIAN_FRONTEND=noninteractive apt-get remove -y "${conflicting_packages[@]}"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<DOCKER_REPO
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Architectures: ${architecture}
Signed-By: /etc/apt/keyrings/docker.asc
DOCKER_REPO
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
[[ "${operator_user}" == "root" ]] || usermod -aG docker "${operator_user}"
docker info >/dev/null
docker compose up --help 2>&1 | grep -q -- '--wait' || die "Docker Compose must support --wait."

log "Preparing the private AlgoQuest origin"
[[ -f "${env_file}" ]] || cp "${example_env}" "${env_file}"
chmod 600 "${env_file}"
set_env WEB_BIND_ADDRESS 127.0.0.1
set_env WEB_PORT "${web_port}"
set_env API_BIND_ADDRESS 127.0.0.1
set_env JUDGE_BIND_ADDRESS 127.0.0.1
set_env DB_BIND_ADDRESS 127.0.0.1
set_env API_ALLOWED_ORIGIN "https://${domain}"
set_env PUBLIC_APP_URL "https://${domain}"
set_env TURNSTILE_EXPECTED_HOSTNAME "${domain}"
set_env AUTH_EMAIL_MODE resend
require_secret RESEND_API_KEY "Resend API key"
require_secret TURNSTILE_SITE_KEY "Cloudflare Turnstile site key"
require_secret TURNSTILE_SECRET_KEY "Cloudflare Turnstile secret key"
require_value SITE_OWNER_EMAIL "Site owner email"

cd "${project_root}"
chmod +x install.sh uninstall.sh deploy/pi/*.sh
ALGOQUEST_NO_CONSOLE=1 ./deploy/pi/deploy.sh all
curl --noproxy '*' -fsS "http://127.0.0.1:${web_port}/healthz" >/dev/null || die "Origin health check failed."
./deploy/pi/install-systemd.sh >/dev/null

log "AlgoQuest origin deployment complete"
printf 'Private origin: http://127.0.0.1:%s\n' "${web_port}"
printf 'Public routing: managed independently by https://github.com/intqwq/Bridge\n'
printf 'Status:         sudo systemctl status algoquest\n'
