#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/../.." && pwd)

DEFAULT_REMOTE_USER="root"
DEFAULT_REMOTE_DEPLOY_DIR="/root/new-api/deploy/newapi-local"
DEFAULT_REMOTE_TMP_DIR="/root"
DEFAULT_LOCAL_BACKUP_DIR="${HOME}/newapi-104-env-backup"
DEFAULT_VERIFY_PORT="18080"
DEFAULT_VITE_HOME_ENTRY="en"

REMOTE_HOST="${REMOTE_HOST:-}"
REMOTE_USER="${REMOTE_USER:-$DEFAULT_REMOTE_USER}"
REMOTE_DEPLOY_DIR="${REMOTE_DEPLOY_DIR:-$DEFAULT_REMOTE_DEPLOY_DIR}"
REMOTE_TMP_DIR="${REMOTE_TMP_DIR:-$DEFAULT_REMOTE_TMP_DIR}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$DEFAULT_LOCAL_BACKUP_DIR}"
VERIFY_PORT="${VERIFY_PORT:-$DEFAULT_VERIFY_PORT}"
VITE_HOME_ENTRY="${VITE_HOME_ENTRY:-$DEFAULT_VITE_HOME_ENTRY}"
PUBLIC_STATUS_URL="${PUBLIC_STATUS_URL:-${REMOTE_HOST:+http://${REMOTE_HOST}:3000/api/status}}"

LOCAL_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.postgres.yml"
REMOTE_COMPOSE_FILE="${REMOTE_DEPLOY_DIR}/docker-compose.postgres.yml"
REMOTE_ENV_FILE="${REMOTE_DEPLOY_DIR}/.env.postgres"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  deploy/newapi-local/release.sh <command> [image_tag]

Commands:
  build [image_tag]          Build local image `new-api:<tag>`
  verify-image [image_tag]   Verify `/`, `/logo.png`, `/favicon.ico`, `/api/status`
  backup-env                 Backup remote `.env.postgres` and effective app envs locally
  upload [image_tag]         Save local image tar and upload to the remote host
  deploy [image_tag]         Load remote tar, pin compose image, recreate only `new-api`
  deploy-existing <tag>      Recreate remote `new-api` from an already loaded image tag
  release [image_tag]        Run build -> verify-image -> confirm -> upload -> deploy
  list-remote-images         List remote `new-api` images
  status                     Show remote service status and health
  rollback <tag>             Alias of `deploy-existing <tag>`
  help                       Show this help

Environment:
  REMOTE_HOST                Required. Example: 104.xx.xx.xx
  REMOTE_USER                Default: root
  REMOTE_PASS                Optional. If set, use sshpass for ssh/scp.
  REMOTE_DEPLOY_DIR          Default: /root/new-api/deploy/newapi-local
  REMOTE_TMP_DIR             Default: /root
  LOCAL_BACKUP_DIR           Default: $HOME/newapi-104-env-backup
  VERIFY_PORT                Default: 18080
  VITE_HOME_ENTRY            Frontend classic home entry build arg. Default: en
  PUBLIC_STATUS_URL          Optional. Defaults to http://$REMOTE_HOST:3000/api/status

Notes:
  - This SOP only updates `new-api`.
  - It does not restart `gateway`, `postgres`, `redis`, or `seedance-compat`.
  - Remote runtime assumes container name `new-api` and compose file `docker-compose.postgres.yml`.
EOF
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_remote_host() {
  [[ -n "${REMOTE_HOST}" ]] || die "REMOTE_HOST is required"
}

run_ssh() {
  need_remote_host
  if [[ -n "${REMOTE_PASS:-}" ]]; then
    need_cmd sshpass
    sshpass -p "${REMOTE_PASS}" ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" "$@"
  else
    ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" "$@"
  fi
}

run_scp() {
  need_remote_host
  if [[ -n "${REMOTE_PASS:-}" ]]; then
    need_cmd sshpass
    sshpass -p "${REMOTE_PASS}" scp -o StrictHostKeyChecking=no "$@"
  else
    scp -o StrictHostKeyChecking=no "$@"
  fi
}

current_tag() {
  (
    cd "${REPO_ROOT}"
    printf '%s-%s' "$(git rev-parse --abbrev-ref HEAD)" "$(git rev-parse --short=8 HEAD)"
  )
}

