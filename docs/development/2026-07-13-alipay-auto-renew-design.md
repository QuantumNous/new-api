# 支付宝自动续费设计（基于 Stripe 自动续费骨架）

## 背景

`codex/stripe-auto-renew-subscription` 已落地：

- `BillingSubscription`：支付方合约
- `RecurringChargeAttempt`：周期扣款尝试（幂等）
- `UserSubscription`：周期权益（`source=auto_renew`）
- Stripe Checkout + webhook + classic 管理/购买/取消

支付宝订阅原先仅为**一次性** `page.pay` → `SubscriptionOrder`。自动续费复用上述三层模型，新增 Alipay 适配与**商户主动扣款调度**。

## 目标

1. 用户对 `billing_mode=auto_renew` 套餐可用支付宝完成签约并自动续期。
2. 与 Stripe 共用权益与互斥语义，避免双开自动续费。
3. 扣款失败、解约、重试、幂等与 Stripe 同等安全水位。

## 非目标（本期）

- 微信周期扣费
- 改价后静默生效（支付宝通常需重新签约）
- `web/default` 完整 UI（可与 Stripe 二期一并做）
- 套餐级 `sign_scene` 多模版（当前全局一个场景码）
- 强制实现支付宝 7:00–22:00 / 扣款前 48h 窗口校验（见合规约束，联调时对齐）

## 产品与支付差异

| | Stripe | 支付宝（商家扣款 / 支付并签约） |
|--|--------|--------------------------------|
| 扣款发起 | 支付方主动（invoice） | 首期：**支付并签约**；续期：**商户主动** `trade.pay` |
| 合约标识 | `subscription` id | `agreement_no` |
| 开通入口 | Checkout `mode=subscription` | page/wap pay + `agreement_sign_params` |
| 解约 | `cancel_at_period_end` | `alipay.user.agreement.unsign` |
| 周期边界 | invoice line period | **本地维护** `current_period_*` + 到期扫描 |

官方说明（升级后「商家扣款」，2026-03-28 起新商户应接新版）：

- 产品能力页 / 支付并签约场景以支付宝开放文档为准（如商家扣款「支付并签约」说明）。
- 旧版「周期扣款 / 商家扣款」老商户可继续使用，但不再更新能力、不接新场景。

必须开通支付宝**商家扣款**（或合同约定的代扣类）产品权限；与现有电脑网站支付不是同一能力。

## 决策（已定）

1. **全局互斥**：同一用户任意时刻最多 1 个未结束 auto_renew 合约（跨 Stripe/Alipay）。
2. **首期策略**：**支付并签约**——支付页完成首期付款并授权；支付成功发权益；签约 notify 只绑 `agreement_no`，**不再二次扣首期**。
3. **续期策略**：仅在 `current_period_end` 到期后 worker 主动扣；中间 idle。
4. **解约语义**：用户取消 → `agreement.unsign` + `cancel_at_period_end`；当前周期权益保留到 `EndTime`。
5. **金额**：支付金额与 `period_rule.single_amount` 按套餐 `PriceAmount × 汇率`；改价需新签。
6. **产品码全局配置**：销售/个人产品码与签约场景为系统级配置，**不随套餐金额变化**；多价位靠每次签约的 `single_amount`。

## 模型映射

| 字段 | Stripe | Alipay |
|------|--------|--------|
| `provider` | `stripe` | `alipay` |
| `provider_subscription_id` | Stripe subscription id | `agreement_no` |
| `signup_reference` | Checkout metadata 参考号 | `external_agreement_no` |
| `provider_customer_id` | Stripe customer | `alipay_user_id`（可选） |
| `provider_checkout_id` | Checkout session id | 签约页/请求号（可选） |
| `provider_invoice_id`（attempt） | Stripe invoice id | 本地周期 `out_trade_no` |

状态复用：`pending_signup` → `pending_first_charge` / `active` → `past_due` → `canceled` / `signup_failed` / `signup_expired`。

履约：继续 `FulfillRecurringInvoice`（provider 无关）。

## 生命周期

```text
用户选择 auto_renew + 支付宝
  → pending_signup + Prepare 稳定首期 out_trade_no (aliar*)
  → 跳转 page/wap「支付并签约」URL

支付成功 notify（首期）
  → FulfillRecurringInvoice + active
  → 若 notify 带 agreement_no 可提前绑定

签约成功 notify
  → 只绑定 agreement_no（不再二次扣首期）

续期（到期扫描）
  → Claim lease → trade.pay + agreement_no → 短查单 / notify → Fulfill

用户取消
  → agreement.unsign + cancel_at_period_end

支付宝解约通知
  → 本地 canceled（不重开）
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/subscription/alipay/checkout/auto-renew` | 支付并签约 checkout（返回 pay_url） |
| POST | `/api/subscription/alipay/notify` | 支付 / 签约 / 解约 / 续期交易回调 |
| POST | `/api/subscription/self/cancel-renewal` | 按 provider 解约 |

Admin：classic 支付设置配置 `AlipayCyclePay*`；套餐 `billing_mode=auto_renew` 且 `alipay_enabled` 时展示支付宝入口。

