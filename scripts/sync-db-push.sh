#!/usr/bin/env bash
# 上传本地 one-api.db 到服务器并重启 new-api 服务
# Push local one-api.db to production server and restart service
# 危险操作：会覆盖服务器数据，需二次确认
set -euo pipefail

REMOTE_HOST="${NEWAPI_REMOTE_HOST:-001}"
REMOTE_PATH="${NEWAPI_REMOTE_PATH:-/opt/newapi/data/one-api.db}"
REMOTE_SERVICE="${NEWAPI_REMOTE_SERVICE:-myclaw-newapi}"
LOCAL_PATH="$(cd "$(dirname "$0")/.." && pwd)/one-api.db"

if [[ ! -f "$LOCAL_PATH" ]]; then
  echo "✗ 本地 db 不存在: ${LOCAL_PATH}"
  exit 1
fi

echo "==> ⚠️  危险操作：即将覆盖服务器数据库"
echo "    源（本地）: ${LOCAL_PATH}"
echo "    目标: ${REMOTE_HOST}:${REMOTE_PATH}"
echo "    将重启服务: ${REMOTE_SERVICE}"
echo

# 显示本地数据概览
if command -v sqlite3 &>/dev/null; then
  echo "==> 本地数据概览"
  sqlite3 "$LOCAL_PATH" <<SQL
.mode column
.headers on
SELECT 'users' AS t, count(*) AS c FROM users
UNION ALL SELECT 'tokens', count(*) FROM tokens
UNION ALL SELECT 'channels', count(*) FROM channels
UNION ALL SELECT 'subscription_plans', count(*) FROM subscription_plans;
SQL
  echo
fi

# 显示服务器当前数据概览
echo "==> 服务器当前数据概览"
ssh "$REMOTE_HOST" "command -v sqlite3 >/dev/null && sqlite3 ${REMOTE_PATH} \"
SELECT 'users' AS t, count(*) AS c FROM users
UNION ALL SELECT 'tokens', count(*) FROM tokens
UNION ALL SELECT 'channels', count(*) FROM channels
UNION ALL SELECT 'subscription_plans', count(*) FROM subscription_plans;\" 2>/dev/null || echo '(sqlite3 not available on server)'"
echo

# 二次确认
read -p "确认上传并重启服务？(输入 yes 继续): " answer
if [[ "$answer" != "yes" ]]; then
  echo "已取消"
  exit 0
fi

# 1. 在服务器上备份
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo "==> 服务器端备份现有 db..."
ssh "$REMOTE_HOST" "cp ${REMOTE_PATH} ${REMOTE_PATH}.bak.${TIMESTAMP}"
echo "✓ 备份完成: ${REMOTE_PATH}.bak.${TIMESTAMP}"

# 2. 上传
echo "==> 上传中..."
scp -q "$LOCAL_PATH" "${REMOTE_HOST}:${REMOTE_PATH}"
echo "✓ 上传完成"

# 3. 重启服务
echo "==> 重启服务 ${REMOTE_SERVICE}..."
ssh "$REMOTE_HOST" "systemctl restart ${REMOTE_SERVICE} && sleep 2 && systemctl is-active ${REMOTE_SERVICE}" || {
  echo "✗ 服务重启失败，尝试回滚..."
  ssh "$REMOTE_HOST" "cp ${REMOTE_PATH}.bak.${TIMESTAMP} ${REMOTE_PATH} && systemctl restart ${REMOTE_SERVICE}"
  exit 1
}

echo
echo "✅ 推送成功，服务已重启"
echo "   如需回滚: ssh ${REMOTE_HOST} 'cp ${REMOTE_PATH}.bak.${TIMESTAMP} ${REMOTE_PATH} && systemctl restart ${REMOTE_SERVICE}'"

# 4. 清理服务器老备份（保留最近 5 个）
ssh "$REMOTE_HOST" "ls -t ${REMOTE_PATH}.bak.* 2>/dev/null | tail -n +6 | xargs -r rm -f"
