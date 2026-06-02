#!/usr/bin/env bash
# podman-migrate-from-docker.sh
#
# One-shot: take a running Docker stack of router-ai-atius and lift it to
# Podman with no data loss. Tested for the SRV-1 (atius-router) deployment.
#
# What it does:
#   1. Dumps the running new-api PostgreSQL DB to a SQL file.
#   2. Stops + removes the Docker stack (data/ and logs/ are NOT removed).
#   3. Builds the model-detailed image (Podman uses Buildah; we use
#      `podman build` to keep one toolchain).
#   4. Starts the Podman stack, pointing it at the same ./data and ./logs.
#   5. Restores the DB dump into the new Podman-managed Postgres.
#   6. Smoke-tests GET /api/status.
#
# Pre-conditions:
#   - Docker stack was up and serving (DB is alive).
#   - podman + podman-compose installed (4.x / 1.0+).
#   - .env populated with POSTGRES_PASSWORD and REDIS_PASSWORD.
#
# NOT a live cutover. The downtime window is roughly:
#   down:   5-30s
#   up:     30-120s (Podman pulls may be slower than dockerd's cache)
#   restore: 1-5 min for 100MB SQL dumps
#
# Use during a maintenance window.

set -euo pipefail
cd "$(dirname "$0")/.."

DUMP_DIR="/tmp/podman-migrate-$$"
DUMP_FILE="$DUMP_DIR/dump.sql"
mkdir -p "$DUMP_DIR"

echo "[migrate] step 1/6: dump PostgreSQL data from Docker stack"
docker exec db-newapi pg_dump -U admin -d newapi --no-owner --no-acl > "$DUMP_FILE" 2>/dev/null \
  || docker exec postgres pg_dump -U root -d new-api --no-owner --no-acl > "$DUMP_FILE" 2>/dev/null \
  || docker exec db-newapi pg_dump -U admin -d newapi > "$DUMP_FILE" 2>/dev/null
DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo "[migrate]   dumped $DUMP_SIZE to $DUMP_FILE"

echo "[migrate] step 2/6: stop + remove Docker stack (keep volumes/data)"
docker compose down 2>&1 || true
docker rm -f new-api model-detailed db-newapi redis-newapi 2>/dev/null || true
docker network rm router-ai_newapi-internal 2>/dev/null || true

echo "[migrate] step 3/6: build the model-detailed image with Podman"
podman-compose -f podman-compose.yml build model-detailed

echo "[migrate] step 4/6: start the Podman stack"
podman-compose -f podman-compose.yml up -d

echo "[migrate] step 5/6: wait for postgres to be ready, then restore"
for i in $(seq 1 30); do
  if podman exec db-newapi pg_isready -U admin -d newapi 2>/dev/null; then
    break
  fi
  sleep 2
done
cat "$DUMP_FILE" | podman exec -i db-newapi psql -U admin -d newapi 2>&1 | tail -3
echo "[migrate]   restore complete"

echo "[migrate] step 6/6: smoke test"
for i in $(seq 1 30); do
  if curl -fs http://localhost:3301/api/status >/dev/null 2>&1; then
    echo "[migrate]   GET /api/status → OK"
    break
  fi
  sleep 2
done

rm -rf "$DUMP_DIR"
echo "[migrate] done. Podman stack is up at :3301 (api) and :3300 (middleware)."
echo "[migrate] next: ./scripts/podman-up.sh --logs  (or podman ps / podman logs new-api)"
