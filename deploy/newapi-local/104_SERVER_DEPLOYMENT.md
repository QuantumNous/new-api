# 104 机器部署与运维手册

本文记录 `104.xx.xx.xx` 当前线上环境的真实状态，以及后续更新 `deploy-dev` 时的安全操作方式。

本文基于 `2026-06-01` 的实机检查结果整理，并作为当前 104 发版的本地唯一准入文档。

环境定位：

- `104` 为海外环境
- classic 首页入口固定使用 `VITE_HOME_ENTRY=en`
- 这里按部署环境固定切换，不做运行时环境变量覆盖

## 0. 文档与脚本入口

这个目录现在建议分两层使用：

- [deploy/newapi-local/README.md](./README.md)
  - 日常操作入口
  - 优先告诉你下一步该跑什么命令
- [deploy/newapi-local/104_SERVER_DEPLOYMENT.md](./104_SERVER_DEPLOYMENT.md)
  - 完整背景手册
  - 记录线上真实结构、风险点、验收与恢复方式

日常发布优先使用统一脚本入口查看 SOP：

```bash
REMOTE_HOST='104.xx.xx.xx' ./deploy/newapi-local/release.sh help
```

使用提醒：

- `release.sh` 现在是纯文档入口，不会执行真实的 `docker`、`ssh`、`scp`、发版、回滚或状态检查
- 正确方式是先运行对应命令查看 SOP，再手工执行
- 线上一律以远端机器上的真实 compose、env、容器名、目录和镜像状态为准

推荐对应关系：

- 发布总览：`./deploy/newapi-local/release.sh release`
- 本地构建说明：`./deploy/newapi-local/release.sh build`
- 本地镜像验收说明：`./deploy/newapi-local/release.sh verify-image`
- 远端备份说明：`./deploy/newapi-local/release.sh backup-env`
- 远端上传说明：`./deploy/newapi-local/release.sh upload`
- 远端发布说明：`./deploy/newapi-local/release.sh deploy`
- 线上状态检查说明：`./deploy/newapi-local/release.sh status`
- 应用级回滚说明：`./deploy/newapi-local/release.sh rollback`

只有在下面这些场景，才需要回到本文逐段排查：

- `502`
- Docker network / alias 异常
- `seedance-compat` 无法转发
- PostgreSQL 或 Redis 连通性异常
- 需要数据库级恢复

## 1. 当前线上真实状态

### 1.1 当前运行中的相关容器

当前机器上与这套 `new-api` 生产服务直接相关的容器是：

- `new-api`
- `new-api-gateway`
- `seedance-compat-local`
- `new-api-postgres`
- `new-api-redis`

当前 `new-api-metadata` 没有在运行。

各自职责：

- `new-api`
  - 真正运行 `new-api`
  - 当前镜像：`new-api:deploy-dev-2533abdc3`
  - 只在 Docker 网络内暴露 `3000`
- `new-api-gateway`
  - 对外入口
  - 监听宿主机 `3000`
  - 普通请求转发到 `new-api:3000`
  - Seedance 原生任务请求转发到 `seedance-compat:3001`
- `seedance-compat-local`
  - 提供 Seedance 原生兼容层
  - 只在 Docker 网络内暴露 `3001`
- `new-api-postgres`
  - 业务 PostgreSQL
- `new-api-redis`
  - 业务 Redis

### 1.2 当前 compose 接管状态

当前 104 上的应用发布入口已经统一为：

- compose 工作目录：`./deploy/newapi-local/`
- compose 文件：`./deploy/newapi-local/docker-compose.postgres.yml`
- env 文件：`./deploy/newapi-local/.env.postgres`

当前普通业务发布、回滚、验收都只认这一套入口。

这里说的是 `new-api` 应用容器的发布入口，不代表 `new-api-postgres` 也已经迁移到这套 compose 标签之下。

但 `new-api-postgres` 实机标签仍然显示为旧入口接管：

- compose 工作目录：`/root/sub2api/deploy/newapi-local`
- compose 文件：`/root/sub2api/deploy/newapi-local/docker-compose.postgres.yml`

已明确废弃、不要再用：

- `/root/new-api/deploy/newapi-local/docker-compose.yml`
- `/root/new-api/docker-compose.yml`
- `/root/sub2api/deploy/newapi-local/docker-compose.postgres.yml`

结论：

- 当前应用侧发布应以 `/root/new-api/deploy/newapi-local` 为准
- 当前普通发布只更新 `new-api`
- 当前 `postgres` 仍保留旧 compose 标签，不要因为这点去重建它
- 当前不要去重建或迁移 `postgres`
- 当前不要把“整理部署结构”和“普通业务发布”放在同一个窗口里做

