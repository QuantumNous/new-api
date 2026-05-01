#!/bin/bash
set -e

BLUE='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
    source "$SCRIPT_DIR/.env"
fi

SERVER_USER=${SERVER_USER:-root}
SERVER_HOST=${SERVER_HOST:-your-server-ip}
SERVER_PATH=${SERVER_PATH:-/opt/production-deploy}

NEW_API_PATH=${NEW_API_PATH:-/Users/linbiqiu/new-api-test/new-api/deploy}
CLIPROXY_API_PATH=${CLIPROXY_API_PATH:-/Users/linbiqiu/trae/源码部署/CLIProxyAPI-main}

NEW_API_IMAGE=${NEW_API_IMAGE:-localhost/new-api:1.0.0}
CLIPROXY_API_IMAGE=${CLIPROXY_API_IMAGE:-localhost/cliproxyapi:1.0.0}

SSH_TARGET="${SERVER_USER}@${SERVER_HOST}"

info()    { echo -e "${BLUE}[INFO]${RESET} $1"; }
success() { echo -e "${GREEN}[OK]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $1"; }
error()   { echo -e "${RED}[ERROR]${RESET} $1"; exit 1; }

ssh_run() {
    ssh "$SSH_TARGET" "cd $SERVER_PATH && $1"
}

check_local() {
    info "检查本地 Docker 环境..."
    command -v docker &> /dev/null || error "Docker 未安装"
    docker info &> /dev/null || error "Docker 守护进程未运行，请先启动 Docker"
    success "Docker 环境正常"
}

check_server() {
    info "检查服务器连接..."
    ssh -o ConnectTimeout=5 "$SSH_TARGET" "echo ok" &> /dev/null || error "无法连接服务器 $SSH_TARGET"
    success "服务器连接正常"
}

do_build() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  构建 Docker 镜像${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    check_local

    info "构建 new-api 镜像..."
    cd "$NEW_API_PATH"
    if [ ! -f "Dockerfile.optimized" ]; then
        error "找不到 Dockerfile.optimized，路径: $NEW_API_PATH"
    fi
    docker build \
        --build-arg ENV=production \
        --build-arg VERSION=1.0.0 \
        -t "$NEW_API_IMAGE" \
        -f Dockerfile.optimized \
        .. || error "new-api 镜像构建失败"
    success "new-api 镜像构建完成: $NEW_API_IMAGE"

    info "构建 CLIProxyAPI 镜像..."
    cd "$CLIPROXY_API_PATH"
    if [ ! -f "Dockerfile" ]; then
        error "找不到 Dockerfile，路径: $CLIPROXY_API_PATH"
    fi
    docker build \
        --build-arg VERSION=1.0.0 \
        -t "$CLIPROXY_API_IMAGE" \
        . || error "CLIProxyAPI 镜像构建失败"
    success "CLIProxyAPI 镜像构建完成: $CLIPROXY_API_IMAGE"

    echo ""
    success "所有镜像构建完成！"
    echo ""
    info "下一步: ./deploy.sh export"
}

do_export() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  导出 Docker 镜像${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    cd "$SCRIPT_DIR"

    info "导出 new-api 镜像..."
    docker save -o new-api.tar "$NEW_API_IMAGE" || error "new-api 镜像导出失败"
    NEW_API_SIZE=$(ls -lh new-api.tar | awk '{print $5}')
    success "new-api 镜像已导出: new-api.tar ($NEW_API_SIZE)"

    info "导出 CLIProxyAPI 镜像..."
    docker save -o cliproxyapi.tar "$CLIPROXY_API_IMAGE" || error "CLIProxyAPI 镜像导出失败"
    CLIPROXY_SIZE=$(ls -lh cliproxyapi.tar | awk '{print $5}')
    success "CLIProxyAPI 镜像已导出: cliproxyapi.tar ($CLIPROXY_SIZE)"

    echo ""
    success "所有镜像导出完成！"
    echo ""
    info "下一步: ./deploy.sh upload"
}

do_upload() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  上传到服务器${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    check_server

    cd "$SCRIPT_DIR"

    if [ ! -f "new-api.tar" ]; then
        error "new-api.tar 不存在，请先运行 ./deploy.sh export"
    fi
    if [ ! -f "cliproxyapi.tar" ]; then
        error "cliproxyapi.tar 不存在，请先运行 ./deploy.sh export"
    fi

    info "创建服务器目录: $SERVER_PATH"
    ssh "$SSH_TARGET" "mkdir -p $SERVER_PATH"

    info "上传 new-api 镜像（可能需要几分钟）..."
    scp new-api.tar "$SSH_TARGET:$SERVER_PATH/" || error "new-api 镜像上传失败"
    success "new-api 镜像上传完成"

    info "上传 CLIProxyAPI 镜像（可能需要几分钟）..."
    scp cliproxyapi.tar "$SSH_TARGET:$SERVER_PATH/" || error "CLIProxyAPI 镜像上传失败"
    success "CLIProxyAPI 镜像上传完成"

    info "上传配置文件..."
    scp docker-compose.yml "$SSH_TARGET:$SERVER_PATH/" || error "docker-compose.yml 上传失败"
    scp init-db.sh "$SSH_TARGET:$SERVER_PATH/" || error "init-db.sh 上传失败"

    if [ -f "$SCRIPT_DIR/.env" ]; then
        scp .env "$SSH_TARGET:$SERVER_PATH/" || error ".env 上传失败"
        success ".env 上传完成"
    else
        warn ".env 文件不存在，请上传后手动创建"
    fi

    if [ -f "$SCRIPT_DIR/config.yaml" ]; then
        ssh "$SSH_TARGET" "mkdir -p $SERVER_PATH/cliproxy-config"
        scp config.yaml "$SSH_TARGET:$SERVER_PATH/cliproxy-config/config.yaml" || error "config.yaml 上传失败"
        success "CLIProxyAPI 配置上传完成"
    else
        warn "config.yaml 不存在，CLIProxyAPI 将使用默认配置"
    fi

    echo ""
    success "所有文件上传完成！"
    echo ""
    info "下一步: ./deploy.sh init"
}

