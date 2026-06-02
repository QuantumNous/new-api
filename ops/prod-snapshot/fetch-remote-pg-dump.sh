#!/usr/bin/env bash
set -euo pipefail

# Fetch a PostgreSQL custom-format dump from the production server without
# writing credentials or database URLs to command-line arguments.

if [ -z "${AFFILIATE_SSH_TARGET:-}" ]; then
  echo "AFFILIATE_SSH_TARGET is required" >&2
  exit 2
fi

if [ -z "${AFFILIATE_REMOTE_COMPOSE_DIR:-}" ]; then
  echo "AFFILIATE_REMOTE_COMPOSE_DIR is required" >&2
  exit 2
fi

if [ -z "${AFFILIATE_PG_SERVICE:-}" ]; then
  echo "AFFILIATE_PG_SERVICE is required" >&2
  exit 2
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_dir="${AFFILIATE_PROD_SNAPSHOT_DIR:-runtime/prod-pg-snapshots}"
out_file="${out_dir}/new-api-prod-pg-${timestamp}.dump"
tmp_file="${out_file}.partial"

mkdir -p "$out_dir"
rm -f "$tmp_file"
trap 'rm -f "$tmp_file"' EXIT

ssh "$AFFILIATE_SSH_TARGET" bash -s -- \
  "$AFFILIATE_REMOTE_COMPOSE_DIR" \
  "$AFFILIATE_PG_SERVICE" > "$tmp_file" <<'REMOTE'
set -euo pipefail

compose_dir="$1"
pg_service="$2"

cd "$compose_dir"

docker compose exec -T "$pg_service" sh -eu -c '
db="${POSTGRES_DB:-${PGDATABASE:-}}"
user="${POSTGRES_USER:-${PGUSER:-}}"

if [ -z "$db" ]; then
  echo "POSTGRES_DB or PGDATABASE is required inside the PostgreSQL container" >&2
  exit 2
fi

if [ -z "$user" ]; then
  echo "POSTGRES_USER or PGUSER is required inside the PostgreSQL container" >&2
  exit 2
fi

exec pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --username="$user" \
  --dbname="$db"
'
REMOTE

pg_restore --list "$tmp_file" >/dev/null

mv "$tmp_file" "$out_file"
trap - EXIT
sha256sum "$out_file" > "${out_file}.sha256"

printf '%s\n' "$out_file"