### 1.3 当前关键挂载路径

当前 `new-api` 容器挂载：

- `/root/new-api/deploy/newapi-local/data -> /data`
- `/root/new-api/deploy/newapi-local/logs -> /app/logs`

当前 `new-api-gateway` 容器挂载：

- `/root/new-api/deploy/newapi-local/gateway/nginx.conf -> /etc/nginx/nginx.conf`

当前 `new-api-postgres` 容器挂载：

- Docker volume：`newapi-local_newapi_pg_data`
- 宿主机落点：`/var/lib/docker/volumes/newapi-local_newapi_pg_data/_data`
- 容器内数据目录：`/var/lib/postgresql/data`

### 1.4 当前关键环境变量

当前 `new-api` 容器中已经显式配置：

```env
TZ=Asia/Shanghai
ERROR_LOG_ENABLED=true
MEMORY_CACHE_ENABLED=true
SYNC_UPSTREAM_BASE=http://metadata
SQL_DSN=postgresql://newapi:<password>@postgres:5432/newapi?sslmode=disable
REDIS_CONN_STRING=redis://:<password>@redis:6379/0
CRYPTO_SECRET=<configured>
SESSION_SECRET=<configured>
NODE_NAME=104-node-1
GLOBAL_API_RATE_LIMIT_ENABLE=false
```

结论：

- Redis 已启用
- `CRYPTO_SECRET` 已配置
- `SESSION_SECRET` 已配置
- `GLOBAL_API_RATE_LIMIT_ENABLE=false`
- 当前已经具备共享缓存和会话的一致性基础

### 1.5 当前网络与服务发现

当前相关容器都在 Docker 网络 `newapi-local_default` 中。

当前关键别名：

- `new-api` 容器带 alias：`new-api`
- `seedance-compat-local` 容器带 alias：`seedance-compat`
- `new-api-redis` 容器带 alias：`redis`
- `new-api-postgres` 容器带 alias：`postgres`

这意味着：

- `gateway` 和 `seedance-compat` 依赖的是服务 DNS 名 `new-api`
- `new-api` 依赖的是服务 DNS 名 `postgres` 和 `redis`
- 普通发布时可以替换应用容器，但必须保留 `new-api` 这个网络可解析名字

## 2. 当前流量路径

当前请求链路如下：

```text
client
  -> http://104.xx.xx.xx:3000
  -> new-api-gateway
     -> /api/v3/contents/generations/tasks*  -> seedance-compat:3001
     -> all other paths                      -> new-api:3000

new-api
  -> postgres:5432
  -> redis:6379
```

说明：

- 公网 `3000` 当前正常
- `8088` 对应的 metadata 服务当前未运行，不要把它当作当前健康检查前提

## 3. 当前推荐运维原则

对这台机器，当前建议遵守下面这些规则：

- 普通业务发布只更新 `new-api`
- 不要在普通发布时顺手重建 `gateway`
- 不要在普通发布时重建 `postgres`
- 不要在普通发布时重建 `redis`
- 不要在没有明确需要时重建 `seedance-compat`
- 不要执行 `docker compose down -v`
- 不要删除 PostgreSQL 卷
- 不要把 `/root/sub2api` 那套旧结构当作当前应用发布入口
- 不要再使用 `/root/new-api/docker-compose.yml`
- 不要再使用 `/root/new-api/deploy/newapi-local/docker-compose.yml`

## 4. 更新前备份

每次更新前至少做下面这些备份。

### 4.1 备份 compose 与环境文件

```bash
cd /root/new-api/deploy/newapi-local
cp docker-compose.postgres.yml docker-compose.postgres.yml.bak-$(date +%F-%H%M%S)
cp .env.postgres .env.postgres.bak-$(date +%F-%H%M%S)
cp gateway/nginx.conf gateway/nginx.conf.bak-$(date +%F-%H%M%S)
```

### 4.2 备份 PostgreSQL

```bash
docker exec -t new-api-postgres pg_dump -U newapi -d newapi > /root/newapi-pg-backup-$(date +%F-%H%M%S).sql
```

如需在备份前再确认当前卷没有看错，可以顺手执行：

```bash
docker inspect new-api-postgres --format '{{json .Mounts}}'
docker volume inspect newapi-local_newapi_pg_data
```

### 4.3 备份 data / logs

