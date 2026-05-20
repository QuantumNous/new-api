#!/usr/bin/env bash
# DEV ONLY — remove AIOC_DEMO / UI_TEST / aioc_demo_* fixtures from local docker Postgres.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_CONTAINER="${PG_CONTAINER:-new-api-dev-pg}"
PG_USER="${PG_USER:-root}"
PG_DB="${PG_DB:-new-api}"
CLEANUP_SQL="${ROOT}/scripts/dev/sql/cleanup-aioc-demo-data.sql"

die() { echo "ERROR: $*" >&2; exit 1; }

if ! docker ps --format '{{.Names}}' | grep -qx "${PG_CONTAINER}"; then
  die "Container '${PG_CONTAINER}' is not running."
fi

echo "==> Cleanup target: container=${PG_CONTAINER} db=${PG_DB}"
echo "==> SQL: ${CLEANUP_SQL}"
docker exec -i "${PG_CONTAINER}" psql -v ON_ERROR_STOP=1 -U "${PG_USER}" -d "${PG_DB}" < "${CLEANUP_SQL}"

echo "==> Remaining marker rows (should be 0):"
docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -c "
  SELECT 'users' t, COUNT(*) FROM users
    WHERE id IN (9001, 9101, 9102) OR username LIKE 'aioc_demo_%' OR username = 'UI_TEST_lisi'
  UNION ALL SELECT 'tokens', COUNT(*) FROM tokens
    WHERE name LIKE 'AIOC_DEMO%' OR key LIKE 'sk-aioc-demo%' OR key LIKE 'AIOC_DEMO%'
  UNION ALL SELECT 'logs', COUNT(*) FROM logs
    WHERE content LIKE '%AIOC_DEMO%' OR content LIKE '%UI_TEST%'
      OR username LIKE 'aioc_demo_%' OR username = 'UI_TEST_lisi'
  UNION ALL SELECT 'tasks', COUNT(*) FROM tasks WHERE task_id LIKE 'AIOC_DEMO%' OR task_id LIKE 'aioc-demo-%'
  UNION ALL SELECT 'midjourneys', COUNT(*) FROM midjourneys WHERE mj_id LIKE 'AIOC_DEMO%' OR mj_id LIKE 'aioc-demo-%';
"

echo "==> Cleanup complete."
