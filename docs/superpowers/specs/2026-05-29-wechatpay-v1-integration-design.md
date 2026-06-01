# WeChat Pay V1 Integration Design

## Background

The project already supports multiple top-up providers with a consistent business flow:

- user initiates a wallet top-up from the frontend
- backend creates a local pending order in `top_ups`
- backend requests a third-party payment session
- provider webhook confirms payment
- a pending-order polling task queries provider status and compensates for missed webhooks
- local recharge logic settles quota with idempotency

This pattern already exists for Stripe, Alipay, Creem, Waffo, and Waffo Pancake, and it fits WeChat Pay well.

The main goal of this design is not to build a generic new payment framework. The goal is to add a pragmatic WeChat Pay v1 implementation that matches the existing architecture and user wallet recharge flow.

## Goal

Add WeChat Pay wallet top-up support with the smallest stable scope that fits the current system.

Success means:

1. mobile web users can start a WeChat H5 payment
2. desktop web users can start a WeChat Native QR payment
3. successful WeChat payments can automatically settle local quota
4. missed or delayed webhooks can be compensated by active order query polling
5. the implementation reuses the existing `top_ups` order model and current payment architecture

## Scope

In scope:

- wallet top-up only
- WeChat Pay `H5` payment
- WeChat Pay `Native` payment
- local order creation in `top_ups`
- WeChat webhook handling
- active order query for pending-order compensation
- classic and default frontend recharge entry integration
- admin payment settings for WeChat Pay

Out of scope:

- `JSAPI` payment
- Mini Program payment
- refund APIs and refund callbacks
- bill download / reconciliation file parsing
- new business tables
- storing WeChat `transaction_id` in v1
- full provider abstraction refactor

## Why JSAPI Is Excluded

`JSAPI` requires a user `openid`.

That means the project would need an additional WeChat identity acquisition path, such as:

- official account OAuth
- pre-bound WeChat user identity
- another OpenID acquisition workflow

This is significantly broader than "add WeChat Pay recharge support". It turns a payment integration into a payment-plus-identity project.

For the current project, the stable v1 scope is:

- `H5` for mobile browsers
- `Native` for desktop QR code payments

Official references:

- H5 order API: <https://pay.wechatpay.cn/doc/v3/merchant/4012791834>
- Native order API: <https://pay.wechatpay.cn/doc/v3/merchant/4012791877>
- JSAPI order API: <https://pay.wechatpay.cn/doc/v3/merchant/4012525167>

## Existing Architecture Fit

Relevant project files and patterns:

- [model/topup.go](/mnt/c/users/shaoq/go/src/new-api/model/topup.go)
- [controller/topup_alipay.go](/mnt/c/users/shaoq/go/src/new-api/controller/topup_alipay.go)
- [service/alipay.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay.go)
- [service/alipay_pending_task.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay_pending_task.go)
- [controller/payment_webhook_availability.go](/mnt/c/users/shaoq/go/src/new-api/controller/payment_webhook_availability.go)
- [model/option.go](/mnt/c/users/shaoq/go/src/new-api/model/option.go)

The WeChat Pay design should reuse these same layers:

- `setting/` for runtime payment configuration
- `controller/` for request validation and response shaping
- `service/` for provider API details such as signing, verification, decryption, and query
- `model/` for local order persistence and idempotent settlement

## Recommendation

Use a focused WeChat Pay v1 implementation with these boundaries:

- support `H5` and `Native`
- reuse `top_ups`
- use local `trade_no` as WeChat `out_trade_no`
- settle via webhook first, query compensation second
- do not introduce a new generic payment provider interface in this pass

This is the smallest implementation that still gives a complete operational payment loop.

## High-Level Design

### Payment Types

Two WeChat payment types are exposed to the current frontend:

- `H5`
  - for mobile browser top-up
  - backend returns `h5_url`
- `Native`
  - for desktop QR code flow
  - backend returns `code_url`

Suggested selection rule:

