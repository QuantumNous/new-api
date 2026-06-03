# 原生分销 schema impact 发布复核

复核日期：2026-06-04

## 范围

本报告复核当前原生分销相关 GORM sidecar 模型对本地 PostgreSQL schema 的影响。已生成的本地 PostgreSQL schema snapshot 和 diff 位于 Git 忽略目录 `runtime/schema-impact/`；本报告不读取 `.codex-local/sources.yml`，不记录任何 DSN、密码、端点、账号或 dump 内容。

## 输入快照

- 分销 sidecar：`20260602T150911Z-compose-official-baseline.sql` 到 `20260602T152044Z-affiliate-sidecar-after.sql`，diff 为 `20260602T152044Z-affiliate-sidecar.diff`。
- SMS sidecar：`20260602T175546Z-sms-sidecar-before.sql` 到 `20260602T175809Z-sms-sidecar-after.sql`，diff 为 `20260602T175809Z-sms-sidecar.diff`。
- Quota source sidecar：`20260603T003059Z-quota-source-before.sql` 到 `20260603T003059Z-quota-source-after.sql`，diff 为 `20260603T003059Z-quota-source.diff`。
- 代码侧来源：`model.AffiliateSidecarModels()` 当前声明 16 个 `affiliate_*` 模型，`model.SMSSidecarModels()` 当前声明 `sms_send_logs`、`user_phone_bindings` 与 `sms_rate_limit_counters` 三个 SMS sidecar 模型，`model.QuotaSourceSidecarModels()` 当前声明 `user_quota_source_balances` 与 `user_quota_source_events` 两个 quota source sidecar 模型。
- 2026-06-03 新增代码侧 sidecar：`affiliate_job_runs`，用于记录分销结算 pipeline job execution，不改官方核心表。
- 2026-06-04 新增代码侧 SMS sidecar：`sms_rate_limit_counters`，用于短信发送 DB-backed 固定窗口限流，不保存完整手机号、IP 或账号。
- 2026-06-04 新增代码侧分销 sidecar 字段：`affiliate_head_fee_rules.status`，用于人头费规则启停，只影响 `affiliate_*` sidecar 表，不改官方核心表。
- 2026-06-04 新增代码侧分销 sidecar 字段：`affiliate_risk_rules.self_brush_strategy`、`affiliate_risk_rules.bulk_abuse_strategy`、`affiliate_risk_rules.action`，用于风控策略与处理动作配置，只影响 `affiliate_*` sidecar 表，不改官方核心表。

## 复核结果

- 分销 sidecar diff 只新增 `affiliate_*` 表、序列、主键和索引。
- SMS sidecar diff 只新增 `sms_send_logs`、`user_phone_bindings` 及其序列、主键和索引；`sms_rate_limit_counters` 为 2026-06-04 新增代码侧 sidecar，当前因 Docker 不可用尚未生成 PostgreSQL diff。
- Quota source sidecar diff 只新增 `user_quota_source_balances`、`user_quota_source_events` 及其序列、主键和索引。
- `affiliate_job_runs` 当前已进入 `AffiliateSidecarModels()` 和 `AffiliateSidecarTableNames()`，本地 SQLite AutoMigrate 测试可创建该表；预期 PostgreSQL schema impact 只新增 `affiliate_job_runs` 表、序列、主键和索引。
- `sms_rate_limit_counters` 当前已进入 `SMSSidecarModels()` 和 `SMSSidecarTableNames()`，本地 SQLite AutoMigrate 测试可创建该表；预期 PostgreSQL schema impact 只新增 `sms_rate_limit_counters` 表、序列、主键和索引。表内只保存 `dimension`、`scene`、`rate_key_hash`、窗口和计数，不保存原始手机号、IP 或账号。
- `affiliate_head_fee_rules.status` 当前已进入 `AffiliateHeadFeeRule` GORM model，本地 SQLite AutoMigrate 测试可创建该字段；预期 PostgreSQL schema impact 只对 `affiliate_head_fee_rules` sidecar 表新增 `status` 字段与索引。
- `affiliate_risk_rules.self_brush_strategy`、`affiliate_risk_rules.bulk_abuse_strategy`、`affiliate_risk_rules.action` 当前已进入 `AffiliateRiskRule` GORM model，本地 SQLite AutoMigrate 测试可创建这些字段；预期 PostgreSQL schema impact 只对 `affiliate_risk_rules` sidecar 表新增三个 varchar 字段。
- diff 中没有删除 DDL。
- diff 中没有非 sidecar 的新增 `CREATE`、`ALTER` 或 `DROP` DDL。
- 未发现 `users` 或其他官方核心表的结构变更。
- `runtime/schema-impact/` 快照和 diff 仍由 `.gitignore` 忽略，不应提交。
- 本线程尝试 `timeout 30s docker ps --filter 'name=new-api'` 未返回有效容器输出，未强行重建容器生成新的 PostgreSQL before/after diff。发布前或 Docker 恢复后，必须重新导出包含 `affiliate_job_runs` 的 after schema 并更新本报告。

