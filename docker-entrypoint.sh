#!/usr/bin/env bash
set -euo pipefail

if [[ "${CURSOR_AGENT_EMBEDDED_SIDECAR:-1}" == "0" ]]; then
  exec /new-api "$@"
fi

export CURSOR_AGENT_SIDECAR_HOST="${CURSOR_AGENT_SIDECAR_HOST:-127.0.0.1}"
export CURSOR_AGENT_SIDECAR_PORT="${CURSOR_AGENT_SIDECAR_PORT:-3927}"
export CURSOR_AGENT_STATE_DIR="${CURSOR_AGENT_STATE_DIR:-/data/cursor-agent}"
export CURSOR_AGENT_SIDECAR_BASE_URL="${CURSOR_AGENT_SIDECAR_BASE_URL:-http://${CURSOR_AGENT_SIDECAR_HOST}:${CURSOR_AGENT_SIDECAR_PORT}}"

node /opt/cursor-agent/server.mjs &
sidecar_pid=$!

sidecar_ready=0
for _ in {1..30}; do
  if wget -qO- "${CURSOR_AGENT_SIDECAR_BASE_URL}/health" >/dev/null 2>&1; then
    sidecar_ready=1
    break
  fi
  if ! kill -0 "$sidecar_pid" 2>/dev/null; then
    wait "$sidecar_pid"
    exit $?
  fi
  sleep 1
done
if [[ "$sidecar_ready" != "1" ]]; then
  echo "Cursor Agent sidecar did not become healthy" >&2
  kill -TERM "$sidecar_pid" 2>/dev/null || true
  wait "$sidecar_pid" 2>/dev/null || true
  exit 1
fi

/new-api "$@" &
api_pid=$!

shutdown() {
  kill -TERM "$api_pid" "$sidecar_pid" 2>/dev/null || true
}
trap shutdown INT TERM

set +e
wait -n "$api_pid" "$sidecar_pid"
status=$?
set -e
shutdown
wait "$api_pid" 2>/dev/null || true
wait "$sidecar_pid" 2>/dev/null || true
exit "$status"
