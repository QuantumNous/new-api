#!/usr/bin/env bash

set -uo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

OUT_DIR=""
THRESHOLD_USD="1000"
QUOTA_PER_UNIT="${QUOTA_PER_UNIT:-500000}"
SINCE_HOURS="168"
TAIL_BYTES="262144"
LOG_DIR="${LOG_DIR:-${REPO_ROOT}/logs}"
SQLITE_DB="${SQLITE_DB:-}"
CREATE_ARCHIVE=1

usage() {
  cat <<'USAGE'
Usage: bin/collect_security_snapshot.sh [options]

Options:
  --output DIR             Output directory. Default: ./security-collection-<UTC timestamp>
  --sqlite PATH            SQLite database path when SQL_DSN is empty/local.
  --log-dir DIR            Log directory. Default: ./logs or LOG_DIR.
  --threshold-usd VALUE    Suspicious balance threshold in USD units. Default: 1000
  --quota-per-unit VALUE   Quota units per USD. Default: 500000
  --since-hours HOURS      Recent log/top-up window. Default: 168
  --tail-bytes BYTES       Bytes copied from each recent app log. Default: 262144
  --no-archive             Do not create a .tar.gz archive.
  -h, --help               Show this help.

Environment:
  SQL_DSN                  Main database DSN. Empty/local means SQLite.
  LOG_SQL_DSN              Log database DSN. Defaults to SQL_DSN.
  SQLITE_DB                SQLite database path override.

The script is read-only. It writes local evidence files and never uploads them.
USAGE
}

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output)
      OUT_DIR="${2:-}"
      shift 2
      ;;
    --sqlite)
      SQLITE_DB="${2:-}"
      shift 2
      ;;
    --log-dir)
      LOG_DIR="${2:-}"
      shift 2
      ;;
    --threshold-usd)
      THRESHOLD_USD="${2:-}"
      shift 2
      ;;
    --quota-per-unit)
      QUOTA_PER_UNIT="${2:-}"
      shift 2
      ;;
    --since-hours)
      SINCE_HOURS="${2:-}"
      shift 2
      ;;
    --tail-bytes)
      TAIL_BYTES="${2:-}"
      shift 2
      ;;
    --no-archive)
      CREATE_ARCHIVE=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$OUT_DIR" ]]; then
  OUT_DIR="${REPO_ROOT}/security-collection-$(date -u '+%Y%m%d-%H%M%S')"
fi

mkdir -p "$OUT_DIR"/{db,logs,system,queries}

NOW_TS="$(date +%s)"
SINCE_TS=$((NOW_TS - SINCE_HOURS * 3600))
THRESHOLD_QUOTA="$(awk -v usd="$THRESHOLD_USD" -v qpu="$QUOTA_PER_UNIT" 'BEGIN { printf "%.0f", usd * qpu }')"
SQL_DSN_VALUE="${SQL_DSN:-}"
LOG_SQL_DSN_VALUE="${LOG_SQL_DSN:-$SQL_DSN_VALUE}"

detect_db_type() {
  local dsn="$1"
  if [[ -z "$dsn" || "$dsn" == local* ]]; then
    echo "sqlite"
  elif [[ "$dsn" == postgres://* || "$dsn" == postgresql://* ]]; then
    echo "postgres"
  else
    echo "mysql"
  fi
}

find_sqlite_db() {
  if [[ -n "$SQLITE_DB" ]]; then
    echo "$SQLITE_DB"
    return
  fi

  local candidates=(
    "${REPO_ROOT}/one-api.db"
    "${REPO_ROOT}/data/one-api.db"
    "/data/one-api.db"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -f "$candidate" ]]; then
      echo "$candidate"
      return
    fi
  done
  echo "${REPO_ROOT}/one-api.db"
}

write_sql_file() {
  local name="$1"
  local sql="$2"
  printf '%s\n' "$sql" > "${OUT_DIR}/queries/${name}.sql"
}

sql_for_copy() {
  tr '\n' ' ' < "$1" | sed -E 's/[[:space:]]*;[[:space:]]*$//'
}

run_sqlite_query() {
  local db_path="$1"
  local query_file="$2"
  local out_file="$3"
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "sqlite3 not found" > "${out_file}.error"
    return
  fi
  if [[ ! -f "$db_path" ]]; then
    echo "SQLite database not found: $db_path" > "${out_file}.error"
    return
  fi
  sqlite3 -readonly -header -csv "$db_path" < "$query_file" > "$out_file" 2> "${out_file}.error" || true
}

run_postgres_query() {
  local dsn="$1"
  local query_file="$2"
  local out_file="$3"
  if ! command -v psql >/dev/null 2>&1; then
    echo "psql not found" > "${out_file}.error"
    return
  fi
  local sql
  sql="$(sql_for_copy "$query_file")"
  PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-5}" psql "$dsn" -q -v ON_ERROR_STOP=1 -c "\\copy (${sql}) TO STDOUT WITH CSV HEADER" > "$out_file" 2> "${out_file}.error" || true
}

