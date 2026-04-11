#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNTIME_DIR="${ROOT_DIR}/deploy/lab/runtime/wsl"
PID_FILE="${RUNTIME_DIR}/mock-openai.pid"
LOG_FILE="${RUNTIME_DIR}/mock-openai.log"
MOCK_PORT="${MOCK_PORT:-8080}"
START_TIMEOUT_SECONDS="${START_TIMEOUT_SECONDS:-60}"

find_mock_pid() {
  pgrep -fo "${RUNTIME_DIR}/mock-openai-upstream --listen :${MOCK_PORT}" || true
}

mkdir -p "${RUNTIME_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  existing_pid="$(tr -d '\r\n' < "${PID_FILE}")"
  if [[ -n "${existing_pid}" ]] && kill -0 "${existing_pid}" 2>/dev/null; then
    echo "mock OpenAI upstream is already running with pid ${existing_pid}"
    exit 0
  fi
fi

: > "${LOG_FILE}"
nohup env MOCK_PORT="${MOCK_PORT}" MOCK_DELAY_MS="${MOCK_DELAY_MS:-1500}" MOCK_RESPONSE_TEXT="${MOCK_RESPONSE_TEXT:-ok}" MOCK_MODELS="${MOCK_MODELS:-gpt-4o-mini}" "${ROOT_DIR}/deploy/lab/run-wsl-mock-openai.sh" > "${LOG_FILE}" 2>&1 &
mock_pid=$!
echo "${mock_pid}" > "${PID_FILE}"

echo "Started mock OpenAI upstream with pid ${mock_pid}"
echo "Waiting for health check on http://127.0.0.1:${MOCK_PORT}/healthz ..."

deadline=$((SECONDS + START_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  if curl -fsS "http://127.0.0.1:${MOCK_PORT}/healthz" >/dev/null 2>&1; then
    resolved_pid="$(find_mock_pid)"
    if [[ -n "${resolved_pid}" ]]; then
      echo "${resolved_pid}" > "${PID_FILE}"
    fi
    echo "mock OpenAI upstream is healthy."
    exit 0
  fi

  if ! kill -0 "${mock_pid}" 2>/dev/null; then
    echo "mock OpenAI upstream exited before becoming healthy." >&2
    tail -n 80 "${LOG_FILE}" || true
    exit 1
  fi

  sleep 1
done

echo "Timed out waiting for mock OpenAI upstream health check." >&2
tail -n 80 "${LOG_FILE}" || true
exit 1
