#!/usr/bin/env bash
# 从服务器拉取 one-api.db 到本地
# Pull one-api.db from production server to local workspace
set -euo pipefail

REMOTE_HOST="${NEWAPI_REMOTE_HOST:-001}"
REMOTE_PATH="${NEWAPI_REMOTE_PATH:-/opt/newapi/data/one-api.db}"
LOCAL_PATH="$(cd "$(dirname "$0")/.." && pwd)/one-api.db"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/.db-backups"

echo "==> 同步数据库"
echo "    源: ${REMOTE_HOST}:${REMOTE_PATH}"
echo "    目标: ${LOCAL_PATH}"
echo

# 1. 备份本地已有 db
if [[ -f "$LOCAL_PATH" ]]; then
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="${BACKUP_DIR}/one-api.db.$(date +%Y%m%d-%H%M%S)"
  cp "$LOCAL_PATH" "$BACKUP_FILE"
  echo "✓ 本地 db 已备份到: ${BACKUP_FILE}"
fi

# 2. 检查服务器文件存在
ssh "$REMOTE_HOST" "[ -f ${REMOTE_PATH} ]" || {
  echo "✗ 服务器上找不到 ${REMOTE_PATH}"
  exit 1
}

# 3. 获取文件大小并拉取
REMOTE_SIZE=$(ssh "$REMOTE_HOST" "stat -c%s ${REMOTE_PATH}")
echo "✓ 服务器文件大小: $(numfmt --to=iec ${REMOTE_SIZE} 2>/dev/null || echo ${REMOTE_SIZE} bytes)"

scp -q "${REMOTE_HOST}:${REMOTE_PATH}" "$LOCAL_PATH"

echo
echo "✓ 同步完成！"
echo "  运行 'go run main.go' 启动本地开发服务器"
echo "  所有账号、套餐、API Key、系统设置已同步"

# 4. 显示同步过来的数据概览
if command -v sqlite3 &>/dev/null; then
  echo
  echo "==> 数据概览"
  sqlite3 "$LOCAL_PATH" <<SQL
.mode column
.headers on
SELECT 'users' AS table_name, count(*) AS count FROM users
UNION ALL SELECT 'tokens', count(*) FROM tokens
UNION ALL SELECT 'channels', count(*) FROM channels
UNION ALL SELECT 'subscription_plans', count(*) FROM subscription_plans;
SQL
fi

# 5. 清理老备份（只保留最近 10 个）
if [[ -d "$BACKUP_DIR" ]]; then
  ls -t "$BACKUP_DIR" | tail -n +11 | while read -r old; do
    rm -f "${BACKUP_DIR}/${old}"
  done
fi
