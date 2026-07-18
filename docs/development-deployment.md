# New-API 开发、构建与部署方案

本文档面向本项目的日常开发、提交代码、服务器部署、上线验证和回滚。默认采用 Docker Compose 部署源码构建的镜像，服务器上的 .env 与代码仓库分离。

## 1. 推荐架构

```
浏览器
  -> Nginx / OpenResty :443
  -> new-api 容器 :3000
       -> PostgreSQL 容器或受控的外部 PostgreSQL
       -> Redis 容器或受控的外部 Redis
```

开发阶段推荐混合模式：

- PostgreSQL、Redis 使用 Docker，保证依赖版本一致。
- Go 后端和 React 前端在本机运行，获得更快的编译、断点调试和热更新。
- 提交前、联调和发布前再使用完整 Docker Compose 验证。

生产阶段推荐完整 Docker Compose：

- Dockerfile 同时构建 default/classic 前端和 Go 后端。
- docker-compose.yml 负责应用、PostgreSQL、Redis、持久化卷和内部网络。
- .env 只放在服务器，不提交 Git，也不放进镜像。
- 反向代理负责 HTTPS、域名、长连接和公网入口。

不要同时使用 new-api.service 和 Compose 管理同一个 3000 端口。本方案以 Compose 为准，new-api.service 仅作为非 Docker 二进制部署的备用方案。

## 2. 配置文件边界

| 文件 | 是否提交 | 用途 |
| --- | --- | --- |
| .env.example | 是 | 配置模板，只放变量名和示例值 |
| .env | 否 | 本机原生开发或本机 Compose 的私有配置 |
| /etc/new-api/new-api.env | 否 | 服务器真实运行配置，建议放在仓库外 |
| docker-compose.dev.yml | 是 | 本地开发依赖和开发后端 |
| docker-compose.yml | 是 | 生产或准生产部署编排 |
| Dockerfile | 是 | 构建包含前后端的生产镜像 |
| Dockerfile.dev | 是 | 构建不包含真实前端资源的开发后端镜像 |

后端在 main.go 中调用 godotenv.Load(".env")。原生运行时真正识别的是：

- PORT
- SQL_DSN 或 SQLITE_PATH
- REDIS_CONN_STRING
- SESSION_SECRET、CRYPTO_SECRET
- 其他 common.InitEnv 读取的环境变量

Compose 运行时，.env 主要用于变量替换；docker-compose.yml 再将 POSTGRES_*、REDIS_* 拼成容器内使用的 SQL_DSN 和 REDIS_CONN_STRING。

生产环境应保存稳定的 SESSION_SECRET 和 CRYPTO_SECRET。更换 SESSION_SECRET 会使现有登录会话失效；更换 CRYPTO_SECRET 会改变 HMAC/缓存键，多个实例之间也不能使用不同值。

## 3. 本地开发

### 3.1 快速原生模式

适合前端页面、普通控制器、服务逻辑和不依赖 PostgreSQL/Redis 方言的开发。

根目录 .env 使用 SQLite：

```dotenv
PORT=3000
SQLITE_PATH=./one-api.db
MEMORY_CACHE_ENABLED=true
```

启动后端：

```powershell
go run main.go
```

启动 default 前端：

```powershell
cd web
bun install --frozen-lockfile
cd default
bun run dev -- --host 0.0.0.0 --port 5173
```

访问 http://localhost:5173。Rsbuild 会把 /api、/mj、/pg 代理到 http://localhost:3000。

原生模式没有 SQL_DSN 时使用 SQLite，没有 REDIS_CONN_STRING 时 Redis 不启用。这是可用的轻量开发模式，但不能替代 PostgreSQL/Redis 联调。

### 3.2 完整容器开发模式

本机安装 Docker Desktop 和 Compose 插件后：

```powershell
docker compose -f docker-compose.dev.yml up -d
cd web
bun install --frozen-lockfile
cd default
bun run dev -- --host 0.0.0.0 --port 5173
```

停止：

```powershell
docker compose -f docker-compose.dev.yml down
```

需要连同开发数据库卷一起清空时才使用：

```powershell
docker compose -f docker-compose.dev.yml down -v
```

down -v 会删除开发数据库，禁止在生产 Compose 项目中使用。

当前 docker-compose.dev.yml 的后端是编译进容器的，修改 Go 代码后需要重新构建：

```powershell
docker compose -f docker-compose.dev.yml up -d --build new-api
```

因此它更适合前端开发和联调。后端高频开发建议让数据库/Redis 在 Docker 中运行，Go 后端在本机运行；或者后续为开发容器补充 Air/Compose Watch。

### 3.3 Makefile 入口

```text
make dev-api          启动 docker-compose.dev.yml
make dev-api-rebuild  重建开发后端容器
make start-api        原生启动 Go 后端
make dev-web          启动 default 前端
make dev-web-classic  启动 classic 前端
make dev              启动开发后端和 default 前端
```

Windows 如果没有 make，直接使用 go、bun 和 docker compose 命令即可。

