#!/usr/bin/env bash
# Start backend (Docker) + frontend dev (Docker) with auto-restart.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../" && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.dev.yml"

echo "=== new-api dev stack (3000 API + 3001 UI) ==="
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "Waiting for services..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://127.0.0.1:3000/api/status"; then
    break
  fi
  sleep 1
done

for i in $(seq 1 60); do
  if curl -sf -o /dev/null "http://127.0.0.1:3001/"; then
    echo "OK: http://127.0.0.1:3001/"
    HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    if [ -n "$HOST_IP" ]; then
      echo "OK: http://${HOST_IP}:3001/"
    fi
    exit 0
  fi
  sleep 2
done

echo "WARN: frontend not ready yet — check logs:"
echo "  docker compose -f $COMPOSE_FILE logs --tail=50 web-dev"
exit 1
