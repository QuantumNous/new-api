# Airwallex 免密自动充值（Off-Session Auto-Charge）实现设计文档

> 状态：**仅设计（DESIGN ONLY）**。本文档不交付任何可上线代码——对真实信用卡发起免密扣款属于敏感操作，需经评审后再编码。本文目标是把实现路径写到"照着就能开发"的颗粒度。
> 对标：现有 Stripe off-session 自动充值路径（`service/auto_topup.go`）。
> 站点币种：DeepRouter 站点对客户结算为 **AUD**；现有自动充值引擎按 **USD** 写死。

---

## 1. 目标与范围

### 1.1 目标
让使用 **Airwallex** 作为支付渠道的租户，也能享有与 Stripe 一致的自动充值能力：当账户余额（quota）低于阈值时，系统**在用户不在场（off-session / MIT, merchant-initiated transaction）**的情况下，对其首次充值时保存的银行卡自动扣款并回充 quota。

### 1.2 范围内
- 首次（on-session）Airwallex 充值时，创建并持久化 Airwallex **Customer + PaymentConsent + PaymentMethod**（即"存卡 + 免密授权"）。
- 新增 `model/user.go` 列以保存上述句柄。
- 新增 Airwallex off-session 扣款函数，对标 `stripeOffSessionCharge`（`service/auto_topup.go:186`）。
- 将 `service/auto_topup.go` 的 `MaybeAutoTopup` 改造为**按 provider 分流**（Stripe / Airwallex）。
- webhook 在首次支付成功时落库 consent / payment_method / customer / payment_method_transaction_id。
- 前端首次 Airwallex 充值时取得 SCA mandate / 保存授权。
- 币种从 USD 扩展到 AUD 的统一/换算策略。

### 1.3 范围外（本期不做）
- 不实现真实生产扣款上线（仅 sandbox + 小额真卡验证流程定义）。
- 不实现 Airwallex consent 生命周期完整管理（吊销/过期自动清理仅留 TODO 钩子）。
- 不改动 `service/text_quota.go:400` 的触发点（已 provider-neutral）。
- 不改动 quota → money 的请求期换算逻辑（`computeAirwallexPayMoney`, `topup_airwallex.go:187`）。

---

## 2. 现状对比：Stripe 自动充值怎么做 vs Airwallex 缺什么

### 2.1 Stripe 自动充值全链路（已实现，对标基准）

| 环节 | 位置 | 行为 |
|---|---|---|
| 存卡（首次 checkout 即存） | `controller/topup_stripe.go:376-378` | `PaymentIntentData.SetupFutureUsage = "off_session"`，让 Stripe 保存卡 + 弹出 SCA mandate 文案 |
| 建客户 | `controller/topup_stripe.go:381-389` | 无 `StripeCustomer` 时 `CustomerCreation = "always"` (+ `CustomerEmail`)；否则复用 `params.Customer = customerId` |
| 持久化客户句柄 | webhook `sessionCompleted` (`topup_stripe.go:193-208`) → `fulfillOrder` (:260) → `model.Recharge(referenceId, customerId, callerIp)` (:282) → `model/topup.go:144` `Updates({"stripe_customer": customerId, "quota": ...})`（`FOR UPDATE` 事务） |
| off-session 扣款 | `service/auto_topup.go:186-209` `stripeOffSessionCharge`：`Confirm=true` + `OffSession=true` + `Customer=cus_xxx` + `PaymentMethod=nil`（用客户默认卡），非 `StatusSucceeded` 视为失败 (:205-207) |
| 幂等 | `service/auto_topup.go:144` `IdempotencyKey = "auto-topup:{userId}:{unixMinute}"`（按分钟分桶） |
| 触发 | `service/text_quota.go:398-402` `PostTextConsumeQuota` 内 fire-and-forget `gopool.Go(MaybeAutoTopup)` |
| 决策门 | `decideAutoTopup` (`auto_topup.go:71-99`)：enabled → amount>0 → `Quota < Threshold` → `StripeCustomer != ""` → key 形如 `sk_`/`rk_` → Redis enabled → cents ≥ `AutoTopupMinChargeCents()`；cents = `quotaUnitsToStripeCents(Amount) * AutoTopupSellMultiplier()` (:94) |
| 并发锁 | Redis SETNX `auto_topup_lock:{userId}` TTL 60s，成功后不释放，防止 TTL 内重复扣 (:131-138) |
| 回充 + 失败告警 | 成功 → `model.IncreaseUserQuota` (:154) + `model.RecordLog(LogTypeTopup)` (:164)；扣款成功但回充失败 → CRITICAL 日志人工对账 (:158-161) |
| 用户模型 | `StripeCustomer string` (`user.go:52`, varchar(64) indexed)；`AutoTopupEnabled/Threshold/Amount` (`user.go:73-75`) |
| 经济参数 | `AutoTopupSellMultiplier()` 默认 5、`AutoTopupMinChargeCents()` 默认 500（`setting/operation_setting/auto_topup_setting.go:31,39`） |

