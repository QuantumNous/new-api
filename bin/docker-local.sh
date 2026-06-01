#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

PROJECT_NAME="${PROJECT_NAME:-new-api-local}"
IMAGE_NAME="${IMAGE_NAME:-new-api:local}"
CONTAINER_NAME="${CONTAINER_NAME:-${PROJECT_NAME}-app}"
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-${PROJECT_NAME}-postgres}"
REDIS_CONTAINER_NAME="${REDIS_CONTAINER_NAME:-${PROJECT_NAME}-redis}"
NETWORK_NAME="${NETWORK_NAME:-${PROJECT_NAME}-network}"
POSTGRES_VOLUME="${POSTGRES_VOLUME:-${PROJECT_NAME}-postgres-data}"
REDIS_VOLUME="${REDIS_VOLUME:-${PROJECT_NAME}-redis-data}"
APP_DATA_VOLUME="${APP_DATA_VOLUME:-${PROJECT_NAME}-app-data}"

HOST_PORT="${HOST_PORT:-${PORT:-3000}}"
APP_PORT="${APP_PORT:-3000}"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-}"
REDIS_HOST_PORT="${REDIS_HOST_PORT:-}"
LOCAL_TZ="${TZ:-Asia/Shanghai}"
ENV_FILE="${ENV_FILE:-}"
FOLLOW_LOGS="${FOLLOW_LOGS:-0}"
NO_CACHE="${NO_CACHE:-0}"
PLATFORM="${PLATFORM:-}"
ACTION="${1:-up}"

STATE_DIR="${STATE_DIR:-${ROOT_DIR}/data/docker-local}"
LOG_DIR="${LOG_DIR:-${ROOT_DIR}/logs/docker-local}"
SECRETS_FILE="${SECRETS_FILE:-${STATE_DIR}/.env.generated}"

POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:15-alpine}"
REDIS_IMAGE="${REDIS_IMAGE:-redis:7-alpine}"
POSTGRES_DB="${POSTGRES_DB:-new-api}"
POSTGRES_USER="${POSTGRES_USER:-newapi}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
SESSION_SECRET="${SESSION_SECRET:-}"
CRYPTO_SECRET="${CRYPTO_SECRET:-}"
NODE_NAME="${NODE_NAME:-${PROJECT_NAME}-node-1}"
BUILD_ON_UP="${BUILD_ON_UP:-1}"
if [[ -z "${FRONTEND_THEME+x}" ]]; then
  FRONTEND_THEME="classic"
fi

usage() {
  cat <<'USAGE'
Usage:
  bash bin/docker-local.sh [up|build|run|stop|logs|status|clean|help]

Default action:
  up      Build app image, then start PostgreSQL, Redis, and new-api.

No manual config is required. The script persists generated secrets in:
  ./data/docker-local/.env.generated

Common environment overrides:
  PROJECT_NAME=new-api-local        Prefix for containers/network/volumes
  IMAGE_NAME=new-api:local          Docker image tag for the app
  HOST_PORT=3000                    Host port for new-api
  POSTGRES_HOST_PORT=5432           Optional host port for PostgreSQL
  REDIS_HOST_PORT=6379              Optional host port for Redis
  BUILD_ON_UP=0                     Skip docker build during up
  NO_CACHE=1                        Build without Docker cache
  PLATFORM=linux/amd64              Optional docker build --platform value
  FOLLOW_LOGS=1                     Follow app logs after starting
  ENV_FILE=.env.local               Optional extra env file for the app
  FRONTEND_THEME=default             Frontend theme for local deployment (default|classic; empty to skip)

Advanced overrides:
  POSTGRES_PASSWORD=...             Override generated PostgreSQL password
  REDIS_PASSWORD=...                Override generated Redis password
  SESSION_SECRET=...                Override generated session secret
  CRYPTO_SECRET=...                 Override generated crypto secret

Examples:
  bash bin/docker-local.sh
  HOST_PORT=3001 bash bin/docker-local.sh up
  BUILD_ON_UP=0 bash bin/docker-local.sh up
  bash bin/docker-local.sh logs
  bash bin/docker-local.sh status
  bash bin/docker-local.sh stop
  bash bin/docker-local.sh clean
USAGE
}