- mobile browser + `scene=auto` -> `H5`
- non-mobile browser + `scene=auto` -> `Native`

### Order Model Reuse

The existing `top_ups` table remains the single business order table for v1.

Mapping:

- `top_ups.trade_no` -> WeChat `out_trade_no`
- `top_ups.payment_method` -> `wechat_pay`
- `top_ups.payment_provider` -> `wechat_pay`
- `top_ups.status` -> `pending` / `success` / `expired` / `failed`

No new payment transaction table is required in v1.

### Runtime Flow

1. user requests WeChat top-up
2. backend validates config and amount
3. backend creates local pending order in `top_ups`
4. backend calls WeChat H5 or Native order API
5. backend returns `h5_url` or `code_url`
6. WeChat calls payment notification webhook after success
7. backend verifies signature, decrypts payload, validates merchant and amount, settles local order
8. pending-order polling task queries unpaid or unconfirmed orders and compensates if webhook was missed

## Configuration Design

### Base Configuration

Add WeChat Pay runtime settings:

- `WeChatPayEnabled`
- `WeChatPayH5Enabled`
- `WeChatPayNativeEnabled`
- `WeChatPayMinTopUp`

### Merchant Identity

- `WeChatPayAppID`
- `WeChatPayMchID`
- `WeChatPaySerialNo`

### Sensitive Materials

- `WeChatPayPrivateKey`
- `WeChatPayAPIv3Key`
- `WeChatPayPublicKey` or platform-certificate validation material

### Callback and Return

- `WeChatPayNotifyURL`
- `WeChatPayReturnURL`

## Sensitive Configuration Handling

At minimum, the following values should be treated as sensitive:

- `WeChatPayPrivateKey`
- `WeChatPayAPIv3Key`

Recommendation:

- use the same encrypted-option-at-rest mechanism already introduced for Alipay-sensitive fields
- do not return these values through `/api/option`
- keep frontend UX as "leave blank to keep current value"

Whether `WeChatPayPublicKey` also joins encrypted storage can be decided separately. It is less sensitive than the private key and APIv3 key.

## Provider Verification Material Strategy

WeChat Pay v3 introduces two separate concerns:

1. request signing with merchant private key
2. callback verification and encrypted payload processing

Two implementation strategies exist:

### Approach A: Platform certificate oriented

Pros:

- closest to official long-term model
- better extensibility for future APIs
- strongest fit for a complete WeChat Pay v3 integration

Cons:

- requires certificate download, cache, and rotation logic
- larger v1 scope

### Approach B: Minimal validation-material implementation

Pros:

- smaller v1 implementation
- faster time to working recharge flow
- enough for H5/Native order + notify + query scope

Cons:

- future expansion may still need certificate infrastructure

### Recommendation

For v1, structure code so that verification material loading is isolated, but keep the business scope minimal.

That means:

- request signing, callback verification, and resource decryption live in `service/wechatpay.go`
- the code is organized so validation-material retrieval can later switch from static public key to platform certificate management without rewriting controllers or order logic

## New File and Module Layout

### Add

- `setting/payment_wechatpay.go`
- `controller/topup_wechatpay.go`
- `service/wechatpay.go`
- `service/wechatpay_pending_task.go`

### Modify

- `model/topup.go`
- `controller/payment_webhook_availability.go`
- `controller/payment_webhook_availability_test.go`
- `model/option.go`
- frontend payment settings pages
- frontend wallet recharge pages

## Data Model Design

### `top_ups`

No schema change is required in v1.

Suggested constants:

- `PaymentMethodWeChatPay = "wechat_pay"`
- `PaymentProviderWeChatPay = "wechat_pay"`

### Why `transaction_id` Is Not Stored In V1

WeChat has both:

- `out_trade_no` - merchant order number
- `transaction_id` - WeChat payment transaction number

For v1:

- the local system already uses `trade_no` as the business join key
- active query by `out_trade_no` is supported by WeChat
- webhook processing can settle by `out_trade_no`

