#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/deploy/lab/runtime/wsl"
PID_FILE="${RUNTIME_DIR}/new-api.pid"
SESSION_FILE="${RUNTIME_DIR}/session.env"
REDIS_PID_FILE="${RUNTIME_DIR}/redis/redis.pid"
MOCK_PID_FILE="${RUNTIME_DIR}/mock-openai.pid"
LOG_FILE="${RUNTIME_DIR}/lab-start.log"
MOCK_LOG_FILE="${RUNTIME_DIR}/mock-openai.log"
APP_PORT_DEFAULT=3000
REDIS_PORT_DEFAULT=6380
MOCK_PORT_DEFAULT=8080
ENV_APP_PORT="${PORT-}"
ENV_REDIS_PORT="${REDIS_PORT-}"
ENV_MOCK_PORT="${MOCK_PORT-}"

find_app_pid() {
  pgrep -fo "${RUNTIME_DIR}/new-api --log-dir ${RUNTIME_DIR}/logs" || true
}

if [[ -f "${SESSION_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${SESSION_FILE}"
fi

APP_PORT="${ENV_APP_PORT:-${LAB_APP_PORT:-${APP_PORT_DEFAULT}}}"
REDIS_PORT="${ENV_REDIS_PORT:-${LAB_REDIS_PORT:-${REDIS_PORT_DEFAULT}}}"
MOCK_PORT="${ENV_MOCK_PORT:-${MOCK_PORT_DEFAULT}}"

echo "WSL lab runtime: ${RUNTIME_DIR}"
echo "App port: ${APP_PORT}"
echo "Redis port: ${REDIS_PORT}"
echo "Mock port: ${MOCK_PORT}"
echo "Log file: ${LOG_FILE}"
echo "Mock log file: ${MOCK_LOG_FILE}"

echo
echo "Process status:"

if [[ -f "${PID_FILE}" ]]; then
  app_pid="$(tr -d '\r\n' < "${PID_FILE}")"
  if [[ -n "${app_pid}" ]] && kill -0 "${app_pid}" 2>/dev/null; then
    echo "  new-api: running (pid ${app_pid})"
  else
    detected_pid="$(find_app_pid)"
    if [[ -n "${detected_pid}" ]]; then
      echo "${detected_pid}" > "${PID_FILE}"
      echo "  new-api: running (pid ${detected_pid})"
    else
      echo "  new-api: pid file exists but process is not running"
    fi
  fi
else
  detected_pid="$(find_app_pid)"
  if [[ -n "${detected_pid}" ]]; then
    echo "${detected_pid}" > "${PID_FILE}"
    echo "  new-api: running (pid ${detected_pid})"
  else
    echo "  new-api: not running"
  fi
fi

if [[ -f "${REDIS_PID_FILE}" ]]; then
  redis_pid="$(tr -d '\r\n' < "${REDIS_PID_FILE}")"
  if [[ -n "${redis_pid}" ]] && kill -0 "${redis_pid}" 2>/dev/null; then
    echo "  redis: running (pid ${redis_pid})"
  else
    echo "  redis: pid file exists but process is not running"
  fi
else
  echo "  redis: not running"
fi

if [[ -f "${MOCK_PID_FILE}" ]]; then
  mock_pid="$(tr -d '\r\n' < "${MOCK_PID_FILE}")"
  if [[ -n "${mock_pid}" ]] && kill -0 "${mock_pid}" 2>/dev/null; then
    echo "  mock-openai: running (pid ${mock_pid})"
  else
    echo "  mock-openai: pid file exists but process is not running"
  fi
else
  echo "  mock-openai: not running"
fi

echo
echo "Health checks:"

if curl -fsS "http://127.0.0.1:${APP_PORT}/api/status" >/dev/null 2>&1; then
  echo "  api: healthy at http://127.0.0.1:${APP_PORT}/api/status"
else
  echo "  api: unavailable at http://127.0.0.1:${APP_PORT}/api/status"
fi

if command -v redis-cli >/dev/null 2>&1 && redis-cli -p "${REDIS_PORT}" ping >/dev/null 2>&1; then
  echo "  redis: PONG on port ${REDIS_PORT}"
else
  echo "  redis: unavailable on port ${REDIS_PORT}"
fi

if curl -fsS "http://127.0.0.1:${MOCK_PORT}/healthz" >/dev/null 2>&1; then
  echo "  mock-openai: healthy at http://127.0.0.1:${MOCK_PORT}/healthz"
else
  echo "  mock-openai: unavailable at http://127.0.0.1:${MOCK_PORT}/healthz"
fi

if command -v hostname >/dev/null 2>&1; then
  echo
  echo "WSL IPs:"
  hostname -I 2>/dev/null || true
fi
