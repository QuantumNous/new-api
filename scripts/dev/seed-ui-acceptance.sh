#!/usr/bin/env bash
# DEV ONLY — seed UI acceptance data into local docker-compose Postgres.
# Usage: ./scripts/dev/seed-ui-acceptance.sh
# Rollback: ./scripts/dev/seed-ui-acceptance.sh rollback

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_CONTAINER="${PG_CONTAINER:-new-api-dev-pg}"
PG_USER="${PG_USER:-root}"
PG_DB="${PG_DB:-new-api}"
BACKUP_DIR="${ROOT}/scripts/dev/backups"
SEED_SQL="${ROOT}/scripts/dev/sql/seed-ui-acceptance.sql"
ROLLBACK_SQL="${ROOT}/scripts/dev/sql/cleanup-aioc-demo-data.sql"

die() { echo "ERROR: $*" >&2; exit 1; }

require_dev_container() {
  if ! docker ps --format '{{.Names}}' | grep -qx "${PG_CONTAINER}"; then
    die "Container '${PG_CONTAINER}' is not running. Start with: docker compose -f docker-compose.dev.yml up -d"
  fi
  local dsn
  dsn="$(docker exec "${PG_CONTAINER}" printenv POSTGRES_DB 2>/dev/null || true)"
  if [[ "${dsn}" != "${PG_DB}" ]]; then
    die "Refusing: expected dev DB '${PG_DB}', got '${dsn:-unknown}'"
  fi
  if docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -tAc \
    "SELECT setting FROM pg_settings WHERE name='port'" 2>/dev/null | grep -q .; then
    : # connected
  fi
}

run_psql() {
  docker exec -i "${PG_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${PG_USER}" -d "${PG_DB}" "$@"
}

backup_db() {
  mkdir -p "${BACKUP_DIR}"
  local stamp file
  stamp="$(date +%Y%m%d_%H%M%S)"
  file="${BACKUP_DIR}/pre-ui-seed-${stamp}.sql"
  echo "==> Backing up touched tables to ${file}"
  docker exec "${PG_CONTAINER}" pg_dump -U "${PG_USER}" -d "${PG_DB}" \
    --table=users --table=tokens --table=logs --table=tasks \
    --table=midjourneys --table=channels --table=abilities \
    > "${file}"
  echo "    Backup saved ($(wc -l < "${file}") lines)"
}

count_markers() {
  echo ""
  echo "==> Seeded row counts (AIOC_DEMO / UI_TEST markers):"
  run_psql -c "
    SELECT 'users' AS tbl, COUNT(*) FROM users
      WHERE remark LIKE '%AIOC_DEMO%' OR username LIKE 'UI_TEST%'
    UNION ALL
    SELECT 'tokens', COUNT(*) FROM tokens WHERE name LIKE 'AIOC_DEMO%'
    UNION ALL
    SELECT 'channels', COUNT(*) FROM channels WHERE name LIKE 'AIOC_DEMO%'
    UNION ALL
    SELECT 'abilities', COUNT(*) FROM abilities WHERE channel_id = 9001
    UNION ALL
    SELECT 'logs', COUNT(*) FROM logs
      WHERE token_name LIKE 'AIOC_DEMO%' OR content LIKE '%AIOC_DEMO%' OR username = 'UI_TEST_lisi'
    UNION ALL
    SELECT 'tasks', COUNT(*) FROM tasks WHERE task_id LIKE 'AIOC_DEMO%'
    UNION ALL
    SELECT 'midjourneys', COUNT(*) FROM midjourneys WHERE mj_id LIKE 'AIOC_DEMO%';
  "
}

cmd_rollback() {
  require_dev_container
  echo "==> Rolling back UI acceptance seed..."
  run_psql < "${ROLLBACK_SQL}"
  echo "==> Rollback complete."
}

cmd_seed() {
  require_dev_container
  if [[ "${DEV_SEED:-}" != "1" ]]; then
    echo "Refusing: set DEV_SEED=1 to confirm local dev seed."
    echo "  DEV_SEED=1 $0"
    exit 1
  fi
  echo "==> Pre-flight DB:"
  docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -tAc \
    "SELECT 'type=PostgreSQL db=' || current_database() || ' host=' || COALESCE(inet_server_addr()::text,'local');"
  if docker exec new-api-dev printenv SQL_DSN 2>/dev/null | grep -qvE 'postgres:5432/new-api|localhost|127\.0\.0\.1'; then
    die "SQL_DSN does not look like local docker-compose dev"
  fi
  backup_db
  echo "==> Applying seed SQL..."
  run_psql < "${SEED_SQL}"
  count_markers
  echo ""
  echo "==> Done. See scripts/dev/README.md for UI walkthrough and cleanup."
}

case "${1:-seed}" in
  rollback) cmd_rollback ;;
  seed|"") cmd_seed ;;
  *) die "Unknown command: $1 (use: seed | rollback)" ;;
esac
