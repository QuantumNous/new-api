# new-api 部署指南与环境配置规范

本文档说明 `new-api` 的部署拓扑模式、生产单机运行所需的环境变量清单以及 GitHub Actions CI/CD 自动化工作流与 Secrets 规范。

## 0. 目录布局

```
deploy/
├── docker-dev/      # Docker 本地开发栈（compose）
├── podman-dev/      # Podman 本地开发栈（compose，默认）
├── dev-image/       # 开发镜像构建（两个 dev compose 共用）
├── image-prod/      # 生产镜像构建（CI Buildx 使用）
├── podman-prod/     # 生产单机 Podman（compose + Quadlet + env 示例）
├── caddy-prod/      # 生产反代 Caddy（Caddyfile + 镜像）
├── k8s-prod/        # 生产/压测 K8s 清单
└── baremetal-prod/  # 裸机 systemd 模板（非容器）
```

本地开发入口见根 `justfile`：默认引擎为 Podman，`DEV_CONTAINER_ENGINE=docker` 切到 Docker。

---

## 1. 部署模式划分

项目中包含两种独立的部署拓扑，**彼此隔离，配置不可混用**：

| 拓扑模式 | 适用场景 | 配置文件 | 编排与控制 |
|---|---|---|---|
| **单机 Podman Compose（核心生产）** | 稳定独立的生产单机实例（如主站反代服务器） | `deploy/podman-prod/compose.yml` | GitHub Actions `.github/workflows/deploy-server.yml` 自动更新镜像 |
| **Kubernetes / K3s 集群** | 多节点分布式测试/压测集群 | `deploy/k8s-prod/*.yaml` | `.github/workflows/deploy.yml` / `setup-k3s.yml` |

---

## 2. 生产单机环境变量参考（`deploy/podman-prod/compose.yml`）

生产环境部署 `new-api` 容器时，需在 `deploy/podman-prod/compose.yml` 及其同目录的 `.env` 中配置以下生产环境变量（模板见 `deploy/podman-prod/.env.example`）：

### A. 数据库与存储核心变量

| 环境变量 | 必填 | 示例格式 | 说明 |
|---|---|---|---|
| `SQL_DSN` | **是** | `postgres://user:password@127.0.0.1:5432/newapi?sslmode=disable` | 主数据库连接串。支持 PostgreSQL、MySQL、SQLite（`local` 或留空）。生产环境严禁使用默认弱密码！ |
| `REDIS_CONN_STRING` | **是** | `redis://:password@127.0.0.1:6379` | Redis 连接串，用于分布式缓存、限流和 Session 存储。 |
| `LOG_SQL_DSN` | 否 | `postgres://user:pass@127.0.0.1:5432/newapi_log` | 独立日志库连接串。不配置时，日志表默认直接存储在主数据库中。 |

### B. 认证安全与代理配置

| 环境变量 | 必填 | 推荐设置 | 说明 |
|---|---|---|---|
| `SESSION_SECRET` | **是** | 32 位以上随机强密钥 | Session 签名密钥。必须在生产部署前生成高强度随机字符串！ |
| `CRYPTO_SECRET` | **是** | 32 字节随机强密钥 | 渠道凭证与敏感字段的对称加密密钥（AES-256 需要 32 字节）。 |
| `TRUSTED_PROXIES` | **是** | `127.0.0.1`（或实际反代 IP / CIDR） | 信任反向代理列表。用于准确提取客户端真实 IP 并防止 X-Forwarded-For 伪造。 |
| `SESSION_COOKIE_SECURE` | 推荐 | `true` | 全站开启 HTTPS 时务必设为 `true`，启用 Secure Cookie 及严格的 OriginGuard 防护。 |
| `SESSION_COOKIE_TRUSTED_URL` | 推荐 | `https://your-domain.example.com` | `SESSION_COOKIE_SECURE=true` 时必填的精确站点 HTTPS 域名（不支持通配符与路径）。 |

### B2. 地理封禁（可选）

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `GEOIP_DB_PATH` | 未设置 | 进阶用法：手动指定 MaxMind DB（`.mmdb`）文件路径（例如整份 GeoLite2-Country）。设置后数据库由运维自行维护，管理台的自动更新不写该文件。 |
| `GEOIP_DB_URL` | MetaCubeX country-lite | 托管模式的下载源（默认为中国大陆专用库 `country-lite.mmdb`，每日构建，仅含 CN 条目，约 400KB）。仅未设置 `GEOIP_DB_PATH` 时生效。 |

托管模式（默认，无需任何环境变量）：

