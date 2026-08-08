#!/bin/bash
# =====================================================
# new-api 自动部署脚本
# 用法: ./deploy.sh
# 配合 cron 定时执行，实现自动拉取+构建+重启
# =====================================================
set -e

cd "$(dirname "$0")"

# 日志
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# 记录当前 HEAD，判断是否有更新
BEFORE=$(git rev-parse HEAD)

log "拉取最新代码..."
git pull origin main 2>&1 || true

AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  log "没有新更新，跳过构建"
  exit 0
fi

log "检测到新更新 ($(echo $BEFORE | head -c 8)...$(echo $AFTER | head -c 8))"

# 构建前端
log "构建前端..."
cd web/default
if command -v bun &>/dev/null; then
  bun install && bun run build
elif command -v npm &>/dev/null; then
  npm ci && npm run build
else
  log "错误: 未找到 bun 或 npm"
  exit 1
fi
cd ../..

# 编译 Go 后端
log "编译 Go 二进制..."
go build -o new-api .

# 重启服务
log "重启 new-api 服务..."
if command -v systemctl &>/dev/null; then
  systemctl restart new-api
elif command -v service &>/dev/null; then
  service new-api restart
else
  log "警告: 无法自动重启，请手动重启 new-api"
fi

log "部署完成"
