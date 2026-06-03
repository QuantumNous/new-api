#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PID_FILE:-$ROOT_DIR/35sz-api.pid}"
PORT="${PORT:-9588}"

stop_pid() {
  local pid="$1"

  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  echo "Stopping process $pid..."
  kill "$pid" 2>/dev/null || true

  for _ in {1..25}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    sleep 0.2
  done

  echo "Force stopping process $pid..."
  kill -9 "$pid" 2>/dev/null || true
}

if [[ -f "$PID_FILE" ]]; then
  PID="$(tr -d '[:space:]' < "$PID_FILE")"
  stop_pid "$PID"
  rm -f "$PID_FILE"
else
  echo "PID file not found: $PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  while IFS= read -r PID; do
    stop_pid "$PID"
  done < <(lsof -ti tcp:"$PORT" || true)
fi

echo "Stopped 35sz-api services on port $PORT."
