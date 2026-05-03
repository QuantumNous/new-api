# 部署指南

> 本指南覆盖 AIKanHub 的本地 Docker 部署。生产环境（k8s / 多区域 / CDN）暂未在本指南覆盖范围内。

## 一、前置要求

| 工具/服务 | 用途 | 备注 |
|---|---|---|
| Docker 24+ + Docker Compose v2 | 跑应用容器 | 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 即可 |
| [Neon](https://console.neon.tech) 账号 | PostgreSQL 数据库 | Free 层够 MVP |
| 火山引擎 Ark API key | Seedance 2.0 上游 | 在 [火山引擎控制台](https://console.volcengine.com/ark) 申请，形如 `ark-xxxxxxxx` |

可选：自有域名 + TLS（如要对外提供服务）。

## 二、5 步部署

### 步骤 1：克隆仓库

```bash
git clone git@github.com:NekoAIKan/aikanhub.git
cd aikanhub
```

### 步骤 2：创建 Neon 数据库

1. 登录 [console.neon.tech](https://console.neon.tech)，新建 project
   - Region 推荐 **AWS Singapore** 或 **AWS Tokyo**（国内访问最快）
2. 进入 project → 右上角 **Connection Details**
3. ⚠️ 选 **"Direct connection"**，**不要选** "Pooled connection"
   （PgBouncer 的 transaction mode 会和 GORM prepared statements 冲突）
4. 复制连接串，形如：
   ```
   postgresql://neondb_owner:npg_xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```

### 步骤 3：配置环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，填入 Neon 连接串：

```bash
SQL_DSN=postgresql://neondb_owner:npg_xxx@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
```

其他字段（Redis 密码、SESSION_SECRET 等）已生成默认值，**生产部署前务必改 SESSION_SECRET**：

```bash
# 生成新的 SESSION_SECRET
openssl rand -hex 32
```

### 步骤 4：启动

```bash
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
```

首次启动：
- 镜像 build 约 5–10 分钟（后续 build 缓存命中后 20 秒内）
- 容器启动后会跑一次 schema migration（Neon 远程往返 60–90 秒）
- 之后重启走 schema-hash 跳过迁移，**约 11 秒就绪**

等待就绪：

```bash
until curl -sf http://localhost:3000/api/status > /dev/null; do sleep 2; done && echo "READY"
```

### 步骤 5：首次配置

打开浏览器访问 [http://localhost:3000](http://localhost:3000)：

1. **注册首个用户**——自动成为 root admin（角色 100）
2. **进入「渠道管理」→「添加新的渠道」**：
   - 类型：搜索"豆包视频"（type 54 / DoubaoVideo）
   - 名称：`doubao-prod`
   - 分组：勾选 `default`
   - 模型：手动添加 `doubao-seedance-2-0-260128` 和 `doubao-seedance-2-0-fast-260128`
   - 密钥：粘贴你的火山引擎 ark token
   - 代理 / Base URL：留空（adaptor 自带 `https://ark.cn-beijing.volces.com`）
   - 保存 → 点"测试"按钮验证连通
3. **「令牌」→「添加新的令牌」**，复制 `sk-` 开头的字符串
4. **测试 API**：

```bash
export AIKANHUB_TOKEN=sk-xxxxxxxx
bash tools/test-seedance.sh
```

预期：90–120 秒后输出 `SUCCESS` 和视频 URL。

---

## 三、日常运维

### 升级到新版本

```bash
git pull
docker compose -f docker-compose.local.yml --env-file .env.local up -d --build
```

- Schema 没变 → 11 秒就绪（hash 检查跳过迁移）
- Schema 有变 → 自动迁移 + 写入新 hash，下次重启又快了

### 查看日志

```bash
docker compose -f docker-compose.local.yml --env-file .env.local logs -f app
```

错误日志单独看：

```bash
docker compose -f docker-compose.local.yml --env-file .env.local logs app | grep -E "ERROR|FATAL"
```

### 停服 / 重启

```bash
# 停服（保留 Redis 数据）
docker compose -f docker-compose.local.yml --env-file .env.local down

# 完全重置（删除 Redis volume；不影响 Neon 数据）
docker compose -f docker-compose.local.yml --env-file .env.local down -v

# 只重启 app（保留 redis 容器，最快）
docker compose -f docker-compose.local.yml --env-file .env.local restart app
```

### 备份

- **Neon**：自带 Point-in-Time Restore（Launch tier $19/月起），不需要手动备份
- **Redis**：本地缓存，不需要备份
- **应用配置**：在 admin 后台「系统设置」改的内容存在 Neon `options` 表里，已被 Neon 自动备份覆盖
- **`.env.local`**：本地文件，请自行妥善保管（含 Neon 密码、ark key 等敏感信息）

---

## 四、常见问题

### Q1：启动时 SLOW SQL 刷屏

**正常**——首次启动 GORM AutoMigrate 在 Neon 远程跑 ~100 个 schema 检查查询，每个 200–400ms。

> 如果重启依然刷屏，说明 schema-hash 没存进去：检查 `Option` 表里 `SchemaMigrationHash` 是否有值。可以临时用 `SKIP_AUTO_MIGRATION_HASH_CHECK=true` 强制再跑一次。

### Q2：`/v1/video/generations` 返回 `model_price_error`

模型定价没配。两种处理：

```javascript
// 方式 A：开启自用模式（绕过定价检查，仅适合内部测试）
fetch('/api/option/', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({key: 'SelfUseModeEnabled', value: 'true'}),
}).then(r => r.json()).then(console.log)
```

```javascript
// 方式 B：配定价（生产推荐）
const priceMap = {
  'doubao-seedance-2-0-260128': 0.885,
  'doubao-seedance-2-0-fast-260128': 0.712,
};
fetch('/api/option/', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({key: 'ModelPrice', value: JSON.stringify(priceMap)}),
}).then(r => r.json()).then(console.log)
```

### Q3：视频预览返回 502

视频上游 URL 24 小时过期。生成成功后第一时间通过 `/v1/videos/{task_id}/content` 下载到本地或自有对象存储。永久存储计划见 [Issue #7](https://github.com/NekoAIKan/aikanhub/issues/7)。

### Q4：用户注册后没有额度

新用户默认额度由 admin 在系统设置里配置。手动给某个用户充额度（admin 在浏览器控制台跑）：

```javascript
fetch('/api/user/manage', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({id: <user_id>, action: 'add_quota', mode: 'add', value: 50000000}),  // 50000000 quota = $100
}).then(r => r.json()).then(console.log)
```

### Q5：build 太慢

第一次 build ~20s，已用 BuildKit cache mounts。如果异常慢：

```bash
docker builder prune --all  # 清空 build cache 重来
docker compose -f docker-compose.local.yml --env-file .env.local build --no-cache
```

### Q6：站点名/logo 显示成 `New API`/旧图标

DB 里 `SystemName` Option 还是初始值。两种处理：

- 进 admin 后台 → 系统设置 → 站点信息，改成 `AIKanHub`
- 或浏览器控制台跑：

```javascript
fetch('/api/option/', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({key: 'SystemName', value: 'AIKanHub'}),
}).then(r => r.json()).then(console.log)
```

Logo 是编译进二进制的，必须 `up -d --build` 重新构建才会生效（仅在替换了 `web/default/public/logo.png` 之后才需要）。

---

## 五、域名 + TLS（生产对外服务必做）

把 `localhost:3000` 暴露成 `https://your.domain.com` 有两条路。

### 路径 A：Caddy 反代 + Let's Encrypt（推荐：标准、简单、有真证书）

**前提**：服务器入站要开 80（证书申请）和 443（HTTPS 服务）。云厂商安全组 + Ubuntu UFW 都要开。

#### 步骤 1：开端口

**腾讯云 / 阿里云 / AWS** 等：进控制台找到这台 VM 绑的安全组，加入站规则：

| 协议 | 端口 | 来源 | 用途 |
|---|---|---|---|
| TCP | 80 | 0.0.0.0/0 | HTTP（Let's Encrypt 验证 + 重定向到 HTTPS）|
| TCP | 443 | 0.0.0.0/0 | HTTPS |

⚠️ 同时**移除之前 3000 的入站规则**，不再裸暴露 app 端口。

Ubuntu 自带 ufw 检查：

```bash
sudo ufw status
# 如果是 active 而没有 80/443，加上：
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
```

#### 步骤 2：DNS

在域名服务商（Cloudflare / DNSPod / Route53 等）加 A 记录：

- 类型 `A`，主机 `@`（或 `www`），值 = 服务器公网 IP
- 如果用 Cloudflare：**先选 DNS only（灰云）**，让 Caddy 能直连服务器申请证书。证书拿到后再切橙云

#### 步骤 3：装 Caddy + 写配置

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

写 Caddyfile（**注意**：用 nano/vim 直接编辑，避免从聊天工具粘贴时把域名渲染成 markdown 链接 `[domain](http://domain)`）：

```bash
sudo nano /etc/caddy/Caddyfile
```

填入（把 `your.domain.com` 换成你的域名）：

```caddy
your.domain.com {
    reverse_proxy localhost:3000
    request_body {
        max_size 100MB
    }
}

www.your.domain.com {
    redir https://your.domain.com{uri} permanent
}
```

#### 步骤 4：启动 + 验证

```bash
# 验证语法
sudo caddy validate --config /etc/caddy/Caddyfile

# 启动 + 开机自启
sudo systemctl enable --now caddy

# 看证书申请（应看到 "certificate obtained successfully"）
sudo journalctl -u caddy -n 30 --no-pager | grep -E "certificate|obtained|tls"

# 服务器自测
curl -sI https://your.domain.com/api/status | head -3
```

预期返回 `HTTP/2 200`。

#### 步骤 5（可选）：Cloudflare 橙云

证书 OK 后，回 Cloudflare DNS → 把 A 记录切到 **Proxied**（橙云）→ SSL/TLS → encryption mode 选 **Full (strict)**（你服务器有真证书）。

⚠️ **不要选 Flexible**（CF 与你服务器走 HTTP，会出 redirect 死循环）。

#### 步骤 6：后端配 ServerAddress

登录 admin 后台，浏览器 console 跑：

```javascript
fetch('/api/option/', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'New-Api-User': '1',
    'Authorization': 'Bearer ' + localStorage.getItem('access_token'),
  },
  body: JSON.stringify({key: 'ServerAddress', value: 'https://your.domain.com'}),
}).then(r => r.json()).then(console.log)
```

影响密码重置邮件链接、视频代理 URL 等。

---

### 路径 B：Cloudflare Tunnel（推荐：无法登云控制台 / 国内地域 ICP 限制 / 想隐藏服务器 IP）

**适用场景**：
- 拿不到云厂商安全组的修改权（443 入站打不开）
- 服务器在国内地域 + 域名无法 ICP 备案（如 `.ai`），443/80 被 ISP 过滤
- 想把服务器公网 IP 完全藏起来（防 DDoS / 防扫描）

#### 原理

服务器跑 `cloudflared` 守护进程，**主动出站**连 Cloudflare 边缘，建立长连接。用户访问域名时，CF 沿着这条已存在的连接把请求"塞"给你的服务器。**不需要任何入站端口**。

#### 步骤 1：装 cloudflared

```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

#### 步骤 2：浏览器授权

```bash
cloudflared tunnel login
```

会打印 URL，本地浏览器打开 → 登 Cloudflare → 选你的 zone → Authorize。
服务器自动下载 `~/.cloudflared/cert.pem`。

#### 步骤 3：创建 tunnel

```bash
cloudflared tunnel create aikanhub
# 输出会包含 UUID，记下来
```

#### 步骤 4：写配置

```bash
TUNNEL_UUID=<上一步的 UUID>
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_UUID
credentials-file: $HOME/.cloudflared/$TUNNEL_UUID.json

ingress:
  - hostname: your.domain.com
    service: http://localhost:3000
  - hostname: www.your.domain.com
    service: http://localhost:3000
  - service: http_status:404
EOF
```

#### 步骤 5：DNS 路由（自动建 CNAME）

```bash
cloudflared tunnel route dns aikanhub your.domain.com
cloudflared tunnel route dns aikanhub www.your.domain.com
```

完成后 CF DNS 里多了两条 CNAME 指向 `<UUID>.cfargotunnel.com`。**之前手动加的 A 记录可以删掉**。

#### 步骤 6：跑起来 + 装服务

```bash
# 前台测试
cloudflared tunnel run aikanhub

# 浏览器验证 https://your.domain.com 能开
# Ctrl+C 停掉，装 systemd 服务
sudo cloudflared service install
sudo systemctl status cloudflared --no-pager | head -10
```

#### 步骤 7：收尾

```bash
# 关掉 caddy（如果之前装了，不再需要）
sudo systemctl stop caddy
sudo systemctl disable caddy

# 关安全组里 80 / 443 入站规则（不再需要任何入站）
# 在云控制台手动操作；只保留 22 (SSH)
```

后端 ServerAddress 同样要改（参考路径 A 的步骤 6）。

#### 限制 / 注意

- **依赖 cloudflared 进程不挂**——挂了 CF 边缘返回 530。systemd 会自动重启。
- **延迟 +20-50ms**（多一跳 CF 边缘 ↔ 你服务器）
- **CF 默认空闲超时 100s**——长 SSE / WebSocket 注意。视频生成是 HTTP 短连接 + 客户端轮询，不受影响。
- **免费层带宽不限**（CF 不收 egress 费），有"合理使用"政策——MVP 流量完全够。

---

### 怎么选？

| 你的情况 | 推荐 |
|---|---|
| 海外地域 + 能登云控制台 | 路径 A |
| 国内地域 + 域名能 ICP 备案 | 路径 A |
| 国内地域 + 域名无法备案（`.ai` / `.io` / 被拒等） | 路径 B |
| 拿不到云控制台修改权 | 路径 B |
| 想藏服务器 IP | 路径 B |
| 不愿意管 TLS 证书 | 路径 B（CF 自动）|

两条路任意时候可以切——都不影响应用本身。

---

## 六、排查：明明部署了为什么访问不到

### 6.1 容器健康但外部访问 timeout

最常见原因：**端口没真的对外暴露**。按这个顺序排：

```bash
# 1. 容器内部端口确实在监听？
sudo ss -tlnp | grep -E ":80|:443|:3000"

# 2. 服务器自己访问自己的公网 IP（绕一圈出去再回来）
PUB_IP=$(curl -s ifconfig.me)
curl -vk -m 5 https://$PUB_IP/ 2>&1 | head -10

# 3. 对照实验：80 通而 443 不通 == 安全组只开了 80
curl -sI -m 5 http://$PUB_IP/ | head -3
curl -skI -m 5 https://$PUB_IP/ | head -3
```

**判定表**：

| 80 | 443 | 结论 |
|---|---|---|
| ✅ | ❌ timeout | 云安全组没开 443（最常见）|
| ❌ timeout | ❌ timeout | 网络/路由问题，不是端口问题 |
| ✅ | ✅ | 端口都通，问题在 DNS / 浏览器缓存 / 应用 |

### 6.2 在国内地域用未备案 `.ai` / `.io` 等域名访问 443 timeout

即使安全组都开了，部分国内地域对**未 ICP 备案域名**会在 ISP 层面过滤 80/443。表现：服务器自测公网 IP 的 443 通，但**用域名访问**不通。

修法：上面的**路径 B（Cloudflare Tunnel）**。

### 6.3 Caddyfile 里出现 `[domain](http://domain)` 这种乱码

复制粘贴时被聊天工具/IDE 渲染了 markdown。修：

```bash
sudo sed -i 's|\[\([^]]*\)\](http[^)]*)|\1|g' /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

或者**直接用 nano/vim 编辑**而不是从外部粘贴。

### 6.4 Caddy 启动报 `address already in use`

端口被别的服务占了（常见 nginx）：

```bash
sudo ss -tlnp | grep -E ":80|:443"
# 看到 nginx：
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl start caddy
```

---

## 七、生产化清单（上线前过一遍）

- [ ] `.env.local` 里的 `SESSION_SECRET` 重新生成（默认值是开发用）
- [ ] `.env.local` 里的 `REDIS_CONN_STRING` 密码改成强密码（同步改 `docker-compose.local.yml` 里 redis-server 的 `--requirepass`）
- [ ] Neon 升 Launch tier（$19/月）关闭 auto-suspend，避免冷启动
- [ ] 配置域名 + TLS（章节五，路径 A 或 B 二选一）
- [ ] 安全组只开必要端口（路径 A：80+443+22；路径 B：仅 22）
- [ ] 在 admin 后台关闭"自用模式"，配好真实定价
- [ ] 改 admin → 系统设置 → ServerAddress 为你的 https 域名
- [ ] 关闭注册或加上邮箱验证（按业务需要）
- [ ] 配置火山引擎账号的并发上限（默认 10），按预期流量调整
- [ ] 视频任务持久化方案（Issue #7）跟进——避免 24h 后用户拿不到视频
- [ ] 监控：用 Uptime Kuma 或类似工具盯 `/api/status`

---

## 八、相关文档

- API 调用：站内 `/docs` 页面
- 仓库：[NekoAIKan/aikanhub](https://github.com/NekoAIKan/aikanhub)
- 上游归属：[NOTICE.md](./NOTICE.md)
- 协议：[LICENSE](./LICENSE)（AGPL-3.0）