**关键事实：Stripe 本地只存 `cus_xxx`，不存支付方式 id**——扣款时由 Stripe 服务端解析客户默认卡。

### 2.2 Airwallex 现状（仅一次性手动充值）

现有 Airwallex 流程（`controller/topup_airwallex.go`）：建 intent → Hosted Payment Page → webhook 回充 quota，**一次性**，链路如下：

- 金额预览 `/api/user/airwallex/amount` (`RequestAirwallexAmount`, :210)
- 建 intent `/api/user/airwallex/pay` (`RequestAirwallexPay`, :254)：插 pending `TopUp` 行 (:310-320) → `createAirwallexPaymentIntent` (:362) POST `/api/v1/pa/payment_intents/create`，仅传 `descriptor` + 可选 `order.shopper.email` → `buildAirwallexHostedURL` (:418)
- webhook `/api/airwallex/webhook` (`AirwallexWebhook`, :462)：验签 `verifyAirwallexSignature` (:451) → `payment_intent.succeeded` → `handleAirwallexSucceeded` (:519) → `model.RechargeAirwallex` (`topup.go:536`) 回充

### 2.3 Airwallex 缺口清单（mirror 必须补齐的）

| # | 缺什么 | 对应 Stripe 的东西 |
|---|---|---|
| 1 | **首次支付不创建 Customer / 不请求可复用 PaymentConsent** | `SetupFutureUsage:off_session` + `CustomerCreation:always` (`topup_stripe.go:376-389`) |
| 2 | **没有持久化的 customer / consent / payment_method 列**；`TopUp` 行不存 `payment_intent.id`，webhook 结构 `AirwallexPaymentIntent` (:81-87) 也不解析 customer/consent | `users.stripe_customer` (`user.go:52`) |
| 3 | **没有 off-session 扣款函数** | `stripeOffSessionCharge` (`auto_topup.go:186`) |
| 4 | **`MaybeAutoTopup` 写死 Stripe**（`stripeChargeFn` :53；`decideAutoTopup` 仅查 `StripeCustomer` + `looksLikeStripeKey`） | 需 provider 抽象 |
| 5 | **支撑性缺口**：webhook 不记 `payment_intent.id`；无 `payment_consent.*` 生命周期事件处理；off-session 无幂等键策略；验签**不校验 timestamp 时效**（无防重放窗口，`verifyAirwallexSignature` :451 备注）——一旦自动扣款由事件驱动，这点风险放大 | Stripe `IdempotencyKey` (`auto_topup.go:144`) |

---

## 3. Airwallex 存卡 + 免密扣款 API 流程

### 3.0 环境与鉴权
- Host：生产 `https://api.airwallex.com`；sandbox `https://api-demo.airwallex.com`。支付收单端点统一在 `/api/v1/pa/`。复用现有 `AirwallexApiBaseURL()` (`setting/payment_airwallex.go:37`)。
- 鉴权：`POST /api/v1/authentication/login`（headers `x-client-id`/`x-api-key`）→ Bearer token，**有效期 30 分钟，无 refresh token**。复用现有 `getAirwallexAccessToken` (`topup_airwallex.go:100`，已带 ~25-30m TTL 缓存)。**长批量扣款任务必须中途重新登录**。

