#!/usr/bin/env bash
set -euo pipefail

# 配置
COMPOSE_FILE="docker-compose.yml"
HEALTHCHECK_INTERVAL=5
HEALTHCHECK_TIMEOUT=120

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 确保 postgres 和 redis 正在运行
for svc in postgres redis; do
    if ! docker compose -f "$COMPOSE_FILE" ps -q "$svc" 2>/dev/null | grep -q .; then
        log_error "$svc 未运行，请先确保数据库和缓存服务正常"
        exit 1
    fi
done

# 等待容器健康
wait_healthy() {
    local container=$1
    local elapsed=0
    log_info "等待 $container 健康检查通过..."
    while [ "$elapsed" -lt "$HEALTHCHECK_TIMEOUT" ]; do
        local health
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            log_info "$container 已健康"
            return 0
        fi
        sleep "$HEALTHCHECK_INTERVAL"
        elapsed=$(( elapsed + HEALTHCHECK_INTERVAL ))
        log_info "等待中... ($elapsed/${HEALTHCHECK_TIMEOUT}s)"
    done
    log_error "$container 在 ${HEALTHCHECK_TIMEOUT}s 内未通过健康检查"
    return 1
}

# Step 1: 构建新镜像
log_info "构建新镜像..."
docker compose -f "$COMPOSE_FILE" build new-api-1

# Step 2: 滚动更新 new-api-1
log_info "=== 更新 new-api-1 ==="
log_info "new-api-2 继续服务，停止 new-api-1..."
docker compose -f "$COMPOSE_FILE" stop new-api-1
docker compose -f "$COMPOSE_FILE" up -d new-api-1

if ! wait_healthy new-api-1; then
    log_error "new-api-1 启动失败！new-api-2 仍在服务"
    exit 1
fi

# Step 3: 滚动更新 new-api-2
log_info "=== 更新 new-api-2 ==="
log_info "new-api-1 已就绪，停止 new-api-2..."
docker compose -f "$COMPOSE_FILE" stop new-api-2
docker compose -f "$COMPOSE_FILE" up -d new-api-2

if ! wait_healthy new-api-2; then
    log_error "new-api-2 启动失败！new-api-1 仍在服务"
    exit 1
fi

log_info "部署完成！两个实例均已更新"