## 系统配置（classic → 支付设置 → Alipay）

| 配置项 | 含义 | 说明 |
|--------|------|------|
| `AlipayCyclePayEnabled` | 开关 | 关闭则拒绝 auto-renew 支付宝 checkout / 扣款 |
| `AlipayCyclePayPersonalProductCode` | 个人产品码 `personal_product_code` | **以商户开通页/合同为准** |
| `AlipayCyclePayProductCode` | 销售产品码（签约侧 `product_code`） | **以合同为准**；代码默认样例 `GENERAL_WITHHOLDING`（商家扣款线），旧文周期扣款常见 `CYCLE_PAY_AUTH`，**不要混用未开通的码** |
| `AlipayCyclePaySignScene` | 签约场景 `sign_scene` | 商家平台「商家扣款 → 功能管理 → 设置模版」中的场景码；同商家同场景一用户通常最多 1 协议 |

另需：基础 `AlipayAppID` / 私钥 / 公钥 / 网关；异步通知：

```text
https://<公网域名>/api/subscription/alipay/notify
```

### 产品码 vs 套餐金额

- **产品码 / 场景码**：商户能力与业务模版（全局或后续可做套餐级场景码）。
- **金额**：每次签约写入 `period_rule.single_amount` 与首期 `total_amount` = 该套餐 `PriceAmount × 汇率`。
- **多套餐不同价**：可以，各自签约各自 `single_amount`；共用同一套产品码。限制在支付宝侧「单笔上限 / 同场景协议数」，不在产品码个数上。

### 支付宝侧合规约束（运营与联调）

摘自升级后商家扣款说明（以最新开放文档为准）：

1. 单个协议**单笔扣款限额常见为 100 元**（以合同为准）；套餐标价折合人民币应可控。
2. 扣款建议在**北京时间 7:00～22:00** 发起。
3. 支付并签约若做首期优惠，优惠后金额**不得低于正价 1/3**，否则续费扣正价可能失败。
4. 两次扣款间隔**建议 ≥ 30 天**（含首期到二期）。
5. 允许扣款窗口：系统计算「下次预计扣款时间」= 支付成功时间 + 周期；**该时间前 48 小时**起可发起扣款；周期内仅一次有效扣款。
6. 产品合约须勾选实际交易场景（PC / 移动 / 小程序等）。
7. 准入（企业账号、注册资本、活跃用户等）以支付宝审核为准。

## 调度与补偿

- `StartAlipayAutoRenewChargeTask`（约 2 分钟 tick，仅 master）
- `ListDueAlipayAutoRenewContracts`：`current_period_end <= now` 的 alipay 合约
- 复用 `AlipayPendingTask`（`trade_type=auto_renew_charge`）短时 `trade.query`
- notify 失败勿吞错误；配合查单

## 幂等

| 键 | 用途 |
|----|------|
| `(provider, provider_subscription_id)` 可空唯一 | 合约 |
| `(provider, signup_reference)` 可空唯一 | 签约 |
| `(provider, provider_invoice_id)` | 扣款尝试 + 权益 |

与 Stripe 一致：已 `paid` 不被 `failed` 降级；`canceled` 不被迟到成功重开。

### 首期 out_trade_no 稳定键 + 扣款 claim lease

- **稳定键**：首期 `out_trade_no` 由 `contract.Id + signup_reference + periodStart/End` 确定性生成；`periodStart` 取 `contract.CreatedAt`（非每次点击的 wall clock）。双击/重试走 `PrepareAlipayAutoRenewFirstPeriod`，优先复用 `last_invoice_id` 与已有 pending attempt。
- **Claim lease**：`RecurringChargeAttempt.claimed_at` + 状态机；`ClaimAlipayAutoRenewChargeAttempt` 在事务内锁定合约行，仅赢家可调用 `TradePay`。活跃 lease 默认 10 分钟；失败或超时后可 reclaim。仅靠唯一索引不够——必须在发出支付请求前 claim。
- **履约**：notify / 短查单 / sync 成功均走 `FulfillRecurringInvoice`，同 `provider_invoice_id` 只创建一份权益。

## 前端

- classic：`auto_renew` 且启用支付宝时展示入口；有 Stripe+Alipay 时支付方式二选一
- 取消续费 UI 共用
- default：二期

## 实施阶段

### Phase 0（已完成）— Provider 泛化

- 互斥 / 当前合约查询不绑死 `stripe`
- Signup create/reuse/complete/fulfill/expire API 支持 `provider` 参数
- Stripe 调用点改为传入 `PaymentProviderStripe` 的薄封装

### Phase 1（已合入）— 支付并签约 + 首期

- [x] `POST /api/subscription/alipay/checkout/auto-renew`（支付并签约）
- [x] `service`：`BuildAlipayPayAndSignURL` / `AgreementUnsign` / `TradePay`+agreement
- [x] 交易 notify 履约 `aliar*`；签约 notify 绑 `agreement_no`（不二次扣首期）
- [x] 用户取消续费调用 `agreement.unsign`
- [x] classic：auto_renew + `plan.alipay_enabled` + `AlipayCyclePay*` 配置
- [x] 首期稳定 out_trade_no + Prepare 复用
- [ ] 真实沙箱/正式商户端到端验收（依赖商家扣款产品开通）