### 3.1 对象模型
```
Customer (cus_...) ──┐
                     ├─ PaymentConsent (cst_...)  ← mandate / 授权协议，记录"下一次谁触发"
PaymentMethod (pm_...) ┘
```
- **PaymentConsent** 把 Customer 关联到一张保存的 PaymentMethod，并记录 `next_triggered_by`。
- 首次支付返回三个必存句柄：`payment_method.id` (`pm_...`)、`payment_consent_id` (`cst_...`)、`payment_method_transaction_id`。

### 3.2 首次（on-session）存卡 + 收首笔款

1. **建 Customer**（用户首次充值时一次）：`POST /api/v1/pa/customers/create`
   - body：`request_id`(v4 UUID)、`merchant_customer_id`(= 我方 userId)、可选 name/email/phone → 返回 `id` = `cus_...`。落库。

2. **建首笔 PaymentIntent**（真实首笔扣款）：`POST /api/v1/pa/payment_intents/create`
   - 必填：`request_id`、`amount`（**主单位小数，如 `49.00`，不是分**）、`currency`（`"AUD"`）、`merchant_order_id`（= 现有 `tradeNo`）、**`customer_id`**（`cus_...`，必填，卡才能挂到该客户）→ 返回 `id`(`int_...`) + `client_secret`。

3. **确认 intent 并同步创建 consent**：`POST /api/v1/pa/payment_intents/{id}/confirm`
   - 传 `payment_method` + `payment_consent` 块（或先 `POST /api/v1/pa/payment_consents/create` 拿 `payment_consent_id` 再传入）。
   - consent 关键字段：
     - `next_triggered_by: "merchant"`（MIT，免密扣款；区别于 `"customer"` CIT）
     - `merchant_trigger_reason: "scheduled"`（固定节奏）或 `"unscheduled"`（不定期 off-session）——自动充值属"余额触发"，建议用 **`"unscheduled"`**（非固定周期）。
     - `requires_cvc`：后续 CIT 复用是否要 CVC。
   - 成功响应返回 `pm_...` + `cst_...` + `payment_method_transaction_id`。**三个全存。**

> 浏览器侧由 JS SDK `createPaymentConsent({ intent_id, customer_id, client_secret, currency, element, next_triggered_by })` 驱动同一个 confirm，PCI 安全地采集卡数据。这是替代当前 HPP 跳转的前端改动核心（见 §4.4）。

### 3.3 后续（off-session / MIT）扣款

每次无人在场扣款：
1. `POST /api/v1/pa/payment_intents/create` → `request_id`、`amount`、`currency`、`merchant_order_id`、`customer_id` → `id` + `client_secret`。
2. `POST /api/v1/pa/payment_intents/{id}/confirm`：
   - `payment_consent_id`：存的 `cst_...`
   - `payment_method`：存的 `pm_...`
   - `triggered_by: "merchant"`（confirm 时标记本次为 MIT；**注意与 consent 上的 `next_triggered_by` 是两个字段**）
   - `external_recurring_data.merchant_trigger_reason`：`"unscheduled"`（与 consent 保持一致）
   - `external_recurring_data.original_transaction_id`：= 首笔存的 `payment_method_transaction_id`。**每次 MIT 强烈建议带上**——关联原始已认证 mandate，显著提升发卡行通过率，缺失是软拒（soft decline）已知诱因。

### 3.4 首笔 SCA / 3DS 要求
- **首笔交易必须携带持卡人授权**。受 SCA 监管的卡（EU/UK，且全球渐增）需在首笔做 **3DS 认证**——这正是创建 mandate、授权后续 MIT 的依据。
- confirm/verify 响应可能返回 `next_action`（3DS challenge）。完成后用 `POST /api/v1/pa/payment_intents/{id}/confirm_continue` 收尾（**pre-2024-06-14 API 版本流程**，需 pin 住账户 API 版本测试）。浏览器 SDK 自动处理 challenge 跳转。
- 首笔认证后，后续 MIT（`triggered_by:merchant`）凭存储 mandate + `original_transaction_id` **免 3DS**；但 Airwallex 提示部分新 MIT 仍可能重新 3DS——**MIT confirm 也要对 `next_action` 做防御处理**。

