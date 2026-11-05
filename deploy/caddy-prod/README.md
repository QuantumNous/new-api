# Caddy 替换 Nginx 部署说明

本目录提供使用 Caddy 替代传统 Nginx 的配置方案。

## 插件说明
使用 Caddy 替代 Nginx 时，若需实现对等的响应内容改写（如 SPA 页面标题与 Meta 标签动态替换），需使用 [`caddyserver/replace-response`](https://github.com/caddyserver/replace-response) 插件。
---

## 2. 部署方案

### 方案 A：Docker 容器化部署（推荐）

1. **构建镜像**：
   ```bash
   cd deploy/caddy-prod
   docker build -t new-api-caddy:latest .
   ```

2. **启动容器**（使用 host 网络直通或映射 80/443）：
   ```bash
   docker run -d --name new-api-caddy \
     --restart always \
     --network host \
     -v $(pwd)/Caddyfile:/etc/caddy/Caddyfile:ro \
     -v /etc/ssl/certs:/etc/ssl:ro \
     -v /var/www/seo:/var/www/seo:ro \
     new-api-caddy:latest
   ```

### 方案 B：单二进制 systemd 部署

如果希望像原先 Nginx 一样作为系统服务直接跑在宿主机：

1. **一键下载官方已集成插件的二进制**：
   ```bash
   curl -sSL "https://caddyserver.com/api/download?os=linux&arch=amd64&p=github.com%2Fcaddyserver%2Freplace-response" -o /usr/bin/caddy
   chmod +x /usr/bin/caddy
   ```

2. **验证插件已加载**：
   ```bash
   caddy list-modules | grep replace
   ```

3. **配置 systemd** 并加载 `Caddyfile`。

---

## 3. 切换与回滚策略

- **测试**：在未停用 Nginx 前，可先启动 Caddy 绑定至测试端口（如 8443）验证证书与反代行为。
- **切换**：`systemctl stop nginx && systemctl start caddy`（停机耗时仅需 ~1 秒）。
- **回滚**：若有异常，`systemctl stop caddy && systemctl start nginx` 即可瞬间秒级切回原状。