So `transaction_id` is not required for first delivery.

Trade-off:

- v1 keeps schema stable and implementation smaller
- future reconciliation and customer support would be easier if a provider-side transaction number is stored

Deferred enhancement:

- add `provider_trade_no` or a transaction detail table later

## API Design

### User Top-Up API

Endpoint:

```text
POST /api/user/wechatpay/pay
```

Request body:

```json
{
  "amount": 100,
  "payment_method": "wechat_pay",
  "scene": "auto",
  "return_url": "https://example.com/console/topup?show_history=true"
}
```

Field rules:

- `amount` must be positive and must satisfy `WeChatPayMinTopUp`
- `payment_method` must equal `wechat_pay`
- `scene` must be one of:
  - `auto`
  - `h5`
  - `native`
- `return_url` is optional and must pass the existing trusted-redirect validation logic

### User Top-Up Response

H5 success:

```json
{
  "message": "success",
  "data": {
    "pay_type": "h5",
    "pay_url": "https://wx.tenpay.com/..."
  }
}
```

Native success:

```json
{
  "message": "success",
  "data": {
    "pay_type": "qrcode",
    "code_url": "weixin://wxpay/bizpayurl?..."
  }
}
```

Failure:

```json
{
  "message": "error",
  "data": "payment configuration error"
}
```

The project should continue using current i18n patterns instead of introducing raw hardcoded response strings.

### Webhook API

Endpoint:

```text
POST /api/wechatpay/notify
```

This endpoint is for WeChat servers only.

The controller must:

1. check whether WeChat Pay webhook processing is enabled
2. read raw request body
3. read WeChat signature headers
4. verify signature
5. decrypt encrypted resource using `WeChatPayAPIv3Key`
6. validate merchant and amount
7. settle local order by `out_trade_no`

## Request and Response Mapping

### H5 Create Order

Core outbound fields:

- `appid`
- `mchid`
- `description`
- `out_trade_no`
- `notify_url`
- `amount.total`
- `amount.currency`
- `scene_info.payer_client_ip`
- `scene_info.h5_info.type`

Response field used by frontend:

- `h5_url`

Reference:

- H5 order API: <https://pay.wechatpay.cn/doc/v3/merchant/4012791834>

### Native Create Order

Core outbound fields:

- `appid`
- `mchid`
- `description`
- `out_trade_no`
- `notify_url`
- `amount.total`
- `amount.currency`

Response field used by frontend:

- `code_url`

Reference:

- Native order API: <https://pay.wechatpay.cn/doc/v3/merchant/4012791877>

### Query Order

Use merchant order number:

```text
GET /v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={mchid}
```

Reference:

- query by `out_trade_no`: <https://pay.wechatpay.cn/doc/v3/merchant/4012526919>

## Amount Handling

WeChat Pay requires integer amount in `CNY` fen.

This is not a business-architecture problem; it is an adapter-layer responsibility.

The business layer should keep current semantics:

- `top_ups.amount` remains top-up quota amount
- `top_ups.money` remains the actual payment amount under current system rules

The WeChat service layer should convert:

- local `money` -> fen integer

Implementation rule:

- use decimal-safe conversion
- do not use raw `float64 * 100` without decimal normalization

This avoids precision mismatches during callback amount validation.

## Controller Design

### `controller/topup_wechatpay.go`

Primary responsibilities:

- validate user request
- decide H5 vs Native scene
- validate minimum amount
- create local pending order
- call WeChat service for order creation
- shape frontend response

The controller should not implement:

- request signing
- callback signature verification
- encrypted payload decryption
- query signing details

Those belong in `service/wechatpay.go`.

## Service Design

### `service/wechatpay.go`

Suggested internal functions:

- `FormatWeChatPayAmountFen(money float64) (int64, error)`
- `BuildWeChatPayAuthorization(...)`
- `CreateWeChatPayH5Order(...)`
- `CreateWeChatPayNativeOrder(...)`
- `QueryWeChatPayOrderByOutTradeNo(...)`
- `VerifyWeChatPayCallbackSignature(...)`
- `DecryptWeChatPayNotifyResource(...)`
- `MapWeChatPayTradeStateToLocalStatus(...)`