do_init() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  初始化服务器部署${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    check_server

    info "导入 Docker 镜像..."
    ssh_run "docker load -i new-api.tar" || error "new-api 镜像导入失败"
    success "new-api 镜像导入完成"

    ssh_run "docker load -i cliproxyapi.tar" || error "CLIProxyAPI 镜像导入失败"
    success "CLIProxyAPI 镜像导入完成"

    info "创建数据目录..."
    ssh_run "mkdir -p new-api-data new-api-logs cliproxy-config cliproxy-auth cliproxy-logs pg-data redis-data" || error "目录创建失败"
    success "数据目录创建完成"

    info "设置 init-db.sh 执行权限..."
    ssh_run "chmod +x init-db.sh" || error "权限设置失败"
    success "权限设置完成"

    info "检查 .env 文件..."
    if ssh_run "test -f .env" 2>/dev/null; then
        success ".env 文件存在"
    else
        warn ".env 文件不存在！"
        info "正在创建默认 .env 文件..."
        ssh_run "cp .env.example .env 2>/dev/null || echo '请手动创建 .env 文件'"
    fi

    info "启动所有服务..."
    ssh_run "docker-compose up -d" || error "服务启动失败"

    echo ""
    sleep 5
    info "服务状态："
    ssh_run "docker-compose ps"

    echo ""
    success "部署初始化完成！"
    echo ""
    echo -e "${BOLD}访问地址:${RESET}"
    echo -e "  new-api:       http://${SERVER_HOST}:3000"
    echo -e "  CLIProxyAPI:   http://${SERVER_HOST}:8317"
    echo -e "  管理面板:       http://${SERVER_HOST}:8085"
}

do_start()    { echo ""; info "启动服务..."; ssh_run "docker-compose up -d" || error "启动失败"; sleep 3; ssh_run "docker-compose ps"; success "服务已启动"; }
do_stop()     { echo ""; info "停止服务..."; ssh_run "docker-compose stop" || error "停止失败"; success "服务已停止"; }
do_restart()  { echo ""; info "重启服务..."; ssh_run "docker-compose restart" || error "重启失败"; sleep 3; ssh_run "docker-compose ps"; success "服务已重启"; }
do_status()   { echo ""; info "服务状态："; ssh_run "docker-compose ps"; }

do_logs() {
    local service=${2:-}
    if [ -n "$service" ]; then
        ssh_run "docker-compose logs -f --tail=200 $service"
    else
        ssh_run "docker-compose logs -f --tail=200"
    fi
}

do_down() {
    echo ""
    warn "这将停止并删除所有容器（数据不会丢失）"
    read -p "确认继续？(y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        ssh_run "docker-compose down" || error "删除失败"
        success "所有容器已删除"
    else
        info "已取消"
    fi
}

do_backup() {
    echo ""
    BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
    info "备份数据库..."
    ssh_run "docker exec postgres pg_dumpall -U root > backup_${BACKUP_DATE}.sql" || error "备份失败"
    success "备份完成: backup_${BACKUP_DATE}.sql"
    info "备份文件位置: $SERVER_PATH/backup_${BACKUP_DATE}.sql"
}

do_help() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  生产环境一键部署脚本${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""
    echo -e "${BOLD}使用方法:${RESET} ./deploy.sh [命令]"
    echo ""
    echo -e "${BOLD}部署流程（首次部署按顺序执行）:${RESET}"
    echo ""
    echo -e "  ${GREEN}1. build${RESET}      本地构建两个项目的 Docker 镜像"
    echo -e "  ${GREEN}2. export${RESET}     导出镜像为 tar 文件"
    echo -e "  ${GREEN}3. upload${RESET}     上传镜像和配置到服务器"
    echo -e "  ${GREEN}4. init${RESET}       在服务器上初始化并启动部署"
    echo ""
    echo -e "${BOLD}管理命令:${RESET}"
    echo ""
    echo -e "  ${YELLOW}start${RESET}      启动所有服务"
    echo -e "  ${YELLOW}stop${RESET}       停止所有服务"
    echo -e "  ${YELLOW}restart${RESET}    重启所有服务"
    echo -e "  ${YELLOW}status${RESET}     查看服务状态"
    echo -e "  ${YELLOW}logs${RESET}       查看服务日志（可指定服务名）"
    echo -e "  ${YELLOW}down${RESET}       停止并删除所有容器"
    echo -e "  ${YELLOW}backup${RESET}     备份数据库"
    echo ""
    echo -e "${BOLD}配置:${RESET}"
    echo -e "  服务器: ${SERVER_USER}@${SERVER_HOST}"
    echo -e "  路径:   ${SERVER_PATH}"
    echo ""
}

COMMAND=${1:-help}

case $COMMAND in
    build)   do_build   ;;
    export)  do_export  ;;
    upload)  do_upload  ;;
    init)    do_init    ;;
    start)   do_start   ;;
    stop)    do_stop    ;;
    restart) do_restart ;;
    status)  do_status  ;;
    logs)    do_logs "$@" ;;
    down)    do_down    ;;
    backup)  do_backup  ;;
    help)    do_help    ;;
    *)       error "未知命令: $COMMAND\n运行 ./deploy.sh help 查看帮助" ;;
esac
