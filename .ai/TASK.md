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

## 阶段 2 前置设计记录

任务名：阶段 2 前置设计：返利 service 事务边界与幂等策略

status: completed

### 本轮只读分析范围

- 读取 `AGENTS.md`、`.ai/PROJECT.md`、`.ai/TASK.md`。
- 读取 `pkg/billingexpr/expr.md`。
- 只读分析 `service/`、`model/`、`controller/relay.go`、`relay/common/relay_info.go`、`middleware/request-id.go` 中与事务、同步消费、请求 ID、邀请字段和日志相关的代码。
- 本轮只修改 `.ai/TASK.md`，未修改任何 Go 业务代码、model、migration、配置代码、消费链路、充值链路、注册 / OAuth 逻辑、前端页面或依赖。

### 未来 service 位置建议

- 建议新增独立文件 `service/invitation_rebate.go`，不要放入 `service/billing.go`、`service/quota.go` 或现有消费结算文件。
- 理由：邀请消费返利是消费结算后的独立副作用，涉及配置读取、邀请关系、返利记录、邀请人奖励池更新和幂等处理；独立文件最小耦合、便于单元测试，也避免污染现有 billing / quota / relay 逻辑。
- 测试建议放在 `service/invitation_rebate_test.go`，使用本地测试库覆盖配置、事务、幂等和并发重复调用。

### 事务边界结论

- 未来返利 service 应默认自建事务：消费结算已经成功后再调用返利，返利失败不应回滚或阻断主消费。
- service 内部应支持外部传入 `*gorm.DB` 的事务辅助函数，例如公开函数自建事务，内部 `grantInvitationRebateTx(tx, input)` 负责原子写入；未来若有更大事务场景可复用。
- 创建 `InvitationRebateRecord` 和更新邀请人 `aff_quota` / `aff_history_quota` 必须在同一主库事务中完成。
- 如果返利记录创建成功但邀请人字段更新失败，整个返利事务必须回滚，避免出现“有返利流水但奖励池未增加”的半成功状态。
- 如果 `(source_type, source_key)` 唯一约束冲突，正常情况下视为幂等成功：查询既有记录并返回 `already_granted`，不得再次增加邀请人奖励池。
- 如果冲突记录与本次 invitee / inviter / quota / ratio 明显不一致，应记录告警并返回非致命错误状态；消费调用方只记录错误，不影响主消费。
- 配置关闭、比例为 0、消费 quota 小于最小触发值、被邀请人没有邀请人、邀请人不存在、返利计算结果为 0，均返回 skipped 类状态，不创建记录，不更新奖励池，不视为系统错误。

### source_type / source_key 设计结论

- 推荐第一版同步消费返利使用：
  - `source_type = "sync_relay_request"`
  - `source_key = relayInfo.RequestId`
  - `source_request_id = relayInfo.RequestId`
- 依据：`middleware.RequestId` 每个入口请求生成 `X-Oneapi-Request-Id` 并写入 gin context；`relay/common/genBaseRelayInfo` 将其复制到 `RelayInfo.RequestId`，内部渠道重试仍共享同一个请求 ID；`model.RecordConsumeLog` 也使用同一个 request id。
- 不能依赖 `model.Log.Id` 或消费日志主键作为 source，因为 `LOG_DB` 可通过 `LOG_SQL_DSN` 独立于主库，且消费日志可能被关闭或写入失败。
- `source_key` 必须非空。如果 `relayInfo.RequestId` 缺失，未来挂接点必须跳过返利并记录错误，不允许临时用时间戳、user id、model、quota 拼接。
- 同一次同步实际消费只应生成同一个 source key；同一请求内重复调用返利 service 或内部 retry 不会重复返利；不同入口请求会有不同 request id，避免误判为同一笔。
- 备选方案 1：如果未来主库新增统一 usage / settlement ledger，可改为 `source_type = "usage_settlement"`、`source_key = 主库 ledger id`，这是更强来源，但当前仓库尚不存在。
- 备选方案 2：如果某类同步链路确实可能同一 request id 产生多笔独立结算，source_key 可扩展为稳定业务子键，例如 `request_id + ":" + settlement_phase`；第一版不得使用不稳定时间戳。

### 邀请人字段更新策略

- 邀请关系字段在 `model.User`：`InviterId` 表示邀请人，`AffQuota` 表示邀请奖励池剩余额度，`AffHistoryQuota` 表示邀请历史奖励。
- 未来返利应直接增加邀请人的 `aff_quota` 和 `aff_history` 两列，不增加 `quota` 主余额，不影响用户主余额 / quota。
- 不建议复用 `inviteUser(inviterId)`：该函数用于注册邀请奖励，会增加 `AffCount`，并使用 `QuotaForInviter`，不符合“按实际消费比例返利”。
- 不建议复用 `TransferAffQuotaToQuota`：该函数是用户把邀请奖励池转入主余额的领取入口，返利发放阶段不应直接转主余额。
- 更新应使用事务内 `gorm.Expr("aff_quota + ?", rebateQuota)` 和 `gorm.Expr("aff_history + ?", rebateQuota)` 一次性增量更新，并检查受影响行数或邀请人存在性。
- 必须保留 `InvitationRebateRecord` 作为主追踪流水；可在事务成功后额外调用 `model.RecordLog` 写系统日志给邀请人，但日志写入位于 `LOG_DB`，只能作为展示辅助，不参与幂等，不应影响返利事务结果。

