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

## 阶段 2A 多 agent 只读审查记录

任务名：阶段 2A 子步骤 1：多 agent 只读审查与采纳结论固化

status: completed

### 本阶段模式

- 已启用阶段内自治执行模式。
- 已使用 4 个只读 subagents：A 事务与 model 审查、B 配置读取审查、C service 风格与错误处理审查、D 测试审查。
- subagents 均禁止修改文件、禁止执行 `.agents/skills` 命令、禁止连接真实 New API 实例、禁止输出 token / secret / access token / sk- key / bearer token。

### Subagent A：事务与 model 审查结论

- `model.User` 真实邀请字段已确认：`InviterId int`，数据库列 `inviter_id`。
- 邀请奖励池字段已确认：`AffQuota int`，数据库列 `aff_quota`。
- 历史邀请奖励字段已确认：Go 字段为 `AffHistoryQuota int`，JSON 为 `aff_history_quota`，真实数据库列为 `aff_history`；实现必须使用真实列名 `aff_history`，不得误写为 `aff_history_quota`。
- `InvitationRebateRecord` 字段满足 service 需要，`source_type + source_key` 组合唯一约束满足幂等需要。
- 建议用 `model.DB.Transaction`；记录创建与邀请人 `aff_quota` / `aff_history` 增量更新必须同事务完成。
- 唯一约束冲突优先用 GORM `clause.OnConflict{DoNothing: true}` 规避三库错误码解析，必要时再按 `(source_type, source_key)` 查询既有记录。
- 主 Codex 采纳：使用 `OnConflict DoNothing`，新增 service 内部 helper，不新增跨项目 duplicate-key 解析 helper。

### Subagent B：配置读取审查结论

- `InvitationRebateEnabled` 默认 `false`，已进入 `InitOptionMap` 和 `updateOptionMap`。
- `InvitationRebateRatioBps` 默认 `0`，读取时钳制到 `0..10000`，并同步安全值到内存 `OptionMap`。
- `InvitationRebateMinQuota` 默认 `0`，读取时负数归零，并同步安全值到内存 `OptionMap`。
- 默认值保证现有行为不变；当前没有消费链路读取这些配置。
- 主 Codex 采纳：service 直接读取 `common.InvitationRebate*`，并在 service 内再做防御性钳制。

### Subagent C：service 风格与错误处理审查结论

- 建议新增 `service/invitation_rebate.go`，测试放 `service/invitation_rebate_test.go`。
- 建议公开 `InvitationRebateInput`、`InvitationRebateResult`，内部拆 `grantInvitationRebateTx`。
- 建议 service 返回普通 `error`，不返回 `*types.NewAPIError`。
- 建议 service result status 使用 typed string 常量，避免与 model 记录 status 混淆。
- skipped / nil error：配置关闭、比例为 0、quota <= 0、低于最小触发、返利向下取整为 0、无邀请人、邀请人不存在、自邀、已发放。
- error：数据库查询异常、事务提交失败、记录创建失败且查不到既有记录、记录创建后更新邀请人字段失败。
- 主 Codex 采纳：本轮不接入消费链路，未来调用方只记录返利 error，不影响主消费响应。

### Subagent D：测试审查结论

- 建议新增 `service/invitation_rebate_test.go`，同包 `package service`。
- service 包已有 `TestMain`，不新增第二个 `TestMain`。
- 测试使用现有 service 包 SQLite memory DB；本轮测试 helper 内仅对 `model.InvitationRebateRecord` 做本地 AutoMigrate。
- 需要覆盖配置关闭、比例为 0、SourceKey 为空、无邀请人、低于最小触发、正常返利、重复幂等、向下取整、邀请人不存在、并发重复调用。
- 并发幂等测试可做，但不使用 `t.Parallel()`；SQLite 单连接足以验证只创建一条记录、只加一次奖励池。
- 主 Codex 采纳：不测试完整 relay / 消费链路，不连接外部服务。

### 本子步骤修改文件

- `.ai/TASK.md`

### 本子步骤验证命令

- `git status --short`
- `git diff -- .ai/TASK.md`
- `git add .ai/TASK.md`
- `git diff --cached --stat`
- `git diff --cached`

### 本子步骤自审查结果

通过；本子步骤只修改 `.ai/TASK.md`，无 Go 代码、model、migration、配置代码、消费链路、充值链路、注册 / OAuth、前端页面或依赖变更；未写入任何 token / secret / access token / sk- key / bearer token；审查结论覆盖字段真实命名、事务、幂等、配置、错误处理和测试计划。

### commit hash

提交创建后由后续 `.ai/TASK.md` 记录或最终响应记录。

### 下一子步骤

阶段 2A 子步骤 2：实现 `service/invitation_rebate.go` 和 `service/invitation_rebate_test.go`，不挂接消费链路。

## 阶段 2A 子步骤 2 实现记录

任务名：阶段 2A 子步骤 2：实现邀请返利 service 本体与单元测试

status: implementation_verified_with_scope_note

### 本子步骤实际修改文件

- `service/invitation_rebate.go`
- `service/invitation_rebate_test.go`
- `.ai/TASK.md`

### service 行为说明

- 新增 `TryGrantInvitationRebate(ctx, input)`，本轮不被任何消费链路调用。
- 入参不依赖 relay 类型，仅包含 `InviteeUserId`、`SourceType`、`SourceKey`、`SourceRequestId`、`SourceQuota`。
- 配置关闭、比例为 0、`SourceType` / `SourceKey` 为空、消费 quota 小于等于 0、小于最小触发 quota、无邀请人、邀请人缺失、自邀、返利向下取整后为 0，均返回 skipped 类状态且 `error == nil`。
- 正常返利按 `sourceQuota * ratioBps / 10000` 向下取整，创建 `InvitationRebateRecord`，并增加邀请人的 `aff_quota` 与真实数据库列 `aff_history`。
- 唯一约束冲突通过 GORM `OnConflict DoNothing` 处理，重复调用返回 `already_granted`，不重复增加邀请人奖励池。

### 事务与幂等说明

- service 默认使用 `model.DB.WithContext(ctx).Transaction` 自建事务。
- `InvitationRebateRecord` 创建与邀请人 `aff_quota` / `aff_history` 增量更新在同一事务内完成。
- `(source_type, source_key)` 是幂等来源键；`SourceKey` 为空时直接跳过，不生成伪 key。
- 使用 GORM clause 避免解析 SQLite / MySQL / PostgreSQL 各自的 duplicate key 错误码。

### 测试覆盖说明

- 覆盖配置关闭不返利。
- 覆盖比例为 0 不返利。
- 覆盖 `SourceKey` 为空不返利。
- 覆盖用户没有邀请人不返利。
- 覆盖消费 quota 小于最小触发值不返利。
- 覆盖正常返利、记录创建、`aff_quota` 与 `aff_history` 增加。
- 覆盖同一 `source_type + source_key` 串行重复调用只返利一次。
- 覆盖返利 quota 向下取整。
- 覆盖邀请人不存在不返利。
- 覆盖并发重复调用尽量只创建一条记录且只增加一次奖励池。

### 本子步骤验证命令

- `gofmt -w service/invitation_rebate.go service/invitation_rebate_test.go`
- `git status --short`
- `git diff --stat`
- `git diff`
- `go test ./service/...`
- `go test ./service -run TestTryGrantInvitationRebate -count=1`
- `go test ./service -run TestObserveChannelAffinityUsageCacheByRelayFormat -count=1`

### 验证结果

- `go test ./service -run TestTryGrantInvitationRebate -count=1` 通过。
- `go test ./service/...` 未通过，失败点为既有 `service/channel_affinity_usage_cache_test.go` 中的 `TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode` 和 `TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`。
- 已用 `go test ./service -run TestObserveChannelAffinityUsageCacheByRelayFormat -count=1` 单独复现 channel affinity usage cache 测试失败；该失败与新增邀请返利 service / test 无直接调用关系。
- 因本阶段禁止修改非允许范围文件，未修改既有 channel affinity 测试或实现；本轮采用最小可行的邀请返利 service 定向测试作为提交前验证依据，并在最终响应中明确报告包级测试失败。

### 本子步骤自审查结果

通过；本子步骤未修改消费链路、充值链路、注册 / OAuth、前端页面、数据库迁移、model 结构、option / setting 结构或依赖文件；未执行 `.agents/skills` 命令；未连接真实 New API 实例；未写入或输出 token / secret / access token / sk- key / bearer token；service 当前没有被任何消费链路调用；空 `source_key` 不会生成伪 key；唯一冲突不会重复增加返利。

### commit hash

- 多 agent 只读审查文档 commit：`5d5cff79b16fae2306d616e1aedf2afdab9ecd0e`
- service 实现 commit：`2a1ecf5f9c3ea749a76a2b3961f40ac6578293c7`

### 下一阶段建议

阶段 2B：只做同步消费链路挂接前的 source key 只读复核与最小接入点确认；先确认 `relayInfo.RequestId` 在目标同步消费落点必定稳定、非空、同一实际消费只触发一次，再决定是否进入挂接实现。

## 阶段 2B 只读审查记录

任务名：阶段 2B：确认邀请返利同步消费挂接边界

status: completed

### 本阶段模式

- 启用阶段内自治执行。
- 已启动 2 个只读 subagents：A `source_key` 稳定性审查、B 同步消费成功点审查。
- Subagent C / D 因当前 agent 线程上限未能启动，由主 Codex 按独立只读审查小节模拟完成。
- 所有审查均未修改文件、未执行 `.agents/skills`、未连接真实 New API 实例、未输出 token / secret / sk- key / bearer token。

### Subagent A：source_key 稳定性审查结论

- 同步消费路径存在稳定 request id：`middleware.RequestId()` 在入口生成 `X-Oneapi-Request-Id` 并写入 gin context。
- `relay/common/genBaseRelayInfo` 会把 context 中的 request id 复制到 `relayInfo.RequestId`；若 context 缺失，也有非空兜底生成。
- 同一次 `controller.Relay` 请求只生成一个 `relayInfo`，内部 channel retry 复用同一个 `relayInfo.RequestId`。
- 内部 retry 不会产生新 request id；客户端外部重发会产生新 HTTP 请求并获得新 request id。
- 第一版可使用 `source_type = "sync_relay_request"`、`source_key = relayInfo.RequestId`、`source_request_id = relayInfo.RequestId`。
- 不依赖 `LOG_DB` 或消费日志 id；`model.Log.Id` 不适合作为幂等来源，因为 `LOG_DB` 可独立于主库。
- 必须限域到标准同步 relay 消费成功路径；不得挂到全局 `PostConsumeQuota`、异步 task、Midjourney、退款或失败补偿路径。

### Subagent B：同步消费成功点审查结论

- 同步消费最终成功后置点为：
  - `service.PostTextConsumeQuota`
  - `service.PostAudioConsumeQuota`
  - `service.PostWssConsumeQuota`
- 最小挂接点必须在最终 quota 计算完成、`SettleBilling(...)` 成功返回之后。
- `SettleBilling` 本身不能挂接，因为它同时被异步任务提交成功路径复用。
- 本轮必须排除异步任务、Midjourney、`PreWssConsumeQuota` 分段扣费、violation fee、`PostConsumeQuota`、退款、失败补偿、负 quota 返还和 `SettleBilling` 全局挂接。
- 正常同步成功请求通常只触发一次；异常重复调用仍依赖 `(source_type, source_key)` 幂等保护。
- 返利调用不得影响主消费返回；`Post*ConsumeQuota` 当前无 error 返回，返利错误只能记录日志。

### Subagent C：失败隔离与日志审查结论（主流程模拟）

- `TryGrantInvitationRebate` 返回 error 时，挂接点只调用 `logger.LogError` 记录，不向上返回，不回滚消费，不改变响应结构。
- skipped 状态包括配置关闭、比例为 0、空 source、quota 不满足、无邀请人、邀请人不存在、自邀、返利为 0 等，不需要记录 error。
- `already_granted` 属于幂等成功，不需要记录 error。
- 日志不得输出 token key、access token、sk- key、bearer token、上游 api key 或完整请求头；可记录非敏感的 user id、request id、quota、status。
- 可复用现有 `logger.LogError` / `logger.LogWarn`，不新增日志结构。

### Subagent D：挂接测试策略审查结论（主流程模拟）

- 最小测试建议放在 `service/invitation_rebate_test.go`，直接覆盖同步挂接 helper 的行为，避免引入完整 handler / relay 外部依赖。
- 可测试 `source_key` 为空不触发返利。
- 可测试同步成功后同一 request id 触发一次返利，重复调用只返一次。
- “返利失败不影响主消费”可通过挂接 helper 无返回值、仅记录错误的实现自审确认；若要强造数据库异常，当前 service 测试环境会扩大影响，不作为本轮最小测试。
- 保留阶段 2A 的 `TryGrantInvitationRebate` 定向测试作为核心验证；不强制修复既有 `go test ./service/...` 的 channel affinity 失败。

### 进入条件阶段 3A 判断

- 稳定、非空、同一实际消费唯一的 `source_key`：确认，来源为 `relayInfo.RequestId`。
- 不依赖可能独立的 `LOG_DB`：确认。
- 最小同步消费成功后置点：确认，为 `PostTextConsumeQuota`、`PostAudioConsumeQuota`、`PostWssConsumeQuota` 中 `SettleBilling` 成功之后。
- 不接入异步任务：确认。
- 不接入 Midjourney：确认。
- 不在预扣、失败、退款、回滚路径触发：确认。
- 返利失败不影响主消费成功：确认，挂接 helper 不返回 error。
- 只需要修改极少数同步消费后置函数所在文件：确认，预计为 `service/text_quota.go`、`service/quota.go`。
- 有最小验证方案：确认，定向测试新增在 `service/invitation_rebate_test.go`。
- 不需要修改 model、migration、配置结构、前端或依赖：确认。

结论：允许进入条件阶段 3A。

### 阶段 2B 验证命令

- `git status --short`
- `git diff -- .ai/TASK.md`
- `git add .ai/TASK.md`
- `git diff --cached --stat`
- `git diff --cached`

### 阶段 2B 自审查结果

通过；本子步骤只修改 `.ai/TASK.md`，没有 Go 业务代码、异步任务、Midjourney、充值、注册 / OAuth、前端、model、migration、配置结构或依赖变更；未写入 token / secret / sk- key / bearer token；已明确 3A 只允许限域挂接同步消费成功路径。

### commit hash

提交创建后由最终响应记录。

### 下一子步骤

条件阶段 3A：在 `PostTextConsumeQuota`、`PostAudioConsumeQuota`、`PostWssConsumeQuota` 的 `SettleBilling` 成功之后最小挂接 `TryGrantInvitationRebate`，并新增定向测试；仍不接入异步任务、Midjourney、充值、注册 / OAuth 或前端。

## 条件阶段 3A 实现记录

任务名：条件阶段 3A：挂接同步消费邀请返利触发

status: implementation_verified_with_scope_note

### 本阶段实际修改文件

- `service/text_quota.go`
- `service/quota.go`
- `service/invitation_rebate_test.go`
- `.ai/TASK.md`

### 实际挂接点

- `service.PostTextConsumeQuota`：最终 quota 计算完成且 `SettleBilling(ctx, relayInfo, summary.Quota)` 成功返回后调用。
- `service.PostAudioConsumeQuota`：最终 quota 计算完成且 `SettleBilling(ctx, relayInfo, quota)` 成功返回后调用。
- `service.PostWssConsumeQuota`：最终 quota 计算完成且 `SettleBilling(ctx, relayInfo, quota)` 成功返回后调用。
- 未在 `SettleBilling` 内部挂接，避免异步任务复用路径被误接入。

### 挂接行为说明

- 新增同步挂接 helper：`grantInvitationRebateAfterSyncConsume`。
- `SourceType` 使用稳定字符串常量 `sync_relay_request`。
- `SourceKey` / `SourceRequestID` 使用 `relayInfo.RequestId`。
- `SourceQuota` 使用 `SettleBilling` 成功后的实际结算 quota。
- `relayInfo == nil`、`sourceQuota <= 0` 或 `relayInfo.RequestId == ""` 时跳过；空 request id 不生成伪 key。
- `TryGrantInvitationRebate` 返回 skipped 或 `already_granted` 时不影响主流程。
- `TryGrantInvitationRebate` 返回 error 时只通过 `logger.LogError` 记录，不向上传播，不回滚消费，不改变响应结构。

### 本阶段未接入范围

- 未接入异步任务链路。
- 未接入 Midjourney。
- 未修改充值链路。
- 未修改注册 / OAuth。
- 未修改前端。
- 未修改 model / migration / option / setting 结构。
- 未修改依赖。

### 测试覆盖说明

- 新增 `TestGrantInvitationRebateAfterSyncConsumeEmptyRequestIdSkips`：确认 `source_key` 为空不触发返利。
- 新增 `TestGrantInvitationRebateAfterSyncConsumeDuplicateRequestIdGrantsOnce`：确认同步成功后同一 request id 重复调用只返利一次。
- 新增 `TestGrantInvitationRebateAfterSyncConsumeErrorIsIsolated`：确认返利 service 异常时挂接 helper 不 panic、不向上传播。
- 保留并通过阶段 2A 的 `TestTryGrantInvitationRebate*` 定向测试。

### 本阶段验证命令

- `gofmt -w service/text_quota.go service/quota.go service/invitation_rebate_test.go`
- `git status --short`
- `git diff --stat`
- `git diff`
- `go test ./service -run 'TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume' -count=1`
- `go test ./service -run TestTryGrantInvitationRebate -count=1`
- `go test ./service/...`

### 验证结果

- 邀请返利定向测试通过。
- `go test ./service/...` 仍未通过，失败点仍为既有 `service/channel_affinity_usage_cache_test.go` 的 `TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode` 与 `TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`；该问题已在阶段 2A 记录，本阶段未修改该范围。

### 本阶段自审查结果

通过；staged diff 仅包含同步消费后置挂接、邀请返利定向测试和 `.ai/TASK.md` 记录；没有修改异步任务链路、Midjourney、充值、注册 / OAuth、前端、model / migration / config 结构、依赖或响应结构；没有在预扣、失败、refund、rollback、负 quota 返还路径触发返利；返利失败不影响主消费；`source_key` 为空不触发返利；未写入 token / secret / sk- key / bearer token。

### commit hash

- 阶段 2B 文档 commit：`deb6edff6e9254cb9e66fd96a5f4721715addf24`
- 条件阶段 3A 实现 commit：`46462d1459417b9ae51c50e1d155521ec33f78ed`

### 下一阶段建议

阶段 3B：后台配置页面最小接入，仅展示和编辑 `InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota`；不改消费逻辑、不改返利 service、不新增复杂流水页面。

## 阶段 3B 只读审查记录

任务名：阶段 3B：确认邀请返利后台配置接入边界

status: review_completed

### 本阶段模式

- 启用阶段内自治执行与多 agent 只读审查。
- 已启动 4 个只读 subagents：A 后台配置 API 审查、B 前端系统设置结构审查、C i18n 与文案审查、D 前端验证策略审查。
- 所有 subagents 均未修改文件、未执行 `.agents/skills`、未连接真实 New API 实例、未输出 token / secret / sk- key / bearer token。

### Subagent A：后台配置 API 审查结论

- `InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota` 已在 `common/constants.go` 和 `model/option.go` 注册。
- `controller.GetOptions` 通过现有 `/api/option/` 返回 `common.OptionMap`，三个 key 不属于敏感 key 过滤范围。
- `controller.UpdateOption` 通过现有 `/api/option/` 统一写入 option；`model.updateOptionMap` 已支持这三个 key。
- `InvitationRebateRatioBps` 已在后端钳制到 `0..10000`，`InvitationRebateMinQuota` 已将负数归零。
- 结论：本阶段不需要新增后端 API，不需要修改后端 option 白名单或 key 列表。

### Subagent B：前端系统设置结构审查结论

- 邀请消费返利配置适合放在 Billing 设置页，因其属于实际消费结算后的奖励策略。
- 建议新增独立 `Invitation Rebate` section，避免和 `Quota Settings` 中的注册邀请奖励 `QuotaForInviter` / `QuotaForInvitee` 混淆。
- 复用 `SettingsSection`、系统设置表单组件、`Switch`、`Input type="number"`、`Button`、`useSettingsForm`、`useUpdateOption`、`FormDirtyIndicator`、`FormNavigationGuard`。
- 最小前端修改点为 `BillingSettings` 类型、billing 默认值、billing section registry、新增邀请返利设置组件。
- `api.ts` 不需要修改。

### Subagent C：i18n 与文案审查结论

- 新增 UI 文案必须继续使用 `useTranslation()` 和 `t('English key')`。
- 需要在 `en`、`zh`、`fr`、`ja`、`ru`、`vi` 六个 locale 中补齐同一批 key。
- 本阶段不执行 `i18n-translate` skill，不执行会产生额外写入的 skill 命令。
- 可手动最小补齐 locale；若不执行 `bun run i18n:sync`，需人工确认六个 locale key 一致。
- 文案必须说明返利基于实际消费而非充值，`10000 bps = 100%`，`1000 bps = 10%`。

### Subagent D：前端验证策略审查结论

- `web/default/package.json` 提供 `typecheck`、`lint`、`build`、`build:check` 脚本。
- 最小验证建议为 `bun run typecheck`、`bun run lint`、`bun run build`；如需合并类型检查和构建可用 `bun run build:check`，但仍需单独 lint。
- 若当前环境缺少 Bun 或 `web/default/node_modules`，不得自行安装依赖，必须记录阻塞。
- 若本阶段只改前端系统设置页和 i18n，不需要执行后端测试。

### 进入实现判断

- 现有 option 接口可读写三个邀请返利 key：确认。
- 前端设置页有明确最小接入点：确认，新增 Billing 下独立 `Invitation Rebate` section。
- 不需要修改消费挂接逻辑：确认。
- 不需要修改返利 service：确认。
- 不需要修改 model / migration：确认。
- 不需要修改充值、注册、OAuth：确认。
- 不需要执行 `.agents/skills` 命令：确认。
- 有最小构建或类型验证方案：确认，但需以本地 Bun / 依赖可用性为准。

结论：允许进入阶段 3B 最小实现。

### 阶段 3B 审查验证命令

- `git status --short`
- `git diff -- .ai/TASK.md`
- `git add .ai/TASK.md`
- `git diff --cached --stat`
- `git diff --cached`

### 阶段 3B 审查自审查结果

通过；本子步骤只修改 `.ai/TASK.md`，没有 Go 代码、前端业务代码、消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务、Midjourney、model / migration、依赖或密钥变更。

### commit hash

提交创建后由最终响应记录。

### 下一子步骤

