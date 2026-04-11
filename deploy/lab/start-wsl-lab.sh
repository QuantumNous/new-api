#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/deploy/lab/runtime/wsl"
LOG_FILE="${RUNTIME_DIR}/lab-start.log"
PID_FILE="${RUNTIME_DIR}/new-api.pid"
SESSION_FILE="${RUNTIME_DIR}/session.env"
START_TIMEOUT_SECONDS="${START_TIMEOUT_SECONDS:-300}"

LAB_APP_PORT_DEFAULT=3000
LAB_REDIS_PORT_DEFAULT=6380

if [[ -f "${SESSION_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${SESSION_FILE}"
fi

APP_PORT="${PORT:-${LAB_APP_PORT:-${APP_PORT:-${LAB_APP_PORT_DEFAULT}}}}"
REDIS_PORT="${REDIS_PORT:-${LAB_REDIS_PORT:-${REDIS_PORT:-${LAB_REDIS_PORT_DEFAULT}}}}"

find_app_pid() {
  pgrep -fo "${RUNTIME_DIR}/new-api --log-dir ${RUNTIME_DIR}/logs" || true
}

mkdir -p "${RUNTIME_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  existing_pid="$(tr -d '\r\n' < "${PID_FILE}")"
  if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" 2>/dev/null; then
    echo "new-api lab is already running with pid ${existing_pid}"
    exit 0
  fi
fi

cat > "${SESSION_FILE}" <<EOF
LAB_APP_PORT=${APP_PORT}
LAB_REDIS_PORT=${REDIS_PORT}
EOF

: > "${LOG_FILE}"
nohup env PORT="${APP_PORT}" REDIS_PORT="${REDIS_PORT}" "${ROOT_DIR}/deploy/lab/run-wsl-lab.sh" > "${LOG_FILE}" 2>&1 &
app_pid=$!
echo "${app_pid}" > "${PID_FILE}"

echo "Started WSL lab with pid ${app_pid}"
echo "Waiting for health check on http://127.0.0.1:${APP_PORT}/api/status ..."

deadline=$((SECONDS + START_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}/api/status" >/dev/null 2>&1; then
    resolved_pid="$(find_app_pid)"
    if [[ -n "${resolved_pid}" ]]; then
      echo "${resolved_pid}" > "${PID_FILE}"
    fi
    echo "WSL lab is healthy."
    exit 0
  fi

  if ! kill -0 "${app_pid}" 2>/dev/null; then
    echo "WSL lab exited before becoming healthy." >&2
    tail -n 80 "${LOG_FILE}" || true
    exit 1
  fi

  sleep 2
done

echo "Timed out waiting for WSL lab health check." >&2
tail -n 80 "${LOG_FILE}" || true
exit 1