### 3.5 幂等
- 每个 create/confirm 端点都吃 `request_id`（唯一 v4 UUID = 幂等键）。同 `request_id` 重试返回原结果，不重复扣。**每个不同逻辑操作（create vs 每次 confirm）用新 `request_id`，网络重试复用同一个。**
- `merchant_order_id` / `merchant_customer_id` 是我方业务引用，**不是**幂等键。

### 3.6 已知坑
- 两个 trigger 字段易混：`next_triggered_by`（在 **consent** 上，下一笔谁触发）vs `triggered_by`（**confirm 时**，本笔谁触发）。MIT = consent `next_triggered_by:merchant` + 每次 confirm `triggered_by:merchant`。
- `merchant_trigger_reason` 在 consent 与 confirm 的 `external_recurring_data` 两处都要、要**一致**。
- consent 的 `next_triggered_by`/currency 与 intent 不匹配会导致 confirm 加 `payment_consent_id` 失败（GitHub issue #105）——**币种与 trigger 语义必须跨 consent/intent 对齐**。

---

## 4. deeprouter 改动清单

### 4.1 数据模型（`model/user.go`）

新增 3 列，紧邻 `StripeCustomer` (`user.go:52`)：

```go
AirwallexCustomer  string `json:"airwallex_customer"  gorm:"type:varchar(64);index"` // cus_...
AirwallexConsentID string `json:"airwallex_consent_id" gorm:"type:varchar(64)"`        // cst_...  ← 真正的可扣款句柄
AirwallexPaymentMethod string `json:"airwallex_payment_method" gorm:"type:varchar(64)"` // pm_...
```

可选第 4 列（强烈建议，用于 MIT 提通过率）：
```go
AirwallexOriginalTxnID string `json:"airwallex_original_txn_id" gorm:"type:varchar(128)"` // payment_method_transaction_id
```

> 与 Stripe 的差异：Stripe 只需 `stripe_customer`（服务端解析默认卡）；Airwallex **off-session 扣款是 consent-id 驱动**，所以 `AirwallexConsentID` 是不可省的核心句柄，外加 `pm_...` 和 `original_transaction_id` 提通过率。让 GORM 自动迁移，三 DB（SQLite/MySQL/PG）兼容（AGENTS.md Rule 2）。

`AutoTopupEnabled/Threshold/Amount` (`user.go:73-75`) **复用，不新增**——provider 无关。

### 4.2 后端

#### 4.2.1 改 `controller/topup_airwallex.go`（首次支付链路存 consent）

- **`createAirwallexPaymentIntent` (:362)** 扩展：
  - 在建 intent 前，若 `user.AirwallexCustomer == ""`，先 `POST /api/v1/pa/customers/create`（新增 `ensureAirwallexCustomer(user)` helper），把 `cus_...` 暂存（先不落库，等 webhook 确认成功才落，对标 Stripe 只在 webhook 后写 `stripe_customer`）。
  - intent body 增加 `customer_id`。
  - 当本次充值用户**开启了自动充值意向**（前端传 `save_for_future=true` 或用户已勾 `AutoTopupEnabled`），在 intent / confirm 阶段请求 consent（`next_triggered_by:merchant`、`merchant_trigger_reason:unscheduled`）。
- **新增 webhook 结构字段**：扩展 `AirwallexPaymentIntent` (:81-87)，解析 `id`、`customer_id`、`latest_payment_attempt.payment_method.id`、`payment_consent_id`、`payment_method_transaction_id`（字段路径以账户 API 版本为准，开发期抓真实 webhook payload 确认）。

#### 4.2.2 改 webhook 成功路径

- `handleAirwallexSucceeded` (:519)：从 intent 解析出 `customerId / consentId / pmId / originalTxnId`，**透传**给 `model.RechargeAirwallex`。
- `model.RechargeAirwallex` (`topup.go:536`) **改签名**：目前只收 `tradeNo`，需新增参数 `(customerId, consentId, pmId, originalTxnId string)`，在其 `FOR UPDATE` 事务里的 `Updates(...)` 内一并写 `users.airwallex_customer / airwallex_consent_id / airwallex_payment_method / airwallex_original_txn_id`——**对标 `model/topup.go:144` Stripe 写 `stripe_customer` 的做法**。保持已成功幂等返回 nil。

#### 4.2.3 新增 off-session 扣款函数

