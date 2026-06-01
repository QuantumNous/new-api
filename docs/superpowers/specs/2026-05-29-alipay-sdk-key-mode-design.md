# Alipay SDK Key-Mode Replacement Design

## Background

The project already has a native Alipay V1 integration for wallet top-up:

- create local pending orders in `top_ups`
- generate an Alipay cashier URL for desktop `page.pay` and mobile `wap.pay`
- verify async notify signatures
- run a scheduled pending-order reconciliation task with `alipay.trade.query`
- expose Alipay settings in the admin UI and Alipay top-up entry in the `classic` wallet flow

The current implementation is functionally complete, but the Alipay protocol layer is mostly handwritten in:

- [service/alipay.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay.go)

That handwritten layer currently covers:

- request parameter assembly
- RSA2 signing
- AES request encryption for `biz_content`
- query response signature verification
- encrypted response parsing
- notify parameter normalization and signature verification

During sandbox verification, the current implementation can create local pending orders and return a `pay_url`, but real cashier behavior has been unstable:

- cashier opens and then redirects to sandbox error pages
- `alipay.trade.query` often returns `ACQ.TRADE_NOT_EXIST`
- the failure point appears close to the actual Alipay request construction and acceptance path

This makes the protocol layer the highest-value place to simplify and harden.

## Goal

Replace the current handwritten Alipay protocol integration with `github.com/smartwalle/alipay/v3` while preserving the existing business flow and admin configuration shape.

Success means:

1. the project stays in Alipay key mode, not certificate mode
2. existing setting names remain unchanged
3. existing controller routes and `top_ups` storage remain unchanged
4. AES interface-content encryption remains optional
5. page pay, wap pay, trade query, and notify verification all run through the SDK whenever the SDK supports the needed behavior cleanly
6. the replacement is low-risk and easy to roll back

## Scope

In scope:

- replace the protocol implementation behind the current Alipay service helpers
- keep key-mode configuration
- keep optional AES behavior
- keep current top-up business logic and pending-order reconciliation model
- keep `classic` and current backend API contracts unchanged
- improve logging around actual outgoing request shape and incoming Alipay error details

Out of scope:

- switching to Alipay certificate mode
- redesigning the payment architecture for all providers
- introducing new order tables
- changing `top_ups` schema
- adding refund support
- adding subscription purchase via Alipay
- changing frontend payment UX

## Existing Project Context

Current Alipay business entry points:

- [controller/topup_alipay.go](/mnt/c/users/shaoq/go/src/new-api/controller/topup_alipay.go)
- [service/alipay_pending_task.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay_pending_task.go)
- [controller/topup.go](/mnt/c/users/shaoq/go/src/new-api/controller/topup.go)

Current admin and user-side configuration entry:

- [web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayAlipay.jsx](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayAlipay.jsx)

Current runtime configuration already used by the system:

- `AlipayEnabled`
- `AlipaySandbox`
- `AlipayAppID`
- `AlipayPrivateKey`
- `AlipayPublicKey`
- `AlipayEncryptKey`
- `AlipayGateway`
- `AlipayNotifyURL`
- `AlipayReturnURL`
- `AlipaySellerID`
- `AlipayMinTopUp`

Current service consumers depend on the following behaviors:

- `BuildAlipayPayURL(...)`
- `QueryAlipayTrade(...)`
- `QueryAlipayTradeWithEncryptKey(...)`
- `VerifyAlipaySignature(...)`
- trade-status mapping helpers

The design must preserve those higher-level expectations or provide equivalent wrappers.

## Alternatives Considered

### Approach A: Replace only the protocol layer with the SDK

Keep existing business APIs, data model, config names, and frontend behavior. Internally route Alipay operations through `smartwalle/alipay`.

Pros:

- lowest migration risk
- smallest surface change
- easiest rollback
- directly targets the most failure-prone layer

Cons:

- some compatibility wrapper code is still needed
- if the SDK has gaps for optional AES edge cases, a small amount of fallback code may remain

### Approach B: Replace only query and notify, keep pay URL handwritten

Pros:

- smallest code change