log() {
  printf '\033[1;34m==>\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33mWARN\033[0m %s\n' "$*" >&2
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64
    printf '\n'
  fi
}

quote_env_value() {
  printf "%s" "$1" | sed "s/'/'\\''/g"
}

load_secrets_file() {
  if [[ -f "${SECRETS_FILE}" ]]; then
    # shellcheck disable=SC1090
    source "${SECRETS_FILE}"
  fi
}

save_secrets_file() {
  mkdir -p "${STATE_DIR}"
  umask 077
  cat >"${SECRETS_FILE}" <<EOF
POSTGRES_PASSWORD='$(quote_env_value "${POSTGRES_PASSWORD}")'
REDIS_PASSWORD='$(quote_env_value "${REDIS_PASSWORD}")'
SESSION_SECRET='$(quote_env_value "${SESSION_SECRET}")'
CRYPTO_SECRET='$(quote_env_value "${CRYPTO_SECRET}")'
EOF
}

ensure_secrets() {
  load_secrets_file
  POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(random_secret)}"
  REDIS_PASSWORD="${REDIS_PASSWORD:-$(random_secret)}"
  SESSION_SECRET="${SESSION_SECRET:-$(random_secret)}"
  CRYPTO_SECRET="${CRYPTO_SECRET:-$(random_secret)}"
  save_secrets_file
}

container_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

container_running() {
  [[ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" == "true" ]]
}

remove_container_if_exists() {
  local name="$1"
  if container_exists "${name}"; then
    log "Removing existing container ${name}"
    docker rm -f "${name}" >/dev/null
  fi
}

ensure_network() {
  if ! docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
    log "Creating Docker network ${NETWORK_NAME}"
    docker network create "${NETWORK_NAME}" >/dev/null
  fi
}

build_image() {
  require_cmd docker

  local build_args=()
  if [[ "${NO_CACHE}" == "1" || "${NO_CACHE}" == "true" ]]; then
    build_args+=(--no-cache)
  fi
  if [[ -n "${PLATFORM}" ]]; then
    build_args+=(--platform "${PLATFORM}")
  fi

  log "Building Docker image ${IMAGE_NAME}"
  DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}" docker build \
    "${build_args[@]}" \
    -f "${ROOT_DIR}/Dockerfile" \
    -t "${IMAGE_NAME}" \
    "${ROOT_DIR}"
}

start_postgres() {
  require_cmd docker
  ensure_network
  ensure_secrets

  if container_running "${POSTGRES_CONTAINER_NAME}"; then
    log "PostgreSQL already running: ${POSTGRES_CONTAINER_NAME}"
    return
  fi
  remove_container_if_exists "${POSTGRES_CONTAINER_NAME}"

  local port_args=()
  if [[ -n "${POSTGRES_HOST_PORT}" ]]; then
    port_args=(-p "${POSTGRES_HOST_PORT}:5432")
  fi

  log "Starting PostgreSQL ${POSTGRES_CONTAINER_NAME}"
  docker run -d \
    --name "${POSTGRES_CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${NETWORK_NAME}" \
    "${port_args[@]}" \
    -v "${POSTGRES_VOLUME}:/var/lib/postgresql/data" \
    -e "POSTGRES_DB=${POSTGRES_DB}" \
    -e "POSTGRES_USER=${POSTGRES_USER}" \
    -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}" \
    -e "TZ=${LOCAL_TZ}" \
    "${POSTGRES_IMAGE}" >/dev/null
}

