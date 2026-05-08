# 邀请消费返利功能任务记录

## 当前任务

阶段 0 补丁：固化自动自审查、中文 commit 与 skills 使用边界

## status

in_progress

## 本轮允许修改

- `.ai/PROJECT.md`
- `.ai/TASK.md`
- `AGENTS.md` 末尾追加很小的 AI Workflow Overlay
- 本轮仅允许在 `AGENTS.md` 现有 AI Workflow Overlay 中做最小增补

## 本轮禁止修改

- 所有 Go 业务代码
- 所有前端业务代码
- 数据库迁移
- 依赖文件
- 配置文件
- 格式化改动
- 任何 `.agents/skills` 命令
- 真实 New API 实例连接或 token 操作

## 上一轮只读结论摘要

- 仓库已有邀请字段：`model.User.AffCode`、`AffCount`、`AffQuota`、`AffHistoryQuota`、`InviterId`。
- 注册和 OAuth 创建用户时会通过邀请码解析邀请人：`model.GetUserIdByAffCode`、`controller.Register`、`controller.GenerateOAuthCode`、`controller/github.go`、`controller/linuxdo.go`、`controller/oauth.go`。
- 现有邀请奖励发生在注册完成后：`(*model.User).Insert` 和 `(*model.User).FinalizeOAuthUserCreation` 会处理 `QuotaForInvitee` / `QuotaForInviter`，不符合“实际消费返利”的触发口径。
- 用户邀请奖励池已有转余额入口：`(*model.User).TransferAffQuotaToQuota`、`controller.TransferAffQuota`、`/api/user/aff_transfer`。
- 同步消费结算链路集中在：`service.PostTextConsumeQuota`、`service.PostAudioConsumeQuota`、`service.PostWssConsumeQuota` 计算实际 quota 后调用 `service.SettleBilling`，再写 `model.RecordConsumeLog`。
- `service.SettleBilling` 是后结算辅助函数，但也被异步任务提交成功路径调用；第一版不要在该函数内部全局挂接返利。
- 异步任务链路包含 `service.RefundTaskQuota`、`service.RecalculateTaskQuota`、`service.RecalculateTaskQuotaByTokens` 和 `service/task_polling.go` 状态流转，后续必须单独设计幂等与退款处理。
- Midjourney 旧路径在提交成功时通过 `service.PostConsumeQuota` 扣费，后续可能在 `controller/midjourney.go` 退款；第一版不接入该路径。
- `model.Log` 可记录消费、充值、退款等日志，但 `LOG_DB` 可能与主库分离；返利必须新增主库表保证幂等和可追踪。
- 推荐新增 `invitation_rebate_records` 主库表，使用 `(source_type, source_key)` 唯一约束防重复，字段保持跨 SQLite / MySQL / PostgreSQL 兼容。
- 后台设置已有 `model.Option`、`model.InitOptionMap`、`model.UpdateOption`、`controller.UpdateOption` 和 `web/default/src/features/system-settings/*`；返利配置后续应复用该系统。
- 第一版推荐配置：`InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota`。

## 本轮结果记录

- 已创建阶段 0 文档边界草案。
- 已在 `AGENTS.md` 末尾追加 AI Workflow Overlay。
- 本轮实际修改文件：`AGENTS.md`、`.ai/PROJECT.md`、`.ai/TASK.md`。
- `.agents/skills` 只读分析结论：`classic-to-default-sync` 为 B 级，当前后端返利主线无关；`i18n-translate` 为 B 级，后续后台文案可参考但写 locale 需授权；`shadcn-ui` 为 B/C 级，只读文档可参考，CLI/MCP/registry 默认禁止执行；`vercel-react-best-practices` 为 A 级，只读安全。
- 自动自审查规则已写入 `AGENTS.md` 和 `.ai/PROJECT.md`。
- 中文 commit 规则已写入 `AGENTS.md` 和 `.ai/PROJECT.md`。
- skill 使用边界已写入 `AGENTS.md` 和 `.ai/PROJECT.md`。
- 未修改任何业务代码、数据库迁移、前端页面、依赖或配置逻辑。
- 已按要求执行本轮验证命令。
- 自审查结果：通过；staged diff 仅包含 `AGENTS.md`、`.ai/PROJECT.md`、`.ai/TASK.md` 文档变更，无业务代码、前端业务代码、迁移、依赖或实际密钥/token 值变更。
- commit hash：提交创建后由最终响应记录；不在 commit 内容中写入最终 commit 自身 hash，避免自引用导致 hash 失效。

## 本轮验证命令

- `git status --short`
- `git diff -- AGENTS.md .ai/PROJECT.md .ai/TASK.md`
- `git diff -- AGENTS.md`
- `Get-Content .ai/PROJECT.md`
- `Get-Content .ai/TASK.md`
- `git add AGENTS.md .ai/PROJECT.md .ai/TASK.md`
- `git diff --cached --stat`
- `git diff --cached`
- `git commit -m "文档：固化邀请返利工作流与自动审查提交规则"`

