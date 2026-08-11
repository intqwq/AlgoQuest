#!/usr/bin/env bash
set -Eeuo pipefail

[[ "${EUID}" -eq 0 ]] || { echo "Run as root: sudo bash uninstall.sh" >&2; exit 77; }

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${project_root}/.env.pi"
operator_user="${ALGOQUEST_OPERATOR_USER:-${SUDO_USER:-root}}"
operator_home="$(getent passwd "${operator_user}" | cut -d: -f6)"
plan_only=0
remove_legacy_tunnel=0
purge_source=0

usage() {
  cat <<'USAGE'
Usage: sudo bash uninstall.sh [--plan] [--remove-legacy-tunnel] [--purge-source]

Permanently removes the AlgoQuest Raspberry Pi deployment, including its
containers, networks, named data volumes, systemd units, local deployment
configuration, runtime data and legacy AlgoQuest Cloudflare residue.

This script NEVER removes or stops Bridge infrastructure such as:
  bridge-edge.service
  bridge-cloudflared.service
  ~/.cloudflared/bridge.yml
  the Cloudflare tunnel named "bridge"

Options:
  --plan                  Show what would be removed without changing anything.
  --remove-legacy-tunnel  Also delete the obsolete remote Cloudflare tunnel named
                          exactly "algoquest", if cloudflared credentials exist.
  --purge-source          Delete this AlgoQuest checkout after uninstalling.

Interactive confirmation phrase: ERASE-ALGOQUEST
For non-interactive use:
  ALGOQUEST_UNINSTALL_CONFIRM=ERASE-ALGOQUEST sudo -E bash uninstall.sh
USAGE
}

while (( $# > 0 )); do
  case "$1" in
    --plan) plan_only=1 ;;
    --remove-legacy-tunnel) remove_legacy_tunnel=1 ;;
    --purge-source) purge_source=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 64 ;;
  esac
  shift
done

log() { printf '\n[AlgoQuest uninstall] %s\n' "$*"; }
die() { printf '\n[AlgoQuest uninstall] ERROR: %s\n' "$*" >&2; exit 1; }
run() {
  if [[ "${plan_only}" == "1" ]]; then printf '[plan] '; printf '%q ' "$@"; printf '\n';
  else "$@"; fi
}

[[ -n "${operator_home}" ]] || die "Could not resolve the operator home directory."

get_env_value() {
  local key="$1" fallback="$2" value=""
  if [[ -f "${env_file}" ]]; then value="$(sed -n "s/^${key}=//p" "${env_file}" | tail -n 1)"; fi
  printf '%s' "${value:-${fallback}}"
}

validate_volume_name() {
  [[ "$1" =~ ^[A-Za-z0-9_.-]+$ ]] || die "Unsafe Docker volume name: $1"
}

postgres_volume="$(get_env_value POSTGRES_VOLUME algoquest-postgres-data)"
judge_work_volume="$(get_env_value JUDGE_WORK_VOLUME algoquest-judge-work)"
judge_cache_volume="$(get_env_value JUDGE_CACHE_VOLUME algoquest-judge-cache)"
judge_queue_volume="$(get_env_value JUDGE_QUEUE_VOLUME algoquest-judge-queue)"
volumes=("${postgres_volume}" "${judge_work_volume}" "${judge_cache_volume}" "${judge_queue_volume}")
for volume in "${volumes[@]}"; do validate_volume_name "${volume}"; done

cat <<SUMMARY
AlgoQuest will be removed from this host.

Application checkout: ${project_root}
Operator home:       ${operator_home}
Systemd units:       algoquest.service, legacy algoquest-cloudflared.service
Docker volumes:      ${volumes[*]}
Runtime data:        /var/lib/algoquest
Legacy scratch:      ${operator_home}/algoquest-exec-scratch
Local Cloudflare:    ${operator_home}/.cloudflared/algoquest.yml*
Bridge:              PRESERVED
SUMMARY