run_mysql_query() {
  local dsn="$1"
  local query_file="$2"
  local out_file="$3"
  if ! command -v mysql >/dev/null 2>&1; then
    echo "mysql not found" > "${out_file}.error"
    return
  fi

  local dsn_no_query="${dsn%%\?*}"
  local creds="${dsn_no_query%@*}"
  local rest="${dsn_no_query#*@}"
  local user="$creds"
  local pass=""
  if [[ "$creds" == *:* ]]; then
    user="${creds%%:*}"
    pass="${creds#*:}"
  fi

  local db="${rest##*/}"
  local hostport="${rest%/*}"
  local host="127.0.0.1"
  local port="3306"
  local tcp_re='tcp\(([^)]*)\)'
  if [[ "$hostport" =~ $tcp_re ]]; then
    hostport="${BASH_REMATCH[1]}"
    host="${hostport%%:*}"
    if [[ "$hostport" == *:* ]]; then
      port="${hostport##*:}"
    fi
  fi

  MYSQL_PWD="$pass" mysql --batch --raw --connect-timeout=5 -h "$host" -P "$port" -u "$user" "$db" < "$query_file" > "$out_file" 2> "${out_file}.error" || true
}

run_query() {
  local dsn="$1"
  local query_name="$2"
  local query_file="${OUT_DIR}/queries/${query_name}.sql"
  local db_type
  db_type="$(detect_db_type "$dsn")"
  case "$db_type" in
    sqlite)
      run_sqlite_query "$(find_sqlite_db)" "$query_file" "${OUT_DIR}/db/${query_name}.csv"
      ;;
    postgres)
      run_postgres_query "$dsn" "$query_file" "${OUT_DIR}/db/${query_name}.csv"
      ;;
    mysql)
      run_mysql_query "$dsn" "$query_file" "${OUT_DIR}/db/${query_name}.tsv"
      ;;
  esac
}

write_sql_file "suspicious_users" "
SELECT
  u.id,
  u.username,
  u.display_name,
  u.email,
  u.role,
  u.status,
  u.quota,
  u.used_quota,
  u.request_count,
  COUNT(t.id) AS successful_topup_count,
  COALESCE(SUM(t.amount), 0) AS successful_topup_amount_sum,
  MIN(t.complete_time) AS first_successful_topup_time,
  MAX(t.complete_time) AS last_successful_topup_time
FROM users u
LEFT JOIN top_ups t ON t.user_id = u.id AND t.status = 'success'
WHERE u.quota >= ${THRESHOLD_QUOTA}
GROUP BY u.id, u.username, u.display_name, u.email, u.role, u.status, u.quota, u.used_quota, u.request_count
ORDER BY u.quota DESC
LIMIT 200;
"

write_sql_file "topups_for_suspicious_users" "
SELECT
  t.id,
  t.user_id,
  t.amount,
  t.money,
  t.trade_no,
  t.payment_method,
  t.create_time,
  t.complete_time,
  t.status
FROM top_ups t
WHERE t.user_id IN (SELECT id FROM users WHERE quota >= ${THRESHOLD_QUOTA})
ORDER BY t.user_id ASC, t.id DESC
LIMIT 1000;
"

write_sql_file "recent_topups" "
SELECT
  id,
  user_id,
  amount,
  money,
  trade_no,
  payment_method,
  create_time,
  complete_time,
  status
FROM top_ups
WHERE create_time >= ${SINCE_TS} OR complete_time >= ${SINCE_TS}
ORDER BY id DESC
LIMIT 500;
"

write_sql_file "logs_for_suspicious_users" "
SELECT
  l.id,
  l.user_id,
  l.created_at,
  l.type,
  l.quota,
  l.username,
  l.content,
  l.request_id
FROM logs l
WHERE l.user_id IN (SELECT id FROM users WHERE quota >= ${THRESHOLD_QUOTA})
  AND (l.type IN (1, 3, 4, 5, 6) OR l.content LIKE '%充值%' OR l.content LIKE '%补单%' OR l.content LIKE '%额度%')
ORDER BY l.id DESC
LIMIT 1000;
"

write_sql_file "recent_admin_and_payment_logs" "
SELECT
  id,
  user_id,
  created_at,
  type,
  quota,
  username,
  content,
  request_id