## 下一轮候选任务

阶段 1：只实现后端配置读取和数据结构草案。
注意：下一轮也不能直接挂接消费链路，必须先确认表结构、setting key、迁移方式、跨库兼容性、幂等 source_key 设计。

## 阶段 1 本轮任务记录

任务名：阶段 1：后端配置读取与邀请返利记录结构最小基础设施

status: completed

### 本轮允许修改

- `common/constants.go`
- `model/option.go`
- `model/main.go`
- `model/invitation_rebate_record.go`
- `.ai/TASK.md`

### 本轮实际修改文件

- `common/constants.go`
- `model/option.go`
- `model/main.go`
- `model/invitation_rebate_record.go`
- `.ai/TASK.md`

### 只读确认摘要

- 配置项通过 `model.Option` key-value 存储，`model.InitOptionMap` 写入默认值，`loadOptionsFromDatabase` 读取数据库覆盖值，`model.UpdateOption` 持久化后调用 `updateOptionMap` 更新内存变量。
- 后台 option / setting 已有统一 key-value 模式，`controller/option.go` 会返回 `common.OptionMap` 中的配置；本轮未新增 API，也未改变返回结构。
- 主库迁移通过 `model/main.go` 的 `DB.AutoMigrate` 和 `migrateDBFast` migration 列表注册 model；日志库 `LOG_DB` 只迁移 `Log`，返利记录应放主库。
- 新增表使用 GORM model、普通 `int` / `int64` / `varchar` 字段、组合唯一索引，不使用 JSONB、外键约束、数据库特有函数或 raw SQL，兼容 SQLite / MySQL / PostgreSQL。
- 可参考 model 写法包括 `User`、`Log`、`TopUp`、`SubscriptionPreConsumeRecord`、`Checkin`，组合唯一索引可参考 `Checkin` 和 OAuth binding 相关 model。
- quota 字段惯例以 `int` 为主：`User.Quota`、`User.UsedQuota`、`User.AffQuota`、`User.AffHistoryQuota`、`Log.Quota` 均为 `int`。
- 现有邀请奖励配置 key 为 `QuotaForNewUser`、`QuotaForInviter`、`QuotaForInvitee`；它们是注册奖励，不适合作为实际消费返利配置，因此本轮新增独立 key。

### 本轮实现摘要

- 新增后端配置默认值：`InvitationRebateEnabled=false`、`InvitationRebateRatioBps=0`、`InvitationRebateMinQuota=0`。
- 新增配置读取逻辑：`InvitationRebateEnabled` 按布尔值读取；`InvitationRebateRatioBps` 按 int 读取并限制在 `0..10000`；`InvitationRebateMinQuota` 按 int 读取并将负数归零；越界值会同步回内存 `OptionMap` 的安全值。
- 新增主库 model：`InvitationRebateRecord`，默认表名 `invitation_rebate_records`。
- 新增字段：`id`、`inviter_user_id`、`invitee_user_id`、`source_type`、`source_key`、`source_request_id`、`source_quota`、`rebate_quota`、`rebate_ratio_bps`、`status`、`created_at`、`updated_at`。
- 新增 `(source_type, source_key)` 组合唯一索引用于防重复返利，`source_type` 与 `source_key` 在创建前校验为非空。
- 新增 `BeforeCreate` / `BeforeUpdate` 时间戳维护，未实现任何返利服务或消费链路挂接。

### 本轮未修改范围

- 未修改消费扣费链路。
- 未修改充值链路。
- 未修改注册 / OAuth 邀请绑定逻辑。
- 未修改前端页面。
- 未新增后台页面。
- 未新增 API。
- 未修改依赖。
- 未执行 `.agents/skills` 命令。

### 验证命令

已执行：

- `gofmt -w common/constants.go model/option.go model/main.go model/invitation_rebate_record.go`
- `git status --short`
- `git diff --stat`
- `git diff`
- `go test ./model/...`
- `git diff --cached --stat`
- `git diff --cached`

验证结果：通过；`go test ./model/...` 返回 `ok github.com/QuantumNous/new-api/model`。

### 自审查结果

通过；本轮 staged diff 仅包含后端配置读取、返利记录 model、AutoMigrate 注册和 `.ai/TASK.md` 记录更新。未修改消费扣费链路、充值链路、注册 / OAuth 绑定逻辑、前端页面、依赖、数据库破坏性迁移或任何 token / secret / access token / sk- key / bearer token 值。

### commit hash

提交创建后由最终响应记录；不写入同一个 commit 的内容中，避免 commit 自引用导致 hash 变化。

### 下一轮最小任务建议

阶段 2 前置确认：只设计并审查返利 service 的事务边界、幂等 `source_key` 生成规则、邀请人更新字段和失败处理策略；仍不直接挂接消费链路，直到确认同步消费落点与退款/回滚风险。
