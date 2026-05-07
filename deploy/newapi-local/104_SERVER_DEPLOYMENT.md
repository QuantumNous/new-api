# 104 机器部署与扩展手册

本文是针对 `104.225.153.184` 这台机器的专用部署文档。

目标：

- 明确这台机器当前到底是怎么部署的
- 说明以后如何安全更新 `deploy-dev`
- 说明如何启用 Redis
- 说明以后如何从单机扩展到多机

本文基于 `2026-04-23` 的实机检查结果编写。

## 1. 当前线上实际状态

### 1.1 正在运行的容器

当前这台机器实际运行的是下面 5 个容器：

- `new-api-gateway`
- `new-api-local`
- `seedance-compat-local`
- `new-api-postgres`
- `new-api-metadata`

对应职责：

- `new-api-gateway`
  - 对外监听宿主机 `3000`
  - 负责把普通请求转发给 `new-api`
  - 负责把 Seedance 原生任务请求转发给 `seedance-compat`
- `new-api-local`
  - 真正运行 `new-api`
  - 只在 Docker 网络内暴露 `3000`
- `seedance-compat-local`
  - 提供 Seedance 原生兼容层
  - 只在 Docker 网络内暴露 `3001`
- `new-api-postgres`
  - 当前内部 PostgreSQL
- `new-api-metadata`
  - 对外监听宿主机 `8088`
  - 提供本地 metadata 静态文件

### 1.2 当前 compose 真实位置

这台机器不是从 `/root/new-api` 直接起服务。

实际 compose 信息如下：

- compose 工作目录：`/root/sub2api/deploy/newapi-local`
- compose 文件：`/root/sub2api/deploy/newapi-local/docker-compose.postgres.yml`
- env 文件：`/root/sub2api/deploy/newapi-local/.env.postgres`
- `new-api` 构建上下文：`/root/sub2api/.tmp-new-api`

这意味着：

- `/root/new-api` 是 Git 仓库
- 但线上运行服务的代码来源是 `/root/sub2api/.tmp-new-api`
- 更新线上服务时，不能只在 `/root/new-api` 里 `git pull`
- 还必须把代码同步到 `/root/sub2api/.tmp-new-api`

### 1.3 当前关键环境变量

当前 `new-api-local` 容器里实际有这些关键配置：

```env
TZ=Asia/Shanghai
ERROR_LOG_ENABLED=true
MEMORY_CACHE_ENABLED=true
SYNC_UPSTREAM_BASE=http://metadata
SQL_DSN=postgresql://newapi:<password>@postgres:5432/newapi?sslmode=disable
```

当前没有：

- `REDIS_CONN_STRING`
- `CRYPTO_SECRET`
- `SESSION_SECRET`

所以当前状态是：

- 已启用单机内存缓存
- 未启用 Redis
- 当前更适合单机运行，不适合直接横向扩容

## 2. 当前流量路径

当前请求链路如下：

```text
client
  -> http://104.225.153.184:3000
  -> new-api-gateway
     -> /api/v3/contents/generations/tasks*  -> seedance-compat-local:3001
     -> all other paths                      -> new-api-local:3000

new-api-local
  -> new-api-postgres:5432
  -> new-api-metadata:80
```

### 2.1 当前端口

- `3000/tcp`
  - 对外入口
  - 由 `new-api-gateway` 占用
- `8088/tcp`
  - metadata 对外地址
  - 由 `new-api-metadata` 占用

### 2.2 当前数据目录

当前 `new-api-local` 实际挂载的是：

- `/root/sub2api/deploy/newapi-local/data -> /data`
- `/root/sub2api/deploy/newapi-local/logs -> /app/logs`

所以如果你要备份业务数据，优先看这两个目录和 PostgreSQL 卷。

## 3. 推荐运维原则

对这台机器，建议遵守这几个原则：

- 不要直接手改正在运行的容器
- 一律以 compose 文件为准
- 更新代码时，同时更新 `/root/new-api` 和 `/root/sub2api/.tmp-new-api`
- 不要在本次业务更新时顺手大改部署结构
- 如果要做多机扩展，先把 Redis 和统一会话密钥补上

