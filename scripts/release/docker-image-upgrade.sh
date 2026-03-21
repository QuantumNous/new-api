#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEPLOY_DIR=$(cd "${DEPLOY_DIR:-$PWD}" && pwd)
BASE_COMPOSE_FILE=${BASE_COMPOSE_FILE:-docker-compose.yml}
RELEASE_OVERRIDE_FILE=${RELEASE_OVERRIDE_FILE:-docker-compose.release.yml}
STATE_DIR=${STATE_DIR:-.upgrade-state}
BACKUP_DIR=${BACKUP_DIR:-.upgrade-backups}
IMAGE_REPOSITORY=${IMAGE_REPOSITORY:-calciumion/new-api}
APP_SERVICE=${APP_SERVICE:-new-api}
STATUS_URL=${STATUS_URL:-http://127.0.0.1:3000/api/status}
MIN_FREE_MB=${MIN_FREE_MB:-1024}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-180}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-5}
AUTO_ROLLBACK=${AUTO_ROLLBACK:-1}
ENV_FILE=${ENV_FILE:-}

COMMAND=${1:-}
if [[ $# -gt 0 ]]; then
  shift
fi

TARGET_TAG=""
ROLLBACK_TAG=""

usage() {
  cat <<'EOF'
Usage:
  docker-image-upgrade.sh status
  docker-image-upgrade.sh upgrade --tag <image-tag>
  docker-image-upgrade.sh rollback [--tag <image-tag>]

Environment overrides:
  DEPLOY_DIR               Deployment directory, default current working directory
  BASE_COMPOSE_FILE        Base compose file, default docker-compose.yml
  RELEASE_OVERRIDE_FILE    Generated override compose file, default docker-compose.release.yml
  IMAGE_REPOSITORY         Image repository, default calciumion/new-api
  APP_SERVICE              App service name, default new-api
  STATUS_URL               Health check URL, default http://127.0.0.1:3000/api/status
  MIN_FREE_MB              Minimum required disk space in MB, default 1024
  HEALTH_TIMEOUT           Health check timeout in seconds, default 180
  HEALTH_INTERVAL          Health check polling interval in seconds, default 5
  AUTO_ROLLBACK            Auto rollback on failed health check, default 1
  ENV_FILE                 Optional env file to back up together with compose files
EOF
}

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

detect_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD=(docker compose)
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD=(docker-compose)
    return
  fi
  fail "docker compose is not available"
}

compose() {
  (
    cd "$DEPLOY_DIR"
    "${COMPOSE_CMD[@]}" -f "$BASE_COMPOSE_FILE" -f "$RELEASE_OVERRIDE_FILE" "$@"
  )
}

service_exists() {
  local service="$1"
  (
    cd "$DEPLOY_DIR"
    "${COMPOSE_CMD[@]}" -f "$BASE_COMPOSE_FILE" config --services
  ) | grep -Fxq "$service"
}

get_container_id() {
  compose ps -q "$APP_SERVICE" 2>/dev/null | head -n 1
}

get_service_container_id() {
  local service="$1"
  compose ps -q "$service" 2>/dev/null | head -n 1
}

get_current_image_ref() {
  local container_id
  container_id=$(get_container_id || true)
  if [[ -z "$container_id" ]]; then
    return 0
  fi
  docker inspect --format '{{.Config.Image}}' "$container_id"
}

get_current_tag() {
  local image_ref
  image_ref=$(get_current_image_ref || true)
  if [[ -z "$image_ref" ]]; then
    return 0
  fi
  if [[ "$image_ref" == *:* ]]; then
    printf '%s\n' "${image_ref##*:}"
    return 0
  fi
  printf 'latest\n'
}

get_override_tag() {
  local override_file="$DEPLOY_DIR/$RELEASE_OVERRIDE_FILE"
  if [[ ! -f "$override_file" ]]; then
    return 0
  fi
  awk '/image:[[:space:]]/ { print $2; exit }' "$override_file" | awk -F: '{print $NF}'
}

get_service_state() {
  local container_id
  container_id=$(get_container_id || true)
  if [[ -z "$container_id" ]]; then
    printf 'not-created\n'
    return 0
  fi
  docker inspect --format '{{.State.Status}}' "$container_id"
}

read_state_var() {
  local key="$1"
  local state_file="$DEPLOY_DIR/$STATE_DIR/current.env"
  if [[ ! -f "$state_file" ]]; then
    return 0
  fi
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, "", $0); print $0; exit }' "$state_file"
}

write_state_file() {
  local phase="$1"
  local previous_tag="$2"
  local target_tag="$3"
  local backup_path="$4"

  mkdir -p "$DEPLOY_DIR/$STATE_DIR"
  cat >"$DEPLOY_DIR/$STATE_DIR/current.env" <<EOF
LAST_COMMAND=$COMMAND
LAST_PHASE=$phase
LAST_RUN_AT=$(date -u +%FT%TZ)
PREVIOUS_TAG=$previous_tag
TARGET_TAG=$target_tag
CURRENT_TAG=$(get_current_tag)
BACKUP_PATH=$backup_path
STATUS_URL=$STATUS_URL
APP_SERVICE=$APP_SERVICE
IMAGE_REPOSITORY=$IMAGE_REPOSITORY
EOF
}

