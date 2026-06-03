# 原生分销 schema impact 发布复核

复核日期：2026-06-03

## 范围

本报告复核当前原生分销相关 GORM sidecar 模型对本地 PostgreSQL schema 的影响。复核只使用 Git 忽略目录 `runtime/schema-impact/` 中已生成的 schema snapshot 和 diff，不读取 `.codex-local/sources.yml`，不记录任何 DSN、密码、端点、账号或 dump 内容。

## 输入快照

- 分销 sidecar：`20260602T150911Z-compose-official-baseline.sql` 到 `20260602T152044Z-affiliate-sidecar-after.sql`，diff 为 `20260602T152044Z-affiliate-sidecar.diff`。
- SMS sidecar：`20260602T175546Z-sms-sidecar-before.sql` 到 `20260602T175809Z-sms-sidecar-after.sql`，diff 为 `20260602T175809Z-sms-sidecar.diff`。
- Quota source sidecar：`20260603T003059Z-quota-source-before.sql` 到 `20260603T003059Z-quota-source-after.sql`，diff 为 `20260603T003059Z-quota-source.diff`。
- 代码侧来源：`model.AffiliateSidecarModels()` 当前声明 15 个 `affiliate_*` 模型，`model.SMSSidecarModels()` 当前声明 `sms_send_logs` 与 `user_phone_bindings` 两个 SMS sidecar 模型，`model.QuotaSourceSidecarModels()` 当前声明 `user_quota_source_balances` 与 `user_quota_source_events` 两个 quota source sidecar 模型。

## 复核结果

- 分销 sidecar diff 只新增 `affiliate_*` 表、序列、主键和索引。
- SMS sidecar diff 只新增 `sms_send_logs`、`user_phone_bindings` 及其序列、主键和索引。
- Quota source sidecar diff 只新增 `user_quota_source_balances`、`user_quota_source_events` 及其序列、主键和索引。
- diff 中没有删除 DDL。
- diff 中没有非 sidecar 的新增 `CREATE`、`ALTER` 或 `DROP` DDL。
- 未发现 `users` 或其他官方核心表的结构变更。
- `runtime/schema-impact/` 快照和 diff 仍由 `.gitignore` 忽略，不应提交。

## 验证命令

```bash
sha256sum -c runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql.sha256 runtime/schema-impact/20260602T152044Z-affiliate-sidecar-after.sql.sha256 runtime/schema-impact/20260602T175546Z-sms-sidecar-before.sql.sha256 runtime/schema-impact/20260602T175809Z-sms-sidecar-after.sql.sha256 runtime/schema-impact/20260603T003059Z-quota-source-before.sql.sha256 runtime/schema-impact/20260603T003059Z-quota-source-after.sql.sha256
rg '^\+(CREATE|ALTER|DROP)' runtime/schema-impact/*.diff | rg -v 'public\.(affiliate_|sms_send_logs|user_phone_bindings|user_quota_source_)' || true
rg '^-(CREATE|ALTER|DROP|COMMENT)' runtime/schema-impact/*.diff
git check-ignore -v runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql runtime/schema-impact/20260602T152044Z-affiliate-sidecar-after.sql runtime/schema-impact/20260602T175546Z-sms-sidecar-before.sql runtime/schema-impact/20260602T175809Z-sms-sidecar-after.sql runtime/schema-impact/20260603T003059Z-quota-source-before.sql runtime/schema-impact/20260603T003059Z-quota-source-after.sql runtime/schema-impact/20260603T003059Z-quota-source.diff
go test -count=1 ./model -run 'QuotaSourceSidecar|AffiliateSidecarModels|MigrateDBCreatesAffiliateSidecar'
```

## 残留风险

- 本报告基于本地 dev PostgreSQL schema snapshot，不能替代 staging 或生产发布前的现场 schema impact 复核。
- 后续如新增 GORM model、修改 sidecar 字段或索引，必须重新导出 before/after schema 并更新本报告。
- Quota source sidecar schema impact 只证明新增表对象安全；真实支付、relay 钱包扣费和退款链路的本地 thin hook 已接入并有 Go 测试覆盖，但仍需 staging/生产真实链路 smoke 证明来源事件持续写入。
