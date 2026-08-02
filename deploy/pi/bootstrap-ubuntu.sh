#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '\n[AlgoQuest] %s\n' "$*"
}

die() {
  printf '\n[AlgoQuest] ERROR: %s\n' "$*" >&2
  exit 1
}

if [[ "${EUID}" -ne 0 ]]; then
  die "Run this script as root: sudo ./deploy/pi/bootstrap-ubuntu.sh"
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/../.." && pwd)"
env_file="${project_root}/.env.pi"
example_env="${project_root}/.env.pi.example"

domain="${ALGOQUEST_DOMAIN:-game.intqwq.com}"
web_port="${ALGOQUEST_WEB_PORT:-8080}"
tunnel_name="${CLOUDFLARE_TUNNEL_NAME:-algoquest}"
origin_url="http://127.0.0.1:${web_port}"
operator_user="${ALGOQUEST_OPERATOR_USER:-${SUDO_USER:-root}}"

[[ -f "${project_root}/compose.yml" ]] || die "Run the script from an AlgoQuest checkout."
[[ -f "${example_env}" ]] || die "Missing ${example_env}."
[[ "${domain}" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]] ||
  die "ALGOQUEST_DOMAIN is not a valid DNS hostname: ${domain}"
[[ "${web_port}" =~ ^[0-9]+$ ]] && ((web_port >= 1 && web_port <= 65535)) ||
  die "ALGOQUEST_WEB_PORT must be between 1 and 65535."

if ! getent passwd "${operator_user}" >/dev/null; then
  die "Operator user '${operator_user}' does not exist."
fi
operator_home="$(getent passwd "${operator_user}" | cut -d: -f6)"
operator_group="$(id -gn "${operator_user}")"

as_operator() {
  if [[ "${operator_user}" == "root" ]]; then
    HOME="${operator_home}" "$@"
  else
    sudo -u "${operator_user}" -H "$@"
  fi
}

set_env() {
  local key="$1"
  local value="$2"
  [[ "${value}" != *$'\n'* && "${value}" != *$'\r'* ]] ||
    die "${key} must be a single-line value."

  local escaped="${value//\\/\\\\}"
  escaped="${escaped//&/\\&}"
  escaped="${escaped//|/\\|}"

  if grep -qE "^${key}=" "${env_file}"; then
    sed -i "s|^${key}=.*$|${key}=${escaped}|" "${env_file}"
  else
    printf '%s=%s\n' "${key}" "${value}" >> "${env_file}"
  fi
}

get_env() {
  local key="$1"
  sed -n "s/^${key}=//p" "${env_file}" | tail -n 1 | tr -d '\r'
}

is_missing_secret() {
  local value="$1"
  [[ -z "${value}" || "${value}" == CHANGE_ME_* ]]
}