阶段 3B 最小实现：在 Billing 设置页新增独立邀请消费返利配置 section，展示并编辑 `InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota`，手动补齐六语言 locale；不修改后端、消费挂接逻辑、返利 service、充值、注册 / OAuth、model / migration 或依赖。

## 阶段 3B 最小实现记录

任务名：阶段 3B：后台配置页面最小接入邀请消费返利配置

status: validation_blocked

### 本阶段实际修改文件

- `web/default/src/features/system-settings/billing/index.tsx`
- `web/default/src/features/system-settings/billing/section-registry.tsx`
- `web/default/src/features/system-settings/general/invitation-rebate-settings-section.tsx`
- `web/default/src/features/system-settings/types.ts`
- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- `web/default/src/i18n/locales/fr.json`
- `web/default/src/i18n/locales/ja.json`
- `web/default/src/i18n/locales/ru.json`
- `web/default/src/i18n/locales/vi.json`
- `.ai/TASK.md`

### 实现摘要

- 在 Billing 设置页新增独立 `Invitation Rebate` section。
- 新增后台可编辑字段：
  - `InvitationRebateEnabled`：启用邀请消费返利。
  - `InvitationRebateRatioBps`：返利比例 bps，前端表单范围 `0..10000`。
  - `InvitationRebateMinQuota`：最小触发消费 quota，前端表单最小值 `0`。
- 继续复用现有 `/api/option/` 保存协议、`useUpdateOption`、`useSettingsForm`、`SettingsSection`、`Switch`、`Input type="number"`。
- 页面文案已说明返利基于实际消费而非充值，并说明 `10000 bps = 100%`、`1000 bps = 10%`。
- 手动补齐 `en`、`zh`、`fr`、`ja`、`ru`、`vi` 六个 locale 的新增 key；未执行 `i18n-translate` skill，未执行 `bun run i18n:sync`。

### 本阶段未修改范围

- 未修改消费挂接逻辑。
- 未修改返利 service。
- 未修改充值链路。
- 未修改注册 / OAuth。
- 未修改异步任务 / Midjourney。
- 未修改 model / migration。
- 未修改后端 option / setting 结构。
- 未修改依赖。
- 未执行 `.agents/skills` 命令。
- 未连接真实 New API 实例。
- 未写入或输出 token / secret / sk- key / bearer token。

### 本阶段验证命令

- `git status --short`
- `git diff --stat`
- `git diff`
- `Get-Command bun -ErrorAction SilentlyContinue`
- `Test-Path web/default/node_modules`
- `bun run typecheck`
- `bun run lint`
- `bun run build`
- `node --version`
- `node -` locale JSON parse 与新增 key 完整性检查

### 验证结果

- `node --version` 通过，当前为 `v24.14.1`。
- `node -` locale JSON parse 与新增 key 完整性检查通过：`en.json`、`zh.json`、`fr.json`、`ja.json`、`ru.json`、`vi.json` 均包含本阶段新增的 8 个 i18n key。
- `bun run typecheck` 未执行成功：当前环境未安装 `bun`。
- `bun run lint` 未执行成功：当前环境未安装 `bun`。
- `bun run build` 未执行成功：当前环境未安装 `bun`。
- `web/default/node_modules` 当前不存在。
- 按工作流规则，前端实现验证未通过，本阶段实现不提交 commit，不标记 completed。

### 本阶段自审查结果

通过范围自审但验证阻塞；当前 diff 仅包含后台系统设置前端最小接入、六语言 i18n key 和 `.ai/TASK.md` 记录。没有消费挂接逻辑、返利 service、充值、注册 / OAuth、异步任务、Midjourney、model / migration、依赖或密钥变更。因 `bun` 缺失且 `node_modules` 不存在，无法完成 typecheck / lint / build，因此不创建实现 commit。

### commit hash

- 阶段 3B 边界文档 commit：`ac64f4ed774581cb0b3e6c93478d14aaaadab423`
- 阶段 3B 前端实现 commit：未创建，原因是前端验证被当前环境缺少 `bun` 和 `web/default/node_modules` 阻塞。

### 下一阶段建议

阶段 3B 验证恢复：在明确授权或环境准备好 `bun` 与 `web/default/node_modules` 后，先只运行 `cd web/default && bun run typecheck && bun run lint && bun run build`；若验证通过，再 staged diff 自审并提交 `前端：接入邀请消费返利后台配置`。在验证通过前，不进入返利流水展示或新的业务开发。

## 阶段 3B 补验证记录

任务名：阶段 3B 补验证与提交

status: validation_blocked

### 本轮目标

- 只补做阶段 3B 前端实现验证。
- 若 `typecheck`、`lint`、`build` 全部通过，再提交 `前端：接入邀请消费返利后台配置`。
- 不进入阶段 4，不新增功能，不扩大范围。

### 本轮实际修改文件

- `.ai/TASK.md`

### 环境检查结果

- `node --version` 可用，结果为 `v24.14.1`。
- `bun --version` 不可用，PowerShell 返回 `bun : The term 'bun' is not recognized...`。
- `Test-Path web/default/node_modules` 返回 `False`。
- `web/default/package.json` 已读取，脚本包含 `typecheck`、`lint`、`build`、`build:check`。
- `web/default/bun.lock` 存在，但因当前环境没有 `bun`，不能执行 `bun install --frozen-lockfile`。
- `Get-Command tsc -ErrorAction SilentlyContinue` 未发现可用 `tsc`，无法执行 TS / TSX 基础语法检查。

### 本轮执行验证命令

- `git status --short`
- `git diff --stat`
- `git diff`
- `node --version`
- `bun --version`
- `Test-Path web/default/node_modules`
- `Get-Content web/default/package.json`
- `git diff --check`
- `node -` locale JSON parse 与新增 key 完整性检查
- `Get-Command tsc -ErrorAction SilentlyContinue`
- `Get-ChildItem web/default -File | Where-Object { $_.Name -match 'lock|bun' }`

### 本轮验证结果

- `git diff --check` 通过，未发现 whitespace error。
- `node -` locale JSON parse 与新增 key 完整性检查通过：`en.json`、`zh.json`、`fr.json`、`ja.json`、`ru.json`、`vi.json` 均包含阶段 3B 新增的 8 个 i18n key。
- `bun run typecheck` 未执行：当前环境没有 `bun`。
- `bun run lint` 未执行：当前环境没有 `bun`。
- `bun run build` 未执行：当前环境没有 `bun`。
- 未执行 `bun install --frozen-lockfile`：当前环境没有 `bun`。

### 本轮自审查结果

通过范围自审但验证仍阻塞；当前 diff 仍仅包含阶段 3B 后台配置前端接入、六语言 i18n key 和 `.ai/TASK.md` 记录。没有消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务 / Midjourney、model / migration、后端 option 逻辑、依赖文件、token / secret / sk- key / bearer token 变更。因缺少 `bun` 且 `web/default/node_modules` 不存在，未满足提交条件，不创建实现 commit。

### commit hash

- 阶段 3B 实现 commit：未创建。

### 下一阶段建议

仍停留在阶段 3B 验证恢复：准备好 `bun` 和 `web/default/node_modules` 后，先执行 `cd web/default && bun run typecheck && bun run lint && bun run build`；全部通过后再 staged diff 自审并提交 `前端：接入邀请消费返利后台配置`。验证通过前不要进入阶段 4。

## 阶段 3B 补齐 Bun 后验证记录

任务名：阶段 3B 补齐前端验证环境后复验

status: validation_blocked_existing_lint

### 本轮目标

- 在当前 Codex 环境安装或启用 Bun。
- 使用 `web/default/bun.lock` 执行 `bun install --frozen-lockfile`。
- 执行阶段 3B 前端验证，并在通过后提交 `前端：接入邀请消费返利后台配置`。

### 本轮实际修改文件

- `.ai/TASK.md`

### 环境与依赖处理结果

- 官方 PowerShell 安装脚本 `irm https://bun.sh/install.ps1 | iex` 因网络/TLS 连接断开失败，未写入仓库文件。
- 使用 `npm install --prefix $env:TEMP/codex-bun-tool bun@latest` 在临时目录安装 Bun 执行工具，未写入仓库。
- 临时 Bun 版本：`1.3.13`。
- `web/default/bun.lock` 存在。
- 已在 `web/default` 执行 `bun install --frozen-lockfile`，安装成功。
- `web/default/node_modules` 已存在，但未 staged、不会提交。
- `web/default/package.json`、`web/default/bun.lock` 及其他依赖定义 / lock 文件无 diff。

### 本轮执行验证命令

- `git status --short`
- `git diff --stat`
- `node --version`
- `bun --version`
- `Test-Path web/default/node_modules`
- `Get-Content web/default/package.json`
- `Get-ChildItem web/default -File | Where-Object { $_.Name -match 'lock|bun' }`
- `npm install --prefix $env:TEMP/codex-bun-tool bun@latest`
- `$env:TEMP/codex-bun-tool/node_modules/.bin/bun.cmd --version`
- `cd web/default && bun install --frozen-lockfile`
- `cd web/default && bun run typecheck`
- `cd web/default && bun run lint`
- `git diff -- web/default/package.json web/default/bun.lock web/default/package-lock.json web/default/yarn.lock web/default/pnpm-lock.yaml`
- `git diff --check`

### 本轮验证结果

- `bun run typecheck` 通过。
- `bun run lint` 未通过，失败点均位于既有非阶段 3B 文件：
  - `web/default/src/features/keys/components/api-keys-dialogs.tsx`
  - `web/default/src/features/system-settings/models/group-ratio-visual-editor.tsx`
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx`
  - `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx`
  - `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx`
  - `web/default/src/features/usage-logs/components/task-logs-filter-bar.tsx`
  - `web/default/src/lib/theme-radius.ts`
  - 另有既有 warnings 位于 `channels-table.tsx` 和 `user-charts.tsx`。
- lint 失败不来自阶段 3B 新增的邀请返利设置组件、billing registry、types 或 locale。
- 因 lint 未通过，未继续执行 `bun run build`，未创建实现 commit。
- `git diff --check` 通过。
- 依赖定义文件和 lockfile 没有变更。

### 本轮自审查结果

通过范围自审但提交条件未满足；当前 diff 仍仅包含阶段 3B 后台配置前端接入、六语言 i18n key 和 `.ai/TASK.md` 记录。没有修改消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务 / Midjourney、model / migration、后端 option 逻辑或依赖定义文件；没有提交 `node_modules`；没有写入 token / secret / sk- key / bearer token。按本轮规则，既有 lint 问题不在允许修复范围内，因此停止且不提交。

### commit hash

- 阶段 3B 实现 commit：未创建。

### 下一阶段建议

阶段 3B 仍需补验证：先由单独任务处理或临时豁免既有 `bun run lint` 失败；随后重新执行 `cd web/default && bun run lint && bun run build`。若 lint 和 build 均通过，再 staged diff 自审并提交 `前端：接入邀请消费返利后台配置`。验证通过前不要进入阶段 4。

## 阶段 3B 再次补齐 Bun 后复验记录

任务名：阶段 3B 再次补齐前端验证环境并复验

status: validation_blocked_existing_lint

### 本轮目标

- 继续停留在阶段 3B，只补齐前端验证环境并验证上一轮后台配置页面实现。
- 若 `typecheck`、`lint`、`build` 全部通过，再提交 `前端：接入邀请消费返利后台配置`。
- 不进入阶段 4，不新增功能，不扩大修改范围。

### 本轮实际修改文件

- `.ai/TASK.md`

### 环境与依赖处理结果

- `node --version` 可用，结果为 `v24.14.1`。
- 全局 `bun --version` 仍不可用。
- 复用临时目录 `$env:TEMP/codex-bun-tool/node_modules/.bin/bun.cmd` 中的 Bun，版本为 `1.3.13`。
- `web/default/bun.lock` 存在。
- `web/default/node_modules` 已存在。
- 已在 `web/default` 执行 `bun install --frozen-lockfile`，结果为 no changes。
- `web/default/package.json`、`web/default/bun.lock`、`package-lock.json`、`yarn.lock`、`pnpm-lock.yaml` 无 diff。
- 未提交 `node_modules`，未修改依赖定义文件。

### 本轮执行验证命令

- `git status --short`
- `git diff --stat`
- `git diff`
- `node --version`
- `bun --version`
- `Test-Path web/default/node_modules`
- `Get-Content web/default/package.json`
- `Get-ChildItem web/default -File | Where-Object { $_.Name -match 'lock|bun|package' }`
- `$env:TEMP/codex-bun-tool/node_modules/.bin/bun.cmd --version`
- `cd web/default && bun install --frozen-lockfile`
- `cd web/default && bun run typecheck`
- `cd web/default && bun run lint`
- `cd web/default && bun run build`
- `git diff -- web/default/package.json web/default/bun.lock web/default/package-lock.json web/default/yarn.lock web/default/pnpm-lock.yaml`
- `git diff --check`
- `node -` locale JSON parse 与新增 key 完整性检查

### 本轮验证结果

- `bun install --frozen-lockfile` 通过，依赖安装检查显示 no changes。
- `bun run typecheck` 通过。
- `bun run build` 通过。
- `git diff --check` 通过。
- `node -` locale JSON parse 与新增 key 完整性检查通过：`en`、`zh`、`fr`、`ja`、`ru`、`vi` 的 `translation` 对象均包含阶段 3B 新增的 8 个 i18n key。
- `bun run lint` 未通过，失败点仍位于既有非阶段 3B 文件：
  - `web/default/src/features/keys/components/api-keys-dialogs.tsx`
  - `web/default/src/features/system-settings/models/group-ratio-visual-editor.tsx`
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx`
  - `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx`
  - `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx`
  - `web/default/src/features/usage-logs/components/task-logs-filter-bar.tsx`
  - `web/default/src/lib/theme-radius.ts`
  - 另有既有 warnings 位于 `channels-table.tsx` 和 `user-charts.tsx`。
- lint 失败不来自阶段 3B 新增的邀请返利设置组件、billing registry、types 或 locale。
- 因本轮要求 `typecheck`、`lint`、`build` 全部通过后才允许提交，且既有 lint 问题不在允许修复范围内，因此未创建实现 commit。

### 本轮自审查结果

通过范围自审但提交条件仍未满足；当前 diff 仅包含阶段 3B 后台配置前端接入、六语言 i18n key 和 `.ai/TASK.md` 记录。没有修改消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务 / Midjourney、model / migration、后端 option 逻辑或依赖定义文件；没有提交 `node_modules`；没有写入 token / secret / sk- key / bearer token。按本轮规则，既有 lint 问题不在允许修复范围内，因此停止且不提交。

### commit hash

- 阶段 3B 实现 commit：未创建。

### 下一阶段建议

阶段 3B 仍需补验证：先由单独任务处理既有 `bun run lint` 失败，或由用户明确调整本阶段提交门槛；随后重新执行 `cd web/default && bun run lint`，必要时再复跑 `bun run typecheck` 和 `bun run build`。验证策略满足后，再 staged diff 自审并提交 `前端：接入邀请消费返利后台配置`。验证通过前不要进入阶段 4。

## 阶段 3B lint 归因与实现提交记录

任务名：阶段 3B：后台配置页面最小接入 lint 归因与提交

status: completed

### 本轮目标

- 只做阶段 3B 前端实现的 lint 失败归因。
- 如果 lint 失败完全来自非本轮修改文件，则记录为既有 lint 债务，并允许提交阶段 3B 实现。
- 不进入阶段 4，不新增功能，不修复无关既有 lint 文件。

### 本轮实际修改文件

- `.ai/TASK.md`
- `web/default/src/features/system-settings/billing/index.tsx`
- `web/default/src/features/system-settings/billing/section-registry.tsx`
- `web/default/src/features/system-settings/general/invitation-rebate-settings-section.tsx`
- `web/default/src/features/system-settings/types.ts`
- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- `web/default/src/i18n/locales/fr.json`
- `web/default/src/i18n/locales/ja.json`
- `web/default/src/i18n/locales/ru.json`
- `web/default/src/i18n/locales/vi.json`

### lint 归因结论

- 使用临时 Bun `1.3.13` 执行 `bun run lint`，仍未通过。
- lint 失败文件清单：
  - `web/default/src/features/keys/components/api-keys-dialogs.tsx`：`react-hooks/set-state-in-effect`
  - `web/default/src/features/system-settings/models/group-ratio-visual-editor.tsx`：`react-hooks/set-state-in-effect`
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx`：`react-hooks/preserve-manual-memoization`
  - `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx`：`react-hooks/set-state-in-effect`
  - `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx`：`react-hooks/set-state-in-effect`
  - `web/default/src/features/usage-logs/components/task-logs-filter-bar.tsx`：`react-hooks/set-state-in-effect`
  - `web/default/src/lib/theme-radius.ts`：`react-hooks/set-state-in-effect`
- lint warnings 文件清单：
  - `web/default/src/features/channels/components/channels-table.tsx`：`react-hooks/exhaustive-deps`
  - `web/default/src/features/dashboard/components/users/user-charts.tsx`：`react-hooks/exhaustive-deps`
- 将 lint 失败路径与 `git diff --name-only` 加 `git ls-files --others --exclude-standard` 的本轮修改文件集合对照，交集为 `NONE`。
- 结论：lint 失败完全来自非本轮修改文件，判断为既有 lint 债务；本轮未修改这些既有 lint 文件，且不在阶段 3B 允许修复范围内。
- 因本轮用户授权在确认 lint 失败完全不涉及本轮修改文件时记录为既有 lint 债务并允许提交，阶段 3B 实现可以提交。

### 本轮验证命令

- `git status --short`
- `git diff --name-only`
- `git diff --stat`
- `git diff`
- `$env:TEMP/codex-bun-tool/node_modules/.bin/bun.cmd --version`
- `Test-Path web/default/node_modules`
- `cd web/default && bun run lint`
- lint 失败文件与本轮修改文件交叉对照脚本
- `cd web/default && bun run typecheck`
- `cd web/default && bun run build`
- `node -` locale JSON parse 与新增 key 完整性检查
- `git diff --check`
- `git diff -- web/default/package.json web/default/bun.lock web/default/package-lock.json web/default/yarn.lock web/default/pnpm-lock.yaml`
- `git add .ai/TASK.md web/default/src/features/system-settings web/default/src/i18n/locales`
- `git diff --cached --stat`
- `git diff --cached`

### 本轮验证结果

- `bun run lint` 未通过，但失败文件与本轮修改文件无交集，按本轮规则记为既有 lint 债务。
- `bun run typecheck` 通过。
- `bun run build` 通过。
- locale JSON parse 与新增 key 完整性检查通过。
- `git diff --check` 通过。
- 依赖定义文件和 lockfile 无 diff。

### 本轮自审查结果

通过；staged diff 只包含阶段 3B 后台配置页面、六语言 locale 和 `.ai/TASK.md` 记录。没有修改消费挂接逻辑、返利 service、后端 option、充值链路、注册 / OAuth、异步任务 / Midjourney、model / migration、依赖文件；没有提交 `node_modules`；没有写入 token / secret / sk- key / bearer token。lint 仍失败，但已经证明失败只来自非本轮修改文件。

### commit hash

- 阶段 3B 实现 commit：提交后由最终响应记录。

### 下一阶段建议

阶段 4 前置：只读确认返利记录查询与后台展示的最小入口，先设计接口、权限、分页、过滤字段和 i18n 文案，不直接扩大到复杂用户详情或财务报表。

## 阶段 4 边界审查记录

任务名：阶段 4：邀请返利流水查询与后台展示边界确认
status: boundary_confirmed

### 本阶段目标

- 只实现邀请消费返利记录的最小只读查询与后台展示。
- 不做返利补发、手动修改、删除、导出或多级邀请。
- 不修改消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务 / Midjourney、model 结构、migration、option / setting 结构或依赖。

### 多 agent 只读审查结论

- Subagent A（后端接口与权限审查，真实 subagent）：建议新增 `controller/invitation_rebate.go`，接口放在管理员查询边界内；路由使用 `middleware.AdminAuth()`，不使用 `RootAuth()`；最小路径建议为 `GET /api/user/invitation_rebate`；只开放管理员查询，不开放普通用户查询。
- Subagent B（查询模型与分页审查，真实 subagent）：建议第一版不 join `users`，只返回 `inviter_user_id` / `invitee_user_id` 等返利记录本表字段；过滤字段使用 `inviter_user_id`、`invitee_user_id`、`source_type`、`source_key`、`status`；分页复用 `common.GetPageQuery(c)` 和 `common.PageInfo`；查询主库 `model.DB`，不依赖 `LOG_DB`；使用 GORM `Where` / `Count` / `Order` / `Limit` / `Offset` / `Find`，保持 SQLite / MySQL / PostgreSQL 兼容。
- Subagent C（前端展示入口审查，主流程模拟）：返利流水适合放在后台系统设置的 Billing 页面，与已有 `Invitation Rebate` 配置相邻；第一版新增同页 section，不新增独立菜单或复杂路由；最小字段为 ID、邀请人 ID、被邀请人 ID、来源类型、来源 key、请求 ID、消费 quota、返利 quota、返利比例 bps、状态、创建时间；最小筛选为邀请人 ID、被邀请人 ID、source_key、status，可额外支持 source_type；可以先做只读表格，不做详情页。
- Subagent D（验证与测试审查，主流程模拟）：后端有 Go 改动时执行 `gofmt` 和对应包最小 `go test`；前端执行 `bun run typecheck`、`bun run build`、`bun run lint`、locale JSON/key 检查和 `git diff --check`；已知 `bun run lint` 可能仍因非本轮既有文件失败，若失败必须做路径归因，本轮文件无交集时记录为既有 lint 债务豁免。

### 进入实现条件确认

- 查询接口权限边界明确：管理员权限，使用 `AdminAuth()`。
- 查询只读，只读取 `invitation_rebate_records`，不修改返利记录。
- 不需要修改消费挂接逻辑。
- 不需要修改返利 service。
- 不需要修改 model 结构或 migration。
- 不需要修改充值、注册、OAuth、异步任务或 Midjourney。
- 分页和返回结构可复用现有 `common.PageInfo` / `common.ApiSuccess` 风格。
- 前端展示入口明确：系统设置 Billing 页面内的只读 section。
- 验证方案明确：后端最小 Go 测试、前端 typecheck/build/lint 及 locale 检查。
- 不需要新增依赖，不执行 `.agents/skills` 命令。

结论：允许进入阶段 4 最小实现。

### 本轮验证命令

- `git status --short`
- `git diff -- .ai/TASK.md`
- `git add .ai/TASK.md`
- `git diff --cached --stat`
- `git diff --cached`

### 本轮自审查结果

通过；staged diff 仅包含 `.ai/TASK.md` 的阶段 4 边界审查记录。没有 Go 业务代码、前端代码、数据库迁移、model 结构、option / setting、依赖文件、消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务 / Midjourney 或密钥变更。

### commit hash

- 阶段 4 边界文档 commit：提交后由最终响应记录。

### 下一步最小任务

阶段 4 后端实现：新增管理员只读查询接口，复用 `common.PageInfo` 分页和 GORM 主库查询，仅支持最小过滤字段，不修改返利 service、消费挂接或 model 结构。

## 阶段 4 后端实现记录

任务名：阶段 4 后端：邀请返利流水管理员只读查询接口
status: completed

### 本子步骤实际修改文件

- `controller/invitation_rebate.go`
- `router/api-router.go`
- `.ai/TASK.md`

### 实现摘要

- 新增管理员只读查询 handler：`GetAllInvitationRebateRecords`。
- 新增管理员路由：`GET /api/user/invitation_rebate`，挂在 `AdminAuth()` 保护的 `adminRoute` 下。
- 查询主库 `model.DB` 中的 `InvitationRebateRecord`，不依赖 `LOG_DB`。
- 支持分页：复用 `common.GetPageQuery(c)`、`common.PageInfo`、`common.ApiSuccess`。
- 支持最小过滤：`inviter_user_id`、`invitee_user_id`、`source_type`、`source_key`、`status`。
- 默认排序：`created_at desc, id desc`。
- 第一版不 join `users`，只返回返利记录表已有 user_id 字段。

### 本子步骤未修改范围

- 未修改消费挂接逻辑。
- 未修改返利 service。
- 未修改充值链路。
- 未修改注册 / OAuth。
- 未修改异步任务 / Midjourney。
- 未修改 model 结构或 migration。
- 未修改 option / setting 结构。
- 未修改依赖文件。

### 本子步骤验证命令

- `gofmt -w controller/invitation_rebate.go router/api-router.go`
- `git status --short`
- `git diff --stat`
- `git diff`
- `go test ./controller/...`
- `go test ./model/...`
- `git diff --cached --stat`
- `git diff --cached`

### 本子步骤自审查结果

通过；后端 staged diff 仅包含 `.ai/TASK.md`、`controller/invitation_rebate.go`、`router/api-router.go`。接口只读查询主库返利记录，使用管理员权限路由；没有修改消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务 / Midjourney、model 结构、migration、option / setting 结构、依赖文件或任何 token / secret / sk- key / bearer token。

### 本子步骤验证结果

- `go test ./controller/...` 通过。
- `go test ./model/...` 通过。

### commit hash

- 阶段 4 后端实现 commit：提交后由最终响应记录。

### 下一步最小任务

阶段 4 前端实现：在系统设置 Billing 页面新增邀请返利流水只读表格，接入该管理员查询接口，补齐六语言 i18n，并执行前端最小验证。

## 阶段 4 前端实现记录

任务名：阶段 4 前端：邀请返利流水后台只读展示
status: completed

### 本子步骤实际修改文件

- `web/default/src/features/system-settings/api.ts`
- `web/default/src/features/system-settings/types.ts`
- `web/default/src/features/system-settings/billing/section-registry.tsx`
- `web/default/src/features/system-settings/general/invitation-rebate-records-section.tsx`
- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- `web/default/src/i18n/locales/fr.json`
- `web/default/src/i18n/locales/ja.json`
- `web/default/src/i18n/locales/ru.json`
- `web/default/src/i18n/locales/vi.json`
- `.ai/TASK.md`

### 实现摘要

- 在系统设置 Billing 页面新增 `Invitation Rebate Records` 子 section，不新增独立菜单。
- 新增前端 API client：`getInvitationRebateRecords`，调用管理员接口 `GET /api/user/invitation_rebate`。
- 新增类型：`InvitationRebateRecord`、`InvitationRebateRecordQuery`、`InvitationRebateRecordsResponse`。
- 新增只读表格，展示 ID、邀请人 ID、被邀请人 ID、source_type、source_key、source_request_id、source_quota、rebate_quota、rebate_ratio_bps、status、created_at。
- 支持最小筛选：邀请人 ID、被邀请人 ID、source_key、status。
- 支持固定分页，每页 10 条，提供上一页 / 下一页和刷新按钮。
- 补齐 en / zh / fr / ja / ru / vi 六语言新增文案。

### 本子步骤未修改范围

- 未修改消费挂接逻辑。
- 未修改返利 service。
- 未修改后端 option。
- 未修改充值链路。
- 未修改注册 / OAuth。
- 未修改异步任务 / Midjourney。
- 未修改 model 结构或 migration。
- 未修改依赖文件。
- 未执行 `.agents/skills` 命令。

### 本子步骤验证命令

- `cd web/default && bun run typecheck`
- `cd web/default && bun run build`
- `cd web/default && bun run lint`
- `node -` locale JSON parse 与新增 key 完整性检查
- `git diff --check`
- `git status --short`
- `git diff --stat`
- `git diff`
- `git diff --cached --stat`
- `git diff --cached`

### 本子步骤自审查结果

通过；前端 staged diff 仅包含系统设置 Billing 页的邀请返利流水只读展示、API client 类型、六语言 locale 和 `.ai/TASK.md` 记录。没有修改消费挂接逻辑、返利 service、后端 option、充值链路、注册 / OAuth、异步任务 / Midjourney、model / migration、依赖文件或任何 token / secret / sk- key / bearer token；没有提交 `node_modules`；没有修改 new-api / QuantumNous 相关标识。

### 本子步骤验证结果

- `bun run typecheck` 通过。
- `bun run build` 通过。
- locale JSON parse 与新增 key 完整性检查通过，en / zh / fr / ja / ru / vi 均包含本阶段新增 10 个 key，且新增翻译未出现字面问号损坏。
- `git diff --check` 通过。
- 依赖定义文件和 lockfile 无 diff。
- `bun run lint` 未通过，但失败文件均为既有非本轮文件，且与本轮变更文件无交集：
  - `web/default/src/features/keys/components/api-keys-dialogs.tsx`
  - `web/default/src/features/system-settings/models/group-ratio-visual-editor.tsx`
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx`
  - `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx`
  - `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx`
  - `web/default/src/features/usage-logs/components/task-logs-filter-bar.tsx`
  - `web/default/src/lib/theme-radius.ts`
  - warnings: `web/default/src/features/channels/components/channels-table.tsx`、`web/default/src/features/dashboard/components/users/user-charts.tsx`
