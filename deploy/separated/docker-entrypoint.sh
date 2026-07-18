#!/bin/sh
# 渲染 nginx 模板并以前台模式启动，供独立前端镜像 entrypoint 使用。
set -eu

export BACKEND_UPSTREAM="${BACKEND_UPSTREAM:-backend:3000}"
export NGINX_PORT="${NGINX_PORT:-8080}"
export SERVER_NAME="${SERVER_NAME:-_}"
export CLIENT_MAX_BODY_SIZE="${CLIENT_MAX_BODY_SIZE:-100m}"
export PROXY_CONNECT_TIMEOUT="${PROXY_CONNECT_TIMEOUT:-60s}"
export PROXY_SEND_TIMEOUT="${PROXY_SEND_TIMEOUT:-3600s}"
export PROXY_READ_TIMEOUT="${PROXY_READ_TIMEOUT:-3600s}"
# Docker 内置 DNS；非 Docker 环境可改为可用解析器。
export DNS_RESOLVER="${DNS_RESOLVER:-127.0.0.11}"

TEMPLATE="/etc/nginx/templates/nginx.conf.template"
TARGET="/etc/nginx/nginx.conf"

if [ ! -f "$TEMPLATE" ]; then
  echo "missing nginx template: $TEMPLATE" >&2
  exit 1
fi

# 只替换已知占位符，避免误伤 nginx 变量（$host、$uri 等）。
envsubst '${BACKEND_UPSTREAM} ${NGINX_PORT} ${SERVER_NAME} ${CLIENT_MAX_BODY_SIZE} ${PROXY_CONNECT_TIMEOUT} ${PROXY_SEND_TIMEOUT} ${PROXY_READ_TIMEOUT} ${DNS_RESOLVER}' \
  < "$TEMPLATE" > "$TARGET"

# 启动前做配置语法检查，失败直接退出容器。
nginx -t -c "$TARGET"

exec nginx -g 'daemon off;' -c "$TARGET"
