# Fork 与上游 new-api 合并指南

本仓库在官方 [QuantumNous/new-api](https://github.com/QuantumNous/new-api) 之上增加了 **请求审计落库**（`pkg/requestaudit`）等 fork 能力。升级上游时尽量只处理 **2 个补丁触点**，其余逻辑在自有目录中维护。

## 分支与 remote

```text
upstream/main  → 官方 new-api（只读）
main           → 生产分支（merge upstream + 已 apply 补丁）
feature/*      → 功能分支，定期 merge main
```

```bash
git remote add upstream https://github.com/QuantumNous/new-api.git   # 若尚未添加
```

## 合并流程

```bash
./scripts/merge-upstream.sh
```

脚本会：`git fetch upstream` → `git merge upstream/main` → `git apply --3way patches/*.patch` → 尝试 `go build`。

若 merge 或 patch 冲突，优先检查：

| 文件 | 锚点 |
|------|------|
| `main.go` | `FORK:BEGIN requestaudit` … `FORK:END requestaudit`（`InitLogDB` 之后） |
| `router/relay-router.go` | `RegisterRelayForkMiddleware(router)` 必须在 **`StatsMiddleware` 之后** |

**禁止**：在 `main.go` / `relay-router.go` 手改 fork 逻辑却不更新 `patches/`。

## Fork 自有目录（上游不会改）

- `pkg/requestaudit/` — 模型、迁移、中间件、环境变量
- `router/relay_fork.go` — 仅 fork 存在
- `patches/`、`scripts/merge-upstream.sh`、本文档

**不要改**：`model/log.go`、`RecordConsumeLog`、`migrateLOGDB`（合并成本高）。

## 请求审计（RELAY_AUDIT_*）

| 变量 | 默认 | 说明 |
|------|------|------|
| `RELAY_AUDIT_ENABLED` | `false` | 开启后异步写入 LOG 库表 `relay_audit_records` |
| `RELAY_AUDIT_MAX_BODY_KB` | `1024` | 单条 body 最大 KB，超出截断 |
| `RELAY_AUDIT_SAMPLE_RATE` | `100` | 0–100，按 `request_id` 稳定哈希采样 |
| `RELAY_AUDIT_IF_UNCACHED` | `false` | 为 true 时无缓存 body 也会尝试读（排查环境慎用） |

仅 **relay 路由**（`SetRelayRouter`）会经过审计中间件；`/api/*`、视频路由等不在本期范围。

存的是 **客户端 HTTP 请求体**（经解压后），与 `logs.request_id` JOIN 排查。

### 排查 SQL 示例

```sql
SELECT l.request_id, l.use_time, l.completion_tokens, l.model_name, l.ip,
       a.path, a.client_ip, a.body_size, a.truncated, a.body
FROM logs l
LEFT JOIN relay_audit_records a ON a.request_id = l.request_id
WHERE l.request_id = 'YOUR_REQUEST_ID';
```

### 数据保留

表在 LOG 库会持续增长，需定期清理，例如：

```sql
DELETE FROM relay_audit_records WHERE created_at < UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 30 DAY));
```

（SQLite/PostgreSQL 请改用对应时间函数。）

生产默认关闭审计；body 可能含密钥与对话内容，限制 LOG 库访问权限。

## CI 建议（可选）

对干净 upstream tag 执行：`git apply --check patches/*.patch`，补丁过期时提前发现。
