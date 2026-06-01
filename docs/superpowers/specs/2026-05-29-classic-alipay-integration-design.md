# Classic Theme Alipay Integration Design

## Background

The current Alipay V1 work has already added backend support for:

- Alipay top-up order creation
- Alipay async notify verification
- Scheduled pending-order reconciliation by `out_trade_no`
- Payment settings and wallet entry in the `default` frontend

The local acceptance environment is intentionally using the `classic` frontend theme. In that theme:

- the admin payment settings UI does not expose Alipay configuration fields
- the user wallet UI does not route `alipay` through the native Alipay payment flow

This creates a mismatch where backend support exists, but the active frontend theme cannot configure or use it.

## Goal

Add complete `classic` theme support for Alipay V1 so that:

1. administrators can configure Alipay in the `classic` payment settings UI
2. end users can select Alipay in the `classic` wallet recharge flow
3. the wallet keeps the existing confirmation modal behavior and only redirects after user confirmation
4. no theme switch is required for acceptance

## Scope

In scope:

- `classic` admin payment settings
- `classic` wallet recharge flow
- `classic` top-up info parsing for Alipay flags and minimum top-up
- `classic` payment navigation to the backend Alipay pay endpoint

Out of scope:

- subscription purchase via Alipay
- redesigning the `classic` payment settings architecture
- refactoring all payment gateways into a new shared abstraction
- changing backend Alipay business rules already implemented for V1

## Current Project Context

Relevant backend pieces already exist:

- [`controller/topup_alipay.go`](/mnt/c/users/shaoq/go/src/new-api/controller/topup_alipay.go)
- [`service/alipay.go`](/mnt/c/users/shaoq/go/src/new-api/service/alipay.go)
- [`service/alipay_pending_task.go`](/mnt/c/users/shaoq/go/src/new-api/service/alipay_pending_task.go)
- [`controller/topup.go`](/mnt/c/users/shaoq/go/src/new-api/controller/topup.go)

Relevant `classic` frontend files:

- [`web/classic/src/components/settings/PaymentSetting.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/settings/PaymentSetting.jsx)
- [`web/classic/src/pages/Setting/Payment/SettingsPaymentGateway.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGateway.jsx)
- [`web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayStripe.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayStripe.jsx)
- [`web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayCreem.jsx](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayCreem.jsx)
- [`web/classic/src/components/topup/RechargeCard.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/topup/RechargeCard.jsx)
- [`web/classic/src/components/topup/index.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/topup/index.jsx)
- [`web/classic/src/components/topup/modals/PaymentConfirmModal.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/topup/modals/PaymentConfirmModal.jsx)

`classic` already supports multiple payment branches:

- Epay via form submission
- Stripe via redirect link
- Creem via checkout URL
- Waffo / Waffo Pancake via redirect URL

Alipay should follow the same integration style instead of introducing a new UX model.

## Recommended Approach

Use the existing `classic` payment architecture and add Alipay as one more gateway with minimal structural change.

Why this approach:

- lowest behavioral risk for the active acceptance theme
- matches user expectation that `classic` remains the primary UI
- preserves the existing payment confirmation modal and button flow
- aligns with the backend API that already returns `pay_url`

Rejected alternatives:

1. Switching local acceptance to `default`
   - rejected because the user explicitly wants `classic`

2. Refactoring all `classic` payment settings into a new unified payment framework
   - rejected because it is too large for the current scope and increases regression risk

3. Only exposing Alipay through generic `PayMethods` JSON without a dedicated settings tab
   - rejected because it gives poor operator UX and leaves the feature effectively hidden

## Functional Design

### 1. Classic Admin Settings

Add a new `Alipay 设置` tab to the `classic` payment settings area.

This tab will expose the same backend fields already registered in the server:

- `AlipayEnabled`
- `AlipaySandbox`
- `AlipayAppID`
- `AlipayPrivateKey`
- `AlipayPublicKey`
- `AlipayGateway`
- `AlipayNotifyURL`
- `AlipayReturnURL`
- `AlipaySellerID`
- `AlipayMinTopUp`

The tab should follow the existing `classic` payment settings pattern:

- local component state initialized from `props.options`
- save by posting `[{ key, value }]` through the existing option update helper
- no new backend endpoint
- no hidden cross-theme dependency

The UX should include:

- a short explanatory block saying the webhook URL is `/api/alipay/notify`
- a note that desktop uses `page.pay` and mobile browser uses `wap.pay`
- password/textarea treatment for key material consistent with existing Stripe/Creem/Waffo settings

### 2. Classic Wallet Recharge

The `classic` wallet recharge panel should recognize Alipay as a first-class regular payment method.

Expected behavior:

1. `/api/user/topup/info` returns `enable_alipay_topup`, `alipay_min_topup`, and a `pay_methods` item with `type=alipay`
2. `classic` renders Alipay inside the existing payment method selector
3. user chooses amount and selects Alipay
4. the existing confirmation modal opens
5. after confirm, frontend calls `/api/user/alipay/pay`
6. backend returns `pay_url`
7. frontend redirects to that URL

This keeps the exact same interaction shape as the existing `classic` recharge flow:

- select method
- confirm
- redirect

No custom embedded form or QR-only branch is needed for V1.

### 3. Payment Confirmation Modal

No structural redesign is needed.

The existing modal should continue to display:

- recharge amount
- payment amount
- selected payment method

Alipay only needs to render correctly as one of the selectable payment methods and then branch to the Alipay pay API when the user confirms.

### 4. Recharge History

No additional design work is needed here.

`classic` top-up history already contains an `alipay -> 支付宝` mapping in:

- [`web/classic/src/components/topup/modals/TopupHistoryModal.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/topup/modals/TopupHistoryModal.jsx)