Cons:

- does not address the current highest-risk part, which is request construction and cashier acceptance
- likely leaves the most suspicious bug source untouched

### Approach C: Build a brand-new Alipay provider module and migrate controllers to it

Pros:

- cleanest long-term structure

Cons:

- too large for the current problem
- introduces more regression risk than necessary
- slows down sandbox validation

## Recommendation

Adopt Approach A.

This keeps the business flow stable while removing most handwritten Alipay protocol logic from the critical path. It is the smallest change set that can realistically improve request correctness, signature behavior, and response handling at the same time.

## High-Level Design

### Stable Business Boundaries

The following parts remain unchanged:

- `POST /api/user/alipay/pay`
- `POST /api/alipay/notify`
- `top_ups` as the single local wallet recharge order table
- `trade_no` as local `out_trade_no`
- pending-order reconciliation cadence and overall logic
- classic admin setting fields and wallet recharge UX

### Replaced Protocol Layer

The following responsibilities move from handwritten code to SDK-backed code:

- client creation and gateway selection
- pay URL generation for page pay and wap pay
- trade query request creation
- query response decoding and signature verification
- notify signature verification and field extraction

### AES Compatibility Boundary

`AlipayEncryptKey` remains a runtime optional switch:

- empty: no `encrypt_type=AES`
- non-empty: enable AES request/response handling

Design rule:

- prefer native SDK AES support where available
- if the SDK lacks a needed path for key-mode plus optional AES in one specific flow, keep a very small compatibility layer only for that gap
- do not keep the current fully handwritten request/signature stack if the SDK can handle it directly

## Module Design

### 1. Service Layer Structure

Keep the current file-facing API stable for callers, but reimplement internals around a reusable SDK client factory.

Suggested internal structure inside [service/alipay.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay.go):

- `newAlipayClient(...)`
- `configureAlipayClient(...)`
- `BuildAlipayPayURL(...)`
- `QueryAlipayTrade(...)`
- `QueryAlipayTradeWithEncryptKey(...)`
- `VerifyAlipaySignature(...)`
- optional small helper wrappers for notify parsing and query error formatting

The top-level function names used by controllers and background tasks should be preserved where practical to minimize churn.

### 2. Client Initialization

The SDK client should be created from existing settings:

- app id from `AlipayAppID`
- private key from `AlipayPrivateKey`
- Alipay public key from `AlipayPublicKey`
- explicit gateway from `AlipayGateway` when provided
- sandbox fallback based on `AlipaySandbox` when gateway is empty
- optional AES key from `AlipayEncryptKey`

Expected initialization behavior:

1. validate required values
2. create SDK client in key mode
3. set public key for response verification
4. set gateway override if configured
5. if `AlipayEncryptKey` is non-empty, enable content encryption

The factory should return actionable errors so the controller logs show whether the failure is due to missing config, key parsing, or client setup.

### 3. Pay URL Generation

`BuildAlipayPayURL(...)` remains the service entry point used by the pay controller.

Input stays the same:

- gateway
- app id
- private key
- method
- page pay request
- encrypt key

Internal behavior changes:

1. create or reuse a configured SDK client
2. construct the SDK request object matching:
   - `out_trade_no`
   - `total_amount`
   - `subject`
   - `product_code`
   - `timeout_express`
   - `notify_url`
   - `return_url`
3. choose `TradePagePay` for desktop and `TradeWapPay` for mobile
4. return the SDK-generated cashier URL

The service should still preserve current method selection:

- desktop browser -> `alipay.trade.page.pay` -> `FAST_INSTANT_TRADE_PAY`
- mobile browser -> `alipay.trade.wap.pay` -> `QUICK_WAP_WAY`

### 4. Trade Query

`QueryAlipayTradeWithEncryptKey(...)` remains the query entry used by:

- pending-order reconciliation
- any future manual reconciliation path

Behavior:

1. query by local `out_trade_no`
2. let the SDK perform request signing and transport
3. map SDK response fields back into the existing local `AlipayTradeQueryResponse`
4. retain current local trade-status mapping logic
5. retain detailed query error formatting with:
   - `code`
   - `sub_code`
   - `sub_msg`

