#!/bin/bash

# 本地重新编译并运行 new-api 项目的脚本
# 作者: AI Assistant
# 用途: 用于本地开发时快速重新编译和启动服务

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/web"
BACKEND_DIR="$PROJECT_ROOT"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    # 检查 Go
    if ! command -v go &> /dev/null; then
        log_error "Go 未安装，请先安装 Go"
        exit 1
    fi
    log_success "Go 已安装: $(go version)"

    # 检查 bun，支持多种安装路径
    BUN_CMD=""
    if command -v bun &> /dev/null; then
        BUN_CMD="bun"
    elif [ -f "$HOME/.bun/bin/bun" ]; then
        BUN_CMD="$HOME/.bun/bin/bun"
        log_info "使用本地安装的 bun: $BUN_CMD"
    elif [ -f "/usr/local/bin/bun" ]; then
        BUN_CMD="/usr/local/bin/bun"
        log_info "使用系统安装的 bun: $BUN_CMD"
    else
        log_error "bun 未找到，请先安装 bun"
        log_info "安装命令: curl -fsSL https://bun.sh/install | bash"
        exit 1
    fi
    log_success "bun 已找到: $($BUN_CMD --version)"
}

# 停止现有进程
stop_existing_processes() {
    log_info "停止现有的 new-api 进程..."
    
    # 查找并杀死现有的 new-api 进程
    if pgrep -f "one-api" > /dev/null; then
        log_warning "发现运行中的 one-api 进程，正在停止..."
        pkill -f "one-api" || true
        sleep 2
    fi
    
    # 查找并杀死占用3000端口的进程
    if lsof -ti:3000 > /dev/null 2>&1; then
        log_warning "发现占用3000端口的进程，正在停止..."
        lsof -ti:3000 | xargs kill -9 || true
        sleep 2
    fi
    
    log_success "进程清理完成"
}

# 构建前端
build_frontend() {
    log_info "开始构建前端..."

    cd "$FRONTEND_DIR"

    # 安装依赖
    log_info "安装前端依赖..."
    $BUN_CMD install

    # 构建前端
    log_info "编译前端代码..."
    DISABLE_ESLINT_PLUGIN='true' VITE_REACT_APP_VERSION=$(cat ../VERSION) $BUN_CMD run build

    log_success "前端构建完成"
    cd "$PROJECT_ROOT"
}

# 构建后端
build_backend() {
    log_info "开始构建后端..."
    
    cd "$BACKEND_DIR"
    
    # 下载依赖
    log_info "下载 Go 模块依赖..."
    go mod download
    
    # 构建后端
    log_info "编译后端代码..."
    go build -ldflags "-s -w -X 'one-api/common.Version=$(cat VERSION)'" -o one-api
    
    log_success "后端构建完成"
}

# 启动服务
start_service() {
    log_info "启动 new-api 服务..."
    
    cd "$BACKEND_DIR"
    
    # 检查可执行文件是否存在
    if [ ! -f "./one-api" ]; then
        log_error "可执行文件 one-api 不存在"
        exit 1
    fi
    
    # 启动服务
    log_info "正在启动服务，监听端口 3000..."
    ./one-api &
    
    # 获取进程ID
    SERVICE_PID=$!
    echo $SERVICE_PID > .service.pid
    
    log_success "服务已启动，PID: $SERVICE_PID"
    log_info "服务地址: http://localhost:3000"
    log_info "要停止服务，请运行: kill $SERVICE_PID 或者 ./dev-rebuild.sh stop"
}

# 停止服务
stop_service() {
    log_info "停止服务..."
    
    if [ -f ".service.pid" ]; then
        PID=$(cat .service.pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            log_success "服务已停止 (PID: $PID)"
        else
            log_warning "进程 $PID 不存在"
        fi
        rm -f .service.pid
    else
        log_warning "未找到服务PID文件"
    fi
    
    # 额外清理
    stop_existing_processes
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  start, run     重新编译并启动服务 (默认)"
    echo "  stop           停止服务"
    echo "  restart        重启服务"
    echo "  frontend       仅构建前端"
    echo "  backend        仅构建后端"
    echo "  build          仅构建，不启动"
    echo "  help, -h       显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0              # 重新编译并启动"
    echo "  $0 start        # 重新编译并启动"
    echo "  $0 stop         # 停止服务"
    echo "  $0 restart      # 重启服务"
    echo "  $0 frontend     # 仅构建前端"
    echo "  $0 backend      # 仅构建后端"
}

# 主函数
main() {
    local action="${1:-start}"
    
    case "$action" in
        "start"|"run"|"")
            log_info "开始重新编译并启动 new-api..."
            check_dependencies
            stop_existing_processes
            build_frontend
            build_backend
            start_service
            log_success "重新编译并启动完成！"
            ;;
        "stop")
            stop_service
            ;;
        "restart")
            log_info "重启服务..."
            stop_service
            sleep 2
            check_dependencies
            build_frontend
            build_backend
            start_service
            log_success "服务重启完成！"
            ;;
        "frontend")
            log_info "仅构建前端..."
            check_dependencies
            build_frontend
            ;;
        "backend")
            log_info "仅构建后端..."
            check_dependencies
            build_backend
            ;;
        "build")
            log_info "构建项目..."
            check_dependencies
            build_frontend
            build_backend
            log_success "构建完成！"
            ;;
        "help"|"-h")
            show_help
            ;;
        *)
            log_error "未知选项: $action"
            show_help
            exit 1
            ;;
    esac
}

# 捕获 Ctrl+C 信号
trap 'log_warning "收到中断信号，正在清理..."; stop_service; exit 0' INT TERM

# 执行主函数
main "$@"
