#!/bin/bash
# New API 完整部署脚本（首次部署：Nginx + SSL）
# Usage: sudo ./deploy-all.sh [domain] [backend_port] [backend_host] [ssl_email]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="${1:-}"
BACKEND_PORT="${2:-3000}"
BACKEND_HOST="${3:-127.0.0.1}"
SERVICE_NAME="new-api"
NGINX_CONF_SOURCE="deploy/nginx-new-api.conf"
NGINX_CONF_TARGET="/etc/nginx/sites-available/new-api"
NGINX_ENABLED_SITES="/etc/nginx/sites-enabled"
EMAIL="${4:-admin@${DOMAIN}}"

echo -e "${BLUE}=== New API Nginx 反向代理部署 ===${NC}"
echo ""
echo "配置参数："
echo "  域名:         ${DOMAIN:-未配置}"
echo "  后端地址:     ${BACKEND_HOST}:${BACKEND_PORT}"
echo "  邮箱:         ${EMAIL}"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: 请使用 root 权限运行 (use sudo)${NC}"
    exit 1
fi

# 如果没有提供域名，只启动 Go 服务
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}警告: 未配置域名，跳过 Nginx 和 SSL 配置${NC}"
    systemctl restart $SERVICE_NAME || true
    systemctl enable $SERVICE_NAME
    echo -e "${GREEN}✅ 服务已启动${NC}"
    exit 0
fi

echo -e "${BLUE}1. 检查并安装依赖...${NC}"

if ! command -v nginx &>/dev/null; then
    echo -e "${YELLOW}安装 Nginx...${NC}"
    apt-get update -qq
    apt-get install -y nginx
fi

if ! command -v certbot &>/dev/null; then
    echo -e "${YELLOW}安装 Certbot (Let's Encrypt)...${NC}"
    apt-get install -y certbot python3-certbot-nginx
fi

echo -e "${BLUE}2. 配置 Nginx...${NC}"

BACKUP_FILE=""
if [ -f "$NGINX_CONF_TARGET" ]; then
    BACKUP_FILE="${NGINX_CONF_TARGET}.backup.$(date +%Y%m%d%H%M%S)"
    cp "$NGINX_CONF_TARGET" "$BACKUP_FILE"
    echo -e "${YELLOW}已备份现有配置: $BACKUP_FILE${NC}"
fi

SSL_EXISTS=false
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    SSL_EXISTS=true
fi

if [ "$SSL_EXISTS" = true ]; then
    sed "s/__DOMAIN__/$DOMAIN/g; s/__BACKEND_PORT__/$BACKEND_PORT/g; s/__BACKEND_HOST__/$BACKEND_HOST/g; s/server_name _;/server_name $DOMAIN;/g" \
        "$NGINX_CONF_SOURCE" > "$NGINX_CONF_TARGET"
    echo -e "${GREEN}✅ Nginx 配置已更新（含 SSL）${NC}"
else
    cat > "$NGINX_CONF_TARGET" << EOF
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
    echo -e "${GREEN}✅ Nginx 临时配置已创建（HTTP-only）${NC}"
fi

echo -e "${BLUE}3. 配置 SSL 证书...${NC}"

if [ "$SSL_EXISTS" = true ]; then
    echo -e "${GREEN}✅ SSL 证书已存在，跳过申请（certbot 会自动续期）${NC}"
else
    ln -sf "$NGINX_CONF_TARGET" "$NGINX_ENABLED_SITES/new-api"
    rm -f "$NGINX_ENABLED_SITES/default"
    nginx -t && systemctl reload nginx

    echo -e "${YELLOW}为 $DOMAIN 申请 SSL 证书...${NC}"

    if certbot --nginx -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --redirect; then
        echo -e "${GREEN}✅ SSL 证书申请成功${NC}"
    else
        echo -e "${RED}❌ SSL 证书申请失败${NC}"
        echo -e "${YELLOW}提示: 请确保域名已正确解析到此服务器${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}4. 启用 Nginx 站点...${NC}"

ln -sf "$NGINX_CONF_TARGET" "$NGINX_ENABLED_SITES/new-api"
rm -f "$NGINX_ENABLED_SITES/default"

echo -e "${BLUE}5. 测试 Nginx 配置...${NC}"

if ! nginx -t; then
    echo -e "${RED}❌ Nginx 配置测试失败${NC}"
    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
        echo -e "${YELLOW}恢复备份配置...${NC}"
        cp "$BACKUP_FILE" "$NGINX_CONF_TARGET"
    fi
    exit 1
fi

echo -e "${GREEN}✅ Nginx 配置测试通过${NC}"

echo -e "${BLUE}6. 启动服务...${NC}"

if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ 服务正在运行${NC}"
else
    systemctl start $SERVICE_NAME
    systemctl enable $SERVICE_NAME
fi

systemctl reload nginx
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx 正在运行${NC}"
else
    systemctl start nginx
    systemctl enable nginx
    echo -e "${GREEN}✅ Nginx 已启动${NC}"
fi

echo -e "${BLUE}7. 验证部署...${NC}"

sleep 2
if ss -tlnp 2>/dev/null | grep -q ":$BACKEND_PORT"; then
    echo -e "${GREEN}✅ 后端服务监听端口 $BACKEND_PORT${NC}"
else
    echo -e "${RED}❌ 后端服务未监听端口 $BACKEND_PORT${NC}"
    echo "请检查日志: journalctl -u $SERVICE_NAME -n 20"
fi

echo -e "${YELLOW}测试 HTTPS 访问...${NC}"
if curl -sSf "https://$DOMAIN" >/dev/null 2>&1 || curl -sSf "https://$DOMAIN/api/status" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ HTTPS 访问正常${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS 测试失败（可能需要等待 DNS 生效）${NC}"
fi

echo ""
echo -e "${GREEN}=== 部署完成！ ===${NC}"
echo ""
echo -e "${BLUE}访问地址：${NC}"
echo -e "  后端 API:  ${GREEN}https://$DOMAIN${NC}"
echo ""
echo -e "${BLUE}常用命令：${NC}"
echo -e "  查看日志:     ${YELLOW}journalctl -u $SERVICE_NAME -f${NC}"
echo -e "  重启服务:     ${YELLOW}systemctl restart $SERVICE_NAME${NC}"
echo -e "  续期证书:     ${YELLOW}certbot renew${NC}"
echo ""