write_override_file() {
  local tag="$1"
  cat >"$DEPLOY_DIR/$RELEASE_OVERRIDE_FILE" <<EOF
services:
  $APP_SERVICE:
    image: $IMAGE_REPOSITORY:$tag
EOF
}

backup_files() {
  local timestamp="$1"
  local backup_path="$DEPLOY_DIR/$BACKUP_DIR/$timestamp"
  mkdir -p "$backup_path"
  cp -a "$DEPLOY_DIR/$BASE_COMPOSE_FILE" "$backup_path/"
  if [[ -f "$DEPLOY_DIR/$RELEASE_OVERRIDE_FILE" ]]; then
    cp -a "$DEPLOY_DIR/$RELEASE_OVERRIDE_FILE" "$backup_path/"
  fi
  if [[ -n "$ENV_FILE" && -f "$DEPLOY_DIR/$ENV_FILE" ]]; then
    cp -a "$DEPLOY_DIR/$ENV_FILE" "$backup_path/"
  fi
  printf '%s\n' "$backup_path"
}

precheck_config() {
  [[ -f "$DEPLOY_DIR/$BASE_COMPOSE_FILE" ]] || fail "compose file not found: $DEPLOY_DIR/$BASE_COMPOSE_FILE"
  mkdir -p "$DEPLOY_DIR/$STATE_DIR" "$DEPLOY_DIR/$BACKUP_DIR"
  if [[ ! -f "$DEPLOY_DIR/$RELEASE_OVERRIDE_FILE" ]]; then
    local seed_tag
    seed_tag=$(get_current_tag || true)
    if [[ -z "$seed_tag" ]]; then
      seed_tag=$(get_override_tag || true)
    fi
    if [[ -z "$seed_tag" ]]; then
      seed_tag="latest"
    fi
    write_override_file "$seed_tag"
  fi
  (
    cd "$DEPLOY_DIR"
    "${COMPOSE_CMD[@]}" -f "$BASE_COMPOSE_FILE" -f "$RELEASE_OVERRIDE_FILE" config -q
  )
}

precheck_disk() {
  local avail_kb avail_mb
  avail_kb=$(df -Pk "$DEPLOY_DIR" | awk 'NR==2 {print $4}')
  avail_mb=$((avail_kb / 1024))
  if (( avail_mb < MIN_FREE_MB )); then
    fail "insufficient disk space: ${avail_mb}MB available, require at least ${MIN_FREE_MB}MB"
  fi
  log "disk check passed: ${avail_mb}MB available"
}

precheck_runtime() {
  local app_state
  app_state=$(get_service_state)
  log "current app state: $app_state"
  if [[ "$app_state" != "running" && "$app_state" != "not-created" && "$app_state" != "exited" ]]; then
    fail "unexpected app container state: $app_state"
  fi
}

precheck_redis() {
  if ! service_exists redis; then
    log "redis service not defined in compose, skip redis precheck"
    return 0
  fi
  local redis_container_id
  redis_container_id=$(get_service_container_id redis || true)
  [[ -n "$redis_container_id" ]] || fail "redis service exists but container has not been created"
  [[ "$(docker inspect --format '{{.State.Status}}' "$redis_container_id")" == "running" ]] || fail "redis service is not running"
  compose exec -T redis redis-cli ping | grep -q '^PONG$' || fail "redis connectivity check failed"
  log "redis check passed"
}

precheck_postgres() {
  if ! service_exists postgres; then
    log "postgres service not defined in compose, skip postgres precheck"
    return 0
  fi
  local postgres_container_id
  postgres_container_id=$(get_service_container_id postgres || true)
  [[ -n "$postgres_container_id" ]] || fail "postgres service exists but container has not been created"
  [[ "$(docker inspect --format '{{.State.Status}}' "$postgres_container_id")" == "running" ]] || fail "postgres service is not running"
  local pg_user pg_db
  pg_user=$(compose exec -T postgres sh -lc 'printf "%s" "${POSTGRES_USER:-postgres}"')
  pg_db=$(compose exec -T postgres sh -lc 'printf "%s" "${POSTGRES_DB:-postgres}"')
  compose exec -T postgres pg_isready -U "$pg_user" -d "$pg_db" >/dev/null || fail "postgres connectivity check failed"
  log "postgres check passed"
}

precheck_mysql() {
  if ! service_exists mysql; then
    log "mysql service not defined in compose, skip mysql precheck"
    return 0
  fi
  local mysql_container_id
  mysql_container_id=$(get_service_container_id mysql || true)
  [[ -n "$mysql_container_id" ]] || fail "mysql service exists but container has not been created"
  [[ "$(docker inspect --format '{{.State.Status}}' "$mysql_container_id")" == "running" ]] || fail "mysql service is not running"
  local mysql_password
  mysql_password=$(compose exec -T mysql sh -lc 'printf "%s" "${MYSQL_ROOT_PASSWORD:-}"')
  [[ -n "$mysql_password" ]] || fail "mysql service exists but MYSQL_ROOT_PASSWORD is empty"
  compose exec -T mysql mysqladmin ping -h 127.0.0.1 -uroot "-p$mysql_password" >/dev/null || fail "mysql connectivity check failed"
  log "mysql check passed"
}