## 4. 本地验证门槛

后端改动：

```powershell
go test ./...
```

default 前端改动：

```powershell
cd web/default
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run build
```

前端和后端一起改动时，至少执行：

```powershell
go test ./...
cd web/default
bun run build:check
```

提交前检查：

```powershell
git status --short
git diff --check
git diff --stat
```

不要使用 git add . 代替审查。确认 .env、数据库文件、日志、构建产物和临时设计文件没有被加入提交。

## 5. Git 推送流程

### 5.1 开发分支

每个功能使用独立分支：

```powershell
git switch -c feature/<short-name>
```

提交前确认工作区：

```powershell
git status --short
git diff -- docker-compose.yml .dockerignore
```

只添加本次任务需要的文件：

```powershell
git add <file1> <file2>
git diff --cached --check
git commit -m "feat: <short description>"
git push -u origin feature/<short-name>
```

当前仓库中，origin 是个人远端，用于推送自己的分支；upstream 是上游仓库，用于同步上游代码，不作为生产部署的秘密来源。

### 5.2 发布提交

上线不要直接跟随任意工作分支的最新代码。推荐按以下顺序：

1. 本地完成测试并提交。
2. 推送分支并合并到经过审查的发布分支。
3. 为上线提交创建不可变 tag，例如 v0.1.0。
4. 服务器部署明确的 commit SHA 或 tag，而不是盲目拉取 latest。

示例：

```powershell
git switch main
git pull --ff-only origin main
git tag -a v0.1.0 -m "release v0.1.0"
git push origin main --tags
```

如果项目暂时不使用 tag，至少在部署记录中保存 commit SHA、部署时间、操作者和回滚 SHA。

## 6. 服务器初始化

以下以 Ubuntu/Debian、部署目录 /opt/new-api、Docker Compose 部署为例。

### 6.1 安装基础依赖

服务器安装 Git、Docker Engine、Docker Compose plugin、Nginx/OpenResty/Caddy 之一，以及 curl、ca-certificates。

确认：

```bash
docker --version
docker compose version
```

创建专用部署用户，不建议使用 root 运行应用：

```bash
sudo useradd --create-home --shell /bin/bash newapi
sudo usermod -aG docker newapi
sudo mkdir -p /opt/new-api
sudo chown -R newapi:newapi /opt/new-api
```

重新登录一次，让 Docker 用户组权限生效。

### 6.2 拉取代码

使用服务器部署密钥或只读 deploy token，不要把个人密码写入脚本：

```bash
git clone <your-repository-url> /opt/new-api
cd /opt/new-api
git fetch --tags origin
git checkout --detach <release-tag-or-commit-sha>
git rev-parse HEAD
```

以后更新：

```bash
cd /opt/new-api
git fetch --tags origin
git checkout --detach <new-release-tag-or-commit-sha>
```

服务器代码可以处于 detached HEAD，因为发布目标由 tag/SHA 明确指定。服务器 .env 不受切换影响，因为它不在 Git 中。

### 6.3 创建服务器配置

将真实配置放到仓库外：

```bash
sudo install -o newapi -g newapi -m 600 /dev/null /etc/new-api/new-api.env
sudoedit /etc/new-api/new-api.env
```

配置至少包含：

```dotenv
APP_PORT=3000
TZ=Asia/Shanghai
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=<postgres-user>
POSTGRES_PASSWORD=<postgres-password>
POSTGRES_DB=<postgres-db>
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
SESSION_SECRET=<stable-random-secret>
CRYPTO_SECRET=<stable-random-secret>
ERROR_LOG_ENABLED=true
BATCH_UPDATE_ENABLED=true
NODE_NAME=new-api-prod-1
NODE_TYPE=master
```

如果使用外部 PostgreSQL/Redis，将 POSTGRES_HOST、REDIS_HOST 和凭据改为实际值，并同步调整 Compose 服务依赖；不要让应用错误地连接同名的本地容器。

不要把服务器 .env 复制回 Git 仓库。不要在命令行、PR、日志或截图中展示密码、API Key 和两个应用 secret。

## 7. 服务器构建与上线

### 7.1 上线前预检

```bash
cd /opt/new-api
git status --short
git rev-parse HEAD
test -r /etc/new-api/new-api.env
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml config --quiet
```

预检失败时停止，不要继续重启服务。

### 7.2 备份

部署前至少备份 PostgreSQL 和应用数据：

```bash
mkdir -p /var/backups/new-api
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml \
  exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip > /var/backups/new-api/postgres-$(date +%Y%m%d-%H%M%S).sql.gz

tar -czf /var/backups/new-api/data-$(date +%Y%m%d-%H%M%S).tar.gz \
  ./data ./logs
```

保留最近多个备份，并定期复制到另一台机器或对象存储。.env 应由服务器密钥管理或受限备份单独保护。

### 7.3 构建并启动

```bash
cd /opt/new-api
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml build --pull
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml up -d --remove-orphans
```