- 数据库存放在程序工作目录 `geoip/Country.mmdb`。官方镜像 `WORKDIR=/data`（持久卷），即 `/data/geoip/Country.mmdb`。
- 管理后台「系统设置 → 安全 → 地理封禁」的数据库卡片展示状态、大小、上次更新时间与下载源，并提供"立即更新"按钮。
- 开启封禁开关时，若数据库缺失或超过 7 天未更新，后端先自动下载，下载失败则拒绝启用——避免"看似已封禁、实际全放行"的错觉。
- 服务启动时若封禁已启用但数据库缺失/过期，后台自动补一次下载（失败仅记日志，请求路径 fail-open）。
- 下载使用真实 MaxMind 解析器校验，损坏/伪造文件会被拒绝且不影响旧文件；安装采用原子替换，替换后内存中的读取句柄立即重载。

拒绝行为：命中封禁国家的访问者与普通用户只能看到 404 页面（Web 302 到 `/404`，API 返回 404 JSON）。

> 注意：`TRUSTED_PROXIES` 必须正确配置，否则地理封禁依据的是反向代理 IP 而非客户端真实 IP。
>
> 管理员豁免：默认开启（`geo_block_setting.allow_admin`）。携带后台管理员凭证的请求不受地区封禁影响，运营者身处被封禁地区也能登录管理；登录相关路径（`/sign-in`、`/api/user/login*`、`/api/oauth*`）与 SPA 静态资源、`/api/status` 对所有地区保持可达。中转 API（`/v1` 等）不享受豁免：被禁地区的 relay 调用一律 404，即使来自管理员的 API Key。

### C. 时序日志与 TimescaleDB 增强（可选）

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `TIMESCALEDB_ENABLED` | `false` | 是否开启 `logs` 表的 TimescaleDB 超表特性。仅在日志库为 PostgreSQL 且装有扩展时生效。 |
| `TIMESCALEDB_CHUNK_INTERVAL_SECONDS` | `604800`（7天） | 超表时间分块跨度（秒）。建议按日均写入量设置（如 86400 为 1 天）。 |
| `TIMESCALEDB_COMPRESS_AFTER_DAYS` | `0`（关闭） | 超过指定天数的历史日志分块自动压缩（压缩比约 90%+）。 |
| `TIMESCALEDB_RETENTION_DAYS` | `0`（关闭） | 超过指定天数的历史分块整块物理清理（日志为计费凭证，需显式按需开启）。 |

### D. 运行时基础与性能优化

| 环境变量 | 推荐设置 | 说明 |
|---|---|---|
| `BATCH_UPDATE_ENABLED` | `true` | 是否启用配额与额度批量异步回写数据库，大幅降低高并发时数据库锁争用。 |
| `DEFAULT_USER_GROUP` | 视业务而定 | 新注册用户的默认权限分组。 |
| `NODE_NAME` | `node-1` | 实例节点名称，记录在审计日志中便于多节点排查。 |
| `PORT` | `3000` | 容器内服务监听端口（默认 3000）。 |
| `TZ` | `Asia/Shanghai` | 容器时区。 |

---

## 3. GitHub Actions Secrets 命名规范

为了避免将核心生产服务器与测试/临时集群节点混淆，CI Secrets 采用严格的前缀命名区分：

### A. 单机生产部署专属变量（`.github/workflows/deploy-server.yml`）

此组变量**专供单台稳定生产服务器使用**，绝对不要写入 `SERVERS_LIST_JSON` 中：

| Secret 变量名 | 必填 | 示例占位符 | 说明 |
|---|---|---|---|
| `PROD_SERVER_HOST` | **是** | `your-server-ip` | 生产服务器 IP 或可解析域名 |
| `PROD_SERVER_USER` | **是** | `root` | SSH 登录用户名 |
| `PROD_SERVER_SSH_KEY` | **是** | `-----BEGIN OPENSSH PRIVATE KEY...` | 专用的 ED25519 部署私钥（对应公钥部署于服务器 `~/.ssh/authorized_keys`） |
| `PROD_SERVER_SSH_PORT` | 否 | `22` | SSH 端口，不填默认使用 `22` |
| `PROD_DEPLOY_PATH` | 否 | `/opt/new-api/deploy` | 生产服务器上包含 `podman-compose.yml` 的绝对路径，默认 `/opt/new-api/deploy`（仓内正本为 `deploy/podman-prod/compose.yml`，部署时复制并沿用服务器现有文件名） |

#### 一键安全配置命令（无明文泄露注入）
为了防止私钥在终端控制台或历史记录中意外打印，强烈建议通过重定向管道直接注入 GitHub Secrets：