```bash
cd /root/new-api/deploy/newapi-local
tar -czf /root/newapi-files-backup-$(date +%F-%H%M%S).tar.gz data logs
```

## 5. 当前标准发布流程

这是当前 104 机器最稳的 `deploy-dev` 发布方式。

### 5.1 本地或跳板机构建镜像

推荐在本地构建镜像，再上传服务器：

```bash
docker build \
  --build-arg VITE_HOME_ENTRY=en \
  -t new-api:deploy-dev-<commit> .
```

说明：

- `VITE_HOME_ENTRY=en` 是 104 的固定构建参数
- 如果漏传该参数，当前 Dockerfile 默认值也是 `en`，但发布时仍建议显式写出来，避免和 120 的国内环境混淆

如果这次动了前端，发布前至少验证：

- `/`
- `/logo.png`
- `/favicon.ico`
- `/api/status`

### 5.2 上传镜像并在远端加载

```bash
docker save -o new-api-deploy-dev-<commit>.tar new-api:deploy-dev-<commit>
scp new-api-deploy-dev-<commit>.tar root@<masked-104-host>:/root/
ssh root@<masked-104-host> "docker load -i /root/new-api-deploy-dev-<commit>.tar"
```

### 5.3 只重建应用容器

关键原则：

- 只更新 `new-api`
- 不动 `gateway`
- 不动 `postgres`
- 不动 `redis`
- 不动 `seedance-compat`

命令模板：

```bash
cd /root/new-api/deploy/newapi-local
docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --no-deps new-api
```

如需切换到某个已经加载到远端的镜像标签，先确认 `docker-compose.postgres.yml` 里的 `new-api` 服务 `image:` 指向目标标签，再执行上面的 `up -d --no-deps new-api`。

这也是当前 104 的最小发布命令。

### 5.4 发布后快速观察

容器起来后，先不要急着继续别的操作，至少先看一眼状态和最近日志：

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -E 'new-api$|new-api-gateway|seedance-compat-local|new-api-postgres|new-api-redis'
docker logs --tail=50 new-api
docker logs --tail=50 new-api-gateway
```

## 6. 当前应用容器命名约定

当前应用容器名已经是：

- `new-api`

不是：

- `new-api-local`

但是 compose 服务名仍然是：

- `new-api`

网络 alias 也必须保留：

- `new-api`

这样可以保证 `gateway` 和 `seedance-compat` 的 upstream 解析不变。

## 7. 更新后验收

### 7.1 基础健康检查

```bash
curl -fsS http://127.0.0.1:3000/api/status
curl -fsS http://<masked-104-host>:3000/api/status
```

### 7.2 容器状态检查

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -E 'new-api$|new-api-gateway|seedance-compat-local|new-api-postgres|new-api-redis'
docker inspect new-api --format 'STATUS={{.State.Status}} HEALTH={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} IMAGE={{.Config.Image}}'
```

至少应确认：

- `new-api` 为 `Up`，并且健康检查为 `healthy` 或容器状态正常
- `new-api-gateway` 为 `Up`
- `seedance-compat-local` 为 `Up`
- `new-api-postgres` 为 `Up` 且 `healthy`
- `new-api-redis` 为 `Up`

### 7.3 日志检查

```bash
docker logs --tail=100 new-api
docker logs --tail=100 new-api-gateway
```

### 7.4 Seedance 原生接口检查

```bash
cd /root/new-api
curl -sS http://127.0.0.1:3000/api/v3/contents/generations/tasks \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  --data @deploy/newapi-local/seedance-compat-smoke.json
```

### 7.5 OpenAI Video 接口检查

```bash
cd /root/new-api
curl -sS http://127.0.0.1:3000/v1/videos \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  --data @deploy/newapi-local/remote-seedance-smoke.json
```

## 8. 当前文档边界

本文只描述当前 104 机器的真实生产状态。

下面这些内容当前不应混在普通发布流程里：

- 把 `postgres` 从 `/root/sub2api` 迁移到 `/root/new-api`
- 恢复或重建 metadata 服务
- 把整套部署重新收敛成单目录统一接管
- 多机扩容和数据库迁移

如果后续要做这些结构整理，应该单独开维护窗口，并在完成后重新更新本文。

## 9. 一眼判断有没有走错入口

如果你准备在 104 上动手，先检查下面三点：

- 当前目录是不是 `/root/new-api/deploy/newapi-local`
- 当前 compose 文件是不是 `docker-compose.postgres.yml`
- 当前要动的是不是只有 `new-api` 服务

只要其中任意一点不满足，就先停下来，说明很可能又走到了旧入口。