FROM logs
WHERE created_at >= ${SINCE_TS}
  AND (type IN (1, 3, 4, 5, 6) OR content LIKE '%充值%' OR content LIKE '%补单%' OR content LIKE '%额度%' OR content LIKE '%订阅%')
ORDER BY id DESC
LIMIT 1000;
"

{
  echo "generated_at_utc=$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "repo_root=${REPO_ROOT}"
  echo "git_head=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
  echo "threshold_usd=${THRESHOLD_USD}"
  echo "quota_per_unit=${QUOTA_PER_UNIT}"
  echo "threshold_quota=${THRESHOLD_QUOTA}"
  echo "since_hours=${SINCE_HOURS}"
  echo "since_timestamp=${SINCE_TS}"
  echo "main_db_type=$(detect_db_type "$SQL_DSN_VALUE")"
  echo "log_db_type=$(detect_db_type "$LOG_SQL_DSN_VALUE")"
  if [[ "$(detect_db_type "$SQL_DSN_VALUE")" == "sqlite" ]]; then
    echo "sqlite_db=$(find_sqlite_db)"
  fi
  echo "sql_dsn_set=$([[ -n "$SQL_DSN_VALUE" ]] && echo yes || echo no)"
  echo "log_sql_dsn_set=$([[ -n "$LOG_SQL_DSN_VALUE" ]] && echo yes || echo no)"
} > "${OUT_DIR}/SUMMARY.txt"

log "writing system snapshot"
date -u '+%Y-%m-%dT%H:%M:%SZ' > "${OUT_DIR}/system/date_utc.txt"
uname -a > "${OUT_DIR}/system/uname.txt" 2>&1 || true
git -C "$REPO_ROOT" status --short > "${OUT_DIR}/system/git_status_short.txt" 2>&1 || true
git -C "$REPO_ROOT" log -5 --oneline > "${OUT_DIR}/system/git_recent_commits.txt" 2>&1 || true
ps aux > "${OUT_DIR}/system/processes_all.txt" 2> "${OUT_DIR}/system/processes_all.error" || true
grep -E 'new-api|one-api|postgres|mysql|redis' "${OUT_DIR}/system/processes_all.txt" > "${OUT_DIR}/system/related_processes.txt" 2>&1 || true
if command -v lsof >/dev/null 2>&1; then
  lsof -nP -iTCP -sTCP:LISTEN > "${OUT_DIR}/system/listening_ports.txt" 2>&1 || true
fi

{
  for key in SQL_DSN LOG_SQL_DSN SQLITE_DB LOG_DIR SECURITY_LOG_COLLECTOR_URL FRONTEND_BASE_URL SESSION_SECRET CRYPTO_SECRET; do
    if [[ -n "${!key:-}" ]]; then
      echo "${key}=<set>"
    else
      echo "${key}=<unset>"
    fi
  done
} > "${OUT_DIR}/system/env_presence.txt"

log "running database queries"
run_query "$SQL_DSN_VALUE" "suspicious_users"
run_query "$SQL_DSN_VALUE" "topups_for_suspicious_users"
run_query "$SQL_DSN_VALUE" "recent_topups"
run_query "$LOG_SQL_DSN_VALUE" "logs_for_suspicious_users"
run_query "$LOG_SQL_DSN_VALUE" "recent_admin_and_payment_logs"

log "copying app log tails"
if [[ -d "$LOG_DIR" ]]; then
  find "$LOG_DIR" -type f -name 'oneapi-*.log' -print0 2>/dev/null |
    xargs -0 ls -t 2>/dev/null |
    head -n 5 |
    while IFS= read -r log_file; do
      base="$(basename "$log_file")"
      tail -c "$TAIL_BYTES" "$log_file" > "${OUT_DIR}/logs/${base}.tail" 2> "${OUT_DIR}/logs/${base}.tail.error" || true
    done
else
  echo "log directory not found: $LOG_DIR" > "${OUT_DIR}/logs/log_dir.error"
fi

if [[ "$CREATE_ARCHIVE" -eq 1 ]]; then
  archive="${OUT_DIR}.tar.gz"
  log "creating archive ${archive}"
  tar -czf "$archive" -C "$(dirname "$OUT_DIR")" "$(basename "$OUT_DIR")"
  echo "archive=${archive}" >> "${OUT_DIR}/SUMMARY.txt"
fi

log "done: ${OUT_DIR}"
if [[ "$CREATE_ARCHIVE" -eq 1 ]]; then
  log "archive: ${OUT_DIR}.tar.gz"
fi