- lint 失败按既有 lint 债务豁免，不修改无关既有文件。

### commit hash

- 阶段 4 前端实现 commit：提交后由最终响应记录。

### 下一步最小任务

阶段 5：做邀请消费返利功能的整体回归清单与文档收口，优先复跑后端定向测试和前端构建，不新增返利补发、删除、导出或多级邀请。

## 阶段 5 最终回归与文档收口记录

任务名：阶段 5：邀请消费返利功能最终回归、风险复核与文档收口
status: completed

### 本轮执行模式

- 真实 subagents 启动失败，原因是当前会话达到 agent thread limit。
- 按用户授权降级为主流程模拟 4 个只读 subagent 审查小节。
- 本轮未执行 `.agents/skills` 命令。
- 本轮未连接真实 New API 实例。
- 本轮未输出 token / secret / sk- key / bearer token。

### Subagent A 模拟结论：后端返利链路回归审查

- 配置默认值 `InvitationRebateEnabled=false`、`InvitationRebateRatioBps=0`、`InvitationRebateMinQuota=0`，默认不会改变现有行为。
- `InvitationRebateRatioBps` 在配置读取和 service 内均限制在 `0..10000`。
- `InvitationRebateMinQuota` 负数会归零。
- `SourceType` 或 `SourceKey` 为空时返回 `skipped_invalid_source`，不会生成伪 key。
- 幂等依赖 `invitation_rebate_records` 的 `(source_type, source_key)` 唯一约束，service 使用 GORM `OnConflict DoNothing` 避免重复加款。
- 正常返利在同一事务内创建返利记录并更新邀请人 `aff_quota` / `aff_history` 列；`model.User.AffHistoryQuota` 的真实 GORM 列名是 `aff_history`。
- 同步消费挂接只在 `SettleBilling` 成功后调用，使用实际结算 quota。
- 返利失败只记录日志，不影响主消费成功路径。
- 代码搜索未发现误接异步任务、Midjourney、充值、注册或 OAuth 链路。
- 未发现明显重复返利风险、越权风险或越界风险。

### Subagent B 模拟结论：后台配置与流水接口审查

- 三个配置项复用现有 option 读写协议，没有新增单独保存协议。
- 返利流水接口为 `GET /api/user/invitation_rebate`，仅查询 `InvitationRebateRecord`，不修改返利记录。
- 路由挂在 `adminRoute` 下并使用 `middleware.AdminAuth()`。
- 查询分页复用 `common.GetPageQuery` / `common.PageInfo` / `common.ApiSuccess` 风格。
- 最小过滤字段为 `inviter_user_id`、`invitee_user_id`、`source_type`、`source_key`、`status`。
- 第一版不 join 用户表，仅返回记录中的 user_id，避免扩大查询风险。
- 未发现普通用户越权查看风险，未发现返利记录修改接口。
- 不需要本轮 bugfix。

### Subagent C 模拟结论：前端与 i18n 回归审查

- 后台配置项已说明返利基于被邀请用户实际消费，不是充值。
- bps 文案已说明 `10000 bps = 100%`、`1000 bps = 10%`。
- 返利流水展示为只读表格，仅包含筛选、分页和刷新，不包含补发、删除、导出或修改。
- en / zh / fr / ja / ru / vi 的 `translation` key 一致。
- `bun run typecheck` 和 `bun run build` 通过，未发现本功能文件的明显类型错误、缺失 import 或命名不一致。
- 本轮不需要执行 i18n sync；新增 key 已手动补齐六语言，且未执行 `.agents/skills`。
- 不需要本轮 bugfix。

### Subagent D 模拟结论：测试与发布风险审查

- 必须复跑后端：`go test ./model/...`、`go test ./controller/...`、`go test ./service -run 'TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume' -count=1`。
- 建议额外复现 `go test ./service/...` 已知失败，确认仍为既有 channel affinity usage cache 测试失败。
- 必须复跑前端：`bun run typecheck`、`bun run build`、`bun run lint`。
- `bun run lint` 若失败，需要归因失败文件；本轮确认失败文件均为既有非邀请返利文件。
- 不需要新增测试；邀请返利 service、同步挂接 helper、管理员查询接口和前端构建已由现有定向测试 / typecheck / build 覆盖。
- 发布风险主要在真实运行配置、历史数据库 AutoMigrate、新表唯一索引创建、管理员启用比例配置和 request id 透传，需要上线前人工检查。

### 最终功能范围

- 后端配置读取：`InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota`。
- 主库返利记录表：`invitation_rebate_records`。
- 幂等唯一约束：`source_type + source_key`。
- 返利 service：`TryGrantInvitationRebate(ctx, input)`。
- 同步消费成功后置点挂接：`PostTextConsumeQuota`、`PostAudioConsumeQuota`、`PostWssConsumeQuota`。
- `source_key` 来源：`relayInfo.RequestId`，为空时跳过。
- 返利失败隔离：只记录日志，不影响主消费。
- 后台配置页面：管理员可编辑三个邀请返利配置项。
- 管理员只读流水接口：`GET /api/user/invitation_rebate`。
- Billing 页面只读流水展示：筛选、分页、刷新。

### 已完成文件清单

- `common/constants.go`
- `model/option.go`
- `model/main.go`
- `model/invitation_rebate_record.go`
- `service/invitation_rebate.go`
- `service/invitation_rebate_test.go`
- `service/text_quota.go`
- `service/quota.go`
- `controller/invitation_rebate.go`
- `router/api-router.go`
- `web/default/src/features/system-settings/api.ts`
- `web/default/src/features/system-settings/types.ts`
- `web/default/src/features/system-settings/billing/index.tsx`
- `web/default/src/features/system-settings/billing/section-registry.tsx`
- `web/default/src/features/system-settings/general/invitation-rebate-settings-section.tsx`
- `web/default/src/features/system-settings/general/invitation-rebate-records-section.tsx`
- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- `web/default/src/i18n/locales/fr.json`
- `web/default/src/i18n/locales/ja.json`
- `web/default/src/i18n/locales/ru.json`
- `web/default/src/i18n/locales/vi.json`
- `.ai/TASK.md`

### 已完成 commit 清单

- `8e65745a8f4befd21c80d620a81ab265c344b9f0`：文档：固化邀请返利工作流与自动审查提交规则
- `4a1a5958611ceb859a7a43c6cc7d6412ff775dc1`：后端：新增邀请消费返利配置与记录结构
- `5498ea278f759248c3961d430276eb9959a8bb71`：文档：明确邀请返利服务事务与幂等设计
- `5d5cff79b16fae2306d616e1aedf2afdab9ecd0e`：文档：记录邀请返利服务多代理审查结论
- `2a1ecf5f9c3ea749a76a2b3961f40ac6578293c7`：后端：实现邀请返利服务与单元测试
- `fdb4fc20e36dfcf6f36395bb26c9b503410ea3dc`：文档：记录阶段2A实现提交哈希
- `deb6edff6e9254cb9e66fd96a5f4721715addf24`：文档：确认邀请返利同步消费挂接边界
- `46462d1459417b9ae51c50e1d155521ec33f78ed`：后端：挂接同步消费邀请返利触发
- `f6af9f2a67f3577535203369aa8e3de0eb042971`：文档：记录阶段3A实现提交哈希
- `ac64f4ed774581cb0b3e6c93478d14aaaadab423`：文档：确认邀请返利后台配置接入边界
- `cbc9c8706be42c5c83e01aedbc8507850d7b5350`：前端：接入邀请消费返利后台配置
- `37a777343708c6898a3600e6880718a74df8b9c9`：文档：确认邀请返利流水查询展示边界
- `6d03307feead91e13f0e2f12b4228cbc426dae32`：后端：新增邀请返利流水查询接口
- `3cbaf5fab60fc6e1a5cb35cf7694a50609ff55b0`：前端：新增邀请返利流水后台展示
- 本轮收口 commit：提交后由最终响应记录，避免在同一 commit 中自引用造成 hash 变化。

### 最终验证命令与结果

- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `go test ./service -run 'TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume' -count=1`：通过。
- `go test ./service/...`：未通过，失败仍为既有 `TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`，与邀请返利无直接关系。
- `cd web/default && bun run typecheck`：通过。
- `cd web/default && bun run build`：通过。
- `cd web/default && bun run lint`：未通过，失败文件均为既有非邀请返利文件。
- `node -` locale JSON parse 与 `translation` key 一致性检查：通过，en / zh / fr / ja / ru / vi 均与英文基准一致。
- `git diff --check`：通过。
- `git status --short`：文档更新前为空；文档更新后仅 `.ai/TASK.md`。
- `git diff --stat` / `git diff`：用于确认本轮只更新 `.ai/TASK.md` 收口文档。

### 已知既有失败与豁免依据

- `go test ./service/...` 失败文件：`service/channel_affinity_usage_cache_test.go`，失败用例为 `TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`；该测试属于 channel affinity usage cache，不在邀请返利改动范围内。邀请返利 service 与挂接 helper 的定向测试已通过。
- `bun run lint` 失败文件：
  - `web/default/src/features/keys/components/api-keys-dialogs.tsx`
  - `web/default/src/features/system-settings/models/group-ratio-visual-editor.tsx`
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx`
  - `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx`
  - `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx`
  - `web/default/src/features/usage-logs/components/task-logs-filter-bar.tsx`
  - `web/default/src/lib/theme-radius.ts`
- `bun run lint` warnings：
  - `web/default/src/features/channels/components/channels-table.tsx`
  - `web/default/src/features/dashboard/components/users/user-charts.tsx`
- 上述 lint 失败 / warnings 与本轮收口文档、邀请返利 service、同步挂接、后台配置和流水展示文件无交集，按既有 lint 债务豁免，不在本阶段修复。

### 上线前人工检查清单

- 确认生产环境执行正常启动迁移，`invitation_rebate_records` 表和 `(source_type, source_key)` 唯一索引创建成功。
- 确认后台配置默认关闭，启用前先设置合理的 `InvitationRebateRatioBps` 和 `InvitationRebateMinQuota`。
- 使用一笔低风险同步文本 / 音频 / WSS 消费在测试环境验证返利流水只生成一次。
- 确认 `relayInfo.RequestId` 在实际同步消费请求中非空。
- 确认邀请人 `aff_quota` 和 `aff_history` 增量与返利记录一致。
- 确认返利失败日志可观察，且不会改变主消费响应。
- 确认管理员账号可以查看流水，普通用户不能访问管理员流水接口。
- 确认后台 Billing 页面配置保存和流水分页筛选符合预期。

### 明确未实现范围

- 多级邀请。
- 异步任务返利。
- Midjourney 返利。
- 手动补发返利。
- 手动修改返利记录。
- 删除返利流水。
- 导出返利流水。
- 普通用户返利记录页。
- 充值返利。
- 注册奖励逻辑改造。

### 最终风险结论

阶段 5 未发现邀请消费返利功能范围内必须修复的 bug。本轮仅做 `.ai/TASK.md` 文档收口；未新增功能，未修改业务逻辑，未修改依赖，未提交 `node_modules`，未写入任何 token / secret / sk- key / bearer token。当前功能范围满足第一版最小可交付目标：后台可配置、同步消费成功后触发、幂等防重复、失败隔离、管理员可只读查看流水。

### 后续可选优化项

- 修复既有 `channel_affinity_usage_cache_test.go` 测试失败后恢复 `go test ./service/...` 全包绿灯。
- 处理既有前端 lint 债务后取消 lint 豁免。
- 为管理员流水接口补充 handler 级权限测试。
- 为后台流水表格增加更细的日期范围筛选。
- 在测试环境增加真实同步请求的端到端验收脚本。
- 若未来有主库 usage ledger，可将 `source_key` 从 request id 演进到主库结算流水 id。

## 阶段 3B 体验调整记录

任务名：迁移邀请返利配置到“运营设置 → 额度设置”并改为百分比输入

status: completed

### 本轮目标

- 只移动邀请返利配置项：`InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota`。
- 后台输入不再展示 bps，改为直接输入百分比；输入 `10` 表示 `10%`。
- 后端仍沿用 `InvitationRebateRatioBps` 配置 key，前端负责读写换算，保持旧数据和返利 service 兼容。
- 不移动邀请返利流水入口，不修改消费挂接、返利 service、数据库结构、后端 option API 或依赖。

### 实现摘要

- 将额度设置 section 从 Billing 分组迁移到 Operations 分组，目标路径为 `/system-settings/operations/quota`。
- 在额度设置中加入“邀请返利”配置块，包含启用开关、返利百分比、最小触发消费额度。
- 读取时将 `InvitationRebateRatioBps / 100` 显示为百分比。
- 保存时将百分比 `* 100` 并四舍五入写回 `InvitationRebateRatioBps`。
- 百分比输入限制为 `0..100`，最多两位小数；例如 `10` 保存为 `1000 bps`，`12.5` 保存为 `1250 bps`。
- 移除独立 `Invitation Rebate` 配置 section，保留 Billing 下的 `Invitation Rebate Records` 只读流水入口。
- 旧路径 `/system-settings/billing/invitation-rebate` 和 `/system-settings/billing/quota` 重定向到 `/system-settings/operations/quota`。
- 流水表格中的返利比例列改为显示百分比，避免后台继续暴露 bps 概念。
- 补齐 en / zh / fr / ja / ru / vi locale 新增文案，并将中文侧栏 `Operations` 调整为“运营设置”。

### 本轮实际修改文件

- `web/default/src/features/system-settings/billing/index.tsx`
- `web/default/src/features/system-settings/billing/section-registry.tsx`
- `web/default/src/features/system-settings/general/quota-settings-section.tsx`
- `web/default/src/features/system-settings/general/invitation-rebate-records-section.tsx`
- `web/default/src/features/system-settings/general/invitation-rebate-settings-section.tsx`（删除）
- `web/default/src/features/system-settings/operations/index.tsx`
- `web/default/src/features/system-settings/operations/section-registry.tsx`
- `web/default/src/features/system-settings/types.ts`
- `web/default/src/routes/_authenticated/system-settings/billing/$section.tsx`
- `web/default/src/i18n/locales/en.json`
- `web/default/src/i18n/locales/zh.json`
- `web/default/src/i18n/locales/fr.json`
- `web/default/src/i18n/locales/ja.json`
- `web/default/src/i18n/locales/ru.json`
- `web/default/src/i18n/locales/vi.json`
- `.ai/TASK.md`

### 本轮未修改范围

- 未修改消费挂接逻辑。
- 未修改返利 service。
- 未修改后端 option 逻辑。
- 未修改充值链路。
- 未修改注册 / OAuth。
- 未修改异步任务 / Midjourney。
- 未修改 model / migration。
- 未修改依赖文件。
- 未执行 `.agents/skills` 命令。

### 验证命令与结果

- `bun --version`：当前 shell 未直接识别全局 `bun`，使用上一轮已安装的临时 Bun 路径 `%TEMP%/codex-bun-tool/node_modules/.bin`，版本 `1.3.13`。
- `Test-Path web/default/node_modules`：通过，结果为 `True`。
- `cd web/default && bun run typecheck`：通过。
- `cd web/default && bun run build`：通过。
- `cd web/default && bun run lint`：未通过，失败文件均为既有非本轮文件，和本轮修改文件无交集，按既有 lint 债务豁免：
  - `web/default/src/features/keys/components/api-keys-dialogs.tsx`
  - `web/default/src/features/system-settings/models/group-ratio-visual-editor.tsx`
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx`
  - `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx`
  - `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx`
  - `web/default/src/features/usage-logs/components/task-logs-filter-bar.tsx`
  - `web/default/src/lib/theme-radius.ts`
  - warnings：`web/default/src/features/channels/components/channels-table.tsx`、`web/default/src/features/dashboard/components/users/user-charts.tsx`
- `node -` locale JSON parse、六语言 key 一致性与新增 key 完整性检查：通过。
- `git diff --check`：通过。
- `git status --short`：确认仅存在本轮允许范围内前端、locale 与 `.ai/TASK.md` 变更。
- `git diff --stat` / `git diff`：已执行，用于确认迁移 diff 和未改后端逻辑。

### 自审查结果

- 通过：本轮 diff 只包含阶段 3B 体验调整相关前端文件、locale 和 `.ai/TASK.md`。
- 通过：没有修改后端、消费挂接、返利 service、充值、注册 / OAuth、异步任务、Midjourney、model / migration 或依赖文件。
- 通过：没有提交 `node_modules`，也没有 lockfile / package 依赖定义变更。
- 通过：百分比输入仅在前端转换为 `InvitationRebateRatioBps`，兼容旧配置值，不改变后端返利计算逻辑。
- 通过：旧路径重定向到 `/system-settings/operations/quota`，不移动 Billing 下只读流水入口。
- 通过：没有 token / secret / sk- key / bearer token。

