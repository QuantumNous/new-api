#!/usr/bin/env bash
set -euo pipefail

# Export a PostgreSQL schema snapshot for schema impact review.
# The database URL must be provided through SCHEMA_DATABASE_URL.
# Do not pass production DSNs as command-line arguments.

if [ -z "${SCHEMA_DATABASE_URL:-}" ]; then
  echo "SCHEMA_DATABASE_URL is required" >&2
  exit 2
fi

label="${1:-schema}"
safe_label="$(printf '%s' "$label" | tr -c 'A-Za-z0-9._-' '_')"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_dir="${SCHEMA_IMPACT_DIR:-runtime/schema-impact}"
out_file="${out_dir}/${timestamp}-${safe_label}.sql"

mkdir -p "$out_dir"

pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  --file "$out_file" \
  "$SCHEMA_DATABASE_URL"

sha256sum "$out_file" > "${out_file}.sha256"
printf '%s\n' "$out_file"