resolve_tag() {
  if [[ $# -gt 0 && -n "$1" ]]; then
    printf '%s' "$1"
  else
    current_tag
  fi
}

image_ref() {
  printf 'new-api:%s' "$1"
}

tar_path() {
  printf '%s/new-api-%s.tar' "${SCRIPT_DIR}" "$1"
}

rendered_compose_path() {
  printf '%s/.tmp-release-compose-%s.yml' "${SCRIPT_DIR}" "$1"
}

ensure_local_image() {
  docker image inspect "$(image_ref "$1")" >/dev/null 2>&1 || die "local image not found: $(image_ref "$1")"
}

render_compose_for_tag() {
  local tag="$1"
  local output="$2"
  awk -v image="new-api:${tag}" '
    /^[[:space:]]*new-api:/ { in_service=1 }
    in_service && /^[^[:space:]]/ && $0 !~ /^[[:space:]]*new-api:/ { in_service=0 }
    in_service && /^[[:space:]]*image:[[:space:]]*/ { sub(/image:.*/, "image: " image) }
    { print }
  ' "${LOCAL_COMPOSE_FILE}" > "${output}"
}

build_cmd() {
  local tag="$1"
  log "building $(image_ref "${tag}")"
  (
    cd "${REPO_ROOT}"
    docker build \
      --build-arg GOPROXY=https://goproxy.cn,direct \
      --build-arg VITE_HOME_ENTRY="${VITE_HOME_ENTRY}" \
      -t "$(image_ref "${tag}")" .
  )
}

verify_image_cmd() {
  local tag="$1"
  local name="new-api-image-check"
  ensure_local_image "${tag}"

  docker rm -f "${name}" >/dev/null 2>&1 || true
  docker run -d --name "${name}" -p "${VERIFY_PORT}:3000" "$(image_ref "${tag}")" >/dev/null
  trap 'docker rm -f "'"${name}"'" >/dev/null 2>&1 || true' EXIT

  for _ in 1 2 3 4 5 6; do
    if curl -fsS "http://127.0.0.1:${VERIFY_PORT}/api/status" >/dev/null 2>&1; then
      break
    fi
    sleep 5
  done

  curl -fsS "http://127.0.0.1:${VERIFY_PORT}/api/status" >/dev/null
  curl -fsSI "http://127.0.0.1:${VERIFY_PORT}/" | sed -n '1,5p'
  curl -fsSI "http://127.0.0.1:${VERIFY_PORT}/logo.png" | sed -n '1,5p'
  curl -fsSI "http://127.0.0.1:${VERIFY_PORT}/favicon.ico" | sed -n '1,5p'

  if [[ -f "${REPO_ROOT}/web/public/logo.png" ]]; then
    local local_hash remote_hash
    local_hash="$(sha256sum "${REPO_ROOT}/web/public/logo.png" | awk '{print $1}')"
    remote_hash="$(curl -fsS "http://127.0.0.1:${VERIFY_PORT}/logo.png" | sha256sum | awk '{print $1}')"
    [[ "${local_hash}" == "${remote_hash}" ]] || die "logo.png hash mismatch: local=${local_hash} remote=${remote_hash}"
    log "logo.png hash verified"
  fi

  docker rm -f "${name}" >/dev/null 2>&1 || true
  trap - EXIT
  log "image verification passed for $(image_ref "${tag}")"
}

backup_env_cmd() {
  local stamp backup_dir
  stamp="$(date '+%Y%m%d-%H%M%S')"
  backup_dir="${LOCAL_BACKUP_DIR}-${stamp}"

  mkdir -p "${backup_dir}"
  run_ssh "cat '${REMOTE_ENV_FILE}'" > "${backup_dir}/.env.postgres.remote"
  run_ssh "docker inspect new-api --format '{{range .Config.Env}}{{println .}}{{end}}'" > "${backup_dir}/new-api.env.effective"
  run_ssh "docker inspect new-api-redis --format '{{range .Config.Env}}{{println .}}{{end}}'" > "${backup_dir}/new-api-redis.env.effective"
  printf '%s\n' '.env.postgres.remote' 'new-api.env.effective' 'new-api-redis.env.effective' > "${backup_dir}/README.txt"
  log "backup written to ${backup_dir}"
}

upload_cmd() {
  local tag="$1"
  local tar_file
  ensure_local_image "${tag}"
  tar_file="$(tar_path "${tag}")"

  log "saving $(image_ref "${tag}") to ${tar_file}"
  docker save -o "${tar_file}" "$(image_ref "${tag}")"
  sha256sum "${tar_file}"

  log "uploading ${tar_file} to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_TMP_DIR}/"
  run_scp "${tar_file}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_TMP_DIR}/"
}

remote_backup_state_cmd() {
  local stamp
  stamp="$(date '+%Y%m%d-%H%M%S')"
  run_ssh "cp '${REMOTE_COMPOSE_FILE}' '${REMOTE_COMPOSE_FILE}.bak-${stamp}'"
  run_ssh "cp '${REMOTE_ENV_FILE}' '${REMOTE_ENV_FILE}.bak-${stamp}'"
  run_ssh "cp '${REMOTE_DEPLOY_DIR}/gateway/nginx.conf' '${REMOTE_DEPLOY_DIR}/gateway/nginx.conf.bak-${stamp}'"
  run_ssh "docker exec -t new-api-postgres pg_dump -U newapi -d newapi > '${REMOTE_TMP_DIR}/newapi-pg-backup-${stamp}.sql'"
}

deploy_cmd() {
  local tag="$1"
  local tar_file remote_tar rendered_compose remote_compose_copy
  tar_file="$(tar_path "${tag}")"
  remote_tar="${REMOTE_TMP_DIR}/$(basename "${tar_file}")"
  rendered_compose="$(rendered_compose_path "${tag}")"
  remote_compose_copy="${REMOTE_DEPLOY_DIR}/$(basename "${rendered_compose}")"

  [[ -f "${tar_file}" ]] || die "missing local tar: ${tar_file}; run upload first"
  render_compose_for_tag "${tag}" "${rendered_compose}"

  run_scp "${rendered_compose}" "${REMOTE_USER}@${REMOTE_HOST}:${remote_compose_copy}"
  run_ssh "test -f '${remote_tar}' || { echo 'missing remote tar: ${remote_tar}' >&2; exit 1; }"
  run_ssh "docker load -i '${remote_tar}'"

  remote_backup_state_cmd
  run_ssh "cp '${remote_compose_copy}' '${REMOTE_COMPOSE_FILE}'"
  run_ssh "cd '${REMOTE_DEPLOY_DIR}' && docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --no-deps new-api"

  run_ssh "for i in 1 2 3 4 5 6 7 8; do s=\$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' new-api 2>/dev/null || true); echo \$s; [ \"\$s\" = healthy ] && exit 0; sleep 5; done; exit 1"
  run_ssh "curl -fsS http://127.0.0.1:3000/api/status >/dev/null"
  [[ -n "${PUBLIC_STATUS_URL}" ]] || die "PUBLIC_STATUS_URL is empty"
  curl -fsS "${PUBLIC_STATUS_URL}" >/dev/null
  log "deploy complete for $(image_ref "${tag}")"
}

deploy_existing_cmd() {
  local tag="$1"
  local rendered_compose remote_compose_copy
  rendered_compose="$(rendered_compose_path "${tag}")"
  remote_compose_copy="${REMOTE_DEPLOY_DIR}/$(basename "${rendered_compose}")"

  render_compose_for_tag "${tag}" "${rendered_compose}"
  run_scp "${rendered_compose}" "${REMOTE_USER}@${REMOTE_HOST}:${remote_compose_copy}"
  run_ssh "docker image inspect 'new-api:${tag}' >/dev/null 2>&1"

  remote_backup_state_cmd
  run_ssh "cp '${remote_compose_copy}' '${REMOTE_COMPOSE_FILE}'"
  run_ssh "cd '${REMOTE_DEPLOY_DIR}' && docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --no-deps new-api"
  run_ssh "for i in 1 2 3 4 5 6 7 8; do s=\$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' new-api 2>/dev/null || true); echo \$s; [ \"\$s\" = healthy ] && exit 0; sleep 5; done; exit 1"
  run_ssh "curl -fsS http://127.0.0.1:3000/api/status >/dev/null"
  log "deploy-existing complete for $(image_ref "${tag}")"
}

release_cmd() {
  local tag="$1"
  local answer
  build_cmd "${tag}"
  verify_image_cmd "${tag}"

  cat <<EOF

Release is ready to continue.

Tag:            ${tag}
Image:          $(image_ref "${tag}")
Remote host:    ${REMOTE_USER}@${REMOTE_HOST}
Remote compose: ${REMOTE_COMPOSE_FILE}
Service:        new-api only

Type "yes" to continue with upload and deploy:
EOF
  read -r answer
  [[ "${answer}" == "yes" ]] || die "release aborted before upload/deploy"

  upload_cmd "${tag}"
  deploy_cmd "${tag}"
}

status_cmd() {
  run_ssh "docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -E 'new-api$|new-api-gateway|seedance-compat-local|new-api-postgres|new-api-redis'"
  run_ssh "docker inspect new-api --format 'IMAGE={{.Config.Image}} WORKDIR={{ index .Config.Labels \"com.docker.compose.project.working_dir\" }} CONFIG={{ index .Config.Labels \"com.docker.compose.project.config_files\" }}'"
  run_ssh "curl -fsS http://127.0.0.1:3000/api/status"
}

list_remote_images_cmd() {
  run_ssh "docker image ls new-api --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}'"
}

main() {
  local cmd="${1:-help}"
  shift || true

  case "${cmd}" in
    build)
      build_cmd "$(resolve_tag "${1:-}")"
      ;;
    verify-image)
      verify_image_cmd "$(resolve_tag "${1:-}")"
      ;;
    backup-env)
      backup_env_cmd
      ;;
    upload)
      upload_cmd "$(resolve_tag "${1:-}")"
      ;;
    deploy)
      deploy_cmd "$(resolve_tag "${1:-}")"
      ;;
    deploy-existing)
      [[ $# -ge 1 ]] || die "deploy-existing requires an image tag"
      deploy_existing_cmd "$1"
      ;;
    release)
      release_cmd "$(resolve_tag "${1:-}")"
      ;;
    list-remote-images)
      list_remote_images_cmd
      ;;
    status)
      status_cmd
      ;;
    rollback)
      [[ $# -ge 1 ]] || die "rollback requires an image tag"
      deploy_existing_cmd "$1"
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      die "unknown command: ${cmd}"
      ;;
  esac
}

main "$@"
