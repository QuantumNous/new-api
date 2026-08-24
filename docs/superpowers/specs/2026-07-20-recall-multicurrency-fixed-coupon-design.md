# Recall Multi-Currency Fixed Coupon Design

## Context

The recall campaign feature can automatically create a Stripe Coupon with either a percentage discount or a single-currency fixed discount. Flatkey Checkout already uses one multi-currency Stripe Price per package and can settle in USD, INR, BRL, or JPY. A single-currency fixed Coupon therefore cannot provide the intended discount across every supported checkout currency.

This design makes the first released version of automatic fixed recall Coupons multi-currency. There is no released single-currency fixed-Coupon behavior or stored production data to preserve, so the implementation will not add migration or backwards-compatibility paths.

## Goal

Allow an operator to configure one automatic recall Coupon that subtracts approximately USD 5 in each supported checkout currency:

| Currency | Operator-facing default | Stripe minor-unit value |
| --- | ---: | ---: |
| USD | 5.00 | 500 |
| INR | 450.00 | 45000 |
| BRL | 25.00 | 2500 |
| JPY | 750 | 750 |

Stripe does not convert Coupon discount amounts at redemption time. Operators may adjust these four values per campaign when exchange-rate or commercial policy changes.

## Scope

In scope:

- Automatic fixed-amount recall Coupons.
- USD as the base Coupon currency.
- Required INR, BRL, and JPY `currency_options`.
- Human-readable currency inputs in the campaign editor.
- Backend validation, Stripe parameter construction, read-only display, tests, and the recall configuration guide.

Out of scope:

- Existing Stripe Coupon support or validation changes.
- Minimum-spend restrictions for multi-currency fixed Coupons.
- Runtime exchange-rate lookup or automatic currency conversion.
- Additional currencies.
- Migration or compatibility for older fixed-Coupon drafts.
- Any USD 5 product/package branch or pricing-tier change.

## Data Contract

`RecallDiscountConfig` retains the existing USD base fields and adds a map of Stripe minor-unit amounts:

```json
{
  "type": "fixed",
  "percent_off": 0,
  "amount_off": 500,
  "currency": "usd",
  "currency_options": {
    "inr": 45000,
    "brl": 2500,
    "jpy": 750
  },
  "minimum_amount": 0,
  "minimum_amount_currency": "",
  "coupon_redeem_by": 0
}
```

The API and persisted campaign JSON use integer minor units because this matches Stripe's API and avoids floating-point ambiguity. Map keys are normalized to lowercase before validation and persistence. Map ordering has no semantic meaning.

For percentage discounts, `amount_off`, `currency`, and `currency_options` must be empty or zero as appropriate.

## Campaign Editor

When `coupon_source` is `automatic` and the discount type is `fixed`, the editor displays four currency inputs with the defaults in the goal table.

- USD, INR, and BRL accept positive values with at most two decimal places.
- JPY accepts a positive whole-number value.
- All four values are required.
- The editor explains that Stripe does not perform live Coupon currency conversion.
- The editor converts displayed major-unit values to integer minor units before schema validation and submission, and converts stored minor units back for editing and display.
- The minimum-spend fields are unavailable for this mode and are submitted as zero and an empty currency.

The campaign details, preview, and relevant operational summaries display all four human-readable amounts. Preview remains read-only and does not create a Stripe Coupon.

Percentage-discount UI behavior remains unchanged.

## Backend Validation

For an automatic fixed discount, the backend requires all of the following:

- `currency` equals `usd` after normalization.
- `amount_off` is greater than zero.
- `currency_options` contains exactly `inr`, `brl`, and `jpy`.
- Every currency-option amount is greater than zero.
- `percent_off` is zero.
- `minimum_amount` is zero.
- `minimum_amount_currency` is empty.

The backend rejects missing currencies, additional currencies, invalid or non-positive amounts, a non-USD base currency, and any minimum-spend restriction. These checks are authoritative even when the frontend has already validated the draft.

## Stripe Coupon Creation

The automatic Coupon builder sends:

```text
amount_off = 500
currency = usd
currency_options[inr][amount_off] = 45000
currency_options[brl][amount_off] = 2500
currency_options[jpy][amount_off] = 750
```

The exact amounts come from the campaign configuration, not hard-coded creation logic. Product scope, duration, maximum redemptions, metadata, redeem-by behavior, and the existing `campaign ID + config revision` idempotency key remain unchanged.

When Checkout uses one of the four supported currencies, Stripe applies that currency's fixed amount. Coupon creation must succeed before campaign activation can complete. A permanent validation or Stripe error prevents activation and therefore prevents recall delivery from starting. Retryable Stripe failures continue through the existing bounded retry path, with the idempotency key preventing duplicate Coupons.

The existing-Coupon path is outside this feature and receives no code changes.

## Activation and Mutability

The four discount amounts are editable only while the campaign is a draft. Activation locks the complete discount configuration along with the existing locked campaign fields. Pausing or cancelling a campaign does not mutate or revoke a Coupon that Stripe has already created.

## Testing

Backend unit tests will cover:

- Normalization of currency keys.
- Acceptance of the exact USD/INR/BRL/JPY fixed configuration.
- Rejection of missing, additional, zero, or negative currency-option amounts.
- Rejection of a non-USD base currency and any minimum-spend restriction.
- Exact construction of `stripe.CouponParams.CurrencyOptions`.
- Preservation of the existing idempotency key and retry behavior.
- No behavioral change to percentage discounts.

Frontend tests will cover:

- Major-unit to minor-unit conversion for USD, INR, BRL, and JPY.
- Round-trip display conversion.
- Decimal-place rules and required positive values.
- Schema rejection when any required currency is absent or invalid.
- Clearing incompatible fixed fields when switching to percentage discounts.

Stripe Test Mode verification will create an automatic Coupon and exercise USD, INR, BRL, and JPY Checkout sessions, confirming that each currency receives the configured discount and no minimum-spend restriction is present.

## Documentation and Rollout

The standalone recall campaign HTML guide will be updated with the four input values, the minor-unit explanation, the no-live-conversion warning, and a Stripe Test Mode checklist.

Implementation stays on `feature/stripe-user-winback`. After targeted tests, frontend validation, type checking, and Stripe Test Mode verification pass, only the verified recall commits may be promoted to `staging`. The feature PR remains targeted at `main`, and `main` is not merged or pushed by this workflow.
