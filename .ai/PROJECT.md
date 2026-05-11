# new-api 邀请消费返利二开项目

## 项目目标

实现一级邀请消费返利功能：

用户 A 邀请新用户 B。
B 产生实际消费后，不是充值后，按照后台配置比例给 A 返利。
示例：B 实际消费 10 元，后台返利比例为 10%，A 获得 1 元返利。

## 技术栈

- Backend: Go 1.22+、Gin、GORM v2。
- Database: SQLite、MySQL、PostgreSQL，所有新增设计必须同时兼容三种数据库。
- Cache: Redis、内存缓存。
- Auth: JWT、WebAuthn/Passkeys、OAuth。
- Frontend: React 19、TypeScript、Rsbuild、Base UI、Tailwind CSS。
- Frontend package manager: Bun。

## 固定边界

- 最小改动。
- 最小风险。
- 不做重构。
- 不做全文件格式化。
- 不改 API 协议除非确认必要。
- 不破坏现有邀请、充值、消费、quota、billing、relay、settlement 逻辑。
- 数据库必须兼容 SQLite、MySQL、PostgreSQL。
- 不修改 new-api / QuantumNous 相关标识。
- 每轮编码结束后必须自动自审查，用户不需要每轮重复提醒。
- 每轮产生文件变更并验证通过后，必须提交中文 commit。
- 验证失败不得提交。
- `.agents/skills` 默认只读参考。
- 本次邀请返利后端开发默认不依赖 `.agents/skills`。
- 未经明确授权，不得执行会联网、写文件、修改配置、创建 token、调用远程 New API 实例的 skill 命令。
- 不得创建、修改、复制、注入或输出 token / access token / sk- key / bearer token。

## 当前只读结论

