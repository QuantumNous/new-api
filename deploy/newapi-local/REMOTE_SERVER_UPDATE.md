# 远端服务器增量更新指南

本文针对这样的线上环境：

- 服务器上已经有现成的 `PostgreSQL`、`Redis`、反向代理或网关
- 你这次只想把 `deploy-dev` 的新能力更新上去
- 不希望再额外起一套重复的数据库/缓存服务

适用的本次更新内容主要包括：

- Seedance 原生任务接口兼容链路
  - `POST /api/v3/contents/generations/tasks`
  - `GET /api/v3/contents/generations/tasks/{task_id}`
- 视频端点与模型元数据补充
- 任务日志详情英文展示修复

如果你的线上服务本来已经能稳定跑 `new-api`，这次更新的核心思路是：

1. 备份数据库和当前容器配置
2. 更新 `new-api` 应用镜像
3. 按需新增 `seedance-compat` 容器
4. 在现有反向代理中新增 `/api/v3/contents/generations/tasks` 路由
5. 验证 `/api/status`、`/v1/videos` 和 Seedance 原生路径

## 1. 本次更新会影响什么

如果你只更新 `new-api` 主容器：

- 后台和管理端会拿到本次代码更新
- 任务日志英文展示修复会生效
- `OpenAI Video` 相关接口支持会更新

如果你还要支持 Seedance 原生路径：

- 需要额外部署一个 `seedance-compat` 服务
- 需要在现有 Nginx 或网关里加两条路径转发规则

如果你不需要对外暴露 Seedance 原生接口，可以不部署 `seedance-compat`。

## 2. 更新前建议备份

至少备份下面几项：

- 线上当前使用的 `docker-compose.yml` 或容器启动命令
- `new-api` 相关环境变量文件
- PostgreSQL 数据库
- `/data` 挂载目录
- `/app/logs` 对应日志目录

示例：

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker inspect new-api > new-api.container.inspect.json
pg_dump -h <pg-host> -U <pg-user> -d <pg-db> > newapi-backup-$(date +%F-%H%M%S).sql
tar -czf newapi-data-backup-$(date +%F-%H%M%S).tar.gz data logs
```

## 3. 推荐的线上部署结构

建议沿用你现有的 Postgres/Redis，不要照搬 `deploy/newapi-local/docker-compose.postgres.yml` 里的 `postgres` 服务。

推荐结构如下：

- 现有 `PostgreSQL`
- 现有 `Redis`
- `new-api` 容器
- 可选的 `seedance-compat` 容器
- 现有 Nginx / Traefik / Caddy / 云负载均衡

关系如下：

```text
client
  -> your existing reverse proxy
     -> /api/v3/contents/generations/tasks*  -> seedance-compat:3001
     -> all other paths                      -> new-api:3000

new-api
  -> PostgreSQL
  -> Redis
```

## 4. 需要同步到服务器的代码/文件

至少需要同步这部分：

- 最新的 `deploy-dev` 代码
- [deploy/newapi-local/seedance-compat](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/seedance-compat)
- [deploy/newapi-local/gateway/nginx.conf](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/gateway/nginx.conf)
- [deploy/newapi-local/seedance-compat-smoke.json](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/seedance-compat-smoke.json)
- [deploy/newapi-local/remote-seedance-smoke.json](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/remote-seedance-smoke.json)

如果你也想本地托管模型元数据，再额外同步：

- [deploy/newapi-local/metadata](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/metadata)

## 5. 服务端更新步骤

### 5.1 拉取代码

```bash
cd /path/to/new-api
git fetch origin
git checkout deploy-dev
git pull --ff-only origin deploy-dev
```

### 5.2 构建新镜像

如果你线上是直接从源码构建：

```bash
docker build -t new-api:deploy-dev .
docker build -t seedance-compat:deploy-dev ./deploy/newapi-local/seedance-compat
```

如果你线上是先在其他机器构建后再推送镜像仓库，就在你的 CI/CD 流程里做同样的两次构建。

### 5.3 准备或核对环境变量

`new-api` 至少建议核对下面这些变量：

```env
TZ=Asia/Shanghai
SESSION_SECRET=<replace-me>
CRYPTO_SECRET=<replace-me-if-using-redis>
SQL_DSN=postgresql://<user>:<password>@<pg-host>:5432/<db>?sslmode=disable
REDIS_CONN_STRING=redis://:<password>@<redis-host>:6379/0
ERROR_LOG_ENABLED=true
MEMORY_CACHE_ENABLED=true
```

补充说明：

- 多实例部署时，`SESSION_SECRET` 必须一致
- 使用共享 Redis 时，`CRYPTO_SECRET` 必须显式设置且保持一致
- 本次更新不要求必须启用 `SYNC_UPSTREAM_BASE`
- 如果你要复用本仓库里的本地元数据镜像，再设置 `SYNC_UPSTREAM_BASE=http://<metadata-host>:8088`