### 失败处理策略

- 第一版优先不影响主消费成功路径：返利失败只记录日志，调用方不得把返利错误返回给用户或回滚消费。
- 配置读取使用 `common.InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota` 的内存值；配置缺失或异常解析已在阶段 1 默认归零，按关闭或不返利处理。
- 数据库唯一冲突按幂等成功处理，返回 `already_granted`。
- 被邀请用户没有 `InviterId`、邀请人不存在、邀请人等于被邀请人，均跳过返利并返回 skipped 状态。
- `source_quota <= 0`、低于最小触发 quota、比例为 0、计算出的 `rebate_quota == 0`，均跳过返利。
- 返利 quota 计算规则明确为向下取整：`rebate_quota = source_quota * ratio_bps / 10000`，避免超过配置比例发放。
- 数据库异常、事务提交失败、冲突记录异常等返回 error 给 service 调用方；未来消费挂接处只能记录错误，不影响主消费响应。
- 只有输入缺少稳定 `source_key` 属于接入错误；service 应返回明确错误状态，挂接点应记录并跳过，不允许用不稳定字段补 key。

### 未来 service 函数草案

- 函数名建议：`TryGrantInvitationRebate(ctx context.Context, input InvitationRebateInput) (*InvitationRebateResult, error)`。
- 入参建议：`InviteeUserId int`、`SourceType string`、`SourceKey string`、`SourceRequestId string`、`SourceQuota int`，可选 `Now int64` 仅用于测试注入。
- 出参建议：`InvitationRebateResult` 包含 `Status string`、`RecordId int`、`InviterUserId int`、`InviteeUserId int`、`SourceQuota int`、`RebateQuota int`、`RebateRatioBps int`。
- 状态建议：`granted`、`already_granted`、`skipped_disabled`、`skipped_zero_ratio`、`skipped_min_quota`、`skipped_zero_rebate`、`skipped_no_inviter`、`skipped_inviter_missing`、`skipped_invalid_source`、`failed`。
- 幂等语义：同一 `source_type + source_key` 只允许成功发放一次；重复调用返回 `already_granted`，不再次更新邀请人奖励池。
- 事务语义：公开函数默认 `model.DB.Transaction`；内部 tx helper 在同一事务中创建返利记录并更新邀请人 `aff_quota` / `aff_history`；外部 tx 由调用方负责提交或回滚。
- 错误处理语义：业务不满足条件返回 skipped 状态且 error 为 nil；数据库异常返回 error；未来消费挂接点捕获 error 后只记录，不影响主请求。

### 测试计划

- 配置关闭，不返利，无记录，无邀请人字段变化。
- 比例为 0，不返利。
- 用户没有邀请人，不返利。
- 消费 quota 小于最小触发值，不返利。
- 正常返利：创建记录，`aff_quota` 和 `aff_history` 增加，`rebate_ratio_bps` 和 `source_quota` 正确。
- 同一 `source_type + source_key` 重复调用，只返利一次，第二次返回 `already_granted`。
- 返利 quota 计算使用向下取整，覆盖不能整除和结果为 0 的场景。
- 邀请人不存在，不影响主消费语义，返回 skipped 或非致命状态。
- 数据库异常不影响主消费调用方，但 service 返回 error 供记录。
- 并发重复调用同一 source，只创建一条记录，只增加一次 `aff_quota` / `aff_history`。

### 本轮验证命令

- `git status --short`
- `git diff -- .ai/TASK.md`
- `git add .ai/TASK.md`
- `git diff --cached --stat`
- `git diff --cached`

### 自审查结果

通过；本轮 staged diff 只修改 `.ai/TASK.md`，没有 Go 代码、model、AutoMigrate、配置代码、消费链路、充值链路、注册 / OAuth、前端页面、依赖或数据库迁移变更；未写入 token / secret / access token / sk- key / bearer token；设计已覆盖事务、幂等、source_key、邀请人字段更新、失败处理和测试计划；下一轮任务不要求挂接消费链路。

### commit hash

提交创建后由最终响应记录；不写入同一个 commit 的内容中，避免 commit 自引用导致 hash 变化。

### 下一轮最小任务建议

阶段 2A：只实现返利 service 本体和单元测试，不挂接消费链路。