require_value() {
  local key="$1"
  local label="$2"
  local current
  local supplied
  current="$(get_env "${key}")"
  supplied="${!key:-}"

  if [[ -n "${supplied}" ]]; then
    set_env "${key}" "${supplied}"
    return
  fi

  if [[ -n "${current}" && "${current}" != CHANGE_ME_* ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    die "${key} is required. Export it before running this non-interactively."
  fi

  local value=""
  while [[ -z "${value}" ]]; do
    read -r -p "${label}: " value
  done
  set_env "${key}" "${value}"
}

require_email() {
  local key="$1"
  local label="$2"

  while true; do
    require_value "${key}" "${label}"
    local value
    value="$(get_env "${key}")"
    if [[ "${value}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
      return
    fi

    if [[ ! -t 0 ]]; then
      die "${key} is not a valid email address."
    fi
    printf '[AlgoQuest] %s is not a valid email address. Try again.\n' "${key}" >&2
    set_env "${key}" ""
  done
}

require_secret() {
  local key="$1"
  local label="$2"
  local current
  local supplied
  current="$(get_env "${key}")"
  supplied="${!key:-}"

  if [[ -n "${supplied}" ]]; then
    set_env "${key}" "${supplied}"
    return
  fi

  if ! is_missing_secret "${current}"; then
    return
  fi

  if [[ ! -t 0 ]]; then
    die "${key} is required. Export it before running this non-interactively."
  fi

  local value=""
  while is_missing_secret "${value}"; do
    # These credentials are intentionally echoed so users can verify what they typed.
    read -r -p "${label}: " value
  done
  set_env "${key}" "${value}"
}

source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "This bootstrap targets Ubuntu. Found '${ID:-unknown}'."
ubuntu_codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
[[ -n "${ubuntu_codename}" ]] || die "Could not determine the Ubuntu release codename."

architecture="$(dpkg --print-architecture)"
if [[ "${architecture}" != "arm64" ]]; then
  log "Warning: Raspberry Pi Ubuntu is normally arm64; detected ${architecture}."
fi

log "Installing base packages"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git gnupg jq openssl sudo

if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  log "Installing Docker Engine and Compose v2"

  mapfile -t conflicting_packages < <(
    dpkg-query -W -f='${binary:Package}\n' \
      docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc \
      2>/dev/null || true
  )
  if ((${#conflicting_packages[@]})); then
    apt-get remove -y "${conflicting_packages[@]}"
  fi

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat > /etc/apt/sources.list.d/docker.sources <<DOCKER_REPO
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${ubuntu_codename}
Components: stable
Architectures: ${architecture}
Signed-By: /etc/apt/keyrings/docker.asc
DOCKER_REPO
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
if [[ "${operator_user}" != "root" ]]; then
  usermod -aG docker "${operator_user}"
fi

docker info >/dev/null
docker compose version >/dev/null

if ! command -v cloudflared >/dev/null; then
  log "Installing cloudflared"
  install -m 0755 -d /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
    -o /usr/share/keyrings/cloudflare-main.gpg
  chmod a+r /usr/share/keyrings/cloudflare-main.gpg
  printf '%s\n' \
    'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y cloudflared
fi

log "Preparing production environment for https://${domain}"
if [[ ! -f "${env_file}" ]]; then
  cp "${example_env}" "${env_file}"
fi
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
require_email SITE_OWNER_EMAIL "Site owner email"

log "Building and starting AlgoQuest"
cd "${project_root}"
chmod +x deploy/pi/*.sh
ALGOQUEST_NO_CONSOLE=1 ./deploy/pi/deploy.sh all
./deploy/pi/install-systemd.sh >/dev/null

curl -fsS --retry 10 --retry-delay 2 --retry-connrefused \
  "${origin_url}/healthz" >/dev/null ||
  die "Nginx gateway health check failed at ${origin_url}/healthz."

log "Configuring Cloudflare Tunnel '${tunnel_name}'"
cloudflare_dir="${operator_home}/.cloudflared"
install -d -m 0700 -o "${operator_user}" -g "${operator_group}" "${cloudflare_dir}"

if [[ ! -f "${cloudflare_dir}/cert.pem" ]]; then
  log "Cloudflare authorization is required. Open the URL printed below and select the zone containing ${domain}."
  as_operator cloudflared tunnel login
fi

find_tunnel_id() {
  as_operator cloudflared tunnel list --output json 2>/dev/null |
    jq -r --arg name "${tunnel_name}" \
      '[.[] | select(.name == $name and ((.deletedAt // "") == ""))][0].id // empty'
}

tunnel_id="$(find_tunnel_id)"
if [[ -z "${tunnel_id}" ]]; then
  as_operator cloudflared tunnel create "${tunnel_name}"
  tunnel_id="$(find_tunnel_id)"
fi
[[ -n "${tunnel_id}" ]] || die "Could not resolve Cloudflare Tunnel ID for '${tunnel_name}'."

credentials_file="${cloudflare_dir}/${tunnel_id}.json"
[[ -f "${credentials_file}" ]] || die "Missing tunnel credentials: ${credentials_file}"

config_file="${cloudflare_dir}/algoquest.yml"
tmp_config="$(mktemp)"
trap 'rm -f "${tmp_config:-}"' EXIT
cat > "${tmp_config}" <<CLOUDFLARED_CONFIG
tunnel: ${tunnel_id}
credentials-file: ${credentials_file}
ingress:
  - hostname: ${domain}
    service: ${origin_url}
  - service: http_status:404
CLOUDFLARED_CONFIG
install -m 0600 -o "${operator_user}" -g "${operator_group}" "${tmp_config}" "${config_file}"
rm -f "${tmp_config}"
trap - EXIT

as_operator cloudflared --config "${config_file}" tunnel ingress validate
as_operator cloudflared tunnel route dns --overwrite-dns "${tunnel_id}" "${domain}"

cloudflared_path="$(command -v cloudflared)"
cat > /etc/systemd/system/algoquest-cloudflared.service <<SYSTEMD_UNIT
[Unit]
Description=AlgoQuest Cloudflare Tunnel
Requires=algoquest.service
After=network-online.target algoquest.service
Wants=network-online.target

[Service]
Type=simple
User=${operator_user}
Group=${operator_group}
ExecStart=${cloudflared_path} --no-autoupdate --config "${config_file}" tunnel run "${tunnel_id}"
Restart=on-failure
RestartSec=5s
TimeoutStopSec=30s
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
SYSTEMD_UNIT

systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/algoquest-cloudflared.service
systemctl enable algoquest-cloudflared.service
systemctl restart algoquest-cloudflared.service
systemctl is-active --quiet algoquest.service
systemctl is-active --quiet algoquest-cloudflared.service

log "Deployment complete"
printf 'Local origin:  %s\n' "${origin_url}"
printf 'Public URL:    https://%s\n' "${domain}"
printf 'Tunnel ID:     %s\n' "${tunnel_id}"
printf 'Stack status:  sudo systemctl status algoquest\n'
printf 'Tunnel status: sudo systemctl status algoquest-cloudflared\n'
printf 'Logs:          docker compose --env-file .env.pi logs -f\n'