## 验证命令

```bash
sha256sum -c runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql.sha256 runtime/schema-impact/20260602T152044Z-affiliate-sidecar-after.sql.sha256 runtime/schema-impact/20260602T175546Z-sms-sidecar-before.sql.sha256 runtime/schema-impact/20260602T175809Z-sms-sidecar-after.sql.sha256 runtime/schema-impact/20260603T003059Z-quota-source-before.sql.sha256 runtime/schema-impact/20260603T003059Z-quota-source-after.sql.sha256
rg '^\+(CREATE|ALTER|DROP)' runtime/schema-impact/*.diff | rg -v 'public\.(affiliate_|sms_send_logs|sms_rate_limit_counters|user_phone_bindings|user_quota_source_)' || true
rg '^-(CREATE|ALTER|DROP|COMMENT)' runtime/schema-impact/*.diff
git check-ignore -v runtime/schema-impact/20260602T150911Z-compose-official-baseline.sql runtime/schema-impact/20260602T152044Z-affiliate-sidecar-after.sql runtime/schema-impact/20260602T175546Z-sms-sidecar-before.sql runtime/schema-impact/20260602T175809Z-sms-sidecar-after.sql runtime/schema-impact/20260603T003059Z-quota-source-before.sql runtime/schema-impact/20260603T003059Z-quota-source-after.sql runtime/schema-impact/20260603T003059Z-quota-source.diff
go test -count=1 ./model -run 'QuotaSourceSidecar|AffiliateSidecarModels|MigrateDBCreatesAffiliateSidecar'
go test -count=1 ./model -run 'AffiliateSidecarTableNames|AffiliateSidecarModels|MigrateDBCreatesAffiliateSidecar'
go test -count=1 ./model ./service -run 'AffiliateSidecar|MigrateDBCreatesAffiliateSidecar|AffiliateRuleSet|HeadFee|DefaultAffiliateRuleSetSeed|CommissionRuleStatus'
go test -count=1 ./model ./service -run 'AffiliateSidecar|MigrateDBCreatesAffiliateSidecar|AffiliateRuleSet|RiskStrategies|DefaultAffiliateRuleSetSeed'
go test -count=1 ./model ./service ./controller -run 'SMSRateLimit|SMSSidecar|TestAdminTestSMS(AppliesRateLimitBeforeProvider|UsesPersistedRateLimitAcrossLimiterReset)'
```

## 残留风险

- 本报告基于本地 dev PostgreSQL schema snapshot，不能替代 staging 或生产发布前的现场 schema impact 复核。
- 后续如新增 GORM model、修改 sidecar 字段或索引，必须重新导出 before/after schema 并更新本报告。
- Quota source sidecar schema impact 只证明新增表对象安全；真实支付、relay 钱包扣费和退款链路的本地 thin hook 已接入并有 Go 测试覆盖，但仍需 staging/生产真实链路 smoke 证明来源事件持续写入。
- `affiliate_job_runs` 本轮已有代码级 sidecar 复核和 model AutoMigrate 测试，但缺少 Docker PostgreSQL diff 文件；生产发布前不得用本报告替代现场 schema impact。
- `sms_rate_limit_counters` 本轮已有代码级 sidecar 复核和 model AutoMigrate 测试，但缺少 Docker PostgreSQL diff 文件；生产发布前不得用本报告替代现场 schema impact。
- `affiliate_head_fee_rules.status` 本轮已有代码级 sidecar 复核、model AutoMigrate 测试和 service 行为测试，但缺少 Docker PostgreSQL diff 文件；生产发布前不得用本报告替代现场 schema impact。
- `affiliate_risk_rules` 三个风控策略/动作字段本轮已有代码级 sidecar 复核、model AutoMigrate 测试和 service 行为测试，但缺少 Docker PostgreSQL diff 文件；生产发布前不得用本报告替代现场 schema impact。