新文件 **`service/auto_topup_airwallex.go`**（与 `auto_topup.go` 同包，避免散落）：

```go
func airwallexOffSessionCharge(req chargeRequest) (intentID string, err error)
```
- 复用 `getAirwallexAccessToken` (`topup_airwallex.go:100`)、`AirwallexApiBaseURL()` (`payment_airwallex.go:37`)、currency 配置。
- 两步：create intent（带 `customer_id`、`merchant_order_id`、AUD `amount` 主单位）→ confirm（`payment_consent_id`、`payment_method`、`triggered_by:merchant`、`external_recurring_data.{merchant_trigger_reason:unscheduled, original_transaction_id}`）。
- `request_id` 用 v4 UUID；同一逻辑操作的网络重试复用同一个（见 §6 幂等）。
- 终态 `SUCCEEDED` → 返回 `(intentID, nil)`；`next_action`/`REQUIRES_*` 非终态成功 → 当错误（off-session 不应需要 challenge，记 WARN 留待人工）。

#### 4.2.4 改 `service/auto_topup.go`（provider 分流）

把写死 Stripe 改为 provider 感知：

- **决策结构泛化**：`decideAutoTopup` (:71-99) 返回的前置条件结构扩展为携带 `(provider, customerHandle, consentHandle, pmHandle, originalTxn, providerKey, currency)`：
  - 若 `user.StripeCustomer != ""` 且 key 形如 `sk_`/`rk_` → provider=stripe，currency=`"usd"`。
  - 否则若 `user.AirwallexConsentID != ""`（且 `AirwallexCustomer != ""`）且 Airwallex 已启用 → provider=airwallex，currency=`"aud"`。
  - 都不满足 → 不充值。
- **charge seam**：把硬编码的 `stripeChargeFn` (:53) 换成按 provider 选择：`chargeFnFor(provider)` → `stripeOffSessionCharge` 或 `airwallexOffSessionCharge`。保留可注入（测试 swap）。
- **provider-neutral 复用不动**：cents/markup 数学（`quotaUnitsToStripeCents × AutoTopupSellMultiplier`, :94）、Redis 锁 `auto_topup_lock:{userId}` (:131)、成功回充 `IncreaseUserQuota` (:154) + `RecordLog` (:164)、扣成功回充失败的 CRITICAL 告警 (:158-161)。
- **需处理币种**：`"usd"` 字面量 (:142) 改为按 provider 取 currency；min-charge 单位换算见 §5。

#### 4.2.5 触发点（不改）
`service/text_quota.go:398-402` 的 `gopool.Go(MaybeAutoTopup)` 已 provider-neutral，**零改动**——分流逻辑全在 `MaybeAutoTopup`/`decideAutoTopup` 内。

### 4.3 webhook：首次 Airwallex 支付如何保存 consent / payment method

1. Airwallex POST `/api/airwallex/webhook` → 验签（见 §6 须加 timestamp 校验）。
2. `event.name == payment_intent.succeeded` 且本笔携带 consent（首次存卡的那笔）：
   - 解析 `customer_id / payment_consent_id / payment_method.id / payment_method_transaction_id`。
   - `handleAirwallexSucceeded` 透传给改签名后的 `RechargeAirwallex` → 在回充事务里**一并落库**到 `users` 四列。
3. **新增事件**（留扩展位）：处理 `payment_consent.*`（如 consent 被吊销/过期）→ 清空 `users.airwallex_consent_id` 阻止后续 off-session 扣款。本期可只记日志 + TODO。
4. webhook 不再丢弃 `payment_intent.id`——存入 `TopUp`（可选新增 `TopUp.ProviderIntentID` 列，便于对账）。

### 4.4 前端（首次 Airwallex 充值取得保存授权 / SCA mandate）

当前 `use-airwallex-payment.ts:41` 是 `window.open(payLink,'_blank')` 跳 HPP。要存卡 + 跑 3DS mandate，有两条路：

