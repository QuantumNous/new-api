#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/deploy/lab/runtime/wsl"
REDIS_DIR="${RUNTIME_DIR}/redis"
LOG_DIR="${RUNTIME_DIR}/logs"
BIN_PATH="${RUNTIME_DIR}/new-api"
REDIS_PORT="${REDIS_PORT:-6380}"
APP_PORT="${PORT:-3000}"
SESSION_SECRET="${SESSION_SECRET:-wsl-lab-secret-change-me}"
TZ_VALUE="${TZ:-Asia/Shanghai}"
SQLITE_FILE="${SQLITE_FILE:-${RUNTIME_DIR}/new-api.db}"
SQLITE_PATH_VALUE="${SQLITE_FILE}?_busy_timeout=30000"
REDIS_CONN_STRING_VALUE="${REDIS_CONN_STRING:-redis://127.0.0.1:${REDIS_PORT}/0}"
BUILD_VERSION="${VITE_REACT_APP_VERSION:-dev-wsl}"
NODE_OPTIONS_VALUE="${NODE_OPTIONS:---max-old-space-size=4096}"
REDIS_PID_FILE="${REDIS_DIR}/redis.pid"
REDIS_LOG_FILE="${LOG_DIR}/redis.log"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

for cmd in go bun redis-server; do
  require_cmd "$cmd"
done

mkdir -p "${RUNTIME_DIR}" "${REDIS_DIR}" "${LOG_DIR}"

echo "Building frontend..."
pushd "${ROOT_DIR}/web" >/dev/null
if [[ ! -d node_modules ]]; then
  bun install
fi
DISABLE_ESLINT_PLUGIN='true' NODE_OPTIONS="${NODE_OPTIONS_VALUE}" VITE_REACT_APP_VERSION="${BUILD_VERSION}" bun run build
popd >/dev/null

echo "Building backend..."
pushd "${ROOT_DIR}" >/dev/null
go build -o "${BIN_PATH}" .
popd >/dev/null

if [[ -f "${REDIS_PID_FILE}" ]] && kill -0 "$(cat "${REDIS_PID_FILE}")" 2>/dev/null; then
  echo "Redis already running on port ${REDIS_PORT}"
else
  echo "Starting Redis on port ${REDIS_PORT}..."
  redis-server \
    --daemonize yes \
    --port "${REDIS_PORT}" \
    --dir "${REDIS_DIR}" \
    --appendonly yes \
    --pidfile "${REDIS_PID_FILE}" \
    --logfile "${REDIS_LOG_FILE}"
fi

export PORT="${APP_PORT}"
export SQLITE_PATH="${SQLITE_PATH_VALUE}"
export REDIS_CONN_STRING="${REDIS_CONN_STRING_VALUE}"
export SESSION_SECRET="${SESSION_SECRET}"
export TZ="${TZ_VALUE}"
export ERROR_LOG_ENABLED="${ERROR_LOG_ENABLED:-true}"
export BATCH_UPDATE_ENABLED="${BATCH_UPDATE_ENABLED:-true}"

echo "Starting new-api on port ${APP_PORT}..."
echo "SQLite: ${SQLITE_FILE}"
echo "Redis: ${REDIS_CONN_STRING}"
if command -v hostname >/dev/null 2>&1; then
  echo "WSL IPs: $(hostname -I 2>/dev/null || true)"
  echo "If Windows cannot reach localhost:${APP_PORT}, try the first WSL IP above."
fi

exec "${BIN_PATH}" --log-dir "${LOG_DIR}"