## 6. 推荐的 Compose 改法

下面这个示例适合“只复用现有 Postgres/Redis”的线上环境。

```yaml
services:
  new-api:
    image: new-api:deploy-dev
    container_name: new-api
    restart: unless-stopped
    command: --log-dir /app/logs
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      TZ: Asia/Shanghai
      SESSION_SECRET: ${SESSION_SECRET}
      CRYPTO_SECRET: ${CRYPTO_SECRET}
      SQL_DSN: ${SQL_DSN}
      REDIS_CONN_STRING: ${REDIS_CONN_STRING}
      ERROR_LOG_ENABLED: "true"
      MEMORY_CACHE_ENABLED: "true"
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://127.0.0.1:3000/api/status | grep -o '\"success\":\\s*true' || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  seedance-compat:
    image: seedance-compat:deploy-dev
    container_name: seedance-compat
    restart: unless-stopped
    environment:
      LISTEN_ADDR: ":3001"
      NEWAPI_BASE_URL: "http://new-api:3000"
    expose:
      - "3001"
    depends_on:
      - new-api
```

注意：

- 不要再起一个新的 `postgres` 服务，除非你就是要换库
- 不要再起一个新的 `redis` 服务，除非你就是要隔离缓存
- 如果你的反向代理和 `new-api` 不在同一个 Docker 网络，需要把 `NEWAPI_BASE_URL` 改成可达地址

## 7. 反向代理需要改什么

如果你已经有自己的 Nginx，不需要再起 `deploy/newapi-local/docker-compose.yml` 里的 `gateway` 容器。

你只需要把这两段路由加到现有站点里：

```nginx
location /api/v3/contents/generations/tasks {
    proxy_pass http://seedance-compat:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Content-Type $content_type;
}

location /api/v3/contents/generations/tasks/ {
    proxy_pass http://seedance-compat:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Content-Type $content_type;
}

location / {
    proxy_pass http://new-api:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

如果你的 Nginx 不是跑在 Docker 网络里：

- `seedance-compat:3001` 改成实际内网地址
- `new-api:3000` 改成实际内网地址

参考配置来源见 [deploy/newapi-local/gateway/nginx.conf](/mnt/c/Users/shaoq/go/src/new-api/deploy/newapi-local/gateway/nginx.conf)。

## 8. 实际更新命令示例

假设你已经把 compose 文件改成复用现有 Postgres/Redis 的版本：

```bash
cd /path/to/new-api
git fetch origin
git checkout deploy-dev
git pull --ff-only origin deploy-dev

docker build -t new-api:deploy-dev .
docker build -t seedance-compat:deploy-dev ./deploy/newapi-local/seedance-compat