- **方案 A（推荐，能拿 consent）**：引入 Airwallex JS SDK，前端用 `createPaymentConsent({ intent_id, customer_id, client_secret, currency, element, next_triggered_by:'merchant' })` 在内嵌 card element 上采集卡 + 触发首笔 confirm + 3DS challenge（SDK 自动处理跳转）。这是 §3.2 step 3 的浏览器对应物。需改 `web/default/src/features/wallet/hooks/use-airwallex-payment.ts` + `api.ts`。
- **方案 B（最小改动）**：继续用 HPP，但在 `buildAirwallexHostedURL` (:418) 注入"创建 consent"信号（HPP 的 recurring/`mode` 参数）。HPP 是否能完整建 MIT consent 取决于 Airwallex HPP 能力，**需先在 sandbox 验证**——若 HPP 不支持创建 merchant-trigger consent，则必须走方案 A。

UI 侧：在 `payment-settings-section.tsx` 和钱包充值页加一个"保存此卡用于自动充值"勾选（仅当用户开启 `AutoTopupEnabled` 或显式勾选时才请求 consent），并展示 SCA mandate 授权文案（合规要求，见 §6）。

---

## 5. 计费与币种（USD vs AUD）

### 5.1 问题
- 现有自动充值引擎按 **USD** 写死：charge 时 currency `"usd"` (`auto_topup.go:142`)，金额单位 `quotaUnitsToStripeCents`（Stripe 用**分**）、`AutoTopupMinChargeCents()` 默认 500（= $5.00）。
- Airwallex 站点结算 **AUD**，且 Airwallex **amount 是主单位小数（`49.00`），不是分**——与 Stripe 的分是易错点。

### 5.2 统一策略

| 关注点 | 方案 |
|---|---|
| **金额单位** | 新增 `quotaUnitsToMajorAmount(units, currency)` 与现有 `quotaUnitsToStripeCents` 并存；Airwallex 路径用主单位 decimal（2 位）。或在 charge seam 内部，stripe 分支转分、airwallex 分支转主单位，**统一入口拿"quota units"，由各 provider 函数自行换算**。 |
| **markup 经济** | `AutoTopupSellMultiplier()`（默认 5）provider-neutral，**复用**——它作用在 quota units → 钱的倍率上，与币种无关。 |
| **min-charge** | `AutoTopupMinChargeCents()` 是 USD 分语义。新增 `AutoTopupMinChargeAUD()`（或泛化为按 currency 取最小额）。AUD 与 USD 不等值，**不可直接复用 500**——按 AUD 设独立最小额（如 A$5.00 → 主单位 `5.00`）。 |
| **quota→money 换算源** | 首次充值的 quota↔money 换算已由 `computeAirwallexPayMoney` (`topup_airwallex.go:187`，含 group ratio + `AmountDiscount`) 完成。off-session 自动充值应**复用同一套** AUD 单价（`AirwallexCurrencies` 里的 `unit_price`/`min_topup`），保证手动与自动充值定价一致。 |
| **跨币种用户** | 一个用户只可能绑定 Stripe(USD) 或 Airwallex(AUD) 之一（由 `decideAutoTopup` provider 选择保证互斥）。`AutoTopupAmount`（quota units）币种无关，最终金额由所选 provider 的币种换算决定。 |

### 5.3 落地要点
- 在 `setting/operation_setting/auto_topup_setting.go` 新增 AUD 最小额 setting，默认值需运营确认。
- `airwallexOffSessionCharge` 内 currency 取自 `AirwallexCurrencies` 配置（站点主币 AUD），**与 consent currency 必须一致**（否则触发 §3.6 issue #105 失败）。

---

## 6. 风险与合规