### Responsibilities

Request side:

- build canonical string
- sign requests with merchant private key
- attach `Authorization` header
- call H5 / Native / query APIs

Webhook side:

- verify request signature
- decrypt `resource`
- parse business payload

## Model Settlement Design

### `model.RechargeWeChatPay`

Add an idempotent settlement function matching current payment-model patterns.

Responsibilities:

- lock order row
- verify `payment_provider == wechat_pay`
- only settle `pending`
- calculate quota
- update user quota
- mark order success
- write top-up log

Idempotency behavior:

- if already `success`, treat as successful replay
- if non-`pending` final state, reject duplicate settlement

This function is the main safety barrier against:

- repeated WeChat notifications
- query-task overlap
- manual retries

## State Machine

Local statuses remain:

- `pending`
- `success`
- `expired`
- `failed`

### Creation

- local order is created as `pending`

### Success path

- WeChat callback says paid -> `pending -> success`
- active query says paid -> `pending -> success`

### Final failure path

- query says `CLOSED` -> `pending -> expired`
- query says `REVOKED` -> `pending -> failed`
- query says `PAYERROR` -> `pending -> failed`

### Non-final processing path

- `NOTPAY` -> remain `pending`
- `USERPAYING` -> remain `pending`

## WeChat Trade State Mapping

Recommended mapping:

- `SUCCESS` -> `success`
- `NOTPAY` -> `pending`
- `USERPAYING` -> `pending`
- `CLOSED` -> `expired`
- `REVOKED` -> `failed`
- `PAYERROR` -> `failed`

Unknown state handling:

- do not auto-settle
- log warning
- preserve order for later observation or compensation

## Scene Selection Rules

Request field `scene` supports:

- `auto`
- `h5`
- `native`

Selection:

- `auto` + mobile browser -> `H5`
- `auto` + desktop browser -> `Native`
- explicit `h5` -> force H5
- explicit `native` -> force Native

This is the simplest rule that matches current browser recharge usage.

## Callback Validation Rules

Webhook processing must validate all of the following before settlement:

- signature headers are present
- signature is valid
- encrypted payload decrypts successfully
- event indicates payment success
- `appid` matches configured `WeChatPayAppID`
- `mchid` matches configured `WeChatPayMchID`
- `out_trade_no` exists
- callback amount matches local order amount

If any check fails:

- reject processing
- write structured logs
- do not settle

## Amount Validation Rule

Callback and query settlement paths must validate amount equality:

- local `top_ups.money`
- converted to fen
- equals WeChat order `amount.total`

This is mandatory and should not be optional in v1.

## Pending Order Compensation Task

### File

- `service/wechatpay_pending_task.go`

### Strategy

Use the same style as the current Alipay pending-order task:

- run periodically
- scan `payment_provider=wechat_pay AND status=pending`
- only query orders older than a short delay window

Recommended initial parameters:

- tick interval: 5 minutes
- query delay: 1 minute
- batch size: 100

### Query outcomes

- `SUCCESS` -> settle
- `NOTPAY` / `USERPAYING` -> keep pending
- `CLOSED` -> expired
- `REVOKED` / `PAYERROR` -> failed
- query error -> log and continue

## Admin and Frontend Design

### Admin

Add WeChat Pay settings to the payment settings area:

- enable switch
- H5 enable switch
- Native enable switch
- AppID
- MchID
- SerialNo
- PrivateKey
- APIv3Key
- validation material
- NotifyURL
- ReturnURL
- MinTopUp

### User Wallet Recharge

Both classic and default frontend should consume only the normalized backend response:

- `pay_type=h5` -> redirect
- `pay_type=qrcode` -> render QR code

Frontend should not implement:

- WeChat signing
- WeChat query
- WeChat callback logic