This preserves existing downstream behavior in:

- [service/alipay_pending_task.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay_pending_task.go)

### 5. Notify Verification

`POST /api/alipay/notify` remains unchanged at the route level.

Internal verification should move to the SDK:

1. parse form payload
2. verify sign using SDK and configured Alipay public key
3. extract normalized notify fields
4. continue existing business checks:
   - `out_trade_no` must exist
   - `app_id` must equal `AlipayAppID`
   - if configured, `seller_id` must equal `AlipaySellerID`
5. continue existing local settlement behavior:
   - `TRADE_SUCCESS` / `TRADE_FINISHED` -> settle
   - `TRADE_CLOSED` -> mark expired if still pending

The controller should not start trusting browser return pages. Async notify remains the primary success signal.

## Request and Response Mapping

### Local Pay Request Mapping

Existing local request object:

- `OutTradeNo`
- `TotalAmount`
- `Subject`
- `ReturnURL`
- `NotifyURL`
- `QuitURL`
- `TimeoutExpress`
- `ProductCode`

Mapped SDK request fields should preserve the same values. No user-facing API contract changes are required.

### Local Query Response Mapping

Current local response shape should be preserved:

- `Code`
- `Msg`
- `SubCode`
- `SubMsg`
- `OutTradeNo`
- `TradeNo`
- `TradeStatus`

This avoids rewriting:

- query status mapping
- pending-task logic
- current logs and tests

## Runtime Flow

### 1. User Top-Up Request

1. user calls `POST /api/user/alipay/pay`
2. controller validates amount, payment method, and optional return URL
3. controller calculates payable amount
4. controller creates local `trade_no`
5. controller asks service to generate cashier URL through the SDK
6. controller inserts pending `top_ups` row
7. controller returns:
   - `pay_type=redirect`
   - `pay_url`
   - `trade_no`

### 2. Async Notify Flow

1. Alipay posts to `/api/alipay/notify`
2. controller verifies signature via SDK-backed helper
3. controller checks `app_id` and optional `seller_id`
4. controller locks local order
5. controller settles or expires the local order based on `trade_status`
6. controller returns `success` or `fail`

### 3. Pending Reconciliation Flow

1. scheduled task loads pending Alipay top-up rows older than the delay threshold
2. task calls SDK-backed trade query by `out_trade_no`
3. query response maps to local status
4. successful payments settle through existing idempotent recharge logic
5. closed or failed payments update local pending order state

## Error Handling Design

### Client Initialization Errors

Examples:

- missing app id
- missing private key
- invalid private key format
- invalid Alipay public key format
- invalid AES key format

Handling:

- return explicit service errors
- controller logs should include user id, trade no, and exact setup error
- API response to end user remains generic payment start failure

### Pay URL Generation Errors

Examples:

- SDK request object validation failure
- signing failure
- AES setup failure

Handling:

- log exact underlying error
- preserve current user-facing failure message

### Query Errors

Query errors should continue to expose machine-useful and operator-useful details in logs, especially:

- `10000` success
- `40004`
- `ACQ.TRADE_NOT_EXIST`
- raw `sub_msg`

The current format `code | sub_code | sub_msg` should be preserved where possible.

### Notify Errors

Notify verification failure should continue to:

- log client IP
- return `fail`
- avoid touching local order state

Business validation failures such as wrong `app_id` or wrong `seller_id` should remain explicit and non-settling.

## Logging and Observability

To support sandbox troubleshooting, the SDK migration should keep or add structured logs for:

- selected method: page pay vs wap pay
- local `trade_no`
- app id
- whether AES is enabled
- query result code / sub-code / sub-msg
- notify trade status

Sensitive values must not be logged:

- private key
- AES key
- full raw signed payload

Allowed debug detail:

- field names and non-sensitive business values such as `out_trade_no`, `subject`, `total_amount`, `product_code`

## Testing Strategy

### Unit Tests

Update and extend existing tests in:

