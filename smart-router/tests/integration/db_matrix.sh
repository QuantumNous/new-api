#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if (cd "$ROOT" && go test ./store -run 'TestSQLiteOwnsRoutingState|TestRouteKeysAndOutcomeCooldownArePersistedAtomically' -count=1); then
  echo "SQLite: PASS"
else
  echo "SQLite: FAIL"
  exit 1
fi

run_mysql() {
  if [[ "${SMART_ROUTER_TEST_MYSQL:-}" != "1" ]]; then
    echo "MySQL: BLOCKED (set SMART_ROUTER_TEST_MYSQL=1 to use local client defaults)"
    return
  fi
  if ! command -v mysql >/dev/null 2>&1; then
    echo "MySQL: BLOCKED (mysql client unavailable)"
    return
  fi
  if ! mysql --batch --skip-column-names --execute "SELECT 1" >/dev/null 2>&1; then
    echo "MySQL: BLOCKED (local engine unavailable through client defaults)"
    return
  fi

  local database="smart_router_matrix_$$"
  mysql --execute "CREATE DATABASE \`${database}\`"
  for migration in "$ROOT"/migrations/mysql/*.sql; do
    if ! mysql "$database" <"$migration"; then
      mysql --execute "DROP DATABASE IF EXISTS \`${database}\`"
      echo "MySQL: FAIL"
      exit 1
    fi
  done
  local count
  count="$(mysql --batch --skip-column-names "$database" --execute \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()")"
  mysql --execute "DROP DATABASE \`${database}\`"
  if [[ "$count" != "14" ]]; then
    echo "MySQL: FAIL (expected 14 tables, found $count)"
    exit 1
  fi
  echo "MySQL: PASS"
}

run_postgres() {
  if [[ "${SMART_ROUTER_TEST_POSTGRES:-}" != "1" ]]; then
    echo "PostgreSQL: BLOCKED (set SMART_ROUTER_TEST_POSTGRES=1 to use local client defaults)"
    return
  fi
  if ! command -v psql >/dev/null 2>&1 ||
    ! command -v createdb >/dev/null 2>&1 ||
    ! command -v dropdb >/dev/null 2>&1; then
    echo "PostgreSQL: BLOCKED (psql/createdb/dropdb unavailable)"
    return
  fi
  if ! psql --no-psqlrc --tuples-only --command "SELECT 1" >/dev/null 2>&1; then
    echo "PostgreSQL: BLOCKED (local engine unavailable through client defaults)"
    return
  fi

  local database="smart_router_matrix_$$"
  createdb "$database"
  for migration in "$ROOT"/migrations/postgres/*.sql; do
    if ! psql --no-psqlrc --set ON_ERROR_STOP=1 --dbname "$database" \
      --file "$migration" >/dev/null; then
      dropdb --if-exists "$database"
      echo "PostgreSQL: FAIL"
      exit 1
    fi
  done
  local count
  count="$(psql --no-psqlrc --tuples-only --no-align --dbname "$database" \
    --command "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")"
  dropdb "$database"
  if [[ "$count" != "14" ]]; then
    echo "PostgreSQL: FAIL (expected 14 tables, found $count)"
    exit 1
  fi
  echo "PostgreSQL: PASS"
}

run_mysql
run_postgres
