#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BINARY="$ROOT_DIR/35sz-api"
LOG_FILE="${LOG_FILE:-$ROOT_DIR/35sz-api.log}"
PID_FILE="${PID_FILE:-$ROOT_DIR/35sz-api.pid}"
PORT="${PORT:-9588}"
REBUILD="${REBUILD:-0}"

build_binary() {
  echo "Building 35sz-api binary..."
  cd "$ROOT_DIR"

  local ldflags="-s -w"
  if [[ -f "$ROOT_DIR/VERSION" ]]; then
    local version
    version="$(tr -d '\n' < "$ROOT_DIR/VERSION")"
    ldflags="$ldflags -X github.com/QuantumNous/new-api/common.Version=$version"
  fi

  go build -ldflags "$ldflags" -o "$BINARY"
}

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "35sz-api is already running with PID $EXISTING_PID."
    echo "Run ./stop.sh first if you want to restart it."
    exit 1
  fi
  echo "Removing stale PID file: $PID_FILE"
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
  echo "Port $PORT is already in use. Run ./stop.sh first or set a different PORT."
  exit 1
fi

if [[ "$REBUILD" == "1" || ! -x "$BINARY" ]]; then
  build_binary
fi

if [[ ! -x "$BINARY" ]]; then
  echo "Binary not found or not executable after build: $BINARY"
  exit 1
fi

cd "$ROOT_DIR"
PORT="$PORT" nohup "$BINARY" > "$LOG_FILE" 2>&1 &
PID="$!"
echo "$PID" > "$PID_FILE"

if command -v lsof >/dev/null 2>&1; then
  for _ in {1..50}; do
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "35sz-api failed to start. Check log file: $LOG_FILE"
      rm -f "$PID_FILE"
      exit 1
    fi
    if lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
      break
    fi
    sleep 0.2
  done

  if ! lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
    echo "35sz-api started with PID $PID but port $PORT is not listening yet. Check log file: $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi
else
  sleep 0.5
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "35sz-api failed to start. Check log file: $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi
fi

echo "Started 35sz-api with PID $PID on port $PORT."
echo "Log file: $LOG_FILE"
echo "PID file: $PID_FILE"
