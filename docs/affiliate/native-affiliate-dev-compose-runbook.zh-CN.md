# 原生分销本地 dev compose runbook

更新日期：2026-06-03

## 适用范围

本 runbook 只用于 `/home/rain/projects/new-api-rain021217` 的本地 WSL2 Docker Compose 开发环境。

原则：

- 只使用本地 compose PostgreSQL、Redis 和 `runtime/prod-pg-snapshots/` 下已下载 dump。
- 不读取、不输出、不记录 `.codex-local/sources.yml`。
- 不把生产 DSN、密码、dump、runtime/schema 输出提交到 Git。
- Docker 命令串行执行，并使用明确 timeout。

## Preflight

```bash
timeout 60s docker version
timeout 60s docker info --format '{{.ServerVersion}} {{.Name}}'
timeout 60s docker compose version
timeout 60s docker ps --filter 'name=new-api'
```

## 构建与启动

```bash
timeout 600s docker compose -f docker-compose.dev.yml build new-api
timeout 600s docker compose -f docker-compose.dev.yml up -d --force-recreate new-api
timeout 60s docker ps --filter 'name=new-api'
```

目标状态：

- 主服务镜像：`new-api:dev`
- 主容器：`new-api`
- PostgreSQL：`postgres:latest`，容器 `new-api-postgres`
- Redis：`redis:latest`，容器 `new-api-redis`

## Dev 与生产镜像区别

本地 dev compose 的 `new-api:dev` 来自当前仓库源码和 `Dockerfile.dev`，用于快速重建后端开发容器。`5173` default 与 `5174` classic 前端不在该容器内，而是 WSL 内单独运行的 Rsbuild dev server。

生产发布不能把官方 `calciumion/new-api:latest` 当作包含本仓库二开功能的应用镜像。生产应使用当前仓库根目录 `Dockerfile` 构建不可变 tag，该 Dockerfile 会构建并嵌入 default/classic 前端 dist。切换步骤见 `docs/affiliate/native-affiliate-production-cutover-runbook.zh-CN.md`。

## 恢复本地 dump

恢复前先停止主服务，避免应用进程占用数据库：

```bash
timeout 60s docker compose -f docker-compose.dev.yml stop new-api
timeout 60s docker exec new-api-postgres pg_restore --version
timeout 600s docker exec -i new-api-postgres pg_restore --clean --if-exists --no-owner --no-privileges --username root --dbname new-api < runtime/prod-pg-snapshots/new-api-prod-20260602-193617.dump
timeout 600s docker compose -f docker-compose.dev.yml up -d new-api
```

恢复完成后采集核心表行数，不输出连接串：

```bash
timeout 60s docker exec new-api-postgres psql --username root --dbname new-api --tuples-only --no-align --command "select count(*) from public.users"
timeout 60s docker exec new-api-postgres psql --username root --dbname new-api --tuples-only --no-align --command "select count(*) from public.channels"
```

## HTTP smoke

```bash
timeout 30s curl -sS http://127.0.0.1:3000/api/status
timeout 30s curl -sS -I http://127.0.0.1:3000/
```

真实账号登录 smoke 必须从 `.codex-local/affiliate-test-accounts.secret.json` 读取密码，输出只保留角色标签、HTTP code 和 success 状态，不输出用户名、密码、cookie 或响应体。

## 前端 dev server

`5173` 和 `5174` 是 WSL 内的 Rsbuild dev server 进程，不是 Docker 容器。电脑重启、WSL 重启或 tmux session 被关闭后，这两个端口会消失，需要重新启动。

一键启动 default 与 classic：

```bash
./scripts/dev-web-tmux.sh
```

默认启动结果：

- default 前端：`http://127.0.0.1:5173/`，工作目录 `web/default`。
- classic 前端：`http://127.0.0.1:5174/`，工作目录 `web/classic`。
- API proxy：`http://localhost:3000`，即本地 dev compose 的 `new-api` 后端。

本地 dev 模式下，浏览器里的前端请求应使用同源 `/api`，由 Rsbuild proxy 转发到后端。不要把 `VITE_REACT_APP_SERVER_URL=http://localhost:3000` 注入浏览器端；如果页面从 `http://127.0.0.1:5174/` 发起跨源请求到 `http://localhost:3000`，浏览器会因 CORS 把 axios 报错显示为 `Network Error`。

`http://127.0.0.1:3000/` 在 `Dockerfile.dev` 中只放置 `use frontend dev server` 占位页面，这是预期行为。dev 后端容器主要提供 API，真实前端页面使用 `5173` 和 `5174`。

常用 tmux 操作：

```bash
tmux attach -t new-api-web
tmux list-windows -t new-api-web
tmux select-window -t new-api-web:default
tmux select-window -t new-api-web:classic
tmux capture-pane -p -t new-api-web:default -S -80
tmux capture-pane -p -t new-api-web:classic -S -80
tmux kill-session -t new-api-web
```

前端端口 smoke：

```bash
timeout 15s curl -I http://127.0.0.1:5173/
timeout 15s curl -I http://127.0.0.1:5174/
timeout 15s curl -i http://127.0.0.1:5173/api/affiliate/team
timeout 15s curl -i http://127.0.0.1:5174/api/affiliate/team
```

未登录访问 `5173` / `5174` 的 `/api/affiliate/team` 应返回 401，不应返回 `Invalid URL` 404。登录态验证必须从本地 secret 文件读取测试账号密码，不得输出密码、cookie 或响应体。

如果脚本提示缺少 `rsbuild`，先分别安装前端依赖：

```bash
cd web/default && bun install
cd web/classic && bun install
```

## Phase 2 schema baseline

导出 baseline 到 Git 忽略的 `runtime/schema-impact/`：

```bash
mkdir -p runtime/schema-impact
timeout 60s docker exec new-api-postgres pg_dump --schema-only --no-owner --no-privileges --no-comments --username root --dbname new-api > runtime/schema-impact/<timestamp>-compose-official-baseline.sql
sha256sum runtime/schema-impact/<timestamp>-compose-official-baseline.sql > runtime/schema-impact/<timestamp>-compose-official-baseline.sql.sha256
sha256sum -c runtime/schema-impact/<timestamp>-compose-official-baseline.sql.sha256
```

后续接入 `AffiliateSidecarModels()` 到 AutoMigrate 前后，必须导出 after schema 并使用 `ops/schema-impact/diff-schema.sh` 比对；预期新增只允许 `affiliate_*` / 已批准 sidecar 表和索引。

## 清理

停止服务：

```bash
timeout 60s docker compose -f docker-compose.dev.yml down
```

清理本地 dev volume 会删除恢复的本地库，只能在确认不需要当前本地数据后执行：

```bash
timeout 60s docker compose -f docker-compose.dev.yml down -v
```
