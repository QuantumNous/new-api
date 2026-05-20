# Dev UI acceptance seed (local only)

**DEV ONLY** — never run against production.

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