- [service/alipay_test.go](/mnt/c/users/shaoq/go/src/new-api/service/alipay_test.go)
- [controller/topup_alipay_test.go](/mnt/c/users/shaoq/go/src/new-api/controller/topup_alipay_test.go)

Focus:

- pay URL generation still selects correct mobile/desktop method
- query response mapping remains stable
- query error formatting remains stable
- notify verification path still rejects bad signatures and accepts valid ones
- AES empty vs AES enabled branch behavior stays deterministic

### Integration Validation

Local Docker validation should reuse the existing PostgreSQL local stack and real configured sandbox credentials.

Minimum validation set:

1. admin saves Alipay settings without field-name changes
2. user creates a local pending Alipay order
3. service returns a cashier URL generated by the SDK
4. opening the cashier URL does not regress compared with current behavior
5. pending task can query by `out_trade_no`
6. notify path still verifies valid payloads

### Regression Validation

Must confirm no regressions in:

- classic wallet recharge flow
- current top-up info response shape
- pending task startup conditions
- non-Alipay payment methods

## Rollout Plan

### Step 1. Dependency and Wrapper Introduction

- add `github.com/smartwalle/alipay/v3`
- keep current service function signatures stable
- implement SDK client factory and wrapper helpers

### Step 2. Pay URL Switch

- move page pay and wap pay URL generation to the SDK
- preserve local logs and current controller behavior

### Step 3. Query Switch

- move `trade.query` to the SDK
- preserve local response mapping and error formatting

### Step 4. Notify Verification Switch

- move notify verification to the SDK
- preserve controller business validation and order settlement logic

### Step 5. Cleanup

- remove no-longer-needed handwritten RSA/AES/signature/request assembly code
- keep only minimal compatibility helpers if the SDK does not fully cover one edge case

## Risks

### Risk 1. SDK AES Support Gap

The SDK may not cover every current edge case exactly the same way, especially around optional AES behavior in key mode.

Mitigation:

- validate SDK AES support before deleting compatibility helpers
- keep a narrow fallback helper only if needed

### Risk 2. Behavior Drift in Notify Parsing

Different normalization rules could subtly change which fields are trusted.

Mitigation:

- keep explicit post-verification checks for `app_id`, `seller_id`, and `out_trade_no`
- preserve existing controller settlement logic

### Risk 3. Sandbox Still Fails for External Reasons

If the root problem is sandbox app state, account mismatch, or cashier-side restrictions, migrating to the SDK may improve protocol correctness but still not fully resolve cashier errors.

Mitigation:

- treat SDK migration as protocol hardening, not guaranteed sandbox cure
- compare generated SDK request parameters with current known payloads during validation

### Risk 4. Hidden Dependency on Current Helper Behavior

Some callers or tests may depend on the exact current helper output shape.

Mitigation:

- preserve exported helper signatures where practical
- preserve response mapping structs and error message format

## Acceptance Criteria

The design is considered successfully implemented when all of the following are true:

1. admin configuration fields for Alipay remain unchanged in the UI and backend option keys
2. `POST /api/user/alipay/pay` still returns `pay_type`, `pay_url`, and `trade_no`
3. desktop uses page pay and mobile uses wap pay
4. `AlipayEncryptKey` remains optional
5. `POST /api/alipay/notify` still verifies valid callbacks and rejects invalid ones
6. pending-order reconciliation still queries by local `out_trade_no`
7. current local order status mapping remains unchanged
8. existing non-Alipay payment flows do not regress

## Non-Goals for This Pass

The following items are intentionally deferred:

- certificate mode migration
- refund APIs
- new payment transaction audit table
- reconciliation bill download
- redesign of the generic payment provider architecture
- browser-return-page based settlement

## Implementation Notes for Child Agents

If this design is handed to an implementation sub-agent, that agent should:

1. keep controller routes and request/response contracts unchanged
2. keep `top_ups` and status mapping unchanged
3. prefer adapting existing exported service helpers instead of creating parallel business entry points
4. use the SDK for pay, query, and notify first
5. only retain handwritten crypto code if required for a narrow unsupported AES edge case
6. verify behavior with Docker-based local testing before claiming completion