### Phase 2（已合入）— 轻量到期扣款 + claim

设计原则：**中间 idle，只在 period 到期后主动扣；扣完短时查单。**

- [x] `StartAlipayAutoRenewChargeTask`（2 分钟 tick，仅 master）
- [x] `ListDueAlipayAutoRenewContracts`
- [x] `ChargeAlipayAutoRenewContract` + **DB claim lease**
- [x] `AlipayPendingTask` 短时 `trade.query`
- [x] `cancel_at_period_end` 到期 finalize 为 `canceled`
- [ ] 真实多周期验收；对齐 48h 窗口 / 7–22 点（若商户规则强制）

### Phase 3

- default 前端
- 对账与报表
- 套餐级场景码 / 协议变更换绑（若需要）
- 运营规则校验：单笔 ≤100、首期折扣、周期 ≥30 天等（可选代码守卫）

## 风险

1. 商户未开通商家扣款（新版）或合约未勾选交易场景 → 支付/签约失败。
2. 产品码/场景码与合同不一致（例如误用旧周期扣款码）→ 支付成功但签约失败等。
3. 套餐价超过单笔限额或首期折扣过低 → 续期失败。
4. 汇率变动：协议金额以签约时快照为准。
5. 调度漏跑：必须有查单与补偿，不能只靠 notify。
6. 并发双击/双 worker：依赖稳定 out_trade_no + claim lease。

## 验收

- [ ] 支付并签约成功：有合约、首期权益、`agreement_no` 绑定
- [ ] 同用户无法同时再开 Stripe/Alipay auto_renew
- [ ] 取消后续费不再扣；当期权益可用
- [ ] 同一 out_trade_no 重放不双发权益
- [ ] 双击 checkout 复用同一首期交易号
- [ ] 并发 charge 仅一侧发起 TradePay
- [ ] 放弃签约可重新发起（expired/failed）

## 工作待办（Todo）

跟踪本分支支付宝自动续费落地进度（与会话 todo 对齐；完成后请勾选并更新日期）。

### 已完成

- [x] 首期稳定 `out_trade_no` + DB claim lease（防双击双扣 / 双 worker）
- [x] claim / 首期复用单测（`service/alipay_auto_renew_charge_test.go`）
- [x] Stripe `/stripe/pay` 与 affinity 相关测试修复
- [x] SQLite `decimal(p,s)` AutoMigrate 旁路 + 单测（`model/sqlite_decimal_migrate_test.go`）
- [x] 设计文档整理（产品码 / 多套餐金额 / 商家扣款合规约束）
- [x] 本地 Postgres `newapi-local`：`docker-compose.postgres.yml` + `.env.postgres` 部署最新镜像
- [x] 代码提交：`217b1054e` fix: harden Alipay auto-renew claim lease and document merchant pay
- [x] 点击 Checkout / 支付并签约即写入 `top_ups` **pending** 账单（`EnsurePendingAutoRenewTopUp`）；支付成功/过期更新状态

### 待办（商户开通与联调；支付宝配置先暂停时优先看这里）

- [ ] **配置**：按合同填写 `AlipayCyclePayPersonalProductCode` / `AlipayCyclePayProductCode` / `AlipayCyclePaySignScene`，打开 `AlipayCyclePayEnabled`
- [ ] **Notify**：公网可达 `https://<域名>/api/subscription/alipay/notify`（支付 + 签约 + 解约）
- [ ] **套餐**：`billing_mode=auto_renew`、`alipay_enabled`；标价折合人民币注意单笔限额（文档常见 ≤100 元）
- [ ] **E2E 验收**：支付并签约 → 绑 `agreement_no` → 首期权益 → 到期主动扣款 → 取消续费
- [ ] **多周期验收**：至少跑通二期扣款 / 失败 past_due / 查单补偿

### 可选后续

- [ ] 对齐支付宝扣款时段（北京时间 7:00–22:00）与「下次预计扣款前 48h」窗口（代码守卫或调度策略）
- [ ] 运营规则校验：单笔 ≤100、首期优惠 ≥ 正价 1/3、周期建议 ≥30 天
- [ ] 套餐级 `sign_scene`（多模版）
- [ ] `web/default` 支付宝 auto_renew 购买 / 取消 UI
- [ ] 对账与报表

## 本地验证备注

- Postgres 模式：`deploy/newapi-local` 使用  
  `docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d --build`  
  勿用默认 `docker-compose.yml`（SQLite、无 `SQL_DSN`）。
- SQLite 本地镜像若对含 `decimal(p,s)` 的表执行 GORM AutoMigrate，可能因 glebarez DDL 解析失败；`model/main.go` 对 SQLite 使用 `ensureDecimalMoneyTablesSQLite` / `ensureSubscriptionPlanTableSQLite` 旁路（Postgres/MySQL 仍 AutoMigrate）。
