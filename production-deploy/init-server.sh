#!/bin/bash
set -e

BLUE='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'
BOLD='\033[1m'

info()    { echo -e "${BLUE}[INFO]${RESET} $1"; }
success() { echo -e "${GREEN}[OK]${RESET} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET} $1"; }
error()   { echo -e "${RED}[ERROR]${RESET} $1"; exit 1; }

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        error "无法检测操作系统版本"
    fi
    info "检测到操作系统: $OS $VERSION"
}

install_docker() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  安装 Docker${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        info "Docker 已安装: $DOCKER_VERSION"
        read -p "是否重新安装？(y/N): " reinstall
        if [ "$reinstall" != "y" ] && [ "$reinstall" != "Y" ]; then
            return
        fi
    fi

    case $OS in
        ubuntu|debian)
            info "安装 Docker..."
            curl -fsSL https://get.docker.com | sh || error "Docker 安装失败"
            ;;
        centos|rhel|fedora|rocky|almalinux)
            info "安装 Docker (官方 docker-ce)..."
            yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
            yum install -y yum-utils device-mapper-persistent-data lvm2 || error "Docker 依赖安装失败"
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo || error "Docker 仓库添加失败"
            yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin || error "Docker 安装失败"
            systemctl start docker || error "Docker 启动失败"
            systemctl enable docker || error "Docker 开机自启失败"
            ;;
        *)
            error "不支持的操作系统: $OS"
            ;;
    esac

    docker --version || error "Docker 安装验证失败"
    success "Docker 安装完成"
}

install_docker_compose() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  安装 Docker Compose${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        info "Docker Compose 已安装: $COMPOSE_VERSION"
        read -p "是否重新安装？(y/N): " reinstall
        if [ "$reinstall" != "y" ] && [ "$reinstall" != "Y" ]; then
            return
        fi
    fi

    case $OS in
        ubuntu|debian)
            info "安装 Docker Compose-Plugin..."
            apt-get install -y docker-compose-plugin || error "Docker Compose 安装失败"
            ;;
        centos|rhel|fedora|rocky|almalinux)
            info "安装 Docker Compose-Plugin..."
            if ! docker compose version &>/dev/null; then
                yum install -y docker-compose-plugin || error "Docker Compose 安装失败"
            fi
            ;;
        *)
            error "不支持的操作系统: $OS"
            ;;
    esac

    docker compose version || error "Docker Compose 安装验证失败"
    success "Docker Compose 安装完成"
}

configure_docker_user() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  配置 Docker 用户${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    CURRENT_USER=$(whoami)

    if [ "$CURRENT_USER" = "root" ]; then
        warn "当前用户是 root，建议使用普通用户运行 Docker"
        read -p "是否创建 docker 用户？(y/N): " create_user
        if [ "$create_user" = "y" ] || [ "$create_user" = "Y" ]; then
            useradd -m -s /bin/bash docker || error "创建 docker 用户失败"
            usermod -aG docker docker || error "添加 docker 用户到组失败"
            success "已创建 docker 用户"
            info "请使用 'su - docker' 切换到 docker 用户"
        fi
    else
        info "当前用户: $CURRENT_USER"
        if groups | grep -q docker; then
            success "用户当前在 docker 组中"
        else
            info "将用户添加到 docker 组..."
            usermod -aG docker $CURRENT_USER || error "添加用户到 docker 组失败"
            success "用户已添加到 docker 组"
            warn "请注销并重新登录以使更改生效"
        fi
    fi
}

optimize_system() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  优化系统性能${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    info "优化文件描述符限制..."
    cat > /etc/security/limits.d/99-docker.conf <<EOF
* soft nofile 65536
* hard nofile 65536
EOF
    success "文件描述符限制已优化"

    info "优化内核参数..."
    cat > /etc/sysctl.d/99-docker.conf <<EOF
vm.max_map_count=262144
fs.inotify.max_user_watches=524288
EOF
    sysctl --system || error "内核参数应用失败"
    success "内核参数已优化"

    info "配置时区为 Asia/Shanghai..."
    timedatectl set-timezone Asia/Shanghai || warn "时区设置失败"
    success "时区已设置"

    info "启用时间同步..."
    case $OS in
        ubuntu|debian)
            apt-get install -y chrony || warn "chrony 安装失败"
            systemctl enable chrony || warn "chrony 启用失败"
            systemctl start chrony || warn "chrony 启动失败"
            ;;
        centos|rhel|fedora|rocky|almalinux)
            yum install -y chrony || warn "chrony 安装失败"
            systemctl enable chronyd || warn "chrony 启用失败"
            systemctl start chronyd || warn "chrony 启动失败"
            ;;
    esac
    success "时间同步已启用"
}

show_system_info() {
    echo ""
    echo -e "${BOLD}${GREEN}========================================${RESET}"
    echo -e "${BOLD}${GREEN}  系统信息${RESET}"
    echo -e "${BOLD}${GREEN}========================================${RESET}"
    echo ""

    info "操作系统: $OS $VERSION"
    info "内核版本: $(uname -r)"
    info "CPU 核心数: $(nproc)"
    info "总内存: $(free -h | grep Mem | awk '{print $2}')"
    info "磁盘空间: $(df -h / | tail -1 | awk '{print $4}') 可用"
    echo ""
    info "Docker 版本: $(docker --version)"
    info "Docker Compose 版本: $(docker compose version)"
    echo ""
    info "Docker 状态:"
    systemctl status docker --no-pager || true
}

main() {
    echo ""
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo -e "${BOLD}${BLUE}  生产服务器环境初始化${RESET}"
    echo -e "${BOLD}${BLUE}========================================${RESET}"
    echo ""

    if [ "$(id -u)" -ne 0 ]; then
        error "请使用 root 用户运行此脚本"
    fi

    detect_os
    install_docker
    install_docker_compose
    configure_docker_user
    optimize_system
    show_system_info

    echo ""
    echo -e "${BOLD}${GREEN}========================================${RESET}"
    echo -e "${BOLD}${GREEN}  初始化完成！${RESET}"
    echo -e "${BOLD}${GREEN}========================================${RESET}"
    echo ""
    echo -e "${BOLD}下一步:${RESET}"
    echo ""
    echo -e "  1. 上传部署文件到服务器"
    echo -e "  2. 导入 Docker 镜像"
    echo -e "  3. 启动服务"
    echo ""
    echo -e "${BOLD}快速命令:${RESET}"
    echo -e "  ${GREEN}docker load -i new-api.tar${RESET}"
    echo -e "  ${GREEN}docker load -i cliproxyapi.tar${RESET}"
    echo -e "  ${GREEN}docker-compose up -d${RESET}"
    echo ""
}

main