## 4. 更新前备份

每次更新前建议至少做下面这些备份。

### 4.1 备份 compose 与环境文件

```bash
cd /root/sub2api/deploy/newapi-local
cp docker-compose.postgres.yml docker-compose.postgres.yml.bak-$(date +%F-%H%M%S)
cp .env.postgres .env.postgres.bak-$(date +%F-%H%M%S)
cp gateway/nginx.conf gateway/nginx.conf.bak-$(date +%F-%H%M%S)
```

### 4.2 备份 PostgreSQL

推荐先导出 SQL：

```bash
docker exec -t new-api-postgres pg_dump -U newapi -d newapi > /root/newapi-pg-backup-$(date +%F-%H%M%S).sql
```

如果你还想备份卷：

```bash
docker inspect new-api-postgres
docker volume ls | grep newapi_pg_data
```

### 4.3 备份 data / logs

```bash
cd /root/sub2api/deploy/newapi-local
tar -czf /root/newapi-files-backup-$(date +%F-%H%M%S).tar.gz data logs
```

## 5. 当前单机部署的标准更新流程

这是以后更新 `deploy-dev` 最稳的方式。

### 5.1 拉取最新代码

```bash
cd /root/new-api
git fetch origin
git checkout deploy-dev
git pull --ff-only origin deploy-dev
```

### 5.2 同步到实际构建目录

当前线上真正构建使用的是 `/root/sub2api/.tmp-new-api`。

所以要把仓库同步过去：

```bash
rsync -a --delete \
  --exclude '.git' \
  --exclude 'web/node_modules' \
  /root/new-api/ /root/sub2api/.tmp-new-api/
```

### 5.3 在部署目录重建服务

```bash
cd /root/sub2api/deploy/newapi-local
docker compose -f docker-compose.postgres.yml up -d --build new-api seedance-compat gateway
docker compose -f docker-compose.postgres.yml ps
```