### commit hash

- 本轮提交：提交后由最终响应记录，避免在同一 commit 中自引用造成 hash 变化。

### 下一步最小任务建议

- 本轮完成后进行本地后台页面人工验收：打开 `/system-settings/operations/quota`，确认能看到返利百分比；输入 `10` 保存后刷新仍显示 `10`；旧路径 `/system-settings/billing/invitation-rebate` 自动跳转到新路径。

## 旧版前端同步记录

任务名：旧版前端同步邀请返利配置与流水入口

status: completed

### 最新提交复核

- 已检查最新提交 `da03f27edc661a373ac75cd68c97ea028f1c0f6a`：该提交只迁移新版前端 `web/default` 的邀请返利配置位置并更新 `.ai/TASK.md`，属于新版前端有效实现，不是 bug 或无用代码。
- 本轮不回退 `da03f27e`，避免移除新版前端已完成的邀请返利配置和流水展示。

### 本轮目标

- 在旧版前端 `web/classic` 的“系统设置 → 运营设置 → 额度设置”中同步邀请消费返利配置。
- 旧版前端使用百分比输入；读取 `InvitationRebateRatioBps / 100`，保存时将百分比乘以 100 写回 `InvitationRebateRatioBps`。
- 在旧版额度设置附近新增管理员只读邀请返利流水入口。
- 不修改后端消费挂接、返利 service、model / migration、充值、注册 / OAuth、异步任务、Midjourney 或依赖。

### 当前实现摘要

- `web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx`：新增邀请消费返利配置块和“查看邀请返利流水”入口。
- `web/classic/src/components/settings/OperationSetting.jsx`：补齐旧版前端 option 默认值 `InvitationRebateEnabled`、`InvitationRebateRatioBps`、`InvitationRebateMinQuota`。
- `web/classic/src/pages/Setting/Operation/InvitationRebateRecordsModal.jsx`：新增管理员只读流水 Modal，调用已有 `GET /api/user/invitation_rebate`。
- `web/classic/src/i18n/locales/{en,zh,zh-CN,zh-TW,fr,ja,ru,vi}.json`：手动补齐旧版前端新增文案。

### 日志权限结论

- 当前返利流水接口为管理员接口，后端路由位于 `AdminAuth` 保护范围内。
- 第一版只有管理员返利流水；没有普通用户返利日志页，也没有普通用户可访问的返利流水 API。

### 验证命令与结果

- `git status --short`：确认本轮仅存在旧版前端、旧版 locale 与 `.ai/TASK.md` 变更；未出现依赖文件、`node_modules` 或 `dist` 待提交变更。
- `git diff --stat` / `git diff`：已检查本轮改动范围。
- `cd web/classic && bun run build`：使用临时 Bun `1.3.13` 执行，通过；仅有既有 Browserslist、lottie eval 与 chunk size warning。
- `cd web/classic && bun run lint`：未通过；失败为旧版前端既有 Prettier 债务和 `dist` 检查项。本轮新增/修改文件在定向 Prettier 修复后已不在失败清单中。
- `cd web/classic && bunx prettier <本轮 JS/JSX/locale 文件> --check`：通过，本轮文件均符合 Prettier。
- locale JSON parse 与本轮 touched 组件 `t()` key 完整性检查：通过，en / zh / zh-CN / zh-TW / fr / ja / ru / vi 均包含新增 key。
- `git diff --check`：通过。

### 自审查结果

- 通过：未回退 `da03f27e`，新版前端邀请返利配置和流水继续保留。
- 通过：旧版前端已在“系统设置 → 运营设置 → 额度设置”中新增邀请消费返利配置，百分比输入会兼容写回 `InvitationRebateRatioBps`。
- 通过：旧版前端已新增管理员只读邀请返利流水入口，不提供补发、删除、修改或导出。
- 通过：未修改后端消费挂接、返利 service、后端 option、model / migration、充值、注册 / OAuth、异步任务、Midjourney 或依赖。
- 通过：未执行 `.agents/skills` 命令，未连接真实 New API 实例，未输出 token / secret / sk- key / bearer token。

### commit hash

- 本轮提交：提交后由最终响应记录，避免在同一 commit 中自引用造成 hash 变化。

### 下一步最小任务建议

- 同时在新版和旧版前端做人工验收：旧版打开 `/console/setting?tab=operation`，在“额度设置”中确认邀请返利配置和“查看邀请返利流水”入口；新版继续确认 `/system-settings/operations/quota` 与 Billing 下返利流水入口可用。

## 邀请返利生产问题修复记录

任务名：修复邀请返利结算边界与配置持久化一致性

status: completed

### 问题背景

- 资金相关审计发现边界风险：`BillingSession.Settle` 中资金来源结算成功后，如果后续 token 额度调整失败，函数仍返回 error。
- 邀请返利同步挂接只在 `SettleBilling` 返回 nil 后触发，因此可能出现“实际消费已成立，但返利被 token 后置统计失败阻断”的漏返利。
- 配置持久化一致性风险：`InvitationRebateRatioBps` 和 `InvitationRebateMinQuota` 原先会先把原始值写入 `options` 表，再在内存中做 clamp，可能留下脏配置值。

### 本轮实际修改文件

- `service/billing_session.go`
- `service/billing_session_test.go`
- `model/option.go`
- `model/option_test.go`
- `.ai/TASK.md`

### 修复摘要

- `funding.Settle(delta)` 失败时仍返回 error，不触发邀请返利。
- `funding.Settle(delta)` 成功后，如果 token 额度调整失败，只记录系统日志，`BillingSession.Settle` 返回 nil。
- 资金侧已结算成功时，后续邀请返利等成功后置逻辑不再被 token 统计失败阻断。
- `InvitationRebateRatioBps` 写入 DB 前规范化到 `0..10000`。
- `InvitationRebateMinQuota` 写入 DB 前负数归零。
- 后端返利 service、消费挂接点、前端页面、model 结构、migration 均未修改。

### 数据修复原则

- 本轮不连接真实 New API 实例，不直接修改生产数据。
- 生产补发必须先在备份库或本地库 dry-run，确认问题窗口内“实际已扣费但缺少 `invitation_rebate_records`”的消费。
- 补发必须复用 `TryGrantInvitationRebate` 的幂等语义，使用原始 `request_id` 作为 `SourceKey` / `SourceRequestID`，不得直接 SQL 增加 `aff_quota`。
- 已存在同一 `source_type + source_key` 的记录必须跳过，避免重复返利。

### 验证命令与结果

- `gofmt -w service/billing_session.go service/billing_session_test.go model/option.go model/option_test.go`：通过。
- `go test ./service -run "TestBillingSessionSettle|TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume" -count=1`：通过。
- `go test ./model -run TestUpdateInvitationRebateOptionsPersistNormalizedValues -count=1`：通过。
- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `git diff --check`：通过。
- `go test ./service/...`：未通过，失败仍在既有 `service/channel_affinity_usage_cache_test.go`，与本轮邀请返利结算修复无直接调用关系；本轮定向 service 测试已通过。

### 自审查结果

- 未修改前端。
- 未修改返利 service。
- 未修改消费挂接点。
- 未修改充值、注册 / OAuth、异步任务、Midjourney。
- 未修改 model 结构、migration、依赖文件。
- 未提交 `node_modules` 或构建产物。
- 未输出或写入 token / secret / sk- key / bearer token。

### 下一步建议

- 在生产备份库按问题窗口生成漏返利 dry-run 清单，再决定是否执行一次性补发。
- 补发后抽查 `invitation_rebate_records`、邀请人 `aff_quota` / `aff_history` 与消费记录的一致性。

## 资金链路上线前全盘加固修复记录

任务名称：资金链路上线前全盘加固修复
status: completed

### 本轮目标

- 修复易支付充值回调本地入账非原子、且过早返回 `success` 的资金风险。
- 修复 `model.UpdateOption` 忽略数据库写入错误导致关闭返利止血不可靠的问题。
- 对 Stripe / Creem / Waffo / Waffo Pancake / 易支付支付日志做最小脱敏，不再记录原始 webhook body、签名、完整回调参数或完整支付响应。
- 补齐高权重定向测试：易支付幂等入账、入账失败回滚、支付网关不匹配、option 写失败不更新内存、邀请返利流水普通用户不可访问。

### 当前已修改文件

- `model/option.go`
- `model/option_test.go`
- `model/topup.go`
- `model/payment_method_guard_test.go`
- `controller/topup.go`
- `controller/topup_stripe.go`
- `controller/topup_creem.go`
- `controller/topup_waffo.go`
- `controller/topup_waffo_pancake.go`
- `controller/invitation_rebate_auth_test.go`
- `.ai/TASK.md`

### 当前实现摘要

- `UpdateOption` 现在用事务执行 `FirstOrCreate` 和 `Save`；DB 写失败时直接返回 error，不调用 `updateOptionMap`。
- 新增 `model.RechargeEpay`，在单个事务中锁定 `topups.trade_no`、校验 `PaymentProviderEpay`、校验 pending / success、更新订单成功状态并增加用户额度。
- 易支付已 success 的订单按幂等成功返回，不重复增加用户额度。
- 如果用户额度更新失败或用户不存在，事务回滚，订单不会被永久标记为 success。
- 易支付事务成功后按原有语义补充用户 quota 缓存增量；缓存失败只记系统日志，不回滚已成功入账。
- `EpayNotify` 验签成功后不再立即返回 `success`；只有本地事务成功或已幂等成功后才返回 `success`，本地失败返回 `fail` 让网关可重试。
- 支付日志改为记录事件类型、订单号、状态、金额、用户 ID、客户端 IP、payload 字节数和错误摘要，不记录原始 body、签名、完整参数或完整响应。

### 当前未修改范围

- 未修改邀请返利计算语义。
- 未修改同步消费挂接范围。
- 未修改 model 结构 / migration。
- 未修改前端页面。
- 未修改依赖文件。
- 未执行 `.agents/skills`。
- 未连接真实 New API 实例。

### 验证命令与结果

- `gofmt -w model/option.go model/option_test.go model/topup.go model/payment_method_guard_test.go controller/topup.go controller/topup_stripe.go controller/topup_creem.go controller/topup_waffo.go controller/topup_waffo_pancake.go controller/invitation_rebate_auth_test.go`：通过。
- `go test ./model -run "TestUpdateInvitationRebateOptions|TestUpdateOption|TestRechargeEpay" -count=1`：通过。
- `go test ./controller -run "TestEpay|TestInvitationRebate" -count=1`：通过。
- `go test ./service -run "TestBillingSessionSettle|TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume" -count=1`：通过。
- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `go test ./service/...`：未通过，失败仍在既有 `service/channel_affinity_usage_cache_test.go`，当前复现失败用例为 `TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode`，与本轮易支付、option、支付日志脱敏和邀请返利功能无直接交集。
- `git diff --check`：通过。

### 自审查结果

- 已确认未修改前端页面。
- 已确认未修改邀请返利计算语义。
- 已确认未扩大同步消费挂接范围。
- 已确认未修改 model 结构 / migration。
- 已确认未修改依赖文件，未提交 `node_modules` 或构建产物。
- 已确认易支付本地入账成功前不会向网关返回 `success`；本地失败返回 `fail`，允许网关重试。
- 已确认易支付重复 success 回调只幂等返回，不重复增加用户额度。
- 已确认 `UpdateOption` 在 DB 写失败时不更新内存 `OptionMap`。
- 已确认支付日志不再记录原始 webhook body、签名、完整回调参数、完整支付响应或支付链接。
- 已确认未输出或写入 token / secret / sk- key / bearer token。

### 下一步建议

- 生产上先保持邀请返利关闭，完成备份和问题窗口核账。
- 在备份库或本地库执行 dry-run，只筛出已实际扣费但缺少 `invitation_rebate_records` 的请求。
- 如需补发，必须复用 `TryGrantInvitationRebate` 幂等语义，使用原始 request id 作为 `SourceKey` / `SourceRequestID`，不要直接 SQL 修改 `aff_quota`。
- 单独排期修复既有 `service/channel_affinity_usage_cache_test.go`，恢复 `go test ./service/...` 全包绿灯。
## 累计邀请返利资金安全加固记录

任务名称：将邀请消费返利改为累计消费达标返利
status: completed

### 本轮目标

- 将邀请返利从单笔消费达标返利改为累计消费达标返利。
- 所有累计入账、满额结算、返利流水创建、邀请人 `aff_quota` / `aff_history` 更新均在主库事务中完成。
- 继续复用现有后台配置项：
  - `InvitationRebateEnabled`
  - `InvitationRebateRatioBps`
  - `InvitationRebateMinQuota`
- 不修改充值、注册 / OAuth、异步任务、Midjourney、多级邀请、补发、删除、导出逻辑。

### 实现摘要

- 新增主库累计消费明细模型 `InvitationRebateConsumption`，对 `source_type + source_key` 建唯一索引，确保同一次同步消费不会重复累计。
- 新增主库累计状态模型 `InvitationRebateAccumulation`，按邀请人 / 被邀请人关系维护未结算累计额度、历史累计额度、历史已结算额度、历史返利额度和返利分子余数。
- `TryGrantInvitationRebate` 保持入口不变，内部改为：
  - 配置关闭、比例为 0、空 source、无邀请人、邀请人不存在、消费额度小于等于 0 时跳过。
  - 有效消费先写入累计明细。
  - 按后台当前 `InvitationRebateMinQuota` 动态计算是否达到累计门槛。
  - 未满门槛返回 `accumulated`，不发放返利。
  - 达到门槛后只结算满额部分，剩余未满部分继续保留。
  - 每笔消费记录消费发生时的 `rebate_ratio_bps`，后续管理员改比例不追溯旧消费。
  - 小额返利的分子余数保留到累计状态中，避免长期向下取整损失。
  - 已发放返利继续写入 `invitation_rebate_records` 作为管理员流水。
- 后台新版和旧版额度设置文案已改为累计门槛语义，强调基于累计实际消费而不是充值。
- 自审时发现部分 locale 新增文案存在终端编码导致的 `????` 乱码，并且新版 locale 中受保护的 footer key 被 JSON 重写为普通拼写；已仅限 locale 文件修复为正确翻译与原有 `footer.new\u0061pi.projectAttributionSuffix` key，未改业务逻辑。

### 修改文件

- `model/invitation_rebate_record.go`
- `model/main.go`
- `service/invitation_rebate.go`
- `service/invitation_rebate_test.go`
- `web/default/src/features/system-settings/general/quota-settings-section.tsx`
- `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json`
- `web/classic/src/pages/Setting/Operation/SettingsCreditLimit.jsx`
- `web/classic/src/i18n/locales/{en,zh,zh-CN,zh-TW,fr,ja,ru,vi}.json`
- `.ai/TASK.md`

### 验证命令与结果

- `gofmt -w model/invitation_rebate_record.go model/main.go service/invitation_rebate.go service/invitation_rebate_test.go`：通过。
- `go test ./service -run "TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume" -count=1`：通过。
- `go test ./service/...`：未通过，失败仍在既有 `service/channel_affinity_usage_cache_test.go`；本轮最新复现用例为 `TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode`，上一轮曾复现 `TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`，均与本轮累计返利模型、事务和前端文案无直接交集。
- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `cd web/default && bun run typecheck`：通过，使用临时 Bun 1.3.13。
- `cd web/default && bun run build`：通过。
- `cd web/classic && bun run build`：通过，仅有既有 Browserslist、lottie eval 和 chunk size warning。
- `cd web/default && bun run lint`：未通过，失败文件均为既有非本轮修改文件。
- `cd web/classic && bun run lint`：未通过，失败为旧版前端既有 Prettier / dist 检查债务，本轮修改文件未出现在失败清单中。
- locale JSON parse 与本轮新增 key 完整性检查：通过。
- `git diff --check`：通过。

### 已知既有失败与豁免依据

- 新版前端 lint 仍失败在既有文件：
  - `web/default/src/features/keys/components/api-keys-dialogs.tsx`
  - `web/default/src/features/system-settings/models/group-ratio-visual-editor.tsx`
  - `web/default/src/features/system-settings/models/ratio-settings-card.tsx`
  - `web/default/src/features/system-settings/models/tiered-pricing-editor.tsx`
  - `web/default/src/features/usage-logs/components/common-logs-filter-bar.tsx`
  - `web/default/src/features/usage-logs/components/task-logs-filter-bar.tsx`
  - `web/default/src/lib/theme-radius.ts`
- 旧版前端 lint 仍失败在既有大范围 Prettier / dist 检查债务，本轮修改的 `SettingsCreditLimit.jsx` 与新增 locale key 不在失败清单中。
- 上述 lint 失败均不涉及本轮累计返利后端事务、累计账本、消费挂接、充值、注册 / OAuth、异步任务或 Midjourney。

### 自审查结果

- 未修改充值链路。
- 未修改注册 / OAuth。
- 未修改异步任务 / Midjourney。
- 未扩大同步消费挂接范围。
- 未新增补发、删除、导出、多级邀请或普通用户返利日志。
- 未修改依赖文件，未提交 `node_modules` 或构建产物。
- 未输出或写入 token / secret / sk- key / bearer token。
- 新增累计模型通过 AutoMigrate 注册，兼容项目现有 SQLite / MySQL / PostgreSQL 的 GORM 写法。
- 重复 `source_type + source_key` 只会幂等返回，不重复累计或重复返利。
- 返利流水创建、累计状态更新、邀请人返利额度更新在同一事务中完成；任一失败会回滚。

### 下一步建议

- 上线前保持 `InvitationRebateEnabled=false`，先在本地或备份库确认新表和唯一索引创建成功。
- 用低风险测试账号验证低额累计、满额返利、重复请求幂等和后台流水展示。
- 生产如发现异常，第一步关闭 `InvitationRebateEnabled`，保留 `users`、`options`、`invitation_rebate_consumptions`、`invitation_rebate_accumulations`、`invitation_rebate_records` 和消费日志用于核账。
## 累计邀请返利审计可解释性优化记录

任务名称：新增累计返利结算明细与后台只读详情
status: completed

### 本轮目标

- 保留现有累计返利核心算法、消费挂接、充值、注册 / OAuth、异步任务与 Midjourney 范围不变。
- 新增结算明细审计层，解决管理员流水只看到触发 request id、无法复盘本次累计返利覆盖哪些消费明细的问题。
- 管理员流水列表继续保留，新增只读详情入口；不新增补发、删除、导出、手动修改、多级邀请或普通用户日志页。

### 本轮实际修改文件

- `model/invitation_rebate_record.go`
- `model/main.go`
- `service/invitation_rebate.go`
- `service/invitation_rebate_test.go`
- `controller/invitation_rebate.go`
- `controller/invitation_rebate_auth_test.go`
- `controller/invitation_rebate_test.go`
- `router/api-router.go`
- `web/default/src/features/system-settings/api.ts`
- `web/default/src/features/system-settings/types.ts`
- `web/default/src/features/system-settings/general/invitation-rebate-records-section.tsx`
- `web/default/src/i18n/locales/{en,zh,fr,ja,ru,vi}.json`
- `web/classic/src/pages/Setting/Operation/InvitationRebateRecordsModal.jsx`
- `web/classic/src/i18n/locales/{en,zh,zh-CN,zh-TW,fr,ja,ru,vi}.json`
- `.ai/TASK.md`

### 实现摘要

- 新增主库表模型 `InvitationRebateSettlementItem`，记录 `rebate_record_id`、`consumption_id`、邀请人 / 被邀请人、消费 source type/key/request id、本次从该消费结算的 quota、消费发生时的比例快照、本段返利 quota、结算前后取整余数。
- `InvitationRebateSettlementItem` 已注册到 `AutoMigrate` 和 fast migration 列表，使用 GORM 普通字段和索引，未使用数据库特有语法。
- `TryGrantInvitationRebate` 内部改为先生成结算计划，再同事务创建返利流水、创建结算明细、更新消费明细状态、更新累计状态并增加邀请人 `aff_quota` / `aff_history`。
- 当低比例导致本次 `rebate_quota=0` 时，仍创建 0 金额结算流水和明细用于审计复盘，但不增加邀请人返利余额。
- 新增管理员只读详情接口 `GET /api/user/invitation_rebate/:id`，返回单条返利流水、结算明细列表以及 legacy 标记；路由继续挂在 `AdminAuth` 管理员权限组。
- 新版前端和旧版前端的管理员返利流水均新增“详情”入口，展示本次累计结算覆盖的消费明细；旧流水无明细时展示 legacy 说明。
- i18n 已手动补齐本轮新增 key，未执行 `.agents/skills` 命令。

### 未修改范围

- 未修改充值链路。
- 未修改注册 / OAuth。
- 未修改异步任务 / Midjourney。
- 未扩大同步消费挂接范围。
- 未新增补发、删除、导出、手动修改、多级邀请或普通用户返利日志。
- 未修改依赖文件，未提交 `node_modules` 或构建产物。

### 验证命令与结果

- `gofmt -w model/invitation_rebate_record.go model/main.go service/invitation_rebate.go service/invitation_rebate_test.go controller/invitation_rebate.go controller/invitation_rebate_auth_test.go controller/invitation_rebate_test.go`：通过。
- `go test ./service -run "TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume" -count=1`：通过。
- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `go test ./service/...`：未通过，仍失败在既有 `service/channel_affinity_usage_cache_test.go`，本轮复现用例为 `TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode` 和 `TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`，与累计返利审计明细无直接交集。
- `cd web/default && bun run typecheck`：通过，使用临时 Bun 1.3.13。
- `cd web/default && bun run build`：通过。
- `cd web/classic && bun run build`：通过，仅有既有 Browserslist、lottie eval 和 chunk size warning。
- `cd web/default && bun run lint`：未通过，失败文件均为既有非本轮修改文件。
- `cd web/classic && bun run lint`：未通过，失败为既有 Prettier / dist 检查债务；对本轮 `InvitationRebateRecordsModal.jsx` 做定向 Prettier 后，该文件不再出现在失败清单中。
- locale JSON parse 与本轮新增 key 完整性检查：通过。
- `git diff --check`：通过。

### 已知失败与豁免依据

- `go test ./service/...` 仍受既有 channel affinity usage cache 测试失败影响；定向返利 service 测试已通过，本轮新增结算明细、事务回滚和详情接口不涉及该缓存逻辑。
- 新版前端 lint 仍失败在既有文件：`api-keys-dialogs.tsx`、`group-ratio-visual-editor.tsx`、`ratio-settings-card.tsx`、`tiered-pricing-editor.tsx`、`common-logs-filter-bar.tsx`、`task-logs-filter-bar.tsx`、`theme-radius.ts` 等，均非本轮修改文件。
- 旧版前端 lint 仍失败在既有大范围 Prettier / dist 检查债务；本轮修改的旧版返利流水 Modal 已定向格式化并从失败清单移除。

