#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_SCRIPT="${ROOT_DIR}/deploy/lab/stop-wsl-lab.sh"
TMP_DIR="$(mktemp -d)"
TEST_ROOT="${TMP_DIR}/workspace"
RUNTIME_DIR="${TEST_ROOT}/deploy/lab/runtime/wsl"
ORPHAN_PID_FILE="${TMP_DIR}/orphan-redis.pid"
ORPHAN_LOG_FILE="${TMP_DIR}/orphan-redis.log"
ORPHAN_DATA_DIR="${TMP_DIR}/orphan-redis"
OUTPUT_FILE="${TMP_DIR}/stop-output.txt"

cleanup() {
  if [[ -f "${ORPHAN_PID_FILE}" ]]; then
    orphan_pid="$(tr -d '\r\n' < "${ORPHAN_PID_FILE}")"
    if [[ -n "${orphan_pid}" ]] && kill -0 "${orphan_pid}" 2>/dev/null; then
      kill "${orphan_pid}" 2>/dev/null || true
      sleep 1
      kill -9 "${orphan_pid}" 2>/dev/null || true
    fi
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

find_free_port() {
  local port
  while true; do
    port="$((20000 + RANDOM % 20000))"
    if ! ss -ltn "sport = :${port}" | grep -q ":${port}"; then
      echo "${port}"
      return 0
    fi
  done
}

wait_for_redis() {
  local port="$1"
  for _ in $(seq 1 20); do
    if redis-cli -p "${port}" PING >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

REDIS_PORT="$(find_free_port)"

mkdir -p "${TEST_ROOT}/deploy/lab" "${RUNTIME_DIR}/redis" "${ORPHAN_DATA_DIR}"
cp "${SOURCE_SCRIPT}" "${TEST_ROOT}/deploy/lab/stop-wsl-lab.sh"
chmod +x "${TEST_ROOT}/deploy/lab/stop-wsl-lab.sh"

cat > "${RUNTIME_DIR}/session.env" <<EOF
LAB_APP_PORT=39999
LAB_REDIS_PORT=${REDIS_PORT}
EOF

redis-server \
  --daemonize yes \
  --port "${REDIS_PORT}" \
  --dir "${ORPHAN_DATA_DIR}" \
  --pidfile "${ORPHAN_PID_FILE}" \
  --logfile "${ORPHAN_LOG_FILE}" \
  --save "" \
  --appendonly no

if ! wait_for_redis "${REDIS_PORT}"; then
  echo "failed to start orphan redis on port ${REDIS_PORT}" >&2
  exit 1
fi

"${TEST_ROOT}/deploy/lab/stop-wsl-lab.sh" >"${OUTPUT_FILE}" 2>&1

if redis-cli -p "${REDIS_PORT}" PING >/dev/null 2>&1; then
  echo "expected stop-wsl-lab.sh to stop fallback redis on port ${REDIS_PORT}, but redis is still running" >&2
  cat "${OUTPUT_FILE}" >&2
  exit 1
fi

echo "stop-wsl-lab fallback redis cleanup passed on port ${REDIS_PORT}"
