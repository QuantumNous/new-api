# 构建带 replace-response 插件的 Caddy 镜像
FROM caddy:2.11-builder AS builder
ENV GOPROXY=https://goproxy.cn,direct

RUN xcaddy build \
    --with github.com/caddyserver/replace-response

FROM caddy:2.11-alpine

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