```bash
# 1. 生成专用部署密钥对（本地执行）
ssh-keygen -t ed25519 -N "" -C "github-actions-newapi-deploy" -f ~/.ssh/newapi_deploy_key

# 2. 将公钥部署到目标服务器的 authorized_keys（公钥留在服务端）
ssh root@your-server-ip "cat >> ~/.ssh/authorized_keys" < ~/.ssh/newapi_deploy_key.pub

# 3. 将私钥与主机配置安全注入 GitHub Secrets（私钥存入 GitHub KMS，屏幕零显示）
gh secret set PROD_SERVER_SSH_KEY < ~/.ssh/newapi_deploy_key --repo <owner>/<repo>
gh secret set PROD_SERVER_HOST -b "your-server-ip" --repo <owner>/<repo>
gh secret set PROD_SERVER_USER -b "root" --repo <owner>/<repo>
```

> **公私钥分工铁律**：
> - **私钥（Private Key）**：持有者是发起连接的客户端（GitHub Actions），必须存储在 `PROD_SERVER_SSH_KEY` 中，用于生成数字签名证明身份；
> - **公钥（Public Key）**：持有者是被连接的服务端（生产服务器），必须存储在服务器的 `~/.ssh/authorized_keys` 中，用于解密验签；
> - *切勿混淆：若误将公钥写入 Secrets，GitHub Actions 将因缺少私钥签名能力而遭遇 `Permission denied (publickey)` 拒绝。*
### B. K8s / 临时测试集群变量（与单机生产完全隔离）

以下变量仅供 `deploy/k8s-prod/` 和压测集群使用：

| Secret 变量名 | 作用范围 | 说明 |
|---|---|---|
| `SERVERS_LIST_JSON` | K3s 集群维护 / 压测 | 格式为 `[{"ip":"...","user":"...","password":"..."}]`，仅用于不稳定测试节点自动安装 k3s |
| `KUBE_CONFIG_B64` | K8s 部署 | base64 编码的 kubeconfig，用于公网连接 K8s API Server |
| `SQL_DSN` / `REDIS_CONN_STRING` 等 | K8s Pod 注入 | 集群内通过 `new-api-secrets` 挂载到容器 |

---

## 4. 生产部署工作流（`.github/workflows/deploy-server.yml`）


### 触发条件
1. **手动触发**：在 GitHub Actions 页面选择 `Deploy to Server (Podman)`，输入目标 `image_tag`（如 `latest`、`insight` 或 commit SHA）执行部署。

### 自动化执行步骤与安全防线
1. **轻量只读连接**：Runner 通过内存临时加载 `PROD_SERVER_SSH_KEY`，SSH 登录目标主机。
2. **记录当前镜像**：部署前捕获正在运行的容器镜像 Tag（例如 `ghcr.io/...:prev`），作为回滚基准。
3. **拉取新镜像**：先执行 `podman pull`，确保镜像完整拉取成功后再进行切换。
4. **单容器原子切换**：执行 `podman compose up -d --no-deps new-api`，**仅重启 new-api 容器，绝不触碰数据库、Redis、Nginx/Caddy 等依赖基础设施**。
5. **健康检查轮询**：连续 15 次（每 3 秒一次，共 45 秒）探测 `http://127.0.0.1:3000/api/status` 是否返回 `HTTP 200`。
6. **自动故障回滚**：若 45 秒内未就绪，工作流自动恢复先前的镜像 Tag 并重新拉起旧版本，向 GitHub 汇报失败，防止生产环境陷入不可用状态。

### Caddy 改配置后的重载方式

若生产服务器已由 Nginx 切换到 Caddy（见 `../.agents/skills/newapi-production-upgrade/SKILL.md` 第 4 节），
改完 `Caddyfile` 后**用 `systemctl restart caddy`，不要依赖 `systemctl reload caddy`**。

`caddy reload` 的实现是把新配置 POST 到 admin API（默认 `localhost:2019/load`）。
本仓的 `deploy/caddy-prod/Caddyfile` 没有关闭 admin API，但生产 unit 的 `ExecReload` 不带
`--environ`：reload 由 caddy 进程自行重新解析配置，`{env.CF_API_TOKEN}` 取到空串后
provision 失败：

```
loading module 'cloudflare': ... API token '' appears invalid
```

若主机另外显式配置了 `admin off`，reload 会直接连接失败：

```
Job for caddy.service failed.
# journal 中只有：
error  sending configuration to instance: performing request:
       Post "http://localhost:2019/load": dial tcp ...: connection refused
```

确认 admin 端点状态：`ss -tlnH | grep -c ':2019'`（返回 `1` 表示默认监听开启）。

**最危险的一点**：失败的 reload 不会杀掉运行中的 caddy。旧进程继续用**旧配置**对外服务，
站点照常返回 200，很容易误判成"配置已生效"。改完 Caddyfile 务必验证真实生效，
例如比对页面引用的静态资源指纹是否已切换：