不要执行 docker compose down -v。它会删除 Compose 管理的 PostgreSQL 数据卷。

观察迁移和启动日志：

```bash
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml ps
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml logs --tail=200 new-api
```

### 7.4 健康检查和上线验证

服务器本机验证：

```bash
curl --fail --silent --show-error http://127.0.0.1:3000/api/status
```

反向代理域名验证：

```bash
curl --fail --silent --show-error https://<your-domain>/api/status
```

上线检查至少包括：

- new-api、postgres、redis 均为运行状态。
- /api/status 返回成功。
- 登录、退出、刷新页面正常。
- 发送一次最小化模型请求并确认日志、额度和响应均正常。
- 按本次发布范围抽查流式请求、文件上传或图片/视频任务。
- 反向代理没有 502、504、超时或错误的 SSE 缓冲。

## 8. 反向代理

生产不要直接把 3000、5432、6379 暴露到公网。PostgreSQL 和 Redis 保持 Compose 内网访问。

Nginx/OpenResty 核心配置示例：

```nginx
server {
    listen 443 ssl http2;
    server_name <your-domain>;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

AI 流式请求通常需要关闭代理缓冲并提高读取超时，具体值按接口耗时调整。

## 9. 回滚

记录当前版本：

```bash
cd /opt/new-api
git rev-parse HEAD
```

回滚到上一个已验证 SHA：

```bash
cd /opt/new-api
git fetch --tags origin
git checkout --detach <previous-release-tag-or-commit-sha>
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml config --quiet
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml build
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml up -d --remove-orphans
```

回滚代码不等于自动回滚数据库迁移。如果迁移不可逆，先评估是否需要从 PostgreSQL 备份恢复。

失败时查看：

```bash
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml ps
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml logs --tail=300 new-api postgres redis
```

没有备份和确认数据卷前，不要删除容器或执行 down -v。

## 10. 日常运维

```bash
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml ps
docker compose --env-file /etc/new-api/new-api.env -f docker-compose.yml logs -f --tail=200 new-api
```

更新前：

1. 查看当前 commit 和容器状态。
2. 确认备份最近一次成功。
3. 阅读目标 commit 的迁移、配置和计费变更。
4. 在本地完成测试和构建。
5. 服务器先执行 config --quiet，再构建和启动。
6. 通过本机和公网健康检查。

定期检查 PostgreSQL 备份恢复、Redis 状态、Docker 磁盘、日志和数据库磁盘、证书有效期、反向代理错误日志，以及所有实例的两个应用 secret 是否一致。

## 11. 可选的镜像仓库 CI/CD

仓库已有 .github/workflows/docker-build.yml，会在 tag 触发多架构镜像构建、签名和发布。但该工作流中的镜像命名空间是上游项目的固定值，不应直接当作个人 fork 的发布流程。

如果使用自己的镜像仓库，应先：

1. 改成自己的 registry/repository。
2. 配置 GitHub Actions Secrets。
3. 使用 commit SHA 或版本 tag 生成不可变标签。
4. Compose 使用明确版本或 digest，而不是 latest。
5. 服务器只执行 docker compose pull 和重启，不在生产现场编译。
6. 保存镜像 digest、构建日志和部署记录。

改造完成前，推荐“推送 Git 分支/tag，服务器按固定 SHA 构建”。

## 12. 一次完整发布清单

### 本地

- [ ] 明确本次发布范围。
- [ ] git status --short 无意外文件。
- [ ] git diff --check 通过。
- [ ] go test ./... 通过。
- [ ] 前端 typecheck、lint、build 或 build:check 通过。
- [ ] PostgreSQL/Redis 联调范围已验证。
- [ ] .env、数据库、日志和临时文件未进入提交。

### Git

- [ ] 提交信息清晰。
- [ ] 分支已推送到 origin。
- [ ] 发布分支已审查并创建 tag 或记录 commit SHA。

### 服务器

- [ ] .env 权限为 600 且在仓库外。
- [ ] checkout 的 SHA 与发布记录一致。
- [ ] Compose 配置预检通过。
- [ ] PostgreSQL、数据目录和日志已备份。
- [ ] 镜像构建成功，容器状态正常。
- [ ] 本机和公网健康检查通过。
- [ ] 登录和最小业务请求通过。
- [ ] 已记录版本、时间、操作者和回滚版本。

## 13. 当前工作区的特别注意事项

本机可能同时存在旧运行进程、前端开发服务器和新的 .env。进程不会热加载 .env；修改配置后必须重启对应进程。

重启现有后端前，先确认它当前连接的数据库和 Redis 目标。不要因为本地 .env 已改成 SQLite，就直接重启一个原本连接远程 PostgreSQL/Redis 且正在使用业务数据的进程。

部署前优先完成：

1. 确认服务器实际使用的数据库、Redis 和两个应用 secret。
2. 将这些值写入服务器外部配置文件，而不是提交到仓库。
3. 用固定 commit 构建，并通过 /api/status、登录和最小请求验证后再切流。
