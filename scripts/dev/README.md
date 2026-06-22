# Dev UI acceptance seed (local only)

**DEV ONLY** — never run against production.

94 本机完整开发基线见 [`docs/DEV.md`](../../docs/DEV.md)。new-api dev 栈使用宿主机 **3000**（API）与 **3001**（前端 dev）。本机同时运行 Dify；Dify 端口分配与保护规则以 `docs/DEV.md` 为准，此处不重复。

## Dev stack (3000 + 3001, auto-restart)

Backend and frontend dev server both run in Docker with `restart: unless-stopped`:

```bash
./scripts/dev/start-dev-stack.sh
```

- UI: `http://<host>:3001/`
- API: `http://<host>:3000/`

If you previously ran `pnpm dev` on the host, stop it first (port 3001 conflict):

```bash
pkill -f 'rsbuild dev.*3001' || true
```

## Pre-flight (required)

Confirm:

- Container `new-api-dev-pg` is running
- `SQL_DSN` is `postgresql://root:123456@postgres:5432/new-api`
- Not a cloud/production host

## Seed

```bash
DEV_SEED=1 ./scripts/dev/seed-ui-acceptance.sh
```

## One-click cleanup

```bash
./scripts/dev/cleanup-aioc-demo-data.sh
# or
./scripts/dev/seed-ui-acceptance.sh rollback
```

## Test accounts (password: `DevUi@123456`)

| username | display_name | quota | remark |
|----------|--------------|-------|--------|
| `aioc_demo_zhang` | 张三丰 | 150000000 | AIOC_DEMO |
| `aioc_demo_li` | 李四 | 1000000 | AIOC_DEMO |
| `admin` | (existing) | — | reuse only |

## UI paths

- `/keys` — login as `aioc_demo_zhang`
- `/usage-logs/common` — admin, filter `AIOC_DEMO`
- `/usage-logs/task` — `AIOC_DEMO-任务审计-*`
- `/usage-logs/drawing` — `AIOC_DEMO-绘图审计-*`

## Backups

`scripts/dev/backups/` (gitignored)
