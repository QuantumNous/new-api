# New API 部署文档

## 目录

- [架构概览](#架构概览)
- [自动部署（日常使用）](#自动部署日常使用)
- [首次部署](#首次部署)
- [扩展：添加从节点](#扩展添加从节点)
- [运维命令](#运维命令)
- [环境变量说明](#环境变量说明)
- [故障排查](#故障排查)

---

## 架构概览

```
     浏览器
      │    │
      │    └── 页面/静态资源 ──→ Cloudflare Pages (前端)
      │
      └── /api ──→ Nginx (HTTPS) ──→ new-api :3002 (systemd)
                                        │
                                ┌───────┴────────┐
                                ▼                ▼
                            MySQL 8.0        Redis 7.0
                              (同一台机器)
```

**当前部署环境**：hetzner 服务器（Ubuntu 24.04, 4C/8G），MySQL 和 Redis 已有，New API 部署在同一台机器上。

**后续扩展**：加新服务器只跑 New API 从节点，MySQL/Redis 继续用现有服务器，通过 Nginx upstream 负载均衡。

---

## 自动部署（日常使用）

部署完成后，日常只需要 push 代码，不需要登录服务器：

| 操作 | 触发方式 | 自动执行 |
|------|---------|---------|
| 改后端代码 | push `.go`/`go.mod`/`go.sum`/`VERSION` 到 main | CI 编译 → 上传 → 重启服务，失败自动回滚 |
| 改前端代码 | push `web/` 目录到 main | Cloudflare Pages 自动构建部署 |
| 改部署配置 | push `deploy/` 目录到 main | CI 重新部署 |
| 手动触发 | GitHub Actions 页面点 "Run workflow" | 同上 |

---

## 首次部署

### 第一步：准备 .env

参考 `deploy/.env.example` 创建 `.env` 文件，填入实际的数据库和 Redis 连接信息。

生成密钥：

```bash
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CRYPTO_SECRET
```

上传到服务器：

```bash
scp .env hetzner:/opt/new-api/.env
ssh hetzner 'chmod 600 /opt/new-api/.env'
```

### 第二步：首次部署

```bash
make deploy
```

deploy.sh 会自动检测到是首次部署（Nginx 配置不存在），执行完整流程：

1. 创建 `/opt/new-api/` 目录和 `new-api` 系统用户
2. 安装二进制文件
3. 安装 systemd 服务
4. 安装 Nginx 并配置反向代理
5. 申请 Let's Encrypt SSL 证书
6. 启动服务并验证

### 第三步：配置 DNS

添加 A 记录：

```
api.4aicode.com → <hetzner 服务器公网 IP>
```

### 第四步：配置 GitHub Secrets

在 `richcalls/new-api` 仓库的 Settings → Secrets and variables → Actions 添加：

| Secret | 值 | 必需 |
|--------|-----|------|
| `DEPLOY_HOST` | hetzner 服务器公网 IP | ✅ |
| `DEPLOY_USER` | `root` | ✅ |
| `DEPLOY_SSH_KEY` | SSH 私钥（`cat ~/.ssh/id_ed25519`） | ✅ |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | ✅ 前端部署 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | ✅ 前端部署 |
| `SLACK_BOT_TOKEN` | Slack Bot Token | 可选 |
| `SLACK_CHANNEL_ID` | Slack Channel ID | 可选 |

配好后，每次 push 到 main 自动部署。

---

## 扩展：添加从节点

当主节点扛不住时，可以加从节点分担读请求。New API 原生支持主从模式。

### 架构变化

```
                          Nginx (主节点)
                            │
                    ┌───────┼───────┐
                    ▼       ▼       ▼
               主节点    从节点1   从节点2
              :3002     :3002    :3002
                    │       │       │
                    └───────┼───────┘
                            ▼
                     MySQL + Redis
                      (主节点上)
```

### 操作步骤

#### 1. 准备从节点 .env

从主节点复制 `.env`，修改以下内容：

```bash
# 指向主节点的 MySQL 和 Redis
SQL_DSN=new_api:<密码>@tcp(<主节点IP>:3306)/new_api
REDIS_CONN_STRING=redis://default:<密码>@<主节点IP>:6379

# SESSION_SECRET 和 CRYPTO_SECRET 必须和主节点完全一致（直接复制）

# 设为 slave
NODE_TYPE=slave
```

上传到从节点：

```bash
ssh new-api-slave1 'mkdir -p /opt/new-api'
scp .env new-api-slave1:/opt/new-api/.env
ssh new-api-slave1 'chmod 600 /opt/new-api/.env'
```

#### 2. 部署从节点

```bash
make deploy DEPLOY_HOST=new-api-slave1
```

#### 3. 主节点数据库授权

在主节点 MySQL 中为从节点 IP 授权：

```sql
CREATE USER IF NOT EXISTS 'new_api'@'<从节点IP>' IDENTIFIED BY '<密码>';
GRANT ALL PRIVILEGES ON new_api.* TO 'new_api'@'<从节点IP>';
FLUSH PRIVILEGES;
```

同时确保主节点的 Redis 允许从节点连接（`bind 0.0.0.0` + `requirepass`）。

#### 4. 主节点 Nginx 添加从节点

编辑主节点 `/etc/nginx/sites-available/new-api`，把 `proxy_pass` 改为 upstream 模式：

```nginx
# 在 server 块外面添加
upstream new_api_backend {
    server 127.0.0.1:3002;           # 主节点
    server <从节点IP>:3002;           # 从节点1
}

# server 块里改为
location / {
    proxy_pass http://new_api_backend;
    # ... 其他 proxy_set_header 保持不变
}
```

重载：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### 5. 从节点 CI 自动部署

复制 `deploy-backend.yml`，新建 `deploy-backend-slave1.yml`，使用不同的 Secrets（`DEPLOY_HOST_SLAVE1` 等），去掉域名和 SSL 参数：

```yaml
script: |
  cd /tmp/new-api-deploy
  chmod +x deploy/deploy.sh
  sudo ./deploy/deploy.sh "/tmp/new-api-deploy"
```

---

## 运维命令

```bash
# 查看服务状态
make status

# 实时日志
make logs

# 重启服务
make restart

# 手动部署
make deploy

# 同步上游 new-api 代码
make sync-upstream
```

---

## 环境变量说明

配置文件：`/opt/new-api/.env`，参考 `deploy/.env.example`。

| 变量 | 说明 | 示例 |
|------|------|------|
| `SQL_DSN` | MySQL 连接字符串 | `new_api:pwd@tcp(127.0.0.1:3306)/new_api` |
| `REDIS_CONN_STRING` | Redis 连接字符串 | `redis://default:pwd@127.0.0.1:6379` |
| `SESSION_SECRET` | 会话密钥，**所有节点必须一致** | `openssl rand -hex 32` |
| `CRYPTO_SECRET` | 加密密钥，**所有节点必须一致** | `openssl rand -hex 32` |
| `NODE_TYPE` | 主节点留空，从节点设 `slave` | `slave` |
| `SYNC_FREQUENCY` | 主从同步间隔（秒） | `60` |
| `BATCH_UPDATE_ENABLED` | 批量更新开关 | `true` |
| `BATCH_UPDATE_INTERVAL` | 批量更新间隔（秒） | `5` |
| `TZ` | 时区 | `Asia/Shanghai` |

---

## 故障排查

### 服务启动失败

```bash
sudo journalctl -u new-api -n 50 --no-pager

# 常见原因：
# 1. .env 没上传或配置错误
# 2. MySQL/Redis 没启动或连接不上
# 3. 端口被占用：sudo ss -tlnp | grep :3002
```

### 部署失败自动回滚

deploy.sh 部署时会备份旧二进制为 `new-api.backup`，新版本启动失败时自动回滚。

手动回滚：

```bash
cd /opt/new-api
sudo systemctl stop new-api
sudo cp new-api.backup new-api
sudo systemctl start new-api
```

### SSL 证书

```bash
sudo certbot certificates      # 查看状态
sudo certbot renew              # 手动续期（一般自动）
```

### Nginx

```bash
sudo nginx -t                   # 测试配置
sudo systemctl reload nginx     # 重载
# 配置损坏时恢复备份：
ls /etc/nginx/sites-available/new-api.backup.*
```

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `deploy/.env.example` | 环境变量模板 |
| `deploy/deploy.sh` | 主部署脚本（自动判断首次/更新，失败自动回滚） |
| `deploy/deploy-all.sh` | 首次部署调用（安装 Nginx、申请 SSL 证书） |
| `deploy/new-api.service` | systemd 服务配置 |
| `deploy/nginx-new-api.conf` | Nginx 反向代理模板 |
| `.github/workflows/deploy-backend.yml` | 后端 CI/CD |
| `.github/workflows/deploy-web.yml` | 前端 CI/CD（Cloudflare Pages） |
