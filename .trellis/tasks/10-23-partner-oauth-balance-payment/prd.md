# Partner OAuth 余额查询与充值下单接口

## Goal

在 Partner OAuth（`10-10-partner-oauth-integration`，协议 v0.2）之上，为第三方助手新增：

1. 余额查询：第三方用访问令牌查询所绑定账号的钱包余额。
2. 充值下单：第三方用访问令牌为所绑定账号创建充值订单，拿到收银台地址在自己的客户端里展示给用户支付，并通过订单查询（可选再加 `return_url` 跳回）在自己界面展示结果。

第三方没有给出规格，接口由我方设计，沿用协议 v0.2 的约定：`/api/integrations/v1/*`、`Authorization: Bearer <AT>`、错误体 `{"error":{"code","message"},"request_id"}`、`no-store`、`X-Request-Id`、只在主站 Host 提供、拒绝 Query/表单中的 `access_token`。

## Key Decisions（2026-10-23 用户确认）

| # | 决策 | 结论 |
|---|---|---|
| B1 | 规格来源 | 第三方无规格，我方设计 |
| B2 | 充值方式 | 接口直接下单，返回收银台地址，另提供订单状态查询 |
| B3 | 余额权限 | 并入 `account:read`，不新增 scope；同意页 `account:read` 文案改为包含余额 |
| B4 | 余额单位 | 同时返回换算后的金额（十进制字符串 + 币种）和内部额度 `quota` |
| B5 | 下单权限 | 新增 scope `payment:write`；已有客户端默认不含，需管理员勾选；已有绑定需重新授权 |
| B6 | 支付网关 | 本期只接易支付（epay，生产在用）；实现按网关拆分，后续可加 Stripe 等 |
| B7 | 结果展示 | 第三方轮询订单状态；可选 `return_url`，必须与该客户端已登记回调地址同源（回环地址允许任意端口），支付后浏览器先回本站验签入账再跳回 |
| B8 | 返现 | 第三方代下的订单不参与邀请/充值返现 |

## Requirements

### P1 `GET /api/integrations/v1/balance`（scope `account:read`）

- 不接受 Query；鉴权、错误、限流与 `/account` 相同。
- 响应字段：`account_id`、`binding_id`、`quota`（钱包剩余额度，可为负）、`used_quota`、`amount`、`currency`、`currency_symbol`、`quota_per_unit`。
- `amount` 为十进制字符串，按站点展示类型换算：`USD` → `USD`；`CNY` → `CNY`（按站点 USD 汇率）；`CUSTOM` → `CUSTOM`（按自定义汇率，带符号）；`TOKENS` 按 USD 换算并返回 `USD`。保留 6 位小数并去掉末尾 0。
- 只返回钱包余额，不含订阅套餐额度。

### P2 `GET /api/integrations/v1/payment/options`（scope `payment:write`）

- 不接受 Query。返回 `available`、`currency`（充值数量单位，同网页端展示类型）、`pay_currency`（`CNY`）、`min_amount`、`max_amount`、`amount_options`、`methods[{id,name}]`。
- 支付合规未确认或 epay 未配置时 `available=false`、`methods=[]`。

### P3 `POST /api/integrations/v1/payment/orders`（scope `payment:write`）

- `Content-Type: application/json`，body `{"amount": int, "payment_method": string, "return_url"?: string}`，拒绝未知字段与 Query（重复 JSON 字段以最后一个为准，不单独检测）。
- 必须带 `Idempotency-Key` 头（16–64 个 `[A-Za-z0-9_-]`）。同一绑定、同一 Key 重复请求返回同一订单（200）；同 Key 不同 body → 409 `idempotency_conflict`。
- 金额语义、最小值、最大值、分组充值倍率、预设折扣、钱包额度上限与网页端 epay 下单完全一致。
- 成功 201：`order_id`、`status`、`amount`、`currency`、`pay_money`、`pay_currency`、`payment_method`、`checkout_url`、`created_at`。
- 订单写入现有 `top_ups`，走现有 epay 回调入账流程；绑定关系记在新表 `partner_oauth_payment_orders`，与 `TopUp`、返现上下文在同一事务内创建。
- 订单的返现上下文标记为“第三方下单，不参与返现”，不记录第三方服务器的 IP/UA，不写设备关联。
- 防滥用：每个绑定 1 小时内最多 20 笔，30 分钟内最多 5 笔未支付订单，超出 429 `rate_limited`。
- 错误码：`payment_unavailable`（503，合规未确认/未配置）、`invalid_amount`（400）、`invalid_payment_method`（400）、`invalid_return_url`（400）、`idempotency_conflict`（409）、`rate_limited`（429）。

### P4 `GET /api/integrations/v1/payment/orders/{order_id}`（scope `payment:write`）

- 只能查询本绑定创建的订单；否则 404 `order_not_found`。
- 返回 P3 字段（不含 `checkout_url`），`status`：`pending` / `success` / `failed` / `expired`；成功时附 `paid_at`。

### P5 支付后跳转

- 无 `return_url`：保持现状（回本站）。
- 有 `return_url`：epay 浏览器回跳验签处理后，302 到 `return_url`，追加 `order_id` 与 `status`（`success` / `pending`）。`status` 只是提示，第三方必须以 P4 为准。
- `return_url` 校验：绝对 URL、≤512 字符、无 fragment/userinfo；scheme+host+port 与客户端某个已登记回调地址相同；`none` 客户端的回环回调允许任意端口。

### P6 Scope、同意页与管理

- 新增 scope `payment:write`；客户端表单可勾选；同意页、已授权应用、管理员查看绑定处展示文案。
- `account:read` 文案改为“读取账户资料和余额”。
- 下单写审计日志 `partner_oauth.payment.order_create`；授权日志页可筛选该动作。

### P7 安全与日志（OWASP ASVS 5.0 L2）

- 新接口沿用 `PartnerOAuthBearer`、用户禁用/认证版本检查、主站 Host 校验、`no-store`。
- 不记录 `checkout_url`、`Idempotency-Key` 原文；幂等 Key 只存 SHA-256。
- `return_url` 只允许已登记来源，防开放重定向。

## Acceptance Criteria

- [x] `account:read` 令牌可查余额，四种展示类型换算正确；缺 scope → 403 `insufficient_scope`。
- [x] `payment:write` 令牌可列出支付方式、下单拿到收银台地址；回调入账后订单查询为 `success`、余额增加；无返现奖励产生。
- [x] 金额越界、支付方式不存在、合规未确认、非法 `return_url` 分别返回对应错误；同 Key 重复下单只产生一笔订单，body 不同 409。
- [x] 查询其他绑定或网页端订单 404；未支付数限制生效（每小时 20 单上限与其共用同一计数实现，未单独构造 20 单用例）。
- [x] 有 `return_url` 的订单回跳到第三方并带 `order_id`/`status`；无 `return_url` 行为不变。
- [x] 新表与新列在 SQLite、MySQL 5.7.44、PostgreSQL 9.6.24 Docker 实例上全新建表、从线上版本（origin/main 486b641）升级与重复迁移通过。
- [ ] 后端测试、前端测试/类型检查/构建通过；`docs/partner-oauth-api.md` 补充新接口。

## Out of Scope

- Stripe/Waffo/Creem 等其他网关、订阅套餐购买、退款接口、对第三方的支付结果 webhook。