Frontend may continue polling local order status if better UX is desired.

## Error Handling

### Order creation errors

- missing config -> payment not configured
- invalid amount -> invalid params or min-topup error
- local order create failure -> order create failure
- WeChat create-order failure -> payment start failure

### Webhook errors

- webhook disabled -> `403`
- missing signature headers -> reject
- signature invalid -> reject
- resource decrypt failure -> reject
- appid mismatch -> reject
- mchid mismatch -> reject
- amount mismatch -> reject
- unknown local order -> reject and log

### Compensation errors

- query API failure -> log only, no local state mutation
- invalid status transition -> log and continue

## Logging Requirements

At minimum, these log dimensions should be preserved.

### Order creation

- `user_id`
- `trade_no`
- `scene`
- `amount`
- `money`
- WeChat payment type

### Webhook

- `trade_no`
- WeChat trade state
- amount in fen
- `appid`
- `mchid`
- signature verification result
- decryption result

### Compensation

- `trade_no`
- query result state
- settlement result

All critical payment logs should include local `trade_no`.

## Risks

### 1. Webhook processing is more complex than Alipay

WeChat callback handling requires:

- signature verification
- encrypted payload decryption
- business payload validation

If any layer is wrong, the symptom is often "payment succeeded in WeChat but local quota did not arrive".

Mitigation:

- never ship webhook handling without query compensation

### 2. Wrong `APIv3Key` breaks notification handling

Order creation may still work while callback decryption fails.

Mitigation:

- strict startup or runtime validation for configured WeChat Pay
- compensation task must be enabled

### 3. H5 testing cannot rely on localhost only

Production H5 flow depends on:

- public callback URL
- real browser environment
- valid merchant-domain setup

Mitigation:

- local testing covers controller and service mechanics
- end-to-end payment acceptance requires a real online environment

### 4. Amount conversion drift can create false mismatches

Mitigation:

- one central conversion function
- consistent decimal conversion
- callback and query both use the same rule

### 5. Missing idempotency can duplicate quota settlement

Mitigation:

- all settlement funnels through `RechargeWeChatPay`
- row locking and status checks remain mandatory

## Non-Functional Requirements

- sensitive WeChat payment config must not be exposed via `/api/option`
- settlement must be idempotent
- compensation task must be safe to retry
- incomplete config must not expose a user payment entry
- all payment logs must carry local order identity

## Testing Strategy

### Service tests

- amount-to-fen conversion
- authorization header construction
- callback signature verification
- callback payload decryption
- trade-state mapping

### Controller tests

- reject order creation when config is incomplete
- H5 response shape
- Native response shape
- reject wrong payment method
- reject webhook when disabled

### Model tests

- `RechargeWeChatPay` success path
- repeated settlement idempotency
- invalid final-state transition rejection

### Compensation tests

- query success triggers settlement
- query closed transitions to expired
- query error logs and continues

## Acceptance Criteria

Minimum manual acceptance checklist:

1. admin can save WeChat Pay settings
2. incomplete config does not expose or enable the payment entry
3. mobile browser request returns H5 payment URL
4. desktop browser request returns Native QR code URL
5. successful WeChat callback settles local quota
6. missed callback can still be compensated by query task
7. repeated callback does not duplicate quota
8. amount mismatch rejects settlement

## Implementation Boundary

This v1 explicitly does not include:

- JSAPI / OpenID acquisition
- refund application flow
- refund callback handling
- bill download and parsing
- automatic platform-certificate rotation
- `transaction_id` persistence
- new `payment_transactions` storage
- cross-provider abstraction refactor

## Final Recommendation

Implement WeChat Pay v1 as:

- `H5 + Native`
- wallet top-up only
- `top_ups` reuse
- local `trade_no` as `out_trade_no`
- webhook-first settlement
- active query compensation for pending orders
- no new table
- no JSAPI
- no refunds

This gives the project a complete, practical WeChat Pay recharge flow with bounded implementation scope and low architectural churn.
