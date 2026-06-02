# 手机号/SMS 旧 fork 只读审查

更新日期：2026-06-02

## 审查范围

- 当前仓库：`/home/rain/projects/new-api-rain021217`
- 旧 fork 只读参考：`/home/rain/projects/new-api-liu23zhi`
- 目标：确认官方基线是否已有手机号/SMS 能力，审查旧 fork 的可复用点和不可直接迁移点，为 Phase 5A 后续实现定边界。

## 当前官方基线结论

- 当前仓库未发现 `common/sms.go`、`model.User.Phone`、`PhoneLogin`、`SendSMSVerification`、`/api/sms/verification`、`/api/user/login/phone` 等手机号/SMS 登录注册能力。
- 当前仓库已有通用邮箱验证码、secure verification、Turnstile、前端 mobile 响应式组件，但这些不是手机号/SMS 能力。
- 因此 Phase 5A 如继续实现，不能假设已有官方手机号入口；需要新增独立能力，并接入 Phase 5 的统一 invite context。

## 旧 fork 可参考点

- `common/sms.go`：包含手机号规范化、短信宝发送 URL 构造、短信宝返回码映射和发送入口。
- `common/verification.go`：增加 `phone_register`、`phone_login`、`phone_change` 三类验证码 purpose。
- `controller/misc.go`：`SendSMSVerification` 支持注册、登录、换绑场景；发送前检查手机号格式、注册重复、登录绑定状态。
- `controller/user.go`：包含 `PhoneLogin`、注册时手机号验证码校验、`SendSelfPhoneVerification`、`ChangeSelfPhone`。
- `middleware/turnstile-check.go`：增加 SMS-scoped Turnstile middleware，只保护短信发送动作。
- `router/api-router.go`：增加 `/api/sms/verification`、`/api/user/login/phone`、`/api/user/self/phone/verification`、`/api/user/self/phone/change`。
- `model/option.go` / `common/constants.go`：增加 SMS 开关、短信宝配置、手机号注册/登录开关、短信验证码有效期和发送冷却配置。
- 测试覆盖了 SMS provider URL、返回码、短信发送禁用、重复手机号、状态输出、手机号登录、手机号注册、手机号换绑和 SMS Turnstile。

## 不应直接迁移的点

- 旧 fork 直接在 `users` 表新增 `phone` 字段，并修改用户查询、编辑、缓存和列表逻辑；这会触碰官方核心表结构。
- 当前原生分销治理原则要求：官方核心表尽量不动，新功能优先新增 sidecar 表；因此不应照搬 `users.phone` 设计。
- 旧 fork 的短信内容在 controller 中直接拼接；后续应改为按场景配置模板和签名，避免注册、登录、绑定、换绑、重置密码混用同一文案。
- 旧 fork 的短信 provider 基本等同短信宝专用实现；后续应抽象 provider，短信宝只是一个实现。
- 旧 fork 的 SMS 发送审计较弱；后续需要 sidecar 发送日志，仅记录脱敏手机号、场景、provider、模板版本、返回码和耗时，不记录完整验证码、完整手机号、ApiKey、MD5 password 或短信正文。

## 建议落地方案

### 后端模型

- 新增 `user_phone_bindings` sidecar 表，而不是修改 `users` 表。
- 建议字段：`user_id`、`phone_hash`、`phone_masked`、`status`、`verified_at`、`created_at`、`updated_at`、`deleted_at`。
- 唯一性建议落在 `phone_hash` + active status 语义上；实现前需做 PostgreSQL schema impact。
- 新增 `sms_send_logs` sidecar 表，记录脱敏发送日志。

### Provider 和配置

- 新增 SMS provider 抽象，例如 `Send(ctx, input) (result, error)`。
- 第一阶段实现 `smsbao` provider。
- 管理员配置至少包含：provider、启用状态、短信宝账号、凭据模式、凭据、专用通道产品 ID、签名、各场景模板、验证码有效期、冷却时间、Turnstile 开关、IP/手机号/账号/场景限流。
- 凭据只写入配置存储，不输出到日志、文档、commit 或测试报告。

### Controller 链路

- `/api/sms/verification`：按 purpose 发送验证码，支持注册、登录、绑定手机号、换绑、重置密码。
- `/api/user/login/phone`：只允许已绑定手机号登录，不自动注册。
- 注册链路：如果手机号注册启用，创建用户后写 `user_phone_bindings`，并复用 Phase 5 的统一 invite context、初始额度和 `affiliate_invite_events`。
- 自助绑定/换绑：写 sidecar binding，不修改 `users` 表。
- 管理员用户管理：通过 sidecar 查询/编辑绑定，不能只靠前端隐藏。

### 安全和限流

- SMS 发送必须使用 SMS-scoped Turnstile 或同级图形验证，不扩大到非短信提交动作。
- 必须支持手机号、IP、账号、场景维度限流。
- 发送日志不得记录完整验证码、完整手机号、ApiKey、MD5 password 或完整短信正文。

## 后续顺序建议

1. TDD 新增 SMS provider 抽象和短信宝 provider 单元测试。
2. TDD 新增 SMS 配置 option 与管理接口测试。
3. 设计并 schema impact `user_phone_bindings` / `sms_send_logs`。
4. TDD 新增 `/api/sms/verification`，先只支持发送验证码和限流，不接注册。
5. TDD 接入手机号注册，复用 Phase 5 邀请归因和初始额度。