precheck_all() {
  require_command docker
  require_command awk
  require_command curl
  require_command cp
  require_command df
  detect_compose_cmd
  precheck_config
  precheck_disk
  precheck_runtime
  precheck_postgres
  precheck_mysql
  precheck_redis
}

health_check() {
  local deadline
  deadline=$((SECONDS + HEALTH_TIMEOUT))
  while (( SECONDS < deadline )); do
    if curl --silent --show-error --fail "$STATUS_URL" | grep -Eq '"success"[[:space:]]*:[[:space:]]*true'; then
      log "health check passed: $STATUS_URL"
      return 0
    fi
    sleep "$HEALTH_INTERVAL"
  done
  return 1
}

perform_rollout() {
  local target_tag="$1"
  log "pulling image $IMAGE_REPOSITORY:$target_tag"
  write_override_file "$target_tag"
  compose pull "$APP_SERVICE"
  log "restarting service $APP_SERVICE"
  compose up -d --no-deps "$APP_SERVICE"
}

rollback_internal() {
  local rollback_tag="$1"
  [[ -n "$rollback_tag" ]] || fail "rollback tag is empty"
  log "rolling back to tag: $rollback_tag"
  perform_rollout "$rollback_tag"
  health_check || fail "rollback health check failed"
}

run_upgrade() {
  [[ -n "$TARGET_TAG" ]] || fail "upgrade requires --tag"
  precheck_all

  local previous_tag backup_path timestamp
  previous_tag=$(get_current_tag || true)
  timestamp=$(date +%Y%m%d-%H%M%S)
  backup_path=$(backup_files "$timestamp")

  write_state_file "upgrade-started" "$previous_tag" "$TARGET_TAG" "$backup_path"
  perform_rollout "$TARGET_TAG"

  if health_check; then
    write_state_file "upgrade-succeeded" "$previous_tag" "$TARGET_TAG" "$backup_path"
    log "upgrade completed: $previous_tag -> $TARGET_TAG"
    return 0
  fi

  write_state_file "upgrade-healthcheck-failed" "$previous_tag" "$TARGET_TAG" "$backup_path"
  log "health check failed after upgrade to $TARGET_TAG"

  if [[ "$AUTO_ROLLBACK" == "1" && -n "$previous_tag" && "$previous_tag" != "$TARGET_TAG" ]]; then
    log "auto rollback enabled, attempting rollback to $previous_tag"
    rollback_internal "$previous_tag"
    write_state_file "upgrade-rolled-back" "$previous_tag" "$TARGET_TAG" "$backup_path"
  fi

  fail "upgrade failed"
}

run_rollback() {
  precheck_all
  if [[ -z "$ROLLBACK_TAG" ]]; then
    ROLLBACK_TAG=$(read_state_var PREVIOUS_TAG || true)
  fi
  [[ -n "$ROLLBACK_TAG" ]] || fail "rollback tag not provided and no PREVIOUS_TAG found in $STATE_DIR/current.env"

  local previous_tag backup_path timestamp
  previous_tag=$(get_current_tag || true)
  timestamp=$(date +%Y%m%d-%H%M%S)
  backup_path=$(backup_files "$timestamp")

  write_state_file "rollback-started" "$previous_tag" "$ROLLBACK_TAG" "$backup_path"
  rollback_internal "$ROLLBACK_TAG"
  write_state_file "rollback-succeeded" "$previous_tag" "$ROLLBACK_TAG" "$backup_path"
  log "rollback completed: $previous_tag -> $ROLLBACK_TAG"
}

print_status() {
  precheck_all
  cat <<EOF
deploy_dir=$DEPLOY_DIR
compose_file=$BASE_COMPOSE_FILE
override_file=$RELEASE_OVERRIDE_FILE
image_repository=$IMAGE_REPOSITORY
app_service=$APP_SERVICE
status_url=$STATUS_URL
current_state=$(get_service_state)
current_image=$(get_current_image_ref)
current_tag=$(get_current_tag)
last_phase=$(read_state_var LAST_PHASE)
last_run_at=$(read_state_var LAST_RUN_AT)
last_previous_tag=$(read_state_var PREVIOUS_TAG)
last_target_tag=$(read_state_var TARGET_TAG)
last_backup_path=$(read_state_var BACKUP_PATH)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      [[ $# -ge 2 ]] || fail "--tag requires a value"
      if [[ "$COMMAND" == "rollback" ]]; then
        ROLLBACK_TAG="$2"
      else
        TARGET_TAG="$2"
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

case "$COMMAND" in
  status)
    print_status
    ;;
  upgrade)
    run_upgrade
    ;;
  rollback)
    run_rollback
    ;;
  *)
    usage
    exit 1
    ;;
esac
