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

[[ -f "${project_root}/compose.yml" ]] || die "Run from an AlgoQuest checkout."
[[ -f "${example_env}" ]] || die "Missing ${example_env}."
[[ "${domain}" =~ ^[A-Za-z0-9.-]+$ ]] || die "ALGOQUEST_DOMAIN contains unsupported characters."
[[ "${web_port}" =~ ^[0-9]+$ ]] && (( web_port >= 1 && web_port <= 65535 )) || die "ALGOQUEST_WEB_PORT must be between 1 and 65535."

# Bridge is the platform prerequisite. Application installers do not install or
# configure Docker, Cloudflare, public Nginx, DNS, or tunnels themselves.
command -v bridge >/dev/null || die "Bridge is not installed. Install https://github.com/intqwq/Bridge first."
command -v docker >/dev/null || die "Docker is missing; reinstall/repair Bridge first."
command -v jq >/dev/null || die "jq is missing; reinstall/repair Bridge first."
systemctl is-active --quiet bridge-edge.service || die "bridge-edge.service is not active."
systemctl is-active --quiet bridge-cloudflared.service || die "bridge-cloudflared.service is not active."
docker info >/dev/null || die "Docker is not reachable."
docker compose up --help 2>&1 | grep -q -- '--wait' || die "Docker Compose must support --wait."

source /etc/os-release
[[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" ]] || die "This production installer targets Ubuntu/Debian. Found '${ID:-unknown}'."
architecture="$(dpkg --print-architecture)"
[[ "${architecture}" == "arm64" ]] || log "Warning: Raspberry Pi deployment is normally arm64; detected ${architecture}."

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

log "Preparing the private AlgoQuest origin"
[[ -f "${env_file}" ]] || cp "${example_env}" "${env_file}"
chmod 600 "${env_file}"
set_env WEB_BIND_ADDRESS 127.0.0.1
set_env WEB_PORT "${web_port}"
set_env API_BIND_ADDRESS 127.0.0.1
set_env JUDGE_BIND_ADDRESS 127.0.0.1
set_env DB_BIND_ADDRESS 127.0.0.1
set_env PUBLIC_HOSTNAME "${domain}"
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

log "Registering AlgoQuest with Bridge"
bash ./deploy/pi/register-bridge.sh

log "AlgoQuest deployment complete"
printf 'Private origin: http://127.0.0.1:%s\n' "${web_port}"
printf 'Public host:    https://%s (registered through Bridge)\n' "${domain}"
printf 'Status:         sudo systemctl status algoquest\n'
