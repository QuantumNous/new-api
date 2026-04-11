#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/deploy/lab/runtime/wsl"
PID_FILE="${RUNTIME_DIR}/new-api.pid"
SESSION_FILE="${RUNTIME_DIR}/session.env"
REDIS_PID_FILE="${RUNTIME_DIR}/redis/redis.pid"
MOCK_PID_FILE="${RUNTIME_DIR}/mock-openai.pid"
APP_PID_PATTERN="${RUNTIME_DIR}/new-api --log-dir ${RUNTIME_DIR}/logs"
REDIS_PORT_DEFAULT=6380
REDIS_FALLBACK_ENABLED=false

if [[ -f "${SESSION_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${SESSION_FILE}"
  REDIS_FALLBACK_ENABLED=true
fi

if [[ -n "${REDIS_PORT:-}" ]]; then
  REDIS_FALLBACK_ENABLED=true
fi

if [[ "${REDIS_FALLBACK_ENABLED}" == true ]]; then
  REDIS_PORT="${REDIS_PORT:-${LAB_REDIS_PORT:-${REDIS_PORT_DEFAULT}}}"
fi

find_app_pid() {
	pgrep -fo "${APP_PID_PATTERN}" || true
}

find_redis_pid() {
	pgrep -fo "redis-server .*:${REDIS_PORT}" || true
}

stop_pid_file() {
	local label="$1"
	local pid_file="$2"

  if [[ ! -f "${pid_file}" ]]; then
    echo "${label}: not running"
    return 0
  fi

  local pid
  pid="$(tr -d '\r\n' < "${pid_file}")"
  if [[ -z "${pid}" ]]; then
    rm -f "${pid_file}"
    echo "${label}: empty pid file removed"
    return 0
  fi

  if ! kill -0 "${pid}" 2>/dev/null; then
    rm -f "${pid_file}"
    echo "${label}: stale pid file removed"
    return 0
  fi

  kill "${pid}" 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! kill -0 "${pid}" 2>/dev/null; then
      rm -f "${pid_file}"
      echo "${label}: stopped"
      return 0
    fi
    sleep 1
  done

  kill -9 "${pid}" 2>/dev/null || true
  rm -f "${pid_file}"
  echo "${label}: force stopped"
}

stop_pid_file "new-api" "${PID_FILE}"
stop_pid_file "redis" "${REDIS_PID_FILE}"
stop_pid_file "mock-openai" "${MOCK_PID_FILE}"

fallback_app_pid="$(find_app_pid)"
if [[ -n "${fallback_app_pid}" ]]; then
	kill "${fallback_app_pid}" 2>/dev/null || true
	echo "new-api: stopped fallback pid ${fallback_app_pid}"
fi

if [[ "${REDIS_FALLBACK_ENABLED}" == true ]]; then
	fallback_redis_pid="$(find_redis_pid)"
	if [[ -n "${fallback_redis_pid}" ]]; then
		kill "${fallback_redis_pid}" 2>/dev/null || true
		for _ in $(seq 1 20); do
			if ! kill -0 "${fallback_redis_pid}" 2>/dev/null; then
				echo "redis: stopped fallback pid ${fallback_redis_pid}"
				exit 0
			fi
			sleep 1
		done
		kill -9 "${fallback_redis_pid}" 2>/dev/null || true
		echo "redis: force stopped fallback pid ${fallback_redis_pid}"
	fi
fi