### 5.4 查看状态

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker logs --tail=100 new-api-local
docker logs --tail=100 seedance-compat-local
docker logs --tail=100 new-api-gateway
```

## 6. 当前版本对应的建议更新顺序

对你现在这台机器，建议每次按下面顺序更新：

1. 只更新 `new-api-local`
2. 观察 `api/status` 与后台页面
3. 再更新 `seedance-compat-local`
4. 最后确认 `gateway` 路由是否需要同步

如果这次只是普通业务更新，而 `gateway/nginx.conf` 没变化，通常不需要重建 `metadata` 和 `postgres`。

最小更新命令：

```bash
cd /root/sub2api/deploy/newapi-local
docker compose -f docker-compose.postgres.yml up -d --build new-api seedance-compat
```

## 7. 更新后验收

### 7.1 基础健康检查

```bash
curl -fsS http://127.0.0.1:3000/api/status
curl -fsS http://127.0.0.1:8088/api/newapi/models.json | head
```

### 7.2 容器健康检查

```bash
docker compose -f /root/sub2api/deploy/newapi-local/docker-compose.postgres.yml ps
```

应看到：

- `new-api-local` healthy
- `seedance-compat-local` healthy
- `new-api-postgres` healthy
- `new-api-gateway` healthy

### 7.3 Seedance 原生接口检查

```bash
cd /root/sub2api/.tmp-new-api
curl -sS http://127.0.0.1:3000/api/v3/contents/generations/tasks \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  --data @deploy/newapi-local/seedance-compat-smoke.json
```

### 7.4 OpenAI Video 接口检查

```bash
cd /root/sub2api/.tmp-new-api
curl -sS http://127.0.0.1:3000/v1/videos \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  --data @deploy/newapi-local/remote-seedance-smoke.json
```

## 8. 如果要开启 Redis

当前机器没有 Redis，但可以开启，而且建议为以后多机扩展提前铺好。

### 8.1 为什么建议开启

开启 Redis 后，主要收益是：

- 某些热数据缓存不再只依赖单机内存
- 多实例时可以共享缓存
- 某些依赖 Redis 的缓存能力可以恢复
- 以后做多机扩容时不需要再补一次大改

### 8.2 需要增加的关键配置

`new-api` 至少要增加：

```env
REDIS_CONN_STRING=redis://:your_password@redis:6379/0
CRYPTO_SECRET=<very-strong-random-secret>
SESSION_SECRET=<very-strong-random-secret>
```

说明：

- `REDIS_CONN_STRING`
  - 指定 Redis 连接串
- `CRYPTO_SECRET`
  - 使用共享 Redis 时强烈建议显式设置
  - 多机必须一致
- `SESSION_SECRET`
  - 多机必须一致
  - 单机也建议提前设置，避免以后切多机时忘了补

### 8.3 在当前 compose 中新增 Redis

可以直接在 `/root/sub2api/deploy/newapi-local/docker-compose.postgres.yml` 里增加：

```yaml
  redis:
    image: redis:7-alpine
    container_name: new-api-redis
    restart: unless-stopped
    command: ["redis-server", "--requirepass", "${NEWAPI_REDIS_PASSWORD}"]
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${NEWAPI_REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 10
```

然后在 `new-api` 的 `environment` 里加：

```yaml
      REDIS_CONN_STRING: "redis://:${NEWAPI_REDIS_PASSWORD}@redis:6379/0"
      CRYPTO_SECRET: "${NEWAPI_CRYPTO_SECRET}"
      SESSION_SECRET: "${NEWAPI_SESSION_SECRET}"
```

再把 `depends_on` 补成：

```yaml
    depends_on:
      postgres:
        condition: service_healthy
      metadata:
        condition: service_started
      redis:
        condition: service_healthy
```

### 8.4 `.env.postgres` 建议增加

```env
NEWAPI_POSTGRES_DB=newapi
NEWAPI_POSTGRES_USER=newapi
NEWAPI_POSTGRES_PASSWORD=<postgres-password>

NEWAPI_REDIS_PASSWORD=<redis-password>
NEWAPI_CRYPTO_SECRET=<long-random-secret>
NEWAPI_SESSION_SECRET=<long-random-secret>
```

### 8.5 启用命令

```bash
cd /root/sub2api/deploy/newapi-local
docker compose -f docker-compose.postgres.yml up -d redis new-api
docker compose -f docker-compose.postgres.yml ps
docker logs --tail=100 new-api-local
```

如果日志里看到 Redis connected，说明启用成功。

## 9. 104 机器未来的推荐目标结构

如果这台机器未来还要继续长期用，建议逐步演进成下面结构：

- `gateway`
- `new-api`
- `seedance-compat`
- `postgres`
- `redis`
- `metadata`

即：

```text
client
  -> gateway
     -> new-api
     -> seedance-compat

new-api
  -> postgres
  -> redis
  -> metadata
```

这是最适合单机继续向多机演进的结构。

## 10. 多机扩展前必须先满足的条件

如果以后打算扩成两台或更多台 `new-api`，先把下面这些前置项补齐：

### 10.1 必须使用共享 PostgreSQL

多机时，所有节点必须连同一个 PostgreSQL。

### 10.2 必须使用共享 Redis

多机时，不建议每台机器各用自己的本地 Redis。

必须使用：

- 同一个 Redis 实例
- 同一个 `CRYPTO_SECRET`
- 同一个 `SESSION_SECRET`

### 10.3 反向代理要切成外部统一入口

当前 `new-api-gateway` 是单机容器。

多机时更建议：

- 用外部 Nginx
- 或云负载均衡
- 或 Traefik / HAProxy

统一把流量分到多个 `new-api` 节点。

### 10.4 metadata 建议独立

多机时，metadata 最好不要每台都对外暴露一个 `8088`。

更推荐：

- 只保留一个 metadata 服务
- 或直接使用稳定的统一 metadata 地址
- 所有节点统一配置 `SYNC_UPSTREAM_BASE`

## 11. 多机扩展方案 A：保守方案

这是最稳的多机方式。

架构：

- 1 个外部 Nginx / 负载均衡
- 2 个或更多 `new-api` 节点
- 1 个共享 PostgreSQL
- 1 个共享 Redis
- 可选 1 个共享 metadata

示意：

```text
client
  -> lb.example.com
     -> new-api-node-1
     -> new-api-node-2

new-api-node-1 -> shared postgres
new-api-node-1 -> shared redis
new-api-node-2 -> shared postgres
new-api-node-2 -> shared redis
```

这种方案的特点：

- 稳
- 最容易理解
- 运维边界清晰
- 回滚简单

建议多机统一配置：

```env
SESSION_SECRET=<same-on-all-nodes>
CRYPTO_SECRET=<same-on-all-nodes>
SQL_DSN=postgresql://<shared-pg>
REDIS_CONN_STRING=redis://:<password>@<shared-redis>:6379/0
MEMORY_CACHE_ENABLED=true
NODE_NAME=new-api-node-1
```

第二台机器只改：

```env
NODE_NAME=new-api-node-2
```

## 12. 多机扩展方案 B：保留 Seedance 兼容层

如果多机后仍要支持：

- `/api/v3/contents/generations/tasks`
- `/api/v3/contents/generations/tasks/{task_id}`

那兼容层也要一起纳入负载均衡设计。

建议做法：

- 每个应用节点各带一个本机 `seedance-compat`
- 外部统一网关按路径转发

即：

```text
client
  -> external gateway
     -> /api/v3/contents/generations/tasks* -> seedance-compat nodes
     -> all other paths                     -> new-api nodes
```

这样最清晰，也最好排查问题。

## 13. 多机扩展时不建议的做法

下面这些做法不建议：

- 每个节点各自连自己的 PostgreSQL
- 每个节点各自连自己的 Redis
- 多机了还不设置 `SESSION_SECRET`
- 多机了还不设置 `CRYPTO_SECRET`
- 继续把单机容器 `new-api-gateway` 当作唯一入口

这些做法会导致：

- 登录态不一致
- 缓存行为不一致
- 密文解密异常
- 排障困难

## 14. 推荐的多机演进顺序

建议按这个顺序逐步扩展：

1. 先把当前单机补上 Redis
2. 补 `SESSION_SECRET`
3. 补 `CRYPTO_SECRET`
4. 把 metadata 改成统一来源
5. 再上第二台 `new-api`
6. 最后把入口切到外部负载均衡

这个顺序最稳。

## 15. 回滚方案

如果更新失败，按下面顺序回滚：

### 15.1 回滚代码

```bash
cd /root/new-api
git log --oneline -n 10
git checkout <old-commit-or-branch>

rsync -a --delete \
  --exclude '.git' \
  --exclude 'web/node_modules' \
  /root/new-api/ /root/sub2api/.tmp-new-api/
```

### 15.2 重建旧版本容器

```bash
cd /root/sub2api/deploy/newapi-local
docker compose -f docker-compose.postgres.yml up -d --build new-api seedance-compat gateway
```

### 15.3 必要时恢复数据库

如果只是代码问题，优先不要动数据库。

只有发生明确数据损坏或迁移异常时，才考虑恢复 SQL 备份。

## 16. 推荐的长期整理方向

当前最大的问题不是功能，而是部署目录分裂：

- Git 仓库在 `/root/new-api`
- 实际运行构建在 `/root/sub2api/.tmp-new-api`
- compose 在 `/root/sub2api/deploy/newapi-local`

长期建议整理成一个统一结构，例如：

- `/root/new-api` 既是 Git 仓库
- 也是唯一构建上下文
- compose 也从这个仓库目录启动

这样以后更新时就不需要：

- 一份代码拉 Git
- 再额外 rsync 到另一份目录

但这属于部署结构重构，不建议和业务更新在同一个维护窗口一起做。
