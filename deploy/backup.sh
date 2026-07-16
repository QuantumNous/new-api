#!/usr/bin/env bash
#
# New API（企业内部 AI 网关）MySQL 每日备份脚本
# 配合 crontab 使用，例如每日 03:30：
#   30 3 * * * /path/to/deploy/backup.sh >> /var/log/newapi-backup.log 2>&1
#
# 依赖：docker（通过容器执行 mysqldump，避免宿主机安装客户端）。
# 凭据与库名取自同目录 .env（与 docker-compose.yml 一致）。

set -euo pipefail

# ---- 配置（可被环境变量覆盖）----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/newapi}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MYSQL_CONTAINER="${MYSQL_CONTAINER:-newapi-mysql}"
MYSQL_DB="${MYSQL_DB:-new-api}"

# ---- 读取凭据 ----
if [[ -f "$ENV_FILE" ]]; then
  # 仅提取 SQL_DSN 中的 user:pass@host:port/db 解析为独立变量
  SQL_DSN="$(grep -E '^SQL_DSN=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
# 兜底默认值（与 docker-compose.yml 默认一致）
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-${SQL_DSN:+$(echo "$SQL_DSN" | sed -E 's#.*://([^:]+):([^@]+)@.*#\1#')}}"
MYSQL_PASS="${MYSQL_PASS:-123456}"

mkdir -p "$BACKUP_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/newapi-$TS.sql.gz"

echo "[$(date '+%F %T')] 开始备份 -> $OUT"
docker exec "$MYSQL_CONTAINER" \
  mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASS" --single-transaction --routines --triggers "$MYSQL_DB" \
  | gzip > "$OUT"

if [[ -s "$OUT" ]]; then
  echo "[$(date '+%F %T')] 备份成功，体积 $(du -h "$OUT" | cut -f1)"
else
  echo "[$(date '+%F %T')] 错误：备份文件为空" >&2
  rm -f "$OUT"
  exit 1
fi

# ---- 保留期清理 ----
echo "[$(date '+%F %T')] 清理 $RETENTION_DAYS 天前的备份"
find "$BACKUP_DIR" -name 'newapi-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -delete

echo "[$(date '+%F %T')] 完成。当前备份文件数：$(ls -1 "$BACKUP_DIR"/newapi-*.sql.gz 2>/dev/null | wc -l)"