if [[ "${plan_only}" == "0" ]]; then
  confirm="${ALGOQUEST_UNINSTALL_CONFIRM:-}"
  if [[ -z "${confirm}" && -t 0 ]]; then
    read -r -p 'Type ERASE-ALGOQUEST to continue: ' confirm
  fi
  [[ "${confirm}" == "ERASE-ALGOQUEST" ]] || die "Confirmation phrase did not match. Nothing was removed."
fi

log "Stopping and removing AlgoQuest systemd units"
for unit in algoquest.service algoquest-cloudflared.service; do
  run systemctl disable --now "${unit}" 2>/dev/null || true
done
run rm -f /etc/systemd/system/algoquest.service /etc/systemd/system/algoquest-cloudflared.service
run systemctl daemon-reload
if [[ "${plan_only}" == "0" ]]; then systemctl reset-failed algoquest.service algoquest-cloudflared.service 2>/dev/null || true; fi

if command -v docker >/dev/null 2>&1; then
  log "Removing AlgoQuest Compose stack, containers and networks"
  if [[ -f "${project_root}/compose.yml" && -f "${env_file}" ]]; then
    if [[ "${plan_only}" == "1" ]]; then
      echo "[plan] docker compose --project-directory ${project_root} --env-file ${env_file} --profile all down --remove-orphans --volumes"
    else
      docker compose --project-directory "${project_root}" --env-file "${env_file}" --profile all down --remove-orphans --volumes || true
    fi
  else
    mapfile -t containers < <(docker ps -aq --filter label=com.docker.compose.project=algoquest 2>/dev/null || true)
    if (( ${#containers[@]} > 0 )); then run docker rm -f "${containers[@]}" || true; fi
    mapfile -t networks < <(docker network ls -q --filter label=com.docker.compose.project=algoquest 2>/dev/null || true)
    if (( ${#networks[@]} > 0 )); then run docker network rm "${networks[@]}" || true; fi
  fi

  log "Removing AlgoQuest named volumes"
  for volume in "${volumes[@]}"; do
    if docker volume inspect "${volume}" >/dev/null 2>&1; then run docker volume rm -f "${volume}"; fi
  done

  log "Removing AlgoQuest-built images"
  mapfile -t images < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep -E '(^|/)algoquest([_-]|$)|^algoquest-runner:' || true)
  if (( ${#images[@]} > 0 )); then run docker image rm -f "${images[@]}" || true; fi
else
  log "Docker is not installed; skipping Docker cleanup"
fi

log "Removing runtime and local deployment state"
run rm -rf /var/lib/algoquest
run rm -rf "${operator_home}/algoquest-exec-scratch"
run rm -f "${env_file}"
run rm -f "${operator_home}/.cloudflared/algoquest.yml" "${operator_home}/.cloudflared/algoquest.yml.before-intqwq"

if [[ "${remove_legacy_tunnel}" == "1" ]]; then
  log "Removing obsolete remote Cloudflare tunnel named exactly 'algoquest'"
  if command -v cloudflared >/dev/null 2>&1; then
    if [[ "${operator_user}" == "root" ]]; then
      cf=(env HOME="${operator_home}" cloudflared)
    else
      cf=(sudo -u "${operator_user}" -H cloudflared)
    fi
    if [[ "${plan_only}" == "1" ]]; then
      echo "[plan] ${cf[*]} tunnel delete -f algoquest"
    else
      "${cf[@]}" tunnel delete -f algoquest 2>/dev/null || true
    fi
  else
    log "cloudflared is not installed; no remote tunnel action taken"
  fi
fi

cat <<'BRIDGE'

Bridge infrastructure was intentionally left untouched:
  bridge-edge.service
  bridge-cloudflared.service
  ~/.cloudflared/bridge.yml
  Cloudflare tunnel "bridge"
BRIDGE

if [[ "${purge_source}" == "1" ]]; then
  log "Removing AlgoQuest source checkout last"
  [[ "${project_root}" != "/" && "${project_root}" != "${operator_home}" ]] || die "Refusing unsafe source path: ${project_root}"
  run rm -rf "${project_root}"
fi

log "Uninstall complete"
