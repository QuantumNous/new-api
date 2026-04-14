#!/bin/bash
# New API 部署脚本
# Usage: sudo ./deploy.sh <deploy_dir> [domain] [backend_port] [backend_host] [ssl_email]
# Example: sudo ./deploy.sh /tmp/new-api-deploy api.4aicode.com 3000 127.0.0.1 ceo@richcalls.xyz

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 参数
DEPLOY_DIR="${1:?请提供部署目录路径}"
DOMAIN="${2:-}"
BACKEND_PORT="${3:-3000}"
BACKEND_HOST="${4:-127.0.0.1}"
SSL_EMAIL="${5:-}"

# 常量
SERVICE_NAME="new-api"
INSTALL_DIR="/opt/new-api"
SERVICE_FILE="/etc/systemd/system/new-api.service"
NGINX_CONF="/etc/nginx/sites-available/new-api"
NGINX_CONF_SOURCE="deploy/nginx-new-api.conf"

echo -e "${BLUE}=== New API 部署脚本 ===${NC}"
echo ""

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: 请使用 root 权限运行 (use sudo)${NC}"
    exit 1
fi

# 检查部署目录
if [ ! -d "$DEPLOY_DIR" ]; then
    echo -e "${RED}Error: 部署目录不存在: $DEPLOY_DIR${NC}"
    exit 1
fi

cd "$DEPLOY_DIR"

# 检查二进制文件
if [ ! -f "new-api" ]; then
    echo -e "${RED}Error: 找不到二进制文件: new-api${NC}"
    exit 1
fi

echo -e "${BLUE}1. 准备安装目录...${NC}"

mkdir -p "$INSTALL_DIR"/{data,logs}

# 创建服务用户（首次部署需要）
if ! id new-api &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin new-api
fi

# 确保目录权限正确（服务以 new-api 用户运行）
chown -R new-api:new-api "$INSTALL_DIR"/{data,logs}

echo -e "${BLUE}2. 停止现有服务...${NC}"

systemctl stop $SERVICE_NAME 2>/dev/null || true

echo -e "${BLUE}3. 安装二进制文件...${NC}"

# 备份旧二进制
if [ -f "$INSTALL_DIR/new-api" ]; then
    mv "$INSTALL_DIR/new-api" "$INSTALL_DIR/new-api.backup.$(date +%Y%m%d%H%M%S)"
    echo -e "${YELLOW}已备份旧版本${NC}"
fi

# 安装新二进制
cp new-api "$INSTALL_DIR/new-api"
chmod +x "$INSTALL_DIR/new-api"
chown new-api:new-api "$INSTALL_DIR/new-api"

echo -e "${GREEN}✅ 二进制文件已安装${NC}"

# 检查 .env 是否存在，并确保权限正确
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}❌ 未找到 $INSTALL_DIR/.env，请先上传 .env 文件${NC}"
    echo -e "${YELLOW}参考 deploy/.env.example 创建${NC}"
    exit 1
fi
chown new-api:new-api "$INSTALL_DIR/.env"
chmod 600 "$INSTALL_DIR/.env"

echo -e "${BLUE}4. 安装 systemd 服务...${NC}"

cp deploy/new-api.service "$SERVICE_FILE"
systemctl daemon-reload
echo -e "${GREEN}✅ 服务文件已安装${NC}"

echo -e "${BLUE}5. 检查部署模式...${NC}"

# 判断是否首次部署（Nginx 配置不存在）
if [ ! -f "$NGINX_CONF" ] && [ -n "$DOMAIN" ]; then
    echo -e "${YELLOW}检测到首次部署，执行完整配置（Nginx + SSL）...${NC}"

    chmod +x deploy/deploy-all.sh
    ./deploy/deploy-all.sh "$DOMAIN" "$BACKEND_PORT" "$BACKEND_HOST" "$SSL_EMAIL"
else
    echo -e "${YELLOW}更新部署，只重启服务...${NC}"

    # 启动服务
    systemctl start $SERVICE_NAME
    systemctl enable $SERVICE_NAME

    # 更新 Nginx 配置（自动同步模板变更）
    if [ -n "$DOMAIN" ]; then
        if [ -f "$NGINX_CONF" ]; then
            BACKUP_FILE="${NGINX_CONF}.backup.$(date +%Y%m%d%H%M%S)"
            cp "$NGINX_CONF" "$BACKUP_FILE"
        fi

        if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
            sed "s|__DOMAIN__|$DOMAIN|g; s|__BACKEND_PORT__|$BACKEND_PORT|g; s|__BACKEND_HOST__|$BACKEND_HOST|g; s|server_name _;|server_name $DOMAIN;|g" \
                "$NGINX_CONF_SOURCE" > "$NGINX_CONF"
        else
            cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://$BACKEND_HOST:$BACKEND_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
        fi
    else
        if [ -f "$NGINX_CONF" ]; then
            sed -i "s|proxy_pass http://[^;]*;|proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};|g" "$NGINX_CONF"
        fi
    fi

    # 重载 Nginx
    if command -v nginx &>/dev/null && systemctl is-active --quiet nginx; then
        if nginx -t; then
            systemctl reload nginx
        else
            echo -e "${RED}❌ Nginx 配置测试失败${NC}"
            exit 1
        fi
    fi

    echo -e "${GREEN}✅ 服务已启动${NC}"
fi

echo -e "${BLUE}6. 验证部署...${NC}"

sleep 3

# 检查服务状态
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ 服务运行正常${NC}"
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo -e "${YELLOW}尝试回滚...${NC}"

    LATEST_BACKUP=$(ls -t "$INSTALL_DIR"/new-api.backup.* 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        cp "$LATEST_BACKUP" "$INSTALL_DIR/new-api"
        chown new-api:new-api "$INSTALL_DIR/new-api"
        systemctl start $SERVICE_NAME
        echo -e "${YELLOW}已回滚到旧版本${NC}"
    fi

    echo "查看日志: journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

# 检查端口监听
if ss -tlnp 2>/dev/null | grep -qE ":$BACKEND_PORT([[:space:]]|$)"; then
    echo -e "${GREEN}✅ 端口 $BACKEND_PORT 监听正常${NC}"
else
    echo -e "${YELLOW}⚠️  端口 $BACKEND_PORT 未检测到监听${NC}"
fi

echo -e "${BLUE}7. 清理部署文件...${NC}"

cd /
rm -rf "$DEPLOY_DIR"
echo -e "${GREEN}✅ 清理完成${NC}"

echo ""
echo -e "${GREEN}=== 部署成功！ ===${NC}"
echo ""