### 自审查结果

- 通过：返利流水、结算明细、消费明细状态、累计状态、邀请人返利余额仍在同一主库事务内完成，任一步失败整体回滚。
- 通过：重复 `source_type + source_key` 不重复累计、不重复返利。
- 通过：详情接口只读，且位于管理员权限组；普通用户权限测试覆盖列表与详情路由。
- 通过：前端只新增管理员只读详情展示，不提供补发、删除、导出或修改。
- 通过：未修改充值、注册 / OAuth、异步任务、Midjourney、依赖文件或构建产物。
- 通过：未输出或写入 token / secret / sk- key / bearer token。

### 下一步建议

- 上线前继续保持 `InvitationRebateEnabled=false`，先在本地或备份库验证 `invitation_rebate_settlement_items` 表与索引创建成功。
- 用测试账号验收低额累计、跨多笔消费结算、同一消费拆分结算、比例变更快照、低比例 0 金额明细、详情展示和重复 request id 幂等。
- 生产开启前先小比例、小门槛、小流量灰度；如发现异常，第一步关闭 `InvitationRebateEnabled` 并保留 `users`、`options`、累计表、返利流水、结算明细和消费日志用于核账。

## 资金链路漏洞与风险修复记录

任务名称：资金链路行锁、回调入账与累计返利并发加固
status: completed

### 本轮目标

- 修复资金事务中旧式 `gorm:query_option` 行锁可能不生效的问题。
- 修复 Stripe webhook 本地入账失败仍可能返回 200 的问题。
- 对齐充值渠道用户额度更新命中行数检查，避免订单 success 但用户额度未增加。
- 加固累计返利消费明细结算条件更新，避免并发覆盖同一消费明细。
- 加固邀请余额转余额、兑换码等资金相关事务边界。

### 本轮修改文件

- `model/locking.go`
- `model/topup.go`
- `model/redemption.go`
- `model/user.go`
- `model/subscription.go`
- `model/task_cas_test.go`
- `model/payment_method_guard_test.go`
- `controller/topup_stripe.go`
- `controller/topup_stripe_test.go`
- `service/invitation_rebate.go`
- `service/invitation_rebate_test.go`
- `.ai/TASK.md`

### 实现摘要

- 新增 `model.LockingForUpdate(tx)`，MySQL/PostgreSQL 使用 `clause.Locking{Strength: "UPDATE"}`，SQLite 保持 no-op 兼容。
- 替换资金相关路径中的旧式 `tx.Set("gorm:query_option", "FOR UPDATE")`。
- Stripe webhook 的本地订阅/充值处理失败会向上返回 error，webhook 返回 5xx，允许 Stripe 重试。
- Stripe、Creem、Waffo、Waffo Pancake、易支付、管理员补单的用户额度增加均检查 `RowsAffected`，未命中用户时回滚事务。
- Stripe 重复 success 回调和管理员重复补单保持幂等，不重复增加额度，也不重复写成功充值日志。
- 兑换码充值用户额度更新检查 `RowsAffected`，用户不存在时回滚兑换码状态。
- 邀请余额转余额在行锁基础上增加 `aff_quota >= quota` 条件原子更新，防止并发超扣。
- 累计返利消费明细结算更新增加旧 `settled_source_quota` 条件，命中 0 行视为并发冲突并回滚。

### 未修改范围

- 未修改返利比例、累计门槛、source key 或消费挂接范围。
- 未修改充值金额计算规则。
- 未修改注册 / OAuth、异步任务、Midjourney。
- 未修改 model 结构 / migration。
- 未修改前端。
- 未修改依赖文件，未提交 `node_modules` 或构建产物。
- 未执行 `.agents/skills`，未连接真实 New API 实例。

### 验证命令与结果

- `gofmt -w model/locking.go model/topup.go model/user.go model/redemption.go model/subscription.go model/task_cas_test.go model/payment_method_guard_test.go service/invitation_rebate.go service/invitation_rebate_test.go controller/topup_stripe.go controller/topup_stripe_test.go`：通过。
- `go test ./model -run "TestRechargeEpay|TestRechargeStripe|TestRechargeCreem|TestRechargeWaffo|TestManualCompleteTopUp|TestRedeem|TestTransferAffQuota|TestUpdatePendingTopUpStatus|TestCompleteSubscriptionOrder|TestExpireSubscriptionOrder" -count=1`：通过。
- `go test ./controller -run "TestStripe|TestEpay|TestInvitationRebate" -count=1`：通过。
- `go test ./service -run "TestTryGrantInvitationRebate|TestGrantInvitationRebateAfterSyncConsume|TestApplyInvitationRebateSettlementPlan|TestBillingSessionSettle" -count=1`：通过。
- `go test ./model -run "TestUpdateInvitationRebateOptions|TestUpdateOption|TestRechargeEpay|TestRechargeStripe|TestRechargeCreem|TestRechargeWaffo|TestManualCompleteTopUp|TestRedeem|TestTransferAffQuota" -count=1`：通过。
- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `go test ./service/...`：未通过，仍失败在既有 `service/channel_affinity_usage_cache_test.go` 的 `TestObserveChannelAffinityUsageCacheByRelayFormat_MixedMode` 和 `TestObserveChannelAffinityUsageCacheByRelayFormat_UnsupportedModeKeepsEmpty`，与本轮资金链路、充值入账、累计返利结算加固无直接交集。
- `git diff --check`：通过。

### 自审查结果

- staged 前自审：本轮只改后端资金安全和对应测试，不改前端、不改依赖、不改数据库结构。
- 已确认没有扩大邀请返利消费挂接范围，没有修改返利计算语义。
- 已确认 Stripe 本地入账失败不会返回 200。
- 已确认充值渠道用户额度更新未命中时会回滚订单状态。
- 已确认累计返利消费明细结算并发冲突会回滚。
- 已确认没有输出或写入 token / secret / sk- key / bearer token。

### 下一步建议

- 生产继续保持 `InvitationRebateEnabled=false`，先部署加固版本并在备份库/本地验证行锁、充值回调重试和累计返利并发场景。
- 单独排期修复既有 `service/channel_affinity_usage_cache_test.go` 测试债务，恢复 `go test ./service/...` 全绿。
- 如需恢复生产邀请返利，先用小比例、小门槛、测试账号跑完整消费到返利流水链路。
## service 通道亲和缓存统计测试隔离修复记录
任务名称：修复 `channel_affinity_usage_cache_test.go` 既有测试隔离失败
status: completed

### 本轮目标

- 修复 `go test ./service/...` 中既有 `TestObserveChannelAffinityUsageCacheByRelayFormat` 统计串扰失败。
- 只修改测试隔离逻辑，不修改通道亲和业务实现。
- 不修改邀请返利、充值、消费挂接、model/migration、前端或依赖。

### 问题归因

- 失败复现时，`MixedMode` 或 `UnsupportedModeKeepsEmpty` 的 `Total` 会累加前置用例统计。
- 测试原先使用 `time.Now().UnixNano()` 生成 `ruleName` 与 `keyFP`。
- 在当前环境快速执行时，该时间戳后缀可能不足以隔离包级统计缓存，导致多个用例命中同一统计 key。

### 修改文件

- `service/channel_affinity_usage_cache_test.go`
- `.ai/TASK.md`

### 修复摘要

- 新增测试专用原子计数器和唯一后缀 helper。
- 使用测试名 + 原子递增值生成 `ruleName` 与 `keyFP`。
- 移除对 `time.Now().UnixNano()` 的依赖。
- 未修改 `service/channel_affinity.go` 或任何业务代码。

### 验证命令与结果

- `gofmt -w service/channel_affinity_usage_cache_test.go`：通过。
- `go test ./service -run TestObserveChannelAffinityUsageCacheByRelayFormat -count=1 -v`：通过。
- `go test ./service/...`：通过。
- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `git diff --check`：通过。

### 自审查结果

- 已确认只修改测试隔离与任务记录。
- 已确认未修改邀请返利 service、消费挂接、充值、注册 / OAuth、异步任务、Midjourney。
- 已确认未修改 model/migration、前端、依赖文件。
- 已确认未提交 node_modules、构建产物或任何密钥。

### 下一步建议

- 资金链路继续保持上线前人工验收：小比例、小门槛、测试账号验证完整消费到返利流水链路。
- 后续如需继续增强，可补 MySQL/PostgreSQL 集成环境下的资金行锁与并发回归测试。
## 邀请返利上线前本地验收记录
任务名称：本地 PostgreSQL + Redis 环境验证累计邀请返利与后台流水
status: blocked

### 本轮目标

- 使用 `docker-compose.dev.yml` 构建当前源码后端，在本地 PostgreSQL + Redis 环境验证迁移、健康检查、后台配置与返利流水。
- 不连接真实 New API 实例，不使用生产库，不写入真实资金数据。
- 不修改业务代码、前端代码、数据库结构、依赖或构建产物。

### 已完成验证

- 已安装并启用当前 Codex 环境 Bun 1.3.13；安装发生在用户工具目录，未修改仓库文件。
- `go test ./model/...`：通过。
- `go test ./controller/...`：通过。
- `go test ./service/...`：通过。
- `cd web/default && bun run typecheck`：通过。
- `cd web/default && bun run build`：通过。
- `cd web/classic && bun run build`：通过；仅有既有 Browserslist、lottie eval 和 chunk size warning。
- `cd web/default && bun run lint`：未通过，失败仍为既有非本轮文件的 React hooks lint 债务；本轮未修改前端文件。
- `cd web/classic && bun run lint`：未通过，失败为既有 Prettier / dist 检查债务；本轮未修改前端文件。

### 阻塞项

- 当前环境没有 `docker` 命令，`docker --version` 和 `docker compose version` 均无法执行。
- 当前环境没有可用替代容器运行时：未发现 `podman`、`nerdctl`。
- 当前环境没有本地 PostgreSQL 命令：未发现 `psql`、`postgres`。
- 因此无法执行：
  - `docker compose -f docker-compose.dev.yml up -d --build new-api`
  - `docker compose -f docker-compose.dev.yml ps`
  - `docker compose -f docker-compose.dev.yml logs --tail=200 new-api`
  - 本地 PostgreSQL 表和索引创建结果查询
  - 管理员后台人工验收和真实本地消费链路验收

### 当前结论

- 代码层回归、前端 typecheck 和构建验证已通过。
- 本地 PostgreSQL + Redis 生产相似验收未完成，原因是当前执行环境缺少 Docker/容器运行时和本地 PostgreSQL。
- 本轮不得标记为完成态，也不创建 `文档：记录邀请返利上线前本地验收结果` commit。

### 下一步建议

- 在安装 Docker Desktop 或具备 Docker Engine 的机器上重新执行 `docker-compose.dev.yml` 本地验收。
- 生产开启前继续保持 `InvitationRebateEnabled=false`。
- 容器验收通过后，再用小比例、小门槛、测试账号验证完整“邀请关系 -> 累计消费 -> 达标返利 -> 流水详情”链路。

## 旧版用户端邀请返现日志记录

任务名称：旧版前端用户端邀请返现日志
status: completed

### 阶段 0：文档与边界

- 本轮只实现旧版前端 `web/classic` 的用户端邀请返现日志，不接入新版前端 `web/default`。
- 日志位置为用户端 `/console/topup` 右侧“邀请奖励”卡片下方。
- 单个被邀请用户的“返利余额”统计口径为该用户贡献的累计返利 `total_rebate_quota`。
- 总返利余额 = `aff_history_quota`；待使用收益 = `aff_quota`；已转化余额 = `max(aff_history_quota - aff_quota, 0)`。
- 当前不新增按被邀请用户拆分的划转归因表。
- 本轮不修改返利计算、消费挂接、充值、注册 / OAuth、异步任务、Midjourney、model / migration、依赖。

### 阶段 0 修改文件

- `.ai/PROJECT.md`
- `.ai/TASK.md`

### 阶段 0 验证

- 待执行：`git diff --check`

### 阶段 0 自审

- 已确认阶段 0 仅修改 `.ai/PROJECT.md` 与 `.ai/TASK.md`，未修改业务代码。
- 阶段 0 提交：`7dafbf5d2a7dc6e73a6a494fee371cd45a53cbb2`

### 阶段 1：后端 self 查询接口

- 新增普通用户只读接口：
  - `GET /api/user/invitation_rebate/self/summary`
  - `GET /api/user/invitation_rebate/self/invitees`
  - `GET /api/user/invitation_rebate/self/records`
  - `GET /api/user/invitation_rebate/self/records/:id`
- 路由挂在 `UserAuth` self route 下。
- `summary` 返回待使用收益、总返利余额、已转化余额和邀请人数。
- `invitees` 仅查询当前用户邀请的用户，并按本页 invitee id 合并累计状态。
- `records` 和 `records/:id` 仅查询当前登录用户作为邀请人的返利记录。
- 普通用户列表不返回完整 source key；详情明细仅返回截断后的 source key。

### 阶段 1 修改文件

- `controller/invitation_rebate.go`
- `controller/invitation_rebate_test.go`
- `router/api-router.go`
- `.ai/TASK.md`

### 阶段 1 验证

- `gofmt -w controller/invitation_rebate.go controller/invitation_rebate_test.go router/api-router.go`：通过。
- `go test ./controller -run "TestGetSelfInvitationRebate|TestGetInvitationRebateRecordDetail|TestInvitationRebate" -count=1`：通过。
- `go test ./controller/...`：通过。
- `go test ./model/...`：通过。
- `go test ./service/...`：通过。
- `git diff --check`：通过。

### 阶段 1 自审

- 已确认阶段 1 新增接口均为普通用户只读查询，路由位于 `UserAuth` self route 下。
- 已确认详情接口使用 `id + inviter_user_id` 过滤，普通用户无法查询他人返利详情。
- 已确认普通用户接口不返回完整 source key，详情明细仅返回截断 source key。
- 已确认未修改返利计算、消费挂接、充值、注册 / OAuth、异步任务、Midjourney、model / migration、依赖。

### 阶段 2：旧版前端展示

- 在旧版 `/console/topup` 的“邀请奖励”卡片下方接入用户端“邀请返现日志”区域。
- 新增 `InvitationRebateLogPanel`，调用普通用户 self 只读接口：
  - `GET /api/user/invitation_rebate/self/summary`
  - `GET /api/user/invitation_rebate/self/invitees`
  - `GET /api/user/invitation_rebate/self/records`
- 顶部展示总返利余额、已转化余额、待使用收益。
- 默认展示邀请用户列表，字段包含用户、注册时间、累计消费、已结算消费、返利余额。
- 增加“返利流水”切换视图，字段包含被邀请人用户 ID、结算消费额度、返利额度、返利比例、状态、创建时间。
- 本轮不新增详情弹窗、补发、删除、导出、手动操作或普通用户修改能力。
- 补齐旧版 8 个 locale 文件；验证发现 `注册时间` 为本轮新增列的缺失 key，已做最小补齐。

### 阶段 2 修改文件

- `web/classic/src/components/topup/InvitationCard.jsx`
- `web/classic/src/components/topup/InvitationRebateLogPanel.jsx`
- `web/classic/src/i18n/locales/en.json`
- `web/classic/src/i18n/locales/fr.json`
- `web/classic/src/i18n/locales/ja.json`
- `web/classic/src/i18n/locales/ru.json`
- `web/classic/src/i18n/locales/vi.json`
- `web/classic/src/i18n/locales/zh.json`
- `web/classic/src/i18n/locales/zh-CN.json`
- `web/classic/src/i18n/locales/zh-TW.json`
- `.ai/TASK.md`

### 阶段 2 验证

- `C:\Users\Administrator\.bun\bin\bun.exe --version`：通过，版本 `1.3.13`。
- `cd web/classic && bun run build`：通过；仅有既有 Browserslist、lottie eval、chunk size warning。
- `cd web/classic && bun run lint`：未通过，失败为既有 Prettier / dist 检查债务；本轮新增 `InvitationRebateLogPanel.jsx` 已定向 Prettier 后不再出现在失败清单。
- `cd web/classic && bunx prettier src/components/topup/InvitationCard.jsx src/components/topup/InvitationRebateLogPanel.jsx src/i18n/locales/*.json --check`：通过。
- locale JSON parse 与新增组件 `t()` key 完整性检查：通过，8 个旧版 locale 均包含 23 个相关 key。
- `git diff --check`：通过。

### 阶段 2 lint 归因

- 旧版 `bun run lint` 等价于 `prettier . --check`，会扫描既有 `dist` 与大量旧文件。
- 定向修复后，本轮修改文件已通过 Prettier 检查。
- 全局 lint 剩余失败文件均为既有非本轮文件或构建产物，例如 `.eslintrc.cjs`、`.prettierrc.mjs`、`dist/assets/*`、`src/components/auth/*`、`src/components/table/*`、`src/pages/Setting/*` 等。
- 该 lint 债务与本轮旧版邀请返现日志实现无直接交集，本轮不扩大修复范围。

### 阶段 2 自审

- 已确认本轮只修改旧版前端 `web/classic` 用户端钱包页和旧版 locale。
- 已确认未修改新版前端 `web/default`。
- 已确认未修改后端返利计算、消费挂接、充值、注册 / OAuth、异步任务、Midjourney。
- 已确认未修改 model / migration、后端 option、依赖文件。
- 已确认未提交 `node_modules`、`dist` 或构建产物。
- 已确认未输出或写入 token / secret / sk- key / bearer token。
- 阶段 2 提交：`3bd3d8b24212b6413d202e67da52cebcd1059caf`

### 阶段 3：验证与收口

- 旧版用户端邀请返现日志本轮实现完成。
- 最终功能范围：
  - 普通用户可在旧版 `/console/topup` 右侧“邀请奖励”卡片下方查看邀请返现日志。
  - 汇总口径：总返利余额 = `aff_history_quota`；待使用收益 = `aff_quota`；已转化余额 = `max(aff_history_quota - aff_quota, 0)`。
  - 邀请用户列表展示每个被邀请用户贡献的累计返利，不按被邀请用户拆分已转化余额。
  - 返利流水只读展示当前用户作为邀请人的返利记录。
- 已完成提交：
  - `7dafbf5d2a7dc6e73a6a494fee371cd45a53cbb2`：文档：规划旧版用户端邀请返现日志。
  - `bee845c87bbba4fefe8cf0ce1dfb13a492d0469c`：后端：新增用户端邀请返现日志接口。
  - `3bd3d8b24212b6413d202e67da52cebcd1059caf`：前端：新增旧版用户端邀请返现日志。
- 本轮未实现范围：
  - 不接入新版前端 `web/default`。
  - 不新增数据库表。
  - 不新增普通用户补发、删除、导出、手动修改或详情修改能力。
  - 不做多级邀请。
  - 不修改返利计算、消费挂接、充值、注册 / OAuth、异步任务、Midjourney。
- 最终验证结果：
  - `go test ./controller/...`：阶段 1 已通过。
  - `go test ./model/...`：阶段 1 已通过。
  - `go test ./service/...`：阶段 1 已通过。
  - `cd web/classic && bun run build`：阶段 2 已通过，仅有既有 warning。
  - `cd web/classic && bun run lint`：阶段 2 未通过，失败为既有 Prettier / dist 检查债务；本轮修改文件定向 Prettier 检查通过。
  - locale JSON parse 与新增组件 `t()` key 完整性检查：阶段 2 已通过。
  - `git diff --check`：阶段 2 已通过。
- 自审查结果：
  - 已确认没有修改新版前端。
  - 已确认没有修改消费挂接逻辑、返利 service、充值链路、注册 / OAuth、异步任务、Midjourney。
  - 已确认没有修改 model / migration、依赖文件。
  - 已确认没有提交 `node_modules`、`dist` 或构建产物。
  - 已确认没有输出或写入 token / secret / sk- key / bearer token。
- 下一步建议：
  - 在具备本地后端服务和测试账号的环境中人工验收 `/console/topup`：查看“邀请奖励”卡片下方是否显示邀请返现日志。
  - 用测试邀请关系验证 summary、邀请用户列表和返利流水展示数据是否与后端流水一致。
  - 单独排期清理旧版前端既有 Prettier / dist lint 债务，避免后续 lint 归因成本继续增加。

## 旧版邀请奖励文案修正记录

任务名称：将旧版邀请奖励说明从好友充值改为好友消费
status: completed

### 修改范围

- `web/classic/src/components/topup/InvitationCard.jsx`
- `web/classic/src/i18n/locales/en.json`
- `web/classic/src/i18n/locales/fr.json`
- `web/classic/src/i18n/locales/ja.json`
- `web/classic/src/i18n/locales/ru.json`
- `web/classic/src/i18n/locales/vi.json`
- `web/classic/src/i18n/locales/zh.json`
- `web/classic/src/i18n/locales/zh-CN.json`
- `web/classic/src/i18n/locales/zh-TW.json`
- `.ai/TASK.md`

### 修改内容

- 将旧版 `/console/topup` 邀请奖励卡片中的说明文案从“邀请好友注册，好友充值后您可获得相应奖励”改为“邀请好友注册，好友消费后您可获得相应奖励”。
- 同步更新旧版 8 个 locale 文件，移除旧 key 并补齐新 key 翻译。
- 本轮未修改新版前端 `web/default`。

### 验证命令与结果

- `rg "邀请好友注册，好友充值后您可获得相应奖励" web/classic/src/components/topup/InvitationCard.jsx web/classic/src/i18n/locales -n`：无匹配，旧文案已移除。
- `rg "邀请好友注册，好友消费后您可获得相应奖励" web/classic/src/components/topup/InvitationCard.jsx web/classic/src/i18n/locales -n`：通过，组件和 8 个旧版 locale 均包含新文案。
- locale JSON parse 与新旧 key 检查：通过，8 个旧版 locale 均包含新 key 且不再包含旧 key。
- `bun x prettier web/classic/src/components/topup/InvitationCard.jsx web/classic/src/i18n/locales/en.json web/classic/src/i18n/locales/fr.json web/classic/src/i18n/locales/ja.json web/classic/src/i18n/locales/ru.json web/classic/src/i18n/locales/vi.json web/classic/src/i18n/locales/zh.json web/classic/src/i18n/locales/zh-CN.json web/classic/src/i18n/locales/zh-TW.json --check`：通过。
- `git diff --check`：通过。

### 自审查结果

- 已确认本轮只修改旧版前端邀请奖励说明文案和对应 locale。
- 已确认未修改后端、返利 service、消费挂接、充值、注册 / OAuth、异步任务、Midjourney。
- 已确认未修改 model / migration、依赖文件、新版前端 `web/default`。
- 已确认未提交 `node_modules`、`dist` 或构建产物。
- 已确认未输出或写入 token / secret / sk- key / bearer token。

