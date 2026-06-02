#!/usr/bin/env bash
set -euo pipefail

# Restore a custom-format PostgreSQL dump into a local Docker PostgreSQL
# container dedicated to affiliate development.

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <dump-file>" >&2
  exit 2
fi

dump_file="$1"

if [ ! -f "$dump_file" ]; then
  echo "missing dump file: $dump_file" >&2
  exit 2
fi

container="${AFFILIATE_LOCAL_PG_CONTAINER:-new-api-affiliate-pg}"
image="${AFFILIATE_LOCAL_PG_IMAGE:-postgres:16}"
database="${AFFILIATE_LOCAL_PG_DATABASE:-new_api_affiliate_snapshot}"
user="${AFFILIATE_LOCAL_PG_USER:-postgres}"
port="${AFFILIATE_LOCAL_PG_PORT:-55432}"
volume="${AFFILIATE_LOCAL_PG_VOLUME:-new-api-affiliate-pg-data}"

if [ -z "${AFFILIATE_LOCAL_PG_PASSWORD:-}" ]; then
  echo "AFFILIATE_LOCAL_PG_PASSWORD is required" >&2
  exit 2
fi

pg_restore --list "$dump_file" >/dev/null

if ! docker inspect "$container" >/dev/null 2>&1; then
  docker volume create "$volume" >/dev/null
  POSTGRES_PASSWORD="$AFFILIATE_LOCAL_PG_PASSWORD" docker run \
    --detach \
    --name "$container" \
    --env POSTGRES_PASSWORD \
    --env "POSTGRES_DB=${database}" \
    --publish "127.0.0.1:${port}:5432" \
    --volume "${volume}:/var/lib/postgresql/data" \
    "$image" >/dev/null
fi

if [ "$(docker inspect -f '{{.State.Running}}' "$container")" != "true" ]; then
  docker start "$container" >/dev/null
fi

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready --username "$user" --dbname "$database" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$container" pg_isready --username "$user" --dbname "$database" >/dev/null 2>&1; then
  echo "local PostgreSQL container did not become ready" >&2
  exit 1
fi

docker exec -i "$container" \
  pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --username "$user" \
  --dbname "$database" < "$dump_file"

printf 'postgres://%s:<password>@127.0.0.1:%s/%s\n' "$user" "$port" "$database"
