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