### 下一步建议

- 用户在已启动的旧版前端 `http://localhost:5173/console/topup` 刷新页面后人工确认邀请奖励说明已显示为“好友消费”。

## 旧版请求错误日志细化记录

任务名称：细化旧版前端请求错误日志排障信息
status: completed

### 本轮目标

- 仅增强请求错误日志 `type=5`，不新增数据库字段、不新增 API。
- 使用现有 `logs.other` JSON 保存脱敏排障摘要。
- 只改旧版前端 `web/classic` 的 usage logs 展开行，不接入新版前端 `web/default`。
- 保持 `ERROR_LOG_ENABLED=false` 时不记录错误日志。

### 修改文件

- `controller/relay.go`
- `controller/channel-test.go`
- `controller/error_log_info.go`
- `controller/error_log_info_test.go`
- `service/error.go`
- `service/error_log_summary.go`
- `service/error_log_summary_test.go`
- `types/error.go`
- `model/log.go`
- `model/log_test.go`
- `web/classic/src/hooks/usage-logs/useUsageLogsData.jsx`
- `web/classic/src/i18n/locales/en.json`
- `web/classic/src/i18n/locales/fr.json`
- `web/classic/src/i18n/locales/ja.json`
- `web/classic/src/i18n/locales/ru.json`
- `web/classic/src/i18n/locales/vi.json`
- `web/classic/src/i18n/locales/zh.json`
- `web/classic/src/i18n/locales/zh-CN.json`
- `web/classic/src/i18n/locales/zh-TW.json`
- `.ai/TASK.md`

### 实现摘要

- `processChannelError` 增加 `relayInfo` 入参，错误日志 `other` 保留原有请求路径、错误类型、错误码、状态码、通道信息、管理员重试链。
- `logs.other` 新增请求方法、原始模型、最终模型、模型映射标记、relay mode、relay format、最终 relay format、请求转换链、是否流式、秒级耗时、毫秒级耗时、重试次数、错误来源、上游状态码、上游错误摘要。
- 新增 `service.SafeErrorLogSnippet` 与错误摘要构建逻辑，摘要最多保留 800 rune；可解析 JSON 时按字段名脱敏/去内容，不可解析文本时用正则兜底。
- `Authorization`、API key、bearer token、`sk-` token 会被遮罩；`prompt`、`messages`、`input`、`content`、图片、文件、音频字段会被替换为 `[redacted]`。
- 错误日志表 `content` 与运行时 channel error 日志也改用同一套安全摘要，避免只有 `other.upstream_error` 安全而主内容泄露。
- `RelayErrorHandler` 在上游非 2xx 响应解析失败时记录脱敏 body snippet；解析成功时记录结构化 message/type/code/status/parsed。
- `/api/log/self` 格式化时继续保留普通用户安全字段，剔除通道、最终模型、转换链、重试次数、上游摘要等管理员调试字段。
- 旧版 `useUsageLogsData.jsx` 的 `type=5` 展开行展示上游状态、错误类型、错误码、错误来源、请求方法、模型映射、relay mode/format、重试次数；管理员额外展示重试通道链和上游错误摘要。
- 补齐旧版 8 个 locale 的新增文案；未修改新版前端 `web/default`。

### 验证命令与结果

- `gofmt -w controller/relay.go controller/channel-test.go controller/error_log_info.go controller/error_log_info_test.go service/error.go service/error_log_summary.go service/error_log_summary_test.go types/error.go model/log.go model/log_test.go`：通过。
- `go test ./controller/...`：通过。
- `New-Item -ItemType Directory -Force .gotmp | Out-Null; $env:GOTMPDIR=(Resolve-Path .gotmp).Path; go test ./model/...`：通过。
- `go test ./service/...`：通过。
- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist、lottie eval、chunk size warning。
- `C:\Users\Administrator\.bun\bin\bun.exe x prettier src/hooks/usage-logs/useUsageLogsData.jsx src/i18n/locales/en.json src/i18n/locales/fr.json src/i18n/locales/ja.json src/i18n/locales/ru.json src/i18n/locales/vi.json src/i18n/locales/zh.json src/i18n/locales/zh-CN.json src/i18n/locales/zh-TW.json --check`：通过。
- `node -e "const fs=require('fs'); for (const f of fs.readdirSync('web/classic/src/i18n/locales').filter(f=>f.endsWith('.json'))) JSON.parse(fs.readFileSync('web/classic/src/i18n/locales/'+f,'utf8')); console.log('classic locale json ok')"`：通过。
- `git diff --check`：通过。

### 自审查结果

- 已确认本轮只增强错误日志 `type=5`，未修改成功消费日志和计费逻辑。
- 已确认未新增数据库字段、迁移或 API。
- 已确认旧版前端只修改 `web/classic`，未修改新版前端 `web/default`。
- 已确认上游错误摘要和日志主内容均经过脱敏、去 prompt/图片/文件内容、截断处理。
- 已确认普通用户 `/api/log/self` 不返回管理员调试字段和上游摘要。
- 已确认 `ERROR_LOG_ENABLED=false` 时仍不记录错误日志。
- 已确认未提交 `node_modules`、`dist` 或构建产物。
- 已确认未输出或写入 token / secret / access token / sk- key / bearer token。

### 下一步建议

- 在本地测试实例中用一个会返回 4xx/5xx 的上游通道人工触发错误，管理员查看旧版日志展开行是否显示模型映射、重试链和上游摘要。
- 使用普通用户账号访问 `/api/log/self` 或旧版日志页，确认只显示安全字段。

## 错误日志脱敏遗漏修复记录

任务名称：修复错误日志脱敏遗漏
status: completed

### 修改文件

- `service/error.go`
- `service/error_log_summary.go`
- `service/error_log_summary_test.go`
- `controller/relay.go`
- `controller/error_log_info_test.go`
- `model/log.go`
- `model/log_test.go`
- `.ai/TASK.md`

### 实现摘要

- `RelayErrorHandler` 非 JSON 上游错误体解析失败时，不再把原始 body 写入运行日志；改为记录 `parsed=false`、脱敏 `body_snippet` 和 `truncated`。
- `showBodyWhenFail=true` 的错误包装改为使用脱敏后的 body snippet，并对拼入的 message 同样做脱敏截断，避免 channel test 等路径再次暴露原始上游 body。
- 自动禁用通道时，`DisableChannel` 的 reason 改为使用 `errorLogContent(err)`，保持禁用判断仍由原错误对象负责，但系统日志、管理员通知和 `status_reason` 只接收脱敏摘要。
- 普通用户日志格式化额外删除 `upstream_model_name` 与 `is_model_mapped`，模型映射详情仅管理员可见。
- 强化自由文本 payload 字段脱敏：当 `prompt`、`messages`、`image_url`、`file_data` 等字段相邻出现时，逐字段替换为 `[redacted]`，避免一个字段吞掉后续字段导致可读性或脱敏边界不清。

### 验证命令与结果

- `gofmt -w service/error.go service/error_log_summary.go service/error_log_summary_test.go controller/relay.go controller/error_log_info_test.go model/log.go model/log_test.go`：通过。
- `go test ./controller/...`：通过。
- `New-Item -ItemType Directory -Force .gotmp | Out-Null; $env:GOTMPDIR=(Resolve-Path .gotmp).Path; go test ./model/...`：通过。
- `go test ./service/...`：通过。
- `git diff --check`：通过。

### 自审查结果

- 已确认本轮不改数据库结构、不新增 API、不触碰成功消费日志和计费逻辑。
- 已确认本轮未修改新版前端 `web/default`，也未修改旧版前端展示代码。
- 已确认非 JSON 上游 body、错误日志摘要、自动禁用 reason 和普通用户 `/api/log/self` 字段过滤均有测试覆盖。
- 已确认新增测试使用的是伪造敏感样本，仅用于断言脱敏，不依赖真实 token、key 或外部服务。
- 已确认未提交 `node_modules`、`dist` 或构建产物。

### 下一步最小任务建议

- 在本地测试实例中人工触发一次 4xx/5xx 上游错误，分别用管理员和普通用户账号检查旧版请求日志展开行，确认管理员可排障、普通用户不暴露上游调试字段。

## 用户端日志敏感字段彻底移除记录

任务名称：彻底移除用户端日志中的上游敏感字段
status: completed

### 修改文件

- `model/log.go`
- `model/log_test.go`
- `service/error_log_summary.go`
- `service/error_log_summary_test.go`
- `.ai/TASK.md`

### 实现摘要

- 新增普通用户日志响应 DTO，`/api/log/self` 与 `/api/log/token` 不再直接返回完整 `Log`，响应 JSON 不包含顶层 `channel`、`channel_name`、`token_id`。
- 普通用户错误日志 `type=5` 的 `other` 改为白名单，仅保留安全的 `status_code`、`error_type`、`error_code`，并将包含上游/渠道/relay/key 含义的错误类型或错误码归一为 `request_error`。
- 普通用户非错误日志继续保留用户自有字段与计费展示字段，但递归移除 `admin_info`、渠道、上游模型、relay、重试、多 key、key 指纹/key 摘要、上游摘要等管理员排障字段。
- 普通用户错误日志 `content` 增加用户视图净化：若内容仍包含 `Authorization`、API key、Bearer、`sk-`、channel、upstream、relay、key_hint、key_fp、多 key 等敏感排障词，则回退为 `status_code=xxx` 或通用失败信息。
- 修复自由文本 bracket payload 扫描器，`messages=[{"content":"... ] ..."}]` 中的 `]`、`}`、转义引号不会提前结束脱敏范围。

### 验证命令与结果

- `gofmt -w model/log.go model/log_test.go service/error_log_summary.go service/error_log_summary_test.go`：通过。
- `go test ./model -run "TestFormatUserLogs|TestUserLogContent" -count=1`：通过。
- `go test ./service -run "TestSafeErrorLogSnippet|TestRelayErrorHandler" -count=1`：通过。
- `go test ./controller/...`：通过。
- `New-Item -ItemType Directory -Force .gotmp | Out-Null; $env:GOTMPDIR=(Resolve-Path .gotmp).Path; go test ./model/...`：通过。
- `go test ./service/...`：通过。
- `git diff --check`：通过。

### 自审查结果

- 已确认管理员日志接口 `/api/log/` 未改动，仍保留管理员排障信息。
- 已确认普通用户日志响应字段由后端投影控制，不依赖旧版前端隐藏。
- 已确认普通用户仍可看到自己创建/使用的 `token_name`、请求模型、分组、用量、时间、Request ID 和安全错误状态/错误码。
- 已确认本轮未修改数据库结构、迁移、API 路由、成功消费日志、计费逻辑或新版/旧版前端代码。
- 已确认新增测试只使用伪造敏感样本，不依赖真实 token、key 或外部服务。
- 已确认未提交 `node_modules`、`dist` 或构建产物，未输出或写入真实 token / secret / access token / sk- key / bearer token。

### 下一步最小任务建议

- 在本地测试实例中分别请求 `/api/log/self` 和 `/api/log/token`，抓取原始 JSON 响应确认用户端不存在渠道、上游 key、多 key、relay、重试链和实际上游模型字段名。

## 上游渠道密钥安全与错误响应加固记录

任务名称：统一加固上游渠道密钥脱敏、用户可见错误响应与用户日志投影
status: completed

### 修改文件

- `common/str.go`
- `common/str_test.go`
- `types/error.go`
- `types/error_test.go`
- `service/error.go`
- `service/error_log_summary.go`
- `service/error_log_summary_test.go`
- `controller/relay.go`
- `controller/channel-test.go`
- `controller/error_log_info.go`
- `controller/error_log_info_test.go`
- `model/log.go`
- `model/log_test.go`
- `relay/audio_handler.go`
- `relay/chat_completions_via_responses.go`
- `relay/claude_handler.go`
- `relay/compatible_handler.go`
- `relay/embedding_handler.go`
- `relay/gemini_handler.go`
- `relay/image_handler.go`
- `relay/rerank_handler.go`
- `relay/responses_handler.go`
- `relay/channel/gemini/relay-gemini.go`
- `relay/channel/zhipu/relay-zhipu.go`
- `relay/common/relay_utils.go`
- `.ai/TASK.md`

### 实现摘要

- 新增统一脱敏与用户可见净化函数，覆盖 Authorization/Bearer、API key、访问令牌、裸上游密钥形态、管道分隔密钥，并支持传入当前渠道 key 做精确替换。
- OpenAI/Claude/Task 用户错误响应统一净化 message、type/code/error_code；包含 channel/upstream/relay/retry/key/token/prompt/messages/file/image 等内部或敏感词时回退为安全错误内容。
- `RelayErrorHandler`、错误日志摘要、自动禁用 reason/status_reason、通道测试响应均接入强脱敏，并把当前渠道 key 作为显式 secret 参与替换。
- 普通用户日志继续使用后端投影：错误日志 `other` 只保留安全字段，非错误日志 `other` 递归移除 key/channel/upstream/relay/retry 等敏感字段名，用户端错误 content 遇到内部词直接回退安全内容。
- 智谱无效 key 日志不再输出 key 值。
- 本轮未修改数据库结构、未新增 API、未修改前端、未触碰成功消费日志和计费逻辑。

### 验证命令

- `go test ./common/...`：通过
- `go test ./types/...`：通过
- `go test ./service/...`：通过
- `go test ./controller/...`：通过
- `New-Item -ItemType Directory -Force .gotmp | Out-Null; $env:GOTMPDIR=(Resolve-Path .gotmp).Path; go test ./model/...`：通过
- `go test ./relay -run TestNonExistent -count=1`：通过
- `go test ./relay/common -run TestNonExistent -count=1`：通过
- `go test ./relay/channel/gemini -run TestNonExistent -count=1`：通过
- `go test ./relay/channel/zhipu -run TestNonExistent -count=1`：通过
- `git diff --check`：通过
- 额外检查 `go test ./relay/...`：未通过，失败集中在未修改的 `relay/channel/claude` 文件内容转换用例与 `relay/helper` stream scanner 用例；本轮修改未触碰这些包内实现。

### 自审结果

- 已确认用户可见错误响应不再返回原始上游密钥、Bearer/API key、渠道、上游、relay、重试链、key 指纹/提示等内部信息。
- 已确认管理员日志保留排障字段，但 message/body/prompt/file/image/key 均经过脱敏、截断或字段级替换。
- 已确认普通用户 `/api/log/self` 与 `/api/log/token` 的日志投影不返回顶层渠道/令牌 ID 字段，错误日志 `other` 只保留状态码、错误类型和错误码。
- 已确认新增测试仅使用伪造敏感样本，不依赖真实 token、密钥或外部服务。
- 已确认未修改新旧前端、数据库迁移、依赖文件、成功计费或消费结算逻辑。

### 下一步最小任务建议

- 在本地测试实例中用普通用户调用一次会失败的 relay 请求，抓取原始响应 JSON 与 `/api/log/self`，人工确认用户端完全不出现渠道、上游、relay、重试、key/token 字段名。
## 用户端任务与 Midjourney 错误安全修复记录

任务名称：修复用户端任务与 Midjourney 错误泄露
status: completed

### 修改文件

- `dto/task.go`
- `dto/midjourney.go`
- `controller/task.go`
- `controller/midjourney.go`
- `controller/relay.go`
- `controller/task_video.go`
- `model/task.go`
- `relay/relay_task.go`
- `relay/mjproxy_handler.go`
- `service/error.go`
- `service/midjourney.go`
- `service/task_polling.go`
- `service/user_visible_task.go`
- `service/user_visible_task_test.go`
- `.ai/TASK.md`

### 实现摘要

- 普通用户任务与 Midjourney 查询改用后端 DTO 投影，不再返回渠道、上游模型、relay、重试链、key/token 等内部字段。
- Midjourney relay 错误响应、submit/swap-face/image-seed、notify 写库均使用用户可见净化，用户响应不再返回 `upstream_error`。
- Midjourney 与异步任务轮询日志不再输出原始上游 body，改为脱敏摘要；任务失败原因写库前净化。
- 任务响应体入库前递归移除 key/channel/upstream/relay/retry 等内部字段，并保留用户可见结果 URL/audio URL。

### 验证命令与结果

- `gofmt -w controller/relay.go controller/task.go controller/midjourney.go controller/task_video.go dto/task.go dto/midjourney.go model/task.go relay/mjproxy_handler.go relay/relay_task.go service/error.go service/midjourney.go service/task_polling.go service/user_visible_task.go service/user_visible_task_test.go`：通过。
- `go test ./common/...`：通过。
- `go test ./types/...`：通过。
- `go test ./service/...`：通过。
- `go test ./controller/...`：通过。
- `New-Item -ItemType Directory -Force .gotmp | Out-Null; $env:GOTMPDIR=(Resolve-Path .gotmp).Path; go test ./model/...`：通过。
- `go test ./relay -count=1`：通过。
- `git diff --check`：通过。
- 额外执行 `go test ./relay/...`：未通过，失败仍集中在既有的 `relay/channel/claude` 文件内容转换用例和 `relay/helper` stream scanner 用例；本轮未修改这些包。

### 自审结果

- 已确认未修改数据库结构、未新增 API、未改前端、未触碰成功消费日志和计费结算逻辑。
- 已确认普通用户任务和 Midjourney 响应不再返回渠道 ID、上游模型、relay/重试链、key/token 字段名。
- 已确认服务器日志与任务失败原因只使用脱敏摘要或用户安全描述，不再持久化原始上游错误 body。
- 已确认新增测试只使用伪造敏感样本，不依赖真实密钥、token 或外部服务。

### 下一步最小任务建议

- 另开一轮处理 `go test ./relay/...` 中既有的 Claude 文件内容转换和 stream scanner 测试失败，避免它们继续干扰后续安全回归。

## 旧版前端 EvoLink 风格首页骨架 Stage 1 记录

任务名称：旧版前端公开首页新增 EvoLink 风格落地页静态骨架

status: blocked

### 本轮目标

- 在 `feature/frontend-redesign-gptproto` 分支上，将 `web/classic` 旧版前端公开首页默认分支改造成 EvoLink 风格的信息架构静态骨架。
- 仅抽象目标站的公告条、内部导航、Hero、热门模型、模型家族、API 场景、为什么选择、四步集成、FAQ、底部 CTA 的结构和视觉节奏。
- 保留 `home_page_content` 后台自定义首页渲染逻辑、`NoticeModal`、`/api/notice`、系统名、Logo、`docs_link`、`server_address` 和 Base URL 复制能力。
- 不复制目标站品牌、Logo、图片、原文案、数字承诺、版权信息或受保护素材；不接真实模型/价格接口；不新增依赖；不改后端、全局路由、全局布局、HeaderBar、Footer、登录/注册/控制台/价格页业务逻辑。

### 修改文件

- `web/classic/src/pages/Home/index.jsx`
- `web/classic/src/pages/Home/landingData.js`
- `web/classic/src/pages/Home/components/LandingAnnouncement.jsx`
- `web/classic/src/pages/Home/components/LandingNav.jsx`
- `web/classic/src/pages/Home/components/LandingHero.jsx`
- `web/classic/src/pages/Home/components/FeaturedModels.jsx`
- `web/classic/src/pages/Home/components/ModelFamilies.jsx`
- `web/classic/src/pages/Home/components/ApiScenarios.jsx`
- `web/classic/src/pages/Home/components/WhyChooseSection.jsx`
- `web/classic/src/pages/Home/components/IntegrationSteps.jsx`
- `web/classic/src/pages/Home/components/LandingFAQ.jsx`
- `web/classic/src/pages/Home/components/LandingBottomCTA.jsx`

### 实现摘要

- `Home/index.jsx` 继续保留 `/api/home_page_content`、markdown / iframe 自定义首页渲染、`/api/notice` 弹窗检查和 Base URL 复制逻辑；仅替换 `homePageContentLoaded && homePageContent === ''` 的默认首页分支。
- 新增 `landingData.js`，只保存静态展示数据：公告条、导航锚点、Hero 指标、热门能力卡、模型家族、API 场景、保守卖点、集成步骤和 FAQ。
- 新增首页内部组件：公告条、内部导航、Hero、热门能力、模型家族、API 场景、为什么选择、四步集成、FAQ、底部 CTA。
- 使用 Semi UI、Semi CSS 变量和 Tailwind utility；未新增全局 CSS，未修改 `index.css`、`body`、`.semi-*` 或 `.app-layout`。
- 默认首页容器使用局部 `h-screen overflow-y-auto overflow-x-hidden`，避免桌面端全局 `body overflow-y: hidden` 影响长首页滚动。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval 和 chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：未通过；失败来自既有 repo-wide Prettier 问题，包含 `dist` 构建产物和大量未触碰源码文件，本轮新增/修改的 Home 文件未出现在警告列表中。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：未通过；失败主要来自既有 `dist/assets/*.js` 缺 header 以及未触碰源码文件缺 header/空行问题，本轮新增/修改的 Home 文件未出现在错误列表中。
- `git diff --check`：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bunx prettier --check "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bunx eslint "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 自审查结论

- 当前分支已确认是 `feature/frontend-redesign-gptproto`。
- 本轮业务代码变更仅在允许范围内：`web/classic/src/pages/Home/index.jsx` 和 `web/classic/src/pages/Home/` 下新增组件/数据。
- 未新增依赖，未修改 `web/classic/package.json` 或 `web/classic/bun.lock`。
- 未修改后端 Go 文件、全局路由、全局布局、HeaderBar、Footer、登录/注册/控制台/价格页业务逻辑。
- 已保留 `home_page_content` 后台自定义首页逻辑、`NoticeModal`、`/api/notice`、系统名、Logo、`docs_link`、`server_address` 和 Base URL 复制能力。
- 首页静态文案采用保守表述，未写未经确认的稳定性百分比、节省比例、用户数量、自动故障转移、智能路由、限流规避、SOC2、GDPR、TLS 1.3 等能力承诺。
- 未复制 EvoLink 品牌、Logo、图片、原文案、数字承诺、版权信息或受保护素材。
- 移动端通过响应式网格、横向隐藏和内部导航横向滚动降低溢出风险；暗色模式使用 Semi CSS 变量降低白底黑字冲突风险。

### 已知风险或既有阻断

- `web/classic` 全量 `lint` 当前会扫描 `dist` 和大量既有未格式化源码，导致 Prettier 检查失败；本轮允许范围不包含批量修复这些文件。
- `web/classic` 全量 `eslint` 当前会扫描 `dist/assets` 构建产物并触发 header 规则，也存在若干未触碰源码的既有 header/空行问题；本轮允许范围不包含批量修复这些文件。
- 本轮未启动浏览器做截图验证，移动端和暗色模式为代码级自审。

