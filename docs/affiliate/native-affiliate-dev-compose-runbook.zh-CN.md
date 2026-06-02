# 原生分销本地 dev compose runbook

更新日期：2026-06-02

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