start_redis() {
  require_cmd docker
  ensure_network
  ensure_secrets

  if container_running "${REDIS_CONTAINER_NAME}"; then
    log "Redis already running: ${REDIS_CONTAINER_NAME}"
    return
  fi
  remove_container_if_exists "${REDIS_CONTAINER_NAME}"

  local port_args=()
  if [[ -n "${REDIS_HOST_PORT}" ]]; then
    port_args=(-p "${REDIS_HOST_PORT}:6379")
  fi

  log "Starting Redis ${REDIS_CONTAINER_NAME}"
  docker run -d \
    --name "${REDIS_CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${NETWORK_NAME}" \
    "${port_args[@]}" \
    -v "${REDIS_VOLUME}:/data" \
    -e "TZ=${LOCAL_TZ}" \
    "${REDIS_IMAGE}" \
    redis-server --appendonly yes --requirepass "${REDIS_PASSWORD}" >/dev/null
}

wait_for_postgres() {
  log "Waiting for PostgreSQL"
  local i
  for i in {1..60}; do
    if docker exec "${POSTGRES_CONTAINER_NAME}" pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  echo "PostgreSQL did not become ready in time" >&2
  docker logs "${POSTGRES_CONTAINER_NAME}" >&2 || true
  exit 1
}

wait_for_redis() {
  log "Waiting for Redis"
  local i
  for i in {1..60}; do
    if docker exec "${REDIS_CONTAINER_NAME}" redis-cli -a "${REDIS_PASSWORD}" ping >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  echo "Redis did not become ready in time" >&2
  docker logs "${REDIS_CONTAINER_NAME}" >&2 || true
  exit 1
}

wait_for_options_table() {
  local i
  for i in {1..60}; do
    if docker exec "${POSTGRES_CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -tAc "SELECT to_regclass('public.options') IS NOT NULL" 2>/dev/null | grep -q "t"; then
      return
    fi
    sleep 1
  done
  echo "options table did not become ready in time" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  exit 1
}

apply_frontend_theme() {
  if [[ -z "${FRONTEND_THEME}" ]]; then
    return
  fi
  if [[ "${FRONTEND_THEME}" != "default" && "${FRONTEND_THEME}" != "classic" ]]; then
    echo "Invalid FRONTEND_THEME: ${FRONTEND_THEME} (use default|classic, or empty to skip)" >&2
    exit 1
  fi

  log "Setting frontend theme to ${FRONTEND_THEME}"
  wait_for_options_table
  docker exec "${POSTGRES_CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 -c \
    "INSERT INTO options (\"key\", \"value\") VALUES ('theme.frontend','${FRONTEND_THEME}') ON CONFLICT (\"key\") DO UPDATE SET \"value\" = EXCLUDED.\"value\";" >/dev/null

  log "Restarting app to apply frontend theme"
  docker restart "${CONTAINER_NAME}" >/dev/null
}

run_container() {
  require_cmd docker
  ensure_network
  ensure_secrets
  start_postgres
  start_redis
  wait_for_postgres
  wait_for_redis
  mkdir -p "${LOG_DIR}"

  remove_container_if_exists "${CONTAINER_NAME}"

  local sql_dsn="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_CONTAINER_NAME}:5432/${POSTGRES_DB}"
  local redis_dsn="redis://:${REDIS_PASSWORD}@${REDIS_CONTAINER_NAME}:6379/0"
  local env_args=(
    -e "TZ=${LOCAL_TZ}"
    -e "PORT=${APP_PORT}"
    -e "SQL_DSN=${SQL_DSN:-${sql_dsn}}"
    -e "REDIS_CONN_STRING=${REDIS_CONN_STRING:-${redis_dsn}}"
    -e "SESSION_SECRET=${SESSION_SECRET}"
    -e "CRYPTO_SECRET=${CRYPTO_SECRET}"
    -e "ERROR_LOG_ENABLED=${ERROR_LOG_ENABLED:-true}"
    -e "BATCH_UPDATE_ENABLED=${BATCH_UPDATE_ENABLED:-true}"
    -e "MEMORY_CACHE_ENABLED=${MEMORY_CACHE_ENABLED:-true}"
    -e "SYNC_FREQUENCY=${SYNC_FREQUENCY:-60}"
    -e "NODE_NAME=${NODE_NAME}"
  )

  local pass_env_vars=(
    LOG_SQL_DSN
    RELAY_TIMEOUT
    STREAMING_TIMEOUT
    CHANNEL_UPDATE_FREQUENCY
    GENERATE_DEFAULT_TOKEN
    FRONTEND_BASE_URL
    TRUSTED_REDIRECT_DOMAINS
  )
  local name
  for name in "${pass_env_vars[@]}"; do
    if [[ -n "${!name:-}" ]]; then
      env_args+=(-e "${name}=${!name}")
    fi
  done

  if [[ -n "${ENV_FILE}" ]]; then
    if [[ ! -f "${ENV_FILE}" ]]; then
      echo "ENV_FILE does not exist: ${ENV_FILE}" >&2
      exit 1
    fi
    env_args+=(--env-file "${ENV_FILE}")
  fi

  log "Starting app ${CONTAINER_NAME} on http://localhost:${HOST_PORT}"
  docker run -d \
    --name "${CONTAINER_NAME}" \
    --restart unless-stopped \
    --network "${NETWORK_NAME}" \
    -p "${HOST_PORT}:${APP_PORT}" \
    -v "${APP_DATA_VOLUME}:/data" \
    -v "${LOG_DIR}:/app/logs" \
    "${env_args[@]}" \
    "${IMAGE_NAME}" \
    --log-dir /app/logs >/dev/null

  apply_frontend_theme

  log "Secrets file: ${SECRETS_FILE}"
  log "PostgreSQL volume: ${POSTGRES_VOLUME}"
  log "Redis volume: ${REDIS_VOLUME}"
  log "App data volume: ${APP_DATA_VOLUME}"
  log "Logs dir: ${LOG_DIR}"
  log "Open: http://localhost:${HOST_PORT}"

  if [[ "${FOLLOW_LOGS}" == "1" || "${FOLLOW_LOGS}" == "true" ]]; then
    docker logs -f "${CONTAINER_NAME}"
  fi
}

stop_container() {
  require_cmd docker
  remove_container_if_exists "${CONTAINER_NAME}"
  remove_container_if_exists "${REDIS_CONTAINER_NAME}"
  remove_container_if_exists "${POSTGRES_CONTAINER_NAME}"
}

show_logs() {
  require_cmd docker
  local target="${2:-app}"
  case "${target}" in
    app) docker logs -f "${CONTAINER_NAME}" ;;
    postgres|pg) docker logs -f "${POSTGRES_CONTAINER_NAME}" ;;
    redis) docker logs -f "${REDIS_CONTAINER_NAME}" ;;
    *) echo "Unknown logs target: ${target} (use app|postgres|redis)" >&2; exit 1 ;;
  esac
}