### 提交状态

- commit：未创建；原因是项目要求的全量 `bun run lint` 和 `bun run eslint` 未通过。
- push：未执行。
## 旧版前端 EvoLink 风格首页 Stage 1.5 验证阻断收口记录

任务名称：EvoLink 风格首页开发后的全量 lint / eslint 阻断最小收口

status: blocked

### 本轮目标

- 仅处理 `web/classic` 首页 Stage 1 开发后的全量 `lint` / `eslint` 验证阻断是否可以最小收口。
- 不继续开发首页功能，不进入 Stage 2，不扩大首页改造。
- 不批量格式化全项目，不批量修复未触碰源码，不修改后端，不新增依赖，不 push。

### 状态确认

- 当前分支：`feature/frontend-redesign-gptproto`。
- 本轮开始时工作区仅包含 Stage 1 首页相关文件、`.ai/TASK.md`，以及本轮允许范围内新增的校验 ignore 文件。
- 未切回 `main` / `master` / `dev`，未 push。

### 本轮校验配置最小修复

- 新增 `web/classic/.prettierignore`，仅排除：
  - `dist/`
  - `build/`
- 新增 `web/classic/.eslintignore`，仅排除：
  - `dist/`
  - `build/`
- 允许原因：`dist/` / `build/` 属于构建产物，不应参与源码 Prettier / ESLint 基线检查；该修复没有排除 `src/`，没有排除 `src/pages/Home/**`，也没有放宽本轮首页文件专项校验。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval、chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：未通过；新增 ignore 后 `dist/` 不再出现在失败列表，但仍有 61 个既有配置/未触碰源码文件存在 Prettier 风格问题，包括 `.eslintrc.cjs`、`.prettierrc.mjs`、`src/components/**`、`src/helpers/**`、`src/hooks/**`、`src/index.css`、`src/pages/Setting/**` 等；本轮 `src/pages/Home/**` 文件未出现在失败列表中。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：未通过；新增 ignore 后 `dist/assets/*.js` 不再出现在失败列表，但仍有 12 个既有未触碰源码错误，集中在缺少/错误 header 与多余空行规则：
  - `src/components/common/ErrorBoundary.jsx`
  - `src/components/table/channels/modals/StatusCodeRiskGuardModal.jsx`
  - `src/components/table/channels/modals/statusCodeRiskGuard.js`
  - `src/components/table/model-pricing/modal/components/DynamicPricingBreakdown.jsx`
  - `src/constants/billing.constants.js`
  - `src/helpers/api.js`
  - `src/helpers/subscriptionFormat.js`
  - `src/pages/Setting/Ratio/components/AutoGroupList.jsx`
  - `src/pages/Setting/Ratio/components/GroupGroupRatioRules.jsx`
  - `src/pages/Setting/Ratio/components/GroupTable.jsx`
  - `src/pages/Setting/Ratio/components/requestRuleExpr.js`
- `git diff --check`：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bunx prettier --check "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bunx eslint "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 失败来源分类

1. 本轮修改文件：未出现在全量 `lint` / `eslint` 失败列表中；Home 专项 Prettier / ESLint 均通过。
2. `dist/`、`build/`、`assets` 构建产物：本轮新增 `.prettierignore` / `.eslintignore` 后已从失败列表中移除。
3. 未触碰源码旧文件：仍是主要阻断来源；`lint` 剩余 61 个既有格式问题，`eslint` 剩余 12 个既有 header / 空行问题。
4. 配置文件：`lint` 仍包含 `.eslintrc.cjs`、`.prettierrc.mjs` 的既有 Prettier 问题。
5. 其他：未发现本轮新增依赖、后端文件、全局路由、全局布局、HeaderBar、Footer 或价格/登录/注册/控制台业务逻辑变更。

### 自审查结论

- 当前分支符合要求：`feature/frontend-redesign-gptproto`。
- 本轮只做构建产物校验基线的最小 ignore 修复，未修改首页业务逻辑。
- 未新增依赖，未修改后端，未修改全局路由/布局/HeaderBar/Footer。
- `home_page_content`、`NoticeModal`、`/api/notice`、系统名、Logo、`docs_link`、`server_address` 和 Base URL 复制能力仍由 Stage 1 首页实现保留。
- 没有复制 EvoLink 品牌、Logo、图片、原文案、数字承诺或受保护素材。
- 因全量 `bun run lint` / `bun run eslint` 仍未通过，按项目规则不能 commit，不能标记完成。

### 是否可以 commit

- 不可以。
- 原因：项目要求全量 `bun run lint` 和 `bun run eslint` 必须通过后才允许提交；当前剩余失败来自既有未触碰源码和配置文件，不属于本轮允许的最小修复范围。

### 后续建议

- 单独开一轮治理 `web/classic` 既有 lint / eslint 技术债，范围应明确限定为现有格式/header/空行问题，并单独验证。
- 本轮已经完成构建产物 `dist/` / `build/` 的 ignore 基线修复；剩余不是 dist ignore 问题，而是未触碰源码与配置文件的既有风格问题。
## 旧版前端 EvoLink 风格首页 Stage 1.6 校验基线定点治理记录

任务名称：web/classic 前端 lint / eslint 基线定点治理

status: completed

### 本轮目标

- 仅治理 `web/classic` 当前全量 `bun run lint` / `bun run eslint` 明确报告的既有机械校验问题。
- 修复范围限定为 Prettier 格式、ESLint header 缺失/错误、多余空行。
- 不继续开发首页功能，不进入 Stage 2，不新增依赖，不修改后端，不修改业务语义，不执行全项目或整个 `src` 目录格式化。

### 本轮修复文件

- `web/classic/.eslintrc.cjs`
- `web/classic/.prettierrc.mjs`
- `web/classic/src/components/auth/LoginForm.jsx`
- `web/classic/src/components/auth/OAuth2Callback.jsx`
- `web/classic/src/components/auth/RegisterForm.jsx`
- `web/classic/src/components/common/ErrorBoundary.jsx`
- `web/classic/src/components/common/modals/RiskAcknowledgementModal.jsx`
- `web/classic/src/components/common/ui/SelectableButtonGroup.jsx`
- `web/classic/src/components/layout/headerbar/LanguageSelector.jsx`
- `web/classic/src/components/playground/MessageContent.jsx`
- `web/classic/src/components/settings/CustomOAuthSetting.jsx`
- `web/classic/src/components/settings/personal/cards/AccountManagement.jsx`
- `web/classic/src/components/settings/personal/cards/NotificationSettings.jsx`
- `web/classic/src/components/settings/personal/cards/PreferencesSettings.jsx`
- `web/classic/src/components/table/channels/modals/EditChannelModal.jsx`
- `web/classic/src/components/table/channels/modals/ModelSelectModal.jsx`
- `web/classic/src/components/table/channels/modals/ModelTestModal.jsx`
- `web/classic/src/components/table/channels/modals/ParamOverrideEditorModal.jsx`
- `web/classic/src/components/table/channels/modals/StatusCodeRiskGuardModal.jsx`
- `web/classic/src/components/table/channels/modals/statusCodeRiskGuard.js`
- `web/classic/src/components/table/model-pricing/filter/PricingDisplaySettings.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/SearchActions.jsx`
- `web/classic/src/components/table/model-pricing/modal/ModelDetailSideSheet.jsx`
- `web/classic/src/components/table/model-pricing/modal/components/DynamicPricingBreakdown.jsx`
- `web/classic/src/components/table/model-pricing/modal/components/ModelPricingTable.jsx`
- `web/classic/src/components/table/model-pricing/view/card/PricingCardView.jsx`
- `web/classic/src/components/table/redemptions/modals/EditRedemptionModal.jsx`
- `web/classic/src/components/table/task-logs/TaskLogsColumnDefs.jsx`
- `web/classic/src/components/table/task-logs/TaskLogsTable.jsx`
- `web/classic/src/components/table/task-logs/modals/AudioPreviewModal.jsx`
- `web/classic/src/components/table/tokens/modals/CopyTokensModal.jsx`
- `web/classic/src/components/table/tokens/modals/EditTokenModal.jsx`
- `web/classic/src/components/table/usage-logs/UsageLogsColumnDefs.jsx`
- `web/classic/src/components/table/usage-logs/components/ParamOverrideEntry.jsx`
- `web/classic/src/components/table/usage-logs/modals/ChannelAffinityUsageCacheModal.jsx`
- `web/classic/src/components/table/usage-logs/modals/ColumnSelectorModal.jsx`
- `web/classic/src/components/table/usage-logs/modals/ParamOverrideModal.jsx`
- `web/classic/src/components/table/users/modals/EditUserModal.jsx`
- `web/classic/src/components/topup/index.jsx`
- `web/classic/src/components/topup/modals/TopupHistoryModal.jsx`
- `web/classic/src/constants/billing.constants.js`
- `web/classic/src/helpers/api.js`
- `web/classic/src/helpers/render.jsx`
- `web/classic/src/helpers/subscriptionFormat.js`
- `web/classic/src/helpers/utils.jsx`
- `web/classic/src/hooks/common/useHeaderBar.js`
- `web/classic/src/hooks/dashboard/useDashboardCharts.jsx`
- `web/classic/src/hooks/playground/useApiRequest.jsx`
- `web/classic/src/hooks/tokens/useTokensData.jsx`
- `web/classic/src/index.css`
- `web/classic/src/pages/Setting/Chat/SettingsChats.jsx`
- `web/classic/src/pages/Setting/Model/SettingGeminiModel.jsx`
- `web/classic/src/pages/Setting/Operation/SettingsGeneral.jsx`
- `web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayWaffoPancake.jsx`
- `web/classic/src/pages/Setting/Performance/SettingsPerformance.jsx`
- `web/classic/src/pages/Setting/Ratio/GroupRatioSettings.jsx`
- `web/classic/src/pages/Setting/Ratio/ToolPriceSettings.jsx`
- `web/classic/src/pages/Setting/Ratio/components/AutoGroupList.jsx`
- `web/classic/src/pages/Setting/Ratio/components/GroupGroupRatioRules.jsx`
- `web/classic/src/pages/Setting/Ratio/components/GroupSpecialUsableRules.jsx`
- `web/classic/src/pages/Setting/Ratio/components/GroupTable.jsx`
- `web/classic/src/pages/Setting/Ratio/components/ModelPricingEditor.jsx`
- `web/classic/src/pages/Setting/Ratio/components/TieredPricingEditor.jsx`
- `web/classic/src/pages/Setting/Ratio/components/requestRuleExpr.js`
- `web/classic/src/pages/Setting/Ratio/hooks/useModelPricingEditorState.js`
- `.ai/TASK.md`

### 修复方式

- 对 `bun run lint` 明确报告的 61 个文件执行定点 `bunx prettier --write <明确文件列表>`。
- 对 `bun run eslint` 明确报告的 11 个文件执行定点 `bunx eslint --fix <明确文件列表>`，修复 header 与多余空行。
- ESLint 修复后，再对新增/修正 header 的 9 个文件执行定点 Prettier，确保全量格式检查通过。
- 未执行 `prettier --write .`，未执行 `prettier --write src`，未对整个项目或整个 `src` 目录批量格式化。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval、chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：通过。
- `git diff --check`：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bunx prettier --check "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bunx eslint "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 自审查结论

- 当前分支为 `feature/frontend-redesign-gptproto`。
- Stage 1.6 仅修复 `web/classic` 内 lint / eslint 明确报告的机械格式、header、空行问题。
- 未新增依赖，未修改 `package.json` / `bun.lock`，未修改后端 Go 文件。
- 未修改 API 协议、路由逻辑、权限逻辑、价格/模型/用户/令牌/渠道/充值业务语义。
- 未修改全局路由、全局布局、HeaderBar 或 Footer 的业务逻辑；其中 `LanguageSelector.jsx` 仅因 lint 报告做 Prettier 机械格式化。
- Stage 1 首页改造仍保留 `home_page_content`、`NoticeModal`、`/api/notice`、系统名、Logo、`docs_link`、`server_address` 与 Base URL 复制能力。
- 未复制 EvoLink 品牌、Logo、图片、原文案、数字承诺或受保护素材。
- diff 变化虽然包含若干大文件换行调整，但均来自明确失败文件的 Prettier / header / 空行机械修复；未发现业务语义变更。

### 是否允许 commit

- 允许。
- 理由：当前分支正确，`build` / `lint` / `eslint` / `git diff --check` / Home 专项 Prettier / Home 专项 ESLint 均已通过，`.ai/TASK.md` 已更新，自审查通过。

### 下一步建议

- 后续如需继续首页二开，进入 Stage 2 前先保持本提交作为校验基线；Stage 2 再接入已有公开配置/状态数据，避免与本轮机械治理混在同一提交之外继续扩大范围。

## 旧版前端 EvoLink 风格首页 Stage 2 公开数据最小接入记录

任务名称：Stage 2：公开模型与 FAQ 摘要接入

status: completed

### 本轮目标

- 保留 `home_page_content` 非空时覆盖默认首页的优先级。
- 保留 `NoticeModal` 与 `/api/notice` 弹窗逻辑。
- 不重复请求 `/api/status`，只复用 `StatusContext`。
- 首页默认 landing 分支异步请求 `/api/pricing`，只生成少量模型能力摘要给 `FeaturedModels`。
- `LandingFAQ` 优先使用 `StatusContext.status.faq`，状态 FAQ 不可用时回退静态 `landingData.faqItems`。
- 不接入 `/api/models`、`/api/user/models` 或 admin 模型接口。
- 不展示真实价格数字，不写未经确认的稳定性、节省比例或用户数量承诺。

### 本轮修改文件

- `web/classic/src/pages/Home/index.jsx`
- `web/classic/src/pages/Home/components/FeaturedModels.jsx`
- `web/classic/src/pages/Home/components/LandingFAQ.jsx`
- `.ai/TASK.md`

### 接入数据来源

- `StatusContext.status.faq`：来自既有 `/api/status` 全局状态加载，仅在 FAQ 数组非空且条目包含 `question` / `answer` 时用于首页 FAQ。
- `/api/pricing`：公开价格接口，首页只在默认 landing 分支展示时异步读取，归一化为模型摘要卡片。

### 兜底策略

- FAQ：`status.faq` 不存在、为空或结构不合法时继续使用 `landingData.faqItems`。
- 模型摘要：`/api/pricing` 请求失败、返回失败、`data` 不是数组或可用动态卡片少于 3 个时，`FeaturedModels` 继续使用 `landingData.featuredModelCards`。
- `/api/pricing` 失败路径静默处理，不弹 toast，不阻塞首屏，不影响公告弹窗和自定义首页渲染。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval 和 chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：通过。
- `$env:PATH='C:\Users\Administrator\.bun\bin;' + $env:PATH; C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：通过。
- `git diff --check`：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 自审查结论

- 当前分支为 `feature/frontend-redesign-gptproto`。
- 本轮业务代码只修改允许范围内的 Home 文件。
- 未新增依赖，未修改 `package.json` / `bun.lock`。
- 未修改后端 Go 文件。
- 未修改全局路由、全局布局、HeaderBar、Footer。
- 已保留 `home_page_content`、`NoticeModal`、`/api/notice`、系统名、Logo、`docs_link`、`server_address` 与 Base URL 复制能力。
- 未接入 `/api/models`、`/api/user/models` 或 admin 模型接口。
- `/api/pricing` 摘要失败时有静态兜底，且不展示真实价格数字。
- 未复制 EvoLink 品牌、Logo、图片、原文案、数字承诺或受保护素材。

### 已知风险

- 首页模型摘要依赖 `/api/pricing` 返回结构；当前已做防御式判断，异常时回退静态卡片。
- 动态模型名、供应商名、标签可能较长，已限制标签数量并截断描述，但仍建议后续做浏览器端移动端/暗色模式截图回归。

### 提交状态

- 验证通过，允许创建中文 commit。

## 旧版前端 EvoLink 风格首页 Stage 2.5 视觉与回归检查记录

任务名称：Stage 2.5：首页视觉、移动端、暗色模式与核心路由回归检查

status: completed

### 本轮目标

- 只做 EvoLink 风格首页 Stage 2 后的视觉、移动端、暗色模式和核心路由回归检查。
- 默认不开发新功能；发现明显小问题时，仅允许做 Home 局部最小视觉修复。
- 禁止新增依赖、禁止修改后端、禁止修改全局路由、HeaderBar、Footer、PageLayout、登录/注册/控制台/价格页业务逻辑。

### 本轮修改文件

- `web/classic/src/pages/Home/components/LandingHero.jsx`
- `.ai/TASK.md`

### 本轮修复内容

- 将 Hero 区移动端标题从默认 `text-4xl` 收敛为 `text-3xl`，并在 `sm` 以上恢复原有节奏，降低 375px 宽度下标题横向溢出风险。
- 为 Hero 右侧 API 预览卡补充 `w-full`、`max-w-full`、`min-w-0` 和 body `minWidth: 0`，改善窄屏下卡片被内容撑宽的问题。
- 将代码预览区从未注册的 Tailwind 默认色类改为局部十六进制颜色，修复代码文字对比度偏低问题。
- 未修改首页业务逻辑，未修改 pricing / FAQ 数据接入逻辑。

### 检查结果

- 首页默认 landing：可正常渲染；公告条、首页内部导航、Hero、Base URL 展示、静态 pricing 兜底模型卡、FAQ 静态兜底、底部 CTA 均保持可用。
- `home_page_content`：代码级确认仍保持非空内容覆盖默认 landing；iframe / markdown / 自定义首页分支未改；pricing 请求只在默认 landing 分支触发；NoticeModal 逻辑未替换。
- 动态数据边界：`/api/pricing` 本地 mock 失败时静默回退静态 FeaturedModels；`status.faq` 为空时回退静态 FAQ；未调用 `/api/models`、`/api/user/models` 或 admin 模型接口。
- 移动端：使用 Edge headless 截图检查 375px / 390px / 430px；Home Hero 局部已修复代码预览低对比度和窄屏布局压力。全局 HeaderBar 在 375px 下仍有既有横向裁切风险，本轮禁止修改 HeaderBar，记录为遗留风险。
- 暗色模式：Home 主要背景、卡片、文字、按钮使用 Semi CSS 变量；代码预览使用深色背景配亮色文字。headless 截图未成功切换应用暗色状态，暗色模式本轮以代码级检查为主。
- 核心路由：本地 Vite 下 `/`、`/login`、`/register`、`/console`、`/pricing`、`/console/models`、`/console/token` 均返回 SPA 入口；受登录态保护的控制台路由仍按原路由守卫处理。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval、chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：通过。
- `git diff --check`：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 自审查结论

- 当前分支为 `feature/frontend-redesign-gptproto`。
- 本轮仅修改允许范围内的 Home 局部组件和 `.ai/TASK.md`。
- 未新增依赖，未修改 `package.json` / `bun.lock`。
- 未修改后端 Go 文件。
- 未修改全局路由、全局布局、HeaderBar、Footer、登录、注册、控制台或价格页业务逻辑。
- 保留 `home_page_content`、NoticeModal、`/api/notice`、系统名、Logo、`docs_link`、`server_address` 和 Base URL 展示/复制能力。
- 未复制 EvoLink 品牌、Logo、图片、原文案、数字承诺或受保护素材。

### 已知风险

- 375px 下全局 HeaderBar 仍可能出现横向裁切或导航项挤压；该问题属于全局 HeaderBar 既有移动端表现，本轮禁止修改，建议后续单独治理。
- 暗色模式未完成交互式截图级验证；本轮已做代码级变量与对比度检查，建议后续用真实浏览器手动切换主题复查完整页面。

### 提交状态

- 验证通过，允许创建中文 commit：`前端：首页移动端与暗色模式回归优化`。

## 旧版前端首页顶部导航整合记录

任务名称：首页顶部导航整合为全局 HeaderBar 单导航

status: completed

### 本轮目标

- 将首页默认 landing 顶部导航收敛为一条全局 HeaderBar。
- 复用现有 HeaderBar 的通知、主题、语言、登录/注册或用户菜单能力。
- 首页不再渲染 LandingNav，避免全局导航与首页内导航重复。
- 保持整体视觉简约、居中、干净；不新增依赖、不改后端、不改全局路由、不改 Footer。

### 本轮修改文件

- `web/classic/src/components/layout/headerbar/index.jsx`
- `web/classic/src/components/layout/headerbar/HeaderLogo.jsx`
- `web/classic/src/pages/Home/index.jsx`
- `.ai/TASK.md`

### 实现摘要

- `HeaderBar` 根据当前路由判断 `/` 首页，在首页使用更克制的半透明背景、底部分割线、居中 `max-w-7xl` 容器和紧凑响应式布局。
- `HeaderLogo` 增加可选 `showSubtitle`，仅首页桌面端显示副标题“API 中转与模型管理入口”。
- `Home/index.jsx` 默认 landing 分支移除 `LandingNav` 渲染，保留公告条、Hero、模型区、FAQ、底部 CTA，以及 `home_page_content` 非空覆盖逻辑。
- 未改 `ActionButtons`、通知、主题、语言、用户入口行为。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval、chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：通过。
- `git diff --check`：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/pages/Home/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 自审查结论

- 当前分支为 `feature/frontend-redesign-gptproto`。
- 本轮仅修改 HeaderBar 首页展示、HeaderLogo 可选副标题、Home 默认 landing 分支和 `.ai/TASK.md`。
- 未新增依赖，未修改 `package.json` / `bun.lock`。
- 未修改后端 Go 文件。
- 未修改全局路由、PageLayout、Footer、登录、注册、控制台或价格页业务逻辑。
- 保留 `home_page_content` 非空覆盖默认首页逻辑、NoticeModal、`/api/notice`、系统名、Logo、`docs_link`、`server_address` 和 Base URL 展示/复制能力。
- 首页 `/` 默认 landing 只保留一条顶部导航，通知、主题、语言和用户入口继续复用全局 HeaderBar。

### 已知风险

- 首页移动端 Header 中间导航采用横向滚动/压缩的最小改动策略，极窄屏仍建议人工复查图标按钮密度。
- 本轮没有删除 `LandingNav.jsx` 文件，只是不再渲染，便于降低删除风险。

### 提交状态

- 验证通过，允许创建中文 commit：`前端：首页整合顶部导航栏`。

## 旧版前端模型广场 Stage 3.1 页面结构改造记录

任务名称：Stage 3.1：EvoLink 风格模型广场页面结构改造

status: completed

### 本轮目标

- 将现有公开 `/pricing` 从偏后台价格工具页调整为公开“模型广场 / 模型库”页面结构。
- 只抽象 EvoLink 模型页的信息架构、视觉节奏和模块布局，不复制品牌、Logo、图片、原文案、具体价格、折扣数字或受保护素材。
- 保留现有 `/api/pricing` 数据加载、搜索、筛选、分页、详情抽屉、卡片/表格视图能力。
- 不新增 `/models` 路由，不修改 `/console/models`，不改后端、全局路由、HeaderBar、Footer、Home、登录/注册/控制台业务页。

### 本轮修改文件

- `web/classic/src/components/table/model-pricing/layout/PricingPage.jsx`
- `web/classic/src/components/table/model-pricing/layout/content/PricingContent.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/PricingTopSection.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/PricingMarketplaceHero.jsx`
- `web/classic/src/components/table/model-pricing/view/card/PricingCardView.jsx`
- `web/classic/src/index.css`
- `.ai/TASK.md`

### 实现摘要

- 新增 `PricingMarketplaceHero`，在 `/pricing` 顶部展示“模型广场”标题区、保守副标题、模型数量、当前结果、供应商数量、能力类型数量和只读能力摘要 chips。
- `PricingTopSection` 改为“模型库标题区 + 搜索操作卡片 + 移动端筛选弹窗”，保留原有搜索、筛选入口、视图切换、计费显示开关、token 单位切换等能力。
- `PricingCardView` 调整为更偏公开模型库的卡片结构：能力类型、供应商、模型名、描述、tags、保守计费提示、查看详情入口。
- 继续保留卡片点击打开详情 SideSheet、复制模型名、选择框、分页、loading skeleton 和空状态。
- `index.css` 仅追加 `pricing-marketplace-*` 局部样式，使用 Semi CSS 变量适配明暗主题。

### 数据与能力复用

- 继续复用 `/api/pricing`，未修改接口语义。
- 继续复用 `useModelPricingData`，未新增数据 Hook。
- 未调用 `/api/models`、`/api/user/models` 或 admin 模型接口。
- 保留现有 `PricingSidebar`、`PricingFilterModal`、`ModelDetailSideSheet`、`PricingTable` 和分页逻辑。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval、chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：通过。
- `git diff --check`：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/components/table/model-pricing/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/components/table/model-pricing/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 自审查结论

- 当前分支为 `feature/frontend-redesign-gptproto`。
- 本轮只修改允许范围内的 model-pricing 局部组件、`index.css` 局部样式和 `.ai/TASK.md`。
- 未新增依赖，未修改 `package.json` / `bun.lock`。
- 未修改后端 Go 文件。
- 未新增 `/models` 路由，未修改 `App.jsx`、`PageLayout.jsx`、HeaderBar、Footer、Home。
- 未修改 `/console/models`、登录、注册或控制台业务逻辑。
- 未破坏 `/pricing` 原有 `/api/pricing` 数据加载、搜索、筛选、分页、详情抽屉、卡片/表格视图切换。
- 未展示未经确认的价格、折扣、稳定性、用户数量、节省比例或合规承诺。
- 未复制 EvoLink 品牌、Logo、图片、原文案或受保护素材。

### 已知风险

- 模型能力类型根据模型名、供应商、标签和端点类型做保守推导，只用于摘要展示和卡片标签，不作为强筛选条件。
- 桌面/移动端视觉已按代码和样式做防溢出处理，但仍建议后续 Stage 3.4 进行真实浏览器截图回归。
- 表格视图本轮未重做，保持原有价格表能力，后续如需统一公开模型库视觉可单独优化。

### 提交状态

- 验证通过，允许创建中文 commit：`前端：模型广场改造为公开模型库结构`。

## 旧版前端模型广场 Stage 3.2 筛选与排序增强记录

任务名称：Stage 3.2：模型广场筛选与排序增强

status: completed

### 本轮目标

- 在现有公开 `/pricing` 模型广场中增强前端筛选与排序。
- 新增模型类型筛选：文本、图像、视频、音频、编码、通用。
- 新增排序：热门、名称、供应商、类型；默认热门保留既有展示顺序。
- 新增筛选摘要 chips、一键清空筛选和卡片视图空状态清空入口。
- 移动端筛选弹窗同步模型类型筛选。
- 保留 `/api/pricing`、`useModelPricingData`、现有搜索、供应商/分组/endpoint/tag/billing 筛选、分页、详情 SideSheet、卡片/表格视图切换。

### 本轮修改文件

- `web/classic/src/components/table/model-pricing/filter/PricingModelTypes.jsx`
- `web/classic/src/components/table/model-pricing/utils/modelType.js`
- `web/classic/src/hooks/model-pricing/useModelPricingData.jsx`
- `web/classic/src/hooks/model-pricing/usePricingFilterCounts.js`
- `web/classic/src/components/table/model-pricing/layout/PricingSidebar.jsx`
- `web/classic/src/components/table/model-pricing/modal/components/FilterModalContent.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/SearchActions.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/PricingTopSection.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/PricingMarketplaceHero.jsx`
- `web/classic/src/components/table/model-pricing/view/card/PricingCardView.jsx`
- `web/classic/src/components/table/model-pricing/modal/PricingFilterModal.jsx`
- `web/classic/src/helpers/utils.jsx`
- `web/classic/src/index.css`
- `.ai/TASK.md`

### 实现摘要

- 新增 `modelType.js`，仅提供前端展示与筛选用的保守模型类型推导，不写回后端、不改变 `/api/pricing` 数据结构。
- `useModelPricingData` 增加 `filterModelType` 与 `sortBy`，在既有筛选之后、分页之前完成模型类型过滤和排序。
- 新增 `PricingModelTypes`，桌面侧栏与移动端筛选弹窗共用同一筛选状态和计数。
- `usePricingFilterCounts` 增加模型类型计数，并避免当前类型筛选影响自身计数。
- `SearchActions` 增加排序下拉，保留搜索、复制、视图切换、倍率和单位切换能力。
- `PricingTopSection` 增加筛选摘要 chips 与清空筛选入口。
- `PricingCardView` 复用模型类型 helper 展示能力标签，并在空状态提供清空筛选入口。
- `PricingMarketplaceHero` 复用同一 helper 计算能力摘要，避免多套推导逻辑漂移。
- `index.css` 仅追加 `pricing-marketplace-*` 局部样式。

### 验证命令与结果

- `C:\Users\Administrator\.bun\bin\bun.exe run build`（目录 `web/classic`）：通过；仅有既有 Browserslist 过期、`lottie-web` eval、chunk size 警告。
- `C:\Users\Administrator\.bun\bin\bun.exe run lint`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bun.exe run eslint`（目录 `web/classic`）：通过。
- `git diff --check`：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/components/table/model-pricing/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"`（目录 `web/classic`）：通过。
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/components/table/model-pricing/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"`（目录 `web/classic`）：通过。

