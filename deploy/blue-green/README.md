# 蓝绿部署

`app-blue` 与 `app-green` 两个槽位同时存在，共用同一套 PostgreSQL/MySQL 和 Redis；`gateway`（nginx）把流量转发给 `nginx/upstream/active.conf` 里写的那个槽位。发布时先启动空闲槽位、等它健康，再把网关指过去，旧槽位继续跑完存量流式请求后才停。

```
                    ┌──────────────┐
  :3000 ──────────► │   gateway    │
                    │  (nginx)     │
                    └──────┬───────┘
              active.conf  │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      ┌─────────────┐             ┌─────────────┐
      │  app-blue   │             │  app-green  │
      └──────┬──────┘             └──────┬──────┘
             └───────────┬───────────────┘
                         ▼
              PostgreSQL/MySQL + Redis
```

## 首次部署

1. 准备 Postgres/MySQL 与 Redis（可以复用根目录 `docker-compose.yml`，也可以自己起）。**不能用 SQLite**：两个进程写同一个文件会损坏。
2. 基于 `app.env.example` 创建 `app.env`，两个槽位读同一份，其中 `SQL_DSN`、`REDIS_CONN_STRING`、`SESSION_SECRET` 必须完全一致。
3. 可选：在 `deploy/blue-green/.env` 里设置 `NEW_API_IMAGE`（默认 `ghcr.io/jsxiao/new-api:main`）与 `GATEWAY_PORT`（默认 `3000`）。该文件只用于 compose 变量插值，不会注入容器。
4. 启动：

```bash
docker compose up -d
```

此时只有 `app-blue` 和 `gateway` 需要真正参与服务，`app-green` 可以先不启动（`switch.sh` 会在发布时拉起它）。

## 发布

```bash
./switch.sh status            # 查看当前槽位与两边健康状态
./switch.sh switch            # 发布到空闲槽位（默认镜像）
./switch.sh switch --image ghcr.io/jsxiao/new-api:sha-abc1234
./switch.sh switch green --drain 600 --keep-old
```

脚本做的事：

1. `docker compose up -d --no-deps --force-recreate app-<target>`（带 `--image` 时用指定镜像）。
2. 轮询目标容器的 healthcheck，直到 `healthy`；出现 `unhealthy` 或超过 `HEALTH_TIMEOUT`（默认 300 秒）就中止，**网关不动**。
3. 原子替换 `nginx/upstream/active.conf`，`nginx -t` 通过后 `nginx -s reload`。reload 是平滑的：已经建立的连接（含 SSE 长连接）留在旧槽位继续。
4. 默认 drain 300 秒后 `docker compose stop app-<old>`；`--keep-old` 可保留旧槽位。

新槽位启动时会自己跑数据库迁移。回退前请确认旧版本能对新 schema 工作，或者回退时也一起回滚数据库。

## 回退

```bash
./switch.sh rollback          # 把流量切回上一次发布前的槽位
```

回退同样先等目标槽位健康再切，失败则保持现状。旧槽位在 drain 结束后已被停止，`rollback` 会重新拉起它。

## 运维注意

- 两个槽位的 `NODE_NAME` 已在 compose 里分别固定为 `new-api-blue` / `new-api-green`，便于审计日志区分实例。
- `stop_grace_period` 为 150 秒，大于默认的 `SHUTDOWN_TIMEOUT_SECONDS=120`，保证 SIGTERM 后流式请求能收尾。
- `data` 目录两个槽位共享；日志走容器 stdout（json-file，50m × 5），不进共享目录，避免两个进程抢同一个日志文件。
- 需要 HTTPS 时，把 `nginx/nginx.conf` 的 server 块扩展成 443 + 证书挂载即可，槽位与切换逻辑不变。