show_status() {
  require_cmd docker
  docker ps -a \
    --filter "name=^/${CONTAINER_NAME}$" \
    --filter "name=^/${POSTGRES_CONTAINER_NAME}$" \
    --filter "name=^/${REDIS_CONTAINER_NAME}$"
}

clean_all() {
  stop_container
  log "Removing image ${IMAGE_NAME} if it exists"
  docker image rm "${IMAGE_NAME}" >/dev/null 2>&1 || true

  if [[ "${KEEP_VOLUMES:-1}" == "0" || "${KEEP_VOLUMES:-1}" == "false" ]]; then
    warn "Removing persistent volumes and generated secrets"
    docker volume rm "${POSTGRES_VOLUME}" "${REDIS_VOLUME}" "${APP_DATA_VOLUME}" >/dev/null 2>&1 || true
    rm -f "${SECRETS_FILE}"
  else
    log "Keeping volumes. Set KEEP_VOLUMES=0 bash bin/docker-local.sh clean to remove them."
  fi
}

case "${ACTION}" in
  up)
    if [[ "${BUILD_ON_UP}" == "1" || "${BUILD_ON_UP}" == "true" ]]; then
      build_image
    fi
    run_container
    ;;
  build)
    build_image
    ;;
  run)
    run_container
    ;;
  stop)
    stop_container
    ;;
  logs)
    show_logs "$@"
    ;;
  status)
    show_status
    ;;
  clean)
    clean_all
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    echo "Unknown action: ${ACTION}" >&2
    usage
    exit 1
    ;;
esac
