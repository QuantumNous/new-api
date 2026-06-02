#!/usr/bin/env bash
set -euo pipefail

# Print core table row counts from the local isolated PostgreSQL snapshot.

if [ -z "${AFFILIATE_LOCAL_DATABASE_URL:-}" ]; then
  echo "AFFILIATE_LOCAL_DATABASE_URL is required" >&2
  exit 2
fi

tables=(
  users
  channels
  abilities
  options
  logs
  top_ups
)

printf 'table,count\n'

for table in "${tables[@]}"; do
  exists="$(psql "$AFFILIATE_LOCAL_DATABASE_URL" --tuples-only --no-align --command "select to_regclass('public.${table}') is not null")"
  if [ "$exists" = "t" ]; then
    count="$(psql "$AFFILIATE_LOCAL_DATABASE_URL" --tuples-only --no-align --command "select count(*) from public.${table}")"
    printf '%s,%s\n' "$table" "$count"
  else
    printf '%s,missing\n' "$table"
  fi
done

affiliate_tables="$(psql "$AFFILIATE_LOCAL_DATABASE_URL" --tuples-only --no-align --command "select table_name from information_schema.tables where table_schema = 'public' and left(table_name, 10) = 'affiliate_' order by table_name")"

if [ -n "$affiliate_tables" ]; then
  while IFS= read -r table; do
    [ -n "$table" ] || continue
    count="$(psql "$AFFILIATE_LOCAL_DATABASE_URL" --tuples-only --no-align --command "select count(*) from public.${table}")"
    printf '%s,%s\n' "$table" "$count"
  done <<< "$affiliate_tables"
fi