| 风险 | 说明 | 缓解 |
|---|---|---|
| **SCA / mandate 合法性** | 免密 MIT 必须建立在首笔已认证 mandate 之上；缺失 = 无授权扣款 = 合规违规 | 首笔强制走 3DS（§3.4）；前端展示并记录 mandate 授权文案；只有拿到 `cst_...` 才允许 off-session |
| **误扣 / 重复扣** | 余额触发可能高频；自动重试可能重复 | (1) Redis SETNX 锁 `auto_topup_lock:{userId}` TTL 60s 成功不释放（`auto_topup.go:131`，复用）；(2) Airwallex `request_id` 幂等：同一逻辑扣款生成一次 UUID 缓存于锁内，网络重试复用同 `request_id`；不同分钟/不同触发用新 id |
| **幂等键策略** | Stripe 用 `IdempotencyKey="auto-topup:{userId}:{unixMinute}"` (:144)；Airwallex 用 `request_id` | Airwallex 路径生成 `request_id = uuidv4()`，但需保证"同一笔逻辑充值"在重试时稳定——建议派生自 `auto-topup:{userId}:{unixMinute}` 的确定性 UUIDv5，对标 Stripe 分桶 |
| **webhook 重放** | 现 `verifyAirwallexSignature` (:451) **不校验 timestamp 时效**（无防重放窗口） | **本期必须补**：校验 `x-timestamp` 在 ±N 分钟窗口内，超窗拒绝。自动扣款由事件驱动后此风险放大 |
| **扣款成功但回充失败** | 钱扣了 quota 没加 | 复用 Stripe 的 CRITICAL 日志人工对账路径 (`auto_topup.go:158-161`) |
| **失败回退 / 软拒** | 卡过期、余额不足、issuer 拒 | (1) 始终带 `original_transaction_id` 提通过率（§3.3）；(2) 扣款失败不阻塞主请求（fire-and-forget）；(3) 连续失败 N 次自动关闭该用户 `AutoTopupEnabled` 并通知（留 TODO）；(4) consent 被吊销事件 → 清 `airwallex_consent_id` |
| **consent/intent 不匹配** | currency 或 trigger 语义不一致 → confirm 失败（issue #105） | consent 与每次 intent 的 currency、`merchant_trigger_reason` 严格对齐（§3.6） |
| **token 过期** | Bearer 30 分钟无 refresh | 复用带缓存的 `getAirwallexAccessToken`；批量任务中途重登 |
| **真卡上线** | 自动扣真实卡风险高 | **本文档仅设计**；上线前必经评审 + §7 测试 |

---

## 7. 测试计划（真卡上线前）

### 7.1 Sandbox（`api-demo.airwallex.com`）
1. **首次存卡**：用 Airwallex 测试卡跑完整 on-session → 断言 webhook 落库 `users.airwallex_customer/consent_id/payment_method/original_txn_id` 四列非空。
2. **3DS 路径**：用触发 challenge 的测试卡，验证 `next_action` → `confirm_continue` 收尾（pin 账户 API 版本）。
3. **off-session 扣款**：手动调 `airwallexOffSessionCharge` → 断言 `SUCCEEDED` + quota 回充 + `LogTypeTopup` 日志。
4. **幂等**：同 `request_id` 重发 confirm → 不重复扣；不同 `request_id` → 正常第二笔。
5. **provider 分流**：构造 Stripe-only、Airwallex-only、两者都无 三类用户跑 `decideAutoTopup`，断言选对 provider / 不充值。
6. **失败注入**：余额不足/卡拒测试卡 → 断言不回充、主请求不受影响、错误日志正确。
7. **webhook 防重放**：重放旧 timestamp 的 webhook → 被拒。
8. **币种**：断言 Airwallex 金额为 AUD 主单位 2 位小数；min-charge 用 AUD 阈值。

### 7.2 小额真卡（生产环境，受控）
- 仅对**内部测试账户**开启 Airwallex 自动充值。
- 阈值/金额设到**最小**（如 A$1–2），余额降到阈值下触发一次真实 off-session 扣款。
- 验证：真实发卡行通过、quota 回充、对账（`payment_intent.id` ↔ `TopUp` ↔ log）、Airwallex 后台可见 MIT 标记 + `original_transaction_id`。
- 退款验证：对该笔发起退款，确认链路与人工对账可用。
- 通过后才放开给真实租户，并加灰度（先白名单几个租户）。

### 7.3 单测（provider-neutral 复用）
- `decideAutoTopup` 表驱动用例覆盖 provider 选择矩阵。
- charge seam 注入 mock（对标 `stripeChargeFn` 可 swap）覆盖成功/失败/回充失败三态。
- 币种换算 `quotaUnitsToMajorAmount` / min-charge 边界。

---

## 8. 分阶段实施步骤（按可独立交付 PR）

> 每个 PR 独立可合、可回滚；前 4 个 PR **不触发任何真实自动扣款**（纯铺垫），扣款开关在最后。

