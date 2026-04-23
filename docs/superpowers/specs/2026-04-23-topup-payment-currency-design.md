# Top-Up Payment Currency Design

Date: 2026-04-23

## Goal

Fix the top-up page amount display so payment amounts are shown in the currency used by the selected payment method. The immediate issue is that Stripe USD amounts can be converted again by the frontend and displayed as values such as `$0.14` for a `$1.00` payment.

## Scope

This design applies only to the top-up page and wallet-related amount display used by the top-up flow.

It does not change:

- Database schema or existing data.
- Backend order semantics.
- Stripe checkout quantity semantics.
- Global language selection behavior.
- Global quota rendering across unrelated pages.

## Current Problem

The current top-up UI mixes three separate concepts:

- Top-up quantity: the amount of quota the user wants to buy.
- Preview amount: the backend-calculated payment amount for a payment method.
- Display currency: the symbol and conversion used by frontend rendering helpers.

On the deployed 104 server, the relevant settings are:

- `price = 7.3`
- `quota_display_type = USD`
- `usd_exchange_rate = 7.3`
- `stripe_unit_price = 1`

The backend has separate amount endpoints:

- `/api/user/amount` calculates ordinary online payment amounts with `price`.
- `/api/user/stripe/amount` calculates Stripe amounts with `stripe_unit_price`.

The frontend currently has places that calculate or convert amounts locally. This can cause Stripe amounts, which are already USD, to be divided by `usd_exchange_rate` again.

## Design

Use `paymentCurrency` as the source of truth for the actual payment amount display.

`paymentCurrency` is determined by payment method, not by UI language:

- `stripe` -> `USD`
- `alipay` -> `CNY`
- `wxpay` -> `CNY`
- ordinary Epay methods -> `CNY`
- `waffo` and `waffo_pancake` -> use their backend amount response and configured payment currency when available, defaulting to `USD`

The top-up page should not automatically switch currencies based on Chinese or English language selection.

## User-Facing Behavior

When the user enters or selects a top-up quantity:

- The quantity remains the quota purchase quantity.
- The amount shown as payable should be recalculated for the relevant payment method.
- Stripe payable amounts are shown with `$`.
- Alipay, WeChat Pay, and ordinary Epay payable amounts are shown with `¥`.
- Stripe amounts must not be divided by `usd_exchange_rate`.
- Epay amounts must not be labeled as USD.

When the user opens the payment confirmation modal:

- The modal displays the selected payment method.
- The modal displays the backend-confirmed payment amount.
- The modal formats the amount with the selected payment method's `paymentCurrency`.

## Component Boundaries

Top-up page state should distinguish:

- `topUpCount`: the quota purchase quantity.
- `amount`: the backend-confirmed payment amount for the current payment method.
- `payWay`: the selected payment method.
- `paymentCurrency`: the currency used to format `amount`.

Recommended helper boundaries:

- `getPaymentCurrency(payWay, payMethodConfig)`: maps a payment method to a currency.
- `formatPaymentAmount(amount, currency)`: formats the payable amount with the correct symbol.
- `requestAmountByPayment(payment, value)`: calls the correct backend amount endpoint.

Existing global helpers such as `renderQuota()` and `getCurrencyConfig()` should not be changed globally for this fix.

## Data Flow

1. The page loads top-up configuration from `/api/user/topup/info`.
2. The user enters a quantity or selects a preset.
3. The page determines the active payment method when a method is selected.
4. The page calls the amount endpoint for that payment method:
   - Stripe: `/api/user/stripe/amount`
   - ordinary Epay: `/api/user/amount`
   - Waffo: `/api/user/waffo/amount`
   - Waffo Pancake: `/api/user/waffo-pancake/amount`
5. The returned amount is stored without additional currency conversion.
6. The amount is formatted with `paymentCurrency`.
7. The payment request uses the existing backend API and existing `amount` payload semantics.

## Error Handling

If amount preview fails:

- Keep the payment button behavior consistent with the existing flow.
- Show the existing failure toast where the code already does so.
- Do not fall back to local currency conversion for Stripe.
- Do not show a stale amount in the confirmation modal after a failed preview request.

If a payment method has no known currency:

- Use the currency configured on the payment method if present.
- Otherwise default to `USD`.
- Keep the mapping centralized so new methods can be added without duplicating currency logic.

## Testing

Manual test cases:

- Input `1`, choose Stripe: payable amount shows `$1.00`, not `$0.14`.
- Input `20`, choose Stripe: payable amount shows `$20.00`.
- Input `20`, choose Alipay or WeChat Pay: payable amount shows `¥146.00` when `price = 7.3`.
- Select preset `20`, then choose Stripe: confirmation modal shows `$20.00`.
- Select preset `20`, then choose ordinary Epay: confirmation modal shows `¥146.00`.
- Switch browser language between Chinese and English: payment currency does not change solely because of language.

Regression checks:

- Stripe checkout still receives the same quantity payload.
- Ordinary Epay checkout still receives the same amount payload.
- Existing database records are not migrated or rewritten.
- Wallet balance rendering outside the top-up flow is unchanged.

## Rollout

This is a frontend-focused change with no data migration. Deployment can be done by rebuilding and replacing the application image. If problems appear, rollback only requires redeploying the previous image.