### 人工回归结果

- 代码级确认搜索、供应商筛选、group 筛选、endpoint 筛选、tag 筛选、billing/quota 筛选仍在 `useModelPricingData` 中保留并叠加新类型筛选。
- 代码级确认新增模型类型筛选、排序、筛选摘要 chips、一键清空筛选、卡片空状态清空入口可通过同一筛选状态工作。
- 代码级确认分页仍由 `filteredModels` 驱动，排序在分页前完成。
- 代码级确认卡片/表格切换和详情 SideSheet 仍复用原有数据流。
- 代码级确认移动端筛选弹窗通过 `sidebarProps` 复用同一 `filterModelType` 状态。
- 暗色模式基本可读性使用 Semi CSS 变量与既有局部样式，未覆盖全局 `.semi-*`。

### 自审查结论

- 当前分支为 `feature/frontend-redesign-gptproto`。
- 本轮只修改允许范围内的 model-pricing 局部组件、`useModelPricingData`、`usePricingFilterCounts`、`helpers/utils.jsx` 最小扩展、`index.css` 局部样式和 `.ai/TASK.md`。
- 未新增依赖，未修改 `package.json` / `bun.lock`。
- 未修改后端 Go 文件，未修改 `/api/pricing` 返回结构。
- 未新增路由，未修改 HeaderBar、Footer、Home、登录、注册或控制台业务页。
- 未调用 `/api/models`、`/api/user/models` 或 admin 模型接口。
- 未重写 `useModelPricingData`，仅在既有筛选结果中最小叠加模型类型与排序。
- 默认 `popular` 排序保留原有展示顺序。
- 模型类型推导只用于前端展示/筛选，不代表模型真实能力。
- 未复制 EvoLink 原文案、品牌、图片或素材，未写未经确认的模型能力承诺。

### 已知风险

- 模型类型来自前端保守推导，可能无法完全覆盖站点自定义模型命名；未识别项会归入“通用”。
- 本轮以代码级回归和构建校验为主，真实浏览器移动端与暗色模式截图建议在 Stage 3.4 继续复查。

### 提交状态

- 验证通过，允许创建中文 commit：`前端：模型广场新增类型筛选与排序`。
## Stage 3.R: marketplace and navigation visual rebuild

Task: Stage 3.R marketplace and navigation visual rebuild

status: completed

### Goals

- Rebuild public `/pricing` toward the supplied `.ai/references/` model-page visual structure: centered spacious hero, one main search box, sticky left filters, right-side model card grid.
- Simplify HeaderBar navigation to Console / Marketplace / Docs, with Logo and system name as the home entry.
- Keep `/pricing` on `/api/pricing` and `useModelPricingData`; preserve search, filters, sorting, pagination, detail SideSheet, and card/table switching.
- Do not add `/models`, do not change backend, dependencies, Footer, PageLayout, App.jsx, Home, login/register, or console business pages.

### Changed Files

- `web/classic/src/components/layout/headerbar/index.jsx`
- `web/classic/src/components/layout/headerbar/HeaderLogo.jsx`
- `web/classic/src/components/layout/headerbar/Navigation.jsx`
- `web/classic/src/components/table/model-pricing/layout/PricingPage.jsx`
- `web/classic/src/components/table/model-pricing/layout/content/PricingContent.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/PricingMarketplaceHero.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/PricingTopSection.jsx`
- `web/classic/src/components/table/model-pricing/layout/header/SearchActions.jsx`
- `web/classic/src/components/table/model-pricing/layout/PricingSidebar.jsx`
- `web/classic/src/components/table/model-pricing/modal/components/FilterModalContent.jsx`
- `web/classic/src/components/table/model-pricing/view/card/PricingCardSkeleton.jsx`
- `web/classic/src/components/table/model-pricing/view/card/PricingCardView.jsx`
- `web/classic/src/index.css`
- `.ai/TASK.md`

### Navigation Result

- HeaderBar center nav now renders only Console, Marketplace, and Docs.
- Header logo/system name remains clickable to `/`, with desktop subtitle retained.
- `Navigation.jsx` adds route-aware active pill styling for `/pricing` and `/console/*`.
- ActionButtons behavior for notice, theme, language, login/register, and user menu was not changed.

### Marketplace Result

- `/pricing` now uses a natural page flow instead of an internal full-height Sider/Layout scroll surface.
- Hero now has a large centered title, subtitle, and the single primary search input wired to existing search state.
- Body layout is sticky left filter panel plus right result area; model type and provider filters are first, while group/endpoint/tag/billing filters are retained.
- Result toolbar shows result count and existing controls, including sorting and view/table controls.
- Card view now has CSS-generated cover art, capability badge, provider, model name, description, tags, conservative billing copy, and detail entry.
- No external images were added; no EvoLink brand, logo, image, original copy, price number, or discount number was copied.

### Data And Feature Reuse

- Reused `/api/pricing`.
- Reused `useModelPricingData`.
- Did not call `/api/models`, `/api/user/models`, or admin model APIs.
- Preserved search, model type filter, provider filter, group/endpoint/tag/billing filters, sorting, pagination, detail SideSheet, and card/table switching.

### Verification

- `C:\Users\Administrator\.bun\bin\bun.exe run build` in `web/classic`: passed, with existing Browserslist, lottie eval, and chunk-size warnings only.
- `C:\Users\Administrator\.bun\bin\bun.exe run lint` in `web/classic`: passed.
- `bun run eslint` initially failed because this PowerShell PATH lacked `bunx`; after prepending `$env:USERPROFILE\.bun\bin`, `C:\Users\Administrator\.bun\bin\bun.exe run eslint` passed.
- `git diff --check`: passed.
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/components/table/model-pricing/**/*.{js,jsx}" "src/components/layout/headerbar/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"`: passed.
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/components/table/model-pricing/**/*.{js,jsx}" "src/components/layout/headerbar/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"`: passed.

### Manual Regression

- Code-level check: Logo/title returns to `/` through `HeaderLogo` `Link to='/'`.
- Code-level check: `/pricing` activates Marketplace; `/console` and `/console/*` activate Console.
- Code-level check: Docs still uses existing `docs_link` external-link logic.
- Code-level check: right-side notice/theme/language/user entry still comes from `ActionButtons`.
- Code-level check: marketplace Hero has one main search input bound to `searchValue` / `handleChange`.
- Code-level check: left filters use CSS sticky; model type and provider filters work through existing state; other filters remain mounted.
- Code-level check: sorting, pagination, detail SideSheet, and card/table switching still use existing state/components.
- Code-level check: mobile filtering still uses `PricingFilterModal` and shared sidebar props.
- Code-level check: dark mode uses Semi CSS variables and darkens generated cover patterns.

### Self Review

- Branch confirmed as `feature/frontend-redesign-gptproto`.
- Modified only allowed HeaderBar, model-pricing local components, scoped `index.css`, and `.ai/TASK.md`.
- No dependency changes; `package.json` and `bun.lock` untouched.
- No backend files changed; `/api/pricing` structure and real billing logic untouched.
- No `/models` route added; `App.jsx`, `PageLayout.jsx`, `Footer.jsx`, Home, login/register, and console business pages untouched.
- `.ai/references/` was used only as read-only reference material and was not staged.

### Known Risks

- This round used code-level and local build verification, not pixel-level browser screenshot review.
- Model card covers are CSS-generated placeholders, not real model images.
- The classic frontend repository already contains historical mojibake in some task/code text; this entry is kept ASCII to avoid adding another encoding issue.

### Commit Status

- Verification passed; allowed commit message: `front-end: rebuild marketplace and navigation visual` equivalent Chinese commit `前端：重构模型广场与导航视觉`.

## Stage 3.R.1: marketplace filter and card cover visual tuning

Task: Stage 3.R.1 model marketplace left filter and card cover visual tuning

status: completed

### Goals

- Make the `/pricing` left filter closer to the supplied EvoLink models reference: compact white panels, checkbox-style rows, count badges, and lighter reset affordance.
- Prepare model cards for future real cover images while keeping local CSS fallback art when no safe image field is available.
- Keep this as a visual-only round: no backend, no dependency, no route, no HeaderBar/Footer/Home/App/PageLayout changes, and no pricing data or billing logic changes.

### Changed Files

- `web/classic/src/components/table/model-pricing/filter/PricingModelTypes.jsx`
- `web/classic/src/components/table/model-pricing/filter/PricingVendors.jsx`
- `web/classic/src/components/table/model-pricing/layout/PricingSidebar.jsx`
- `web/classic/src/components/table/model-pricing/modal/components/FilterModalContent.jsx`
- `web/classic/src/components/table/model-pricing/view/card/PricingCardSkeleton.jsx`
- `web/classic/src/components/table/model-pricing/view/card/PricingCardView.jsx`
- `web/classic/src/index.css`
- `.ai/TASK.md`

### Implementation Summary

- Replaced the button-heavy model type filter with a local checkbox-style filter panel using label + count badge rows.
- Added compact Provider panel support using the same visual system; desktop Provider defaults collapsed, mobile Provider defaults open.
- Kept group, quota, tag, and endpoint filters, but moved them into a quieter More Filters section on desktop. If an advanced filter is active, the section opens automatically.
- Updated mobile filter modal content so model type and Provider use the same simplified panels, while existing display and advanced filters remain available.
- Added defensive model card cover source detection for `cover`, `coverImage`, `cover_image`, `image`, `imageUrl`, `image_url`, `thumbnail`, `thumbnailUrl`, `thumbnail_url`, `avatar`, `avatarUrl`, `avatar_url`, `icon`, and `vendor_icon` when they look like usable image URLs or image data.
- Added lazy cover image rendering with `object-fit: cover`; failed image loads fall back to the existing local CSS placeholder art.
- Adjusted card skeleton and scoped `pricing-marketplace-*` styles for 16:9 cover media, compact filter panels, scrollable provider options, mobile modal spacing, and dark mode readability.

### Verification Results

- `C:\Users\Administrator\.bun\bin\bun.exe run build` in `web/classic`: passed, with existing Browserslist, lottie eval, and chunk-size warnings only.
- `C:\Users\Administrator\.bun\bin\bun.exe run lint` in `web/classic`: passed.
- `$env:PATH="$env:USERPROFILE\.bun\bin;$env:PATH"; C:\Users\Administrator\.bun\bin\bun.exe run eslint` in `web/classic`: passed.
- `git diff --check`: passed.
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/components/table/model-pricing/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"` in `web/classic`: pending final run.
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/components/table/model-pricing/**/*.{js,jsx}" "src/pages/Pricing/**/*.{js,jsx}"` in `web/classic`: pending final run.

### Manual Regression

- Code-level check: search state and hero search were not changed.
- Code-level check: model type and Provider filters still call the same setters and share the same counts from `usePricingFilterCounts`.
- Code-level check: group, quota, tag, and endpoint filters remain mounted under More Filters and keep existing state setters.
- Code-level check: reset still calls `resetPricingFilters` and clears existing filters/sort/page state.
- Code-level check: sticky sidebar container and mobile filter modal wiring were preserved.
- Code-level check: sorting, pagination, card/table switching, and detail SideSheet were not changed.
- Code-level check: card cover images use safe detected fields only; no external EvoLink images or assets were added.
- Code-level check: image load failure falls back to local CSS cover placeholder.
- Code-level check: dark mode uses Semi CSS variables plus scoped dark selectors.

### Self Review

- Branch remained `feature/frontend-redesign-gptproto`.
- Modified only allowed model-pricing components, scoped `index.css`, and `.ai/TASK.md`.
- `.ai/references/` stayed untracked and was not staged.
- No backend files changed; `/api/pricing` structure and real billing logic untouched.
- No dependency files changed; `package.json` and `bun.lock` untouched.
- No HeaderBar, Footer, Home, App.jsx, PageLayout.jsx, login/register, console business pages, or `/models` route changes.
- Search, filtering, sorting, pagination, detail SideSheet, and card/table switching remain wired through existing state and components.
- No EvoLink brand, logo, images, original copy, price numbers, or discount numbers were copied.

### Known Risks

- Verification is code-level/build-level; no browser screenshot pass was performed in this round.
- Future real cover image field naming may differ from the defensive list; unsupported field names will still fall back safely to CSS placeholder.

## Stage Home.1: homepage first-screen height and responsive fit

Task: Stage Home.1 homepage first-screen height and responsive adaptation

status: completed

### Goals

- Keep the `/` homepage first viewport clean so the next section title/content does not peek into the initial screen.
- Make the first-screen height responsive across common desktop ratios without hardcoding one machine-specific pixel height.
- Preserve existing Home data flow: `home_page_content`, `NoticeModal`, Base URL copy, CTA routing, API preview, and subsequent landing sections.
- Do not change marketplace, backend, routes, HeaderBar behavior, Footer, PageLayout, dependencies, or billing logic.

### User Feedback

- The homepage Hero was visually acceptable, but the bottom of the initial viewport exposed the next "popular capability" section on some screen ratios.
- The Hero should occupy the first viewport and let the next section appear after the user scrolls.

### Changed Files

- `web/classic/src/pages/Home/index.jsx`
- `web/classic/src/pages/Home/components/LandingHero.jsx`
- `web/classic/src/index.css`
- `.ai/TASK.md`

### Implementation Summary

- Wrapped `LandingAnnouncement` and `LandingHero` in a local `landing-first-screen` section inside the default landing branch.
- Added local `landing-home-shell`, `landing-first-screen`, `landing-hero-section`, and `landing-hero-grid` styles.
- Used `100svh` / `100dvh` and `calc(100dvh - 4rem)` so the first-screen block fills the viewport area beneath the 64px header spacing.
- Used `clamp()` for Hero vertical padding and a short-screen desktop media query to keep the Hero compact without fixed one-off screen heights.
- Added mobile overrides so the shell can use natural page height and avoid excessive empty space while preserving the first-screen minimum.

### Verification Results

- `bun run build`: initial `bun` command unavailable in this PowerShell PATH; reran with `C:\Users\Administrator\.bun\bin\bun.exe run build` in `web/classic`: passed, with existing Browserslist, lottie eval, and chunk-size warnings only.
- `C:\Users\Administrator\.bun\bin\bun.exe run lint` in `web/classic`: passed.
- `C:\Users\Administrator\.bun\bin\bun.exe run eslint` initially failed because the script calls `bunx` and this shell PATH lacked Bun bin; after prepending `$env:USERPROFILE\.bun\bin`, the same eslint script passed.
- `git diff --check`: passed before task-log update; final run will be executed before commit.
- `C:\Users\Administrator\.bun\bin\bunx.exe prettier --check "src/pages/Home/**/*.{js,jsx}" "src/components/layout/headerbar/**/*.{js,jsx}"`: passed.
- `C:\Users\Administrator\.bun\bin\bunx.exe eslint "src/pages/Home/**/*.{js,jsx}" "src/components/layout/headerbar/**/*.{js,jsx}"`: passed.

### Manual Regression

- Code-level check: `/` default landing branch keeps `home_page_content` priority logic unchanged.
- Code-level check: `NoticeModal`, `/api/notice`, Base URL copy, endpoint rotation, CTA routes, and API preview props were not changed.
- Code-level check: first-screen height is driven by viewport units, so 1366x768, 1440x900, 1536x864, and 1920x1080 enter with the next section positioned after the first-screen block.
- Code-level check: shorter desktop heights use reduced Hero padding instead of clipping content.
- Code-level check: mobile shell switches to natural height with responsive first-screen minimum to avoid a large forced blank area.
- Code-level check: dark mode continues to rely on existing Semi CSS variables; no global body, HeaderBar, Footer, PageLayout, or marketplace styles were changed.

### Self Review

- Branch remained `feature/frontend-redesign-gptproto`.
- Modified only allowed Home files, scoped `landing-*` CSS in `index.css`, and `.ai/TASK.md`.
- No dependency, backend, route, marketplace, pricing, billing, App.jsx, PageLayout.jsx, Footer, login/register, or console business changes.
- `home_page_content`, `NoticeModal`, Base URL copy, CTA routing, and downstream landing sections were preserved.
- The next section is not hidden; it remains in normal flow after the first-screen section and appears by scrolling.

### Known Risks

- This round used code/build-level verification rather than pixel screenshot validation in a real browser.
- The exact first-viewport feel can still vary if the deployed HeaderBar height or browser UI differs from the 64px header spacing used by the existing layout.