So once top-up orders are created with `payment_method=alipay`, the history view should already display sensible labels.

## File-Level Design

### Files to Modify

- [`web/classic/src/components/settings/PaymentSetting.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/settings/PaymentSetting.jsx)
  - register Alipay option defaults
  - parse Alipay option values from backend options payload
  - add the `Alipay 设置` tab

- [`web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayAlipay.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayAlipay.jsx)
  - new admin settings component for Alipay

- [`web/classic/src/components/topup/index.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/topup/index.jsx)
  - ensure top-up info state carries Alipay enablement and minimum-top-up fields
  - add request branch for `/api/user/alipay/pay`

- [`web/classic/src/components/topup/RechargeCard.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/topup/RechargeCard.jsx)
  - ensure `alipay` is treated as an enabled standard payment option when returned by backend
  - keep confirmation flow unchanged

- [`web/classic/src/components/topup/modals/PaymentConfirmModal.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/components/topup/modals/PaymentConfirmModal.jsx)
  - verify Alipay method label/icon branch is present; add if missing

### Files to Reuse Without Structural Change

- [`web/classic/src/helpers/paymentNavigation.js`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/helpers/paymentNavigation.js)
  - may be reused if its redirect helper fits the new Alipay branch

- [`web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayStripe.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayStripe.jsx)
  - reference pattern for save mechanics and section layout

- [`web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayCreem.jsx`](/mnt/c/users/shaoq/go/src/new-api/web/classic/src/pages/Setting/Payment/SettingsPaymentGatewayCreem.jsx)
  - reference pattern for textarea/list settings and settings tips block

## Data Flow

### Admin Configuration Flow

1. root admin opens `classic` payment settings
2. opens `Alipay 设置`
3. fills gateway credentials and min top-up
4. saves settings through existing options update flow
5. backend persists options and refreshes runtime settings

### User Recharge Flow

1. wallet requests `/api/user/topup/info`
2. backend includes Alipay capability flags and `pay_methods` entry
3. user selects Alipay and an amount
4. wallet opens the standard confirmation modal
5. confirm action calls `/api/user/alipay/pay`
6. backend creates `TopUp` with `pending` status and returns `pay_url`
7. browser redirects to Alipay
8. final success still depends on `notify` or scheduled `query`

## Error Handling

The `classic` frontend should follow its existing payment error behavior:

- if Alipay is not configured or disabled, show the backend error message
- if amount is below `alipay_min_topup`, block before successful pay start
- if `/api/user/alipay/pay` does not return a valid `pay_url`, show a generic payment request failure
- if redirect cannot be started, show a visible error instead of silently failing

No browser return page should be treated as proof of payment.

## Testing Strategy

### Manual Verification

In `classic` theme:

1. open payment settings and verify the new `Alipay 设置` tab exists
2. save each Alipay field and reload settings page to confirm values persist
3. open wallet recharge page and verify Alipay appears as a selectable payment method
4. select Alipay, click recharge, confirm the modal still appears first
5. confirm payment and verify browser redirects to an Alipay payment URL
6. verify top-up history continues to show `支付宝` for Alipay orders

### Regression Checks

- Stripe flow in `classic` still opens correctly
- Epay form submission still works
- Creem section remains visible and saveable
- Waffo payment selection is unaffected

## Risks

### Theme Duplication Risk

Payment settings now exist in both `default` and `classic`, which means Alipay configuration UI must be maintained in two frontends.

This is acceptable for now because:

- the backend settings keys are shared
- the user explicitly wants `classic`
- the change is small and localized

### Classic-Specific Flow Risk

`classic` wallet code has accumulated gateway-specific branches. Adding one more branch increases local conditional complexity.

Mitigation:

- keep Alipay logic narrow and explicit
- do not refactor unrelated gateways during this work

## Success Criteria

This work is complete when all of the following are true in `classic` theme:

- root admin can configure Alipay from the payment settings UI
- user wallet shows Alipay when backend configuration enables it
- recharge still uses the existing confirmation modal first
- confirm action redirects to the Alipay payment URL
- backend-created Alipay top-up orders continue to be processed by notify/query V1 logic
