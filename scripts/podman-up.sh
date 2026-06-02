#!/usr/bin/env bash
# podman-up.sh — bring the stack up via podman-compose
#
# Usage:
#   ./scripts/podman-up.sh                 # start detached
#   ./scripts/podman-up.sh --build         # rebuild model-detailed first
#   ./scripts/podman-up.sh --logs          # follow logs after start
#
# Equivalent Docker invocation:
#   docker compose -f podman-compose.yml up -d
#
# Prereqs: podman 4.x, podman-compose 1.0+, .env file with POSTGRES_PASSWORD
# and REDIS_PASSWORD set.

set -euo pipefail
cd "$(dirname "$0")/.."

BUILD=""
LOGS=""

for arg in "$@"; do
  case "$arg" in
    --build) BUILD="--build" ;;
    --logs)  LOGS="1" ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

# Sanity check
command -v podman >/dev/null || { echo "ERROR: podman not installed" >&2; exit 1; }
command -v podman-compose >/dev/null || { echo "ERROR: podman-compose not installed" >&2; exit 1; }

# Ensure .env exists (fail loud if not — without POSTGRES_PASSWORD the
# compose YAML's ${POSTGRES_PASSWORD:?} raises).
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "[podman-up] .env missing, copying from .env.example"
    cp .env.example .env
  else
    echo "ERROR: .env not found and no .env.example to copy from" >&2
    exit 1
  fi
fi

echo "[podman-up] podman compose up -d $BUILD"
podman-compose -f podman-compose.yml up -d $BUILD

echo "[podman-up] waiting for new-api to become healthy..."
for i in $(seq 1 30); do
  if curl -fs http://localhost:3301/api/status >/dev/null 2>&1; then
    echo "[podman-up] new-api is up (took ${i}*2s)"
    break
  fi
  sleep 2
done

echo "[podman-up] stack status:"
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

if [ -n "$LOGS" ]; then
  echo "[podman-up] following logs (Ctrl+C to detach)..."
  podman-compose -f podman-compose.yml logs -f
fi