- 邀请关系相关文件：`model/user.go`、`common/constants.go`、`model/option.go`、`controller/user.go`、`controller/oauth.go`、`controller/github.go`、`controller/linuxdo.go`、`router/api-router.go`、`web/default/src/features/auth/sign-up/components/sign-up-form.tsx`、`web/default/src/features/auth/lib/storage.ts`、`web/default/src/lib/oauth.ts`、`web/default/src/features/wallet/*`。
- 邀请关系关键函数：`model.GetUserIdByAffCode`、`model.inviteUser`、`(*model.User).Insert`、`(*model.User).InsertWithTx`、`(*model.User).FinalizeOAuthUserCreation`、`(*model.User).TransferAffQuotaToQuota`、`controller.Register`、`controller.GenerateOAuthCode`、`controller.GetAffCode`、`controller.TransferAffQuota`。
- 现有邀请奖励是注册奖励：`QuotaForInvitee` 给被邀请人，`QuotaForInviter` 累加邀请人的 `aff_quota` / `aff_history_quota` / `aff_count`；这不是消费返利，后续不能复用充值或注册成功作为返利触发点。
- 实际消费扣费链路相关文件：`controller/relay.go`、`relay/*_handler.go`、`service/billing.go`、`service/billing_session.go`、`service/text_quota.go`、`service/quota.go`、`service/task_billing.go`、`service/task_polling.go`、`relay/mjproxy_handler.go`、`controller/midjourney.go`。
- 实际消费关键函数：`service.PreConsumeBilling`、`service.SettleBilling`、`(*service.BillingSession).Settle`、`(*service.BillingSession).Refund`、`service.PostTextConsumeQuota`、`service.PostAudioConsumeQuota`、`service.PostWssConsumeQuota`、`service.PostConsumeQuota`、`service.LogTaskConsumption`、`service.RefundTaskQuota`、`service.RecalculateTaskQuota`、`service.RecalculateTaskQuotaByTokens`。
- quota / billing / settlement 相关文件：`model/user.go`、`model/log.go`、`model/topup.go`、`model/subscription.go`、`model/main.go`、`service/funding_source.go`、`service/pre_consume_quota.go`、`setting/billing_setting/tiered_billing.go`、`pkg/billingexpr/expr.md`。
- 用户余额字段在 `model.User.Quota`，累计消费在 `model.User.UsedQuota`，邀请奖励池在 `model.User.AffQuota` 和 `model.User.AffHistoryQuota`。
- 现有流水主要是 `model.Log`，消费日志由 `model.RecordConsumeLog` / `model.RecordTaskBillingLog` 写入；充值记录有 `model.TopUp`，不适合作为消费返利记录。
- `LOG_DB` 可能通过 `LOG_SQL_DSN` 独立于主库，返利幂等和可追踪记录不能只依赖日志库。
- 后台设置相关文件：`model/option.go`、`controller/option.go`、`router/api-router.go`、`web/default/src/features/system-settings/api.ts`、`web/default/src/features/system-settings/billing/section-registry.tsx`、`web/default/src/features/system-settings/general/quota-settings-section.tsx`、`web/default/src/features/system-settings/types.ts`。
- 当前最可信返利触发点：同步请求在实际 quota 计算完成、`service.SettleBilling(...)` 成功返回、且 `actualQuota > 0` 之后；第一版建议由 `service.PostTextConsumeQuota`、`service.PostAudioConsumeQuota`、`service.PostWssConsumeQuota` 这些最终消费落点显式调用返利服务。
- 当前最大风险点：幂等 source key 设计、异步任务最终失败退款、Midjourney 提交成功后失败退款、`SettleBilling` 同时服务同步和任务路径、以及 `LOG_DB` 与主库分离。
- 推荐数据结构：新增主库表 `invitation_rebate_records`，字段包含 `id`、`inviter_user_id`、`invitee_user_id`、`source_type`、`source_key`、`source_request_id`、`source_quota`、`rebate_quota`、`rebate_ratio_bps`、`status`、`created_at`、`updated_at`；对 `(source_type, source_key)` 建唯一约束，`source_key` 必须非空。
- 第一版最小实现范围：只做一级邀请、只支持同步消费结算成功后的返利、配置启用开关/返利比例 bps/最小触发 quota、返利进入邀请人的 `aff_quota` 和 `aff_history_quota`、同一事务内创建返利记录并更新邀请人奖励池。
- 第一版不接入：充值、兑换码、注册奖励、TopUp、异步任务轮询、Midjourney 旧异步路径、失败退款路径、前端复杂流水展示。

## 推荐分阶段路线

- 阶段 0：文档初始化与边界固化。
- 阶段 1：后端数据结构与配置读取。
- 阶段 2：同步消费结算成功后挂接返利服务，并保证幂等。
- 阶段 3：后台配置返利比例。
- 阶段 4：返利流水查询与展示。
- 阶段 5：测试与回归。

## 用户端邀请返现日志

- 当前阶段只实现旧版前端 `web/classic`，位置为用户端 `/console/topup` 的“邀请奖励”卡片下方日志区域；不接入新版前端 `web/default`。
- 后端新增普通用户只读查询接口，必须挂在 `UserAuth` 下，只允许查询当前登录用户作为邀请人的邀请关系、返利流水和返利详情。
- 单个被邀请用户的“返利余额”统计口径为该被邀请用户贡献的累计返利 `total_rebate_quota`，不是按划转来源拆分后的剩余额。
- 总返利余额 = 当前用户 `aff_history_quota`；待使用收益 = 当前用户 `aff_quota`；已转化余额 = `max(aff_history_quota - aff_quota, 0)`。
- 当前没有按被邀请用户记录邀请收益划转来源，因此第一版不做“每个被邀请用户已转化余额”的精确分摊。
- 用户端不得返回 email、access token、OAuth ID、用户余额、备注、完整 source key 等敏感字段。
- 本阶段不新增数据库表，不修改返利计算、消费挂接、充值、注册 / OAuth、异步任务、Midjourney，不新增补发、删除、导出、普通用户手动操作或多级邀请。