| PR | 标题 | 内容 | 风险 |
|---|---|---|---|
| **PR-1** | 数据模型 + 迁移 | `model/user.go` 新增 4 列；GORM 自动迁移；三 DB 验证（AGENTS.md Rule 2）。无行为变化。 | 极低 |
| **PR-2** | webhook 验签加固 | `verifyAirwallexSignature` (:451) 增加 `x-timestamp` 时效窗口校验；扩展 `AirwallexPaymentIntent` 结构解析 customer/consent/pm/txn 字段；webhook 存 `payment_intent.id`。**先于扣款落地**，独立提升安全。 | 低 |
| **PR-3** | 首次支付存 consent（后端） | `createAirwallexPaymentIntent` 加 `ensureAirwallexCustomer` + intent `customer_id` + 可选 consent 请求；`RechargeAirwallex` 改签名落库四列；`handleAirwallexSucceeded` 透传。**受 feature flag / `save_for_future` 控制，默认关。** | 中 |
| **PR-4** | 前端首次存卡 + SCA | 引入 Airwallex JS SDK / `createPaymentConsent`（方案 A），或 HPP recurring 信号（方案 B，先 sandbox 验证可行性）；勾选"保存此卡用于自动充值" + mandate 文案。 | 中 |
| **PR-5** | 币种与经济参数 | `quotaUnitsToMajorAmount(currency)`；`AutoTopupMinChargeAUD()` setting；charge seam 按 provider 取 currency/单位。**仍未接扣款。** | 低 |
| **PR-6** | off-session 扣款函数 | `service/auto_topup_airwallex.go` 新增 `airwallexOffSessionCharge`（create+confirm with consent/MIT/`original_transaction_id`）；含 sandbox 集成测试。**未接入 `MaybeAutoTopup`，无生产影响。** | 中 |
| **PR-7** | provider 分流接入 | 改 `MaybeAutoTopup`/`decideAutoTopup` 泛化前置条件 + charge seam 选择；保留注入；Airwallex 路径**默认 feature-flag off**。 | 中高 |
| **PR-8** | consent 生命周期 + 失败策略 | 处理 `payment_consent.*` 事件清 consent；连续失败 N 次自动关 `AutoTopupEnabled` + 通知；CRITICAL 对账日志确认。 | 中 |
| **PR-9** | 灰度上线（评审后） | sandbox 全绿 + §7.2 小额真卡通过 → 白名单租户灰度 → 全量。**此 PR 才打开真实扣款 flag。** | 高（需评审） |

依赖关系：PR-1 → (PR-2, PR-3) → PR-4；PR-5 → PR-6 → PR-7 → PR-8 → PR-9。PR-1/2/5 可并行起步。

---

### 关键 file:line 索引（开发期速查）
- Stripe 存卡：`controller/topup_stripe.go:376-378`（`SetupFutureUsage`）、`:381-389`（customer）、`:282`（`Recharge`）、`model/topup.go:144`（写 `stripe_customer`）
- Stripe 扣款：`service/auto_topup.go:186-209`（`stripeOffSessionCharge`）、`:144`（幂等键）、`:53`（`stripeChargeFn` seam）、`:71-99`（`decideAutoTopup`）、`:131-138`（Redis 锁）、`:154/:164`（回充+log）、`:158-161`（失败告警）、`:94/:142`（cents/currency）
- 触发：`service/text_quota.go:398-402`
- 用户模型：`model/user.go:52`（`StripeCustomer`）、`:73-75`（auto-topup 配置）
- 经济参数：`setting/operation_setting/auto_topup_setting.go:31`（`AutoTopupSellMultiplier`）、`:39`（`AutoTopupMinChargeCents`）
- Airwallex 现状：`controller/topup_airwallex.go:100`（token）、`:362`（建 intent）、`:418`（HPP URL）、`:451`（验签）、`:462`（webhook）、`:519`（success）、`:81-87`（intent 结构）；`model/topup.go:536`（`RechargeAirwallex`）；`setting/payment_airwallex.go:37`（base URL）
- 前端：`web/default/src/features/wallet/hooks/use-airwallex-payment.ts:41`

(完整文档已在上方，作为本任务的交付物返回。本设计仅做设计，不含可上线代码；真实免密扣款上线前需经评审 + §7 测试。)
