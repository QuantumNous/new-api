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