docker compose up -d new-api seedance-compat
docker compose ps
```

如果你只更新主服务，不上 Seedance 原生兼容层：

```bash
docker compose up -d new-api
```

如果你用的是单独 `docker run` 而不是 compose，原则也一样：

- 先拉代码或更新镜像
- 再重建 `new-api`
- 按需新增 `seedance-compat`
- 最后 reload Nginx

## 9. 更新后的验收

### 9.1 基础健康检查

```bash
curl -fsS http://127.0.0.1:3000/api/status
docker logs --tail=200 new-api
docker logs --tail=200 seedance-compat
```

### 9.2 OpenAI Video 接口检查

```bash
curl -sS http://<your-host>/v1/videos \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  --data @deploy/newapi-local/remote-seedance-smoke.json
```

### 9.3 Seedance 原生路径检查

```bash
curl -sS http://<your-host>/api/v3/contents/generations/tasks \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  --data @deploy/newapi-local/seedance-compat-smoke.json
```

成功后应至少确认：

- 返回了任务 ID
- 后台日志没有明显的路由错误、数据库连接错误或 Redis 连接错误
- 对应模型的请求确实走到了目标渠道

## 10. 常见坑

- 只更新了 `new-api`，但没有加反向代理规则
  - 结果：`/api/v3/contents/generations/tasks` 仍然打不到兼容层
- 新增了 `seedance-compat`，但 `NEWAPI_BASE_URL` 不可达
  - 结果：兼容层健康检查失败或转发失败
- 线上已经有 Postgres/Redis，又照搬本地 compose 再起一套同名服务
  - 结果：端口冲突、网络冲突、误连错库
- 多实例环境没有设置统一的 `SESSION_SECRET`
  - 结果：登录态异常
- 公用 Redis 没配 `CRYPTO_SECRET`
  - 结果：密文数据无法正确解密

## 11. 回滚建议

如果更新后出现异常，优先按下面顺序回滚：

1. 切回旧镜像标签
2. 重新启动旧版 `new-api`
3. 如本次新增了 `seedance-compat`，先临时下掉 `/api/v3/contents/generations/tasks*` 路由
4. 保留数据库，不要盲目回滚数据库结构，先看应用日志

示例：

```bash
docker compose stop new-api seedance-compat
docker compose rm -f new-api seedance-compat
docker compose up -d new-api
```

如果你有镜像仓库，建议始终保留一个最近稳定版本标签，例如：

- `new-api:stable-2026-04-20`
- `seedance-compat:stable-2026-04-20`

## 12. 最小更新建议

如果你想把风险压到最低，建议按这个顺序上线：

1. 先只更新 `new-api`
2. 确认后台、渠道、日志和现有 API 都正常
3. 再单独上线 `seedance-compat`
4. 最后再给反向代理加 `/api/v3/contents/generations/tasks*` 路由

这样即使 Seedance 原生兼容链路有问题，也不会影响你现有的主 API 流量。

## 13. 104.225.153.184 当前实际状态

我在 `2026-04-23` 实机检查到的状态如下。

当前正在运行的容器：

- `new-api-gateway`
- `new-api-local`
- `seedance-compat-local`
- `new-api-postgres`
- `new-api-metadata`

这说明这台机器当前跑的就是完整的 `deploy/newapi-local` PostgreSQL 方案，不是“复用外部 Postgres/Redis”的精简方案。

实际 compose 项目信息：

- compose 工作目录：`/root/sub2api/deploy/newapi-local`
- compose 文件：`/root/sub2api/deploy/newapi-local/docker-compose.postgres.yml`
- env 文件：`/root/sub2api/deploy/newapi-local/.env.postgres`
- `new-api` 构建上下文：`/root/sub2api/.tmp-new-api`

当前服务特征：

- 对外入口是 `new-api-gateway`，监听宿主机 `3000`
- `new-api-local` 自身只在容器网络里暴露 `3000`
- 使用内部 `new-api-postgres`
- 当前这套服务没有启用 Redis
- 元数据服务通过 `http://<host>:8088` 暴露

当前线上代码形态还有一个关键点：

- `/root/new-api` 是一个 Git 仓库
- 但线上正在跑的服务不是从 `/root/new-api` 直接构建
- 实际构建来源是 `/root/sub2api/.tmp-new-api`
- `/root/sub2api` 本身不是 Git 仓库

这意味着你更新这台机器时，不能只在 `/root/new-api` 里 `git pull`，还必须把最新代码同步到 `/root/sub2api/.tmp-new-api`，或者直接把部署工作目录切换到 `/root/new-api`

## 14. 104.225.153.184 的推荐更新步骤

对这台机器，建议优先采用“保守更新”：

1. 备份 `newapi-local` 这套 compose 目录
2. 备份 PostgreSQL 数据
3. 用最新代码覆盖 `/root/sub2api/.tmp-new-api`
4. 在 `/root/sub2api/deploy/newapi-local` 下重建 `new-api` 和 `seedance-compat`
5. 用 `docker compose -f docker-compose.postgres.yml up -d --build`
6. 验证 `3000` 和 `8088`

建议命令模板：

```bash
cd /root/new-api
git fetch origin
git checkout deploy-dev
git pull --ff-only origin deploy-dev

rsync -a --delete \
  --exclude '.git' \
  --exclude 'web/node_modules' \
  /root/new-api/ /root/sub2api/.tmp-new-api/

cd /root/sub2api/deploy/newapi-local
docker compose -f docker-compose.postgres.yml ps
docker compose -f docker-compose.postgres.yml up -d --build new-api seedance-compat gateway
docker compose -f docker-compose.postgres.yml ps
```

如果你想进一步收敛结构，后续可以把线上部署统一到一个目录，例如直接改成：

- compose 工作目录也放在 `/root/new-api/deploy/newapi-local`
- 构建上下文改回仓库自身
- 不再依赖 `/root/sub2api/.tmp-new-api`

但这属于部署结构整理，不建议和本次业务更新在同一个窗口一起做。