```bash
curl -s https://<domain>/ | grep -oE 'static/js/index\.[a-f0-9]+'   # 与目标容器的一致才算生效
```

#### 一个叠加原因：CF_API_TOKEN 解析

本项目的 Caddyfile 使用 Cloudflare DNS-01 挑战：

```bash
# Caddyfile 中：
#   tls {
#     dns cloudflare {env.CF_API_TOKEN}
#   }
```

unit 的 `ExecStart` 带 `--environ`（由 systemd 以 root 读取 `EnvironmentFile` 后降权到
`User=caddy`），`ExecReload` 却不带该参数。因此即使 admin API 没有关闭，
`caddy reload` 自行重新解析 Caddyfile 时 `{env.CF_API_TOKEN}` 也取到空串，
provision 阶段同样失败：

```
loading module 'cloudflare': ... API token '' appears invalid
```

#### `caddy validate` 与 reload 失败是两回事

手动跑 `caddy validate` 时若当前 shell 没有 `CF_API_TOKEN`，也会报上面的
"API token ''"。这是 validate 自己做完整 provision 时展开环境变量取到空串，
**与 reload 失败原因无关**，排查时不要混淆。validate 前先导入环境变量：

```bash
set -a; . /etc/caddy/cloudflare.env; set +a
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

> 注意：`/etc/caddy/cloudflare.env` 权限是 `600 root:root`，`caddy` 用户读不到。
> systemd 的 `EnvironmentFile=` 由 PID 1 以 root 读取后再降权，因此服务本身正常；
> 但以 `caddy` 身份手动执行命令时需要自己导入。

#### 正确操作与代价

```bash
systemctl restart caddy    # 走 ExecStart，能拿到 --environ 注入的 token
```

代价是 443 中断数秒。证书已缓存在本地，不会重新触发 DNS-01 挑战。

#### 安全提醒

unit 的 `ExecStart` 带 `--environ`，caddy 会把继承到的**全部**环境变量明文 echo 进
journal，其中包括 `CF_API_TOKEN`。排查日志时不要整段复制外泄，若该 token 已出现在
日志或终端记录中应尽快在 Cloudflare 侧轮换。

## 5. Podman 单机部署（标准生产模式）

生产单机使用 Podman 编排，资产位于 `deploy/podman-prod/`。

```bash
# 启动整栈（new-api + PostgreSQL/TimescaleDB）
podman compose -f deploy/podman-prod/compose.yml up -d

# 或使用 Quadlet 单元固化开机自启（推荐生产）
cp deploy/podman-prod/quadlet/*.container /etc/containers/systemd/
systemctl daemon-reload
systemctl enable --now new-api newapi-postgres
```

说明：

1. Quadlet 单元使用命名卷 `newapi-pg-data`；Compose 使用带项目前缀的 `pg_data`（在服务器上为 `deploy_pg_data`）。两者都不依赖容器生命周期。
2. 生产环境优先使用 `deploy/podman-prod/quadlet/` 下的 Quadlet 单元，避免重启后服务丢失。
3. Caddy 通过 `systemctl restart caddy` 完成反代切换。
4. 生产服务器不依赖 Docker 守护进程；镜像仍由 CI 在 runner 上用 Docker Buildx 构建并推送到 GHCR，Podman 直接 `pull` 运行。

## 6. 生产安全部署：避免 dev 免登录进入生产

dev 免登录 (`/api/user/dev/auto-login`) 只存在于带 `dev` build tag 的二进制中，并且运行时还要 `DEV_AUTO_LOGIN=1` 才生效。生产部署必须同时守住这两道门：

1. **构建命令只传业务 tags**：生产/发布构建只使用 `go build -tags "${SINGBOX_TAGS}"`（Dockerfile、release workflow 已如此）。严禁在生产构建里追加 `dev`。
2. **生产环境不设置 `DEV_AUTO_LOGIN`**：即使误设，没有 `dev` tag 时路由根本不注册，请求落 SPA fallback；但为避免混淆，生产 env/secret 中不要出现该变量。
3. **不要把本地 `just dev-wt-dev` 产物当生产二进制**：它带 `dev` tag 且启用自动登录，仅用于开发。
4. **上线后验证**：`curl -sS -X POST https://<domain>/api/user/dev/auto-login` 应返回 404/SPA fallback，且响应中不包含 token/session。
5. **审计日志核查**：生产日志中不应出现 `login_method=dev-auto-login` 的会话；若出现，说明使用了 dev 构建或环境变量被开启。
6. **账号清理**：若发现固定名 `dev-auto-login` 的 root 账号，立即删除/降权并排查构建与部署流程。
7. **CI 保障**：`Backend build with dev tag` 任务仅做编译检查；release/Docker 路径从不传 `dev`，并由 stub 文件保证非 dev 构建路由不存在。
