# Recall Optional Multi-Currency Minimum Spend Design

## Context

Recall campaigns currently store one `minimum_amount` and one
`minimum_amount_currency`. The editor rewrites every positive minimum to USD,
while checkout eligibility requires the purchase currency to match that stored
currency exactly. A campaign that can be purchased in USD, INR, BRL, or JPY can
therefore lose its discount in the three non-USD currencies.

A single currency selector does not solve this: it merely chooses which one of
the four currencies works. The minimum-spend contract must represent all
supported checkout currencies.

## Goal

Keep minimum spend out of the normal operator workflow unless it is needed,
then require an explicit threshold for every supported Recall checkout currency.

- Minimum spend is disabled by default.
- Enabling it reveals four manually entered amounts: USD, INR, BRL, and JPY.
- No exchange rate or amount is inferred.
- Checkout and Stripe use the threshold for the buyer's exact currency.

## Operator Experience

The promotion section contains a `Set minimum spend` control.

When the control is off:

- the four amount inputs are hidden;
- no minimum-spend restriction is persisted or sent to Stripe;
- a new campaign needs no minimum-spend configuration.

When the control is on:

- the editor shows USD, INR, BRL, and JPY amount inputs;
- all four inputs are required and must be positive;
- USD, INR, and BRL accept at most two decimal places;
- JPY accepts positive whole numbers only;
- values are entered manually and are never auto-converted;
- turning the control off clears all four values.

The inputs use human-readable major units. The draft and Stripe adapter use
integer minor units. Field-level errors identify the exact missing or invalid
currency instead of reporting only a form-level error.

Content-only campaigns do not show the control. Promotion campaigns may use the
control with automatic percentage discounts, automatic fixed discounts, or an
existing Coupon because the restriction belongs to each generated Promotion
Code rather than to the Coupon's discount type.

## Canonical Data Contract

`discount_config` gains a canonical minimum-spend object:

```json
{
  "minimum_spend": {
    "enabled": true,
    "amounts": {
      "usd": 2000,
      "inr": 180000,
      "brl": 10000,
      "jpy": 3000
    }
  }
}
```

The amounts are Stripe minor-unit integers. Currency keys are normalized to
lowercase. When enabled, the map contains exactly `usd`, `inr`, `brl`, and `jpy`
and every value is greater than zero. When disabled, the canonical map is empty.

The existing `minimum_amount` and `minimum_amount_currency` fields remain as a
legacy compatibility shim during rollout:

- new enabled drafts dual-write the USD value into the legacy pair;
- new disabled drafts write `0` and an empty currency;
- legacy drafts with a positive single-currency minimum load with the control on,
  preserve that value, and require the missing currencies before they can be
  saved as a new multi-currency configuration;
- already-issued Promotion Codes are not rewritten or migrated.

Dual-writing keeps older application nodes fail-closed during a rolling deploy:
they retain the previous USD-only behavior instead of silently dropping the
minimum restriction. New nodes use `minimum_spend` as the source of truth.

## Backend Normalization and Validation

Backend normalization:

- normalizes minimum-spend keys to lowercase;
- rejects duplicate normalized keys;
- clears all minimum fields when disabled;
- dual-writes the USD amount into the legacy fields when enabled;
- preserves the legacy pair only when the canonical object is absent.

Authoritative validation requires the exact four-currency map when enabled.
Partial maps, extra currencies, zero or negative amounts, malformed currencies,
and contradictory disabled data are rejected. Automatic fixed discounts no
longer reject minimum spend solely because the old contract was single-currency.

## Stripe Promotion Code Mapping

Stripe supports multi-currency Promotion Code minimums through
`restrictions.currency_options`.

The adapter maps the canonical object to:

```text
restrictions.minimum_amount = minimum_spend.amounts.usd
restrictions.minimum_amount_currency = usd
restrictions.currency_options[inr].minimum_amount = minimum_spend.amounts.inr
restrictions.currency_options[brl].minimum_amount = minimum_spend.amounts.brl
restrictions.currency_options[jpy].minimum_amount = minimum_spend.amounts.jpy
```

USD is the deterministic Stripe base entry only; it is not an operator-facing
default. Stripe currency options exclude the base currency as required by the
API. Promotion Code reconciliation compares the full four-currency restriction
set instead of rejecting all currency options.

Official reference:

- <https://docs.stripe.com/api/promotion_codes/create>
- <https://docs.stripe.com/api/promotion_codes/object>

## Runtime Discount Selection

The server and frontend preview resolve the threshold by the exact uppercase
checkout currency:

1. if minimum spend is disabled, continue without a threshold;
2. if enabled, read that currency's configured amount;
3. if the currency is absent or the subtotal is below the amount, the candidate
   contributes zero discount;
4. otherwise calculate the percentage or fixed discount normally.

Currency mismatch never skips the minimum-spend check. This prevents an order
below the configured threshold from receiving the offer.

Legacy configurations without `minimum_spend` retain the existing exact-match
single-currency behavior until an operator converts the draft.

## Error Handling

- Enabling minimum spend with an incomplete map produces field-level errors.
- Unsupported checkout currency fails closed for an enabled restriction.
- Stripe returning a different restriction set remains a permanent
  reconciliation error with sanitized details.
- Disabling minimum spend removes both canonical and legacy restriction values.
- No live exchange-rate dependency or implicit fallback is introduced.

## Testing

Frontend tests cover:

- the control being off by default;
- four inputs appearing only when enabled;
- manual major-unit to minor-unit conversion for USD, INR, BRL, and JPY;
- exact decimal rules and required positive values;
- disabling the control clearing every amount;
- submit normalization preserving the canonical map and legacy USD shim;
- field-level validation errors and immutable rendering.

Backend tests cover:

- normalization and exact validation of the four-currency map;
- legacy single-currency read compatibility;
- disabled configuration clearing all values;
- automatic percentage, automatic fixed, and existing-Coupon acceptance;
- exact runtime threshold behavior in USD, INR, BRL, and JPY;
- fail-closed behavior for missing or unsupported currencies;
- exact Stripe Promotion Code request and reconciliation currency options.

Verification includes targeted frontend and Go tests, frontend typecheck, lint,
production build, Go build, review of the branch diff against `main`, and a
staging smoke test for one below-threshold and one qualifying checkout currency.

## Rollout

No database migration is required because `discount_config` is persisted as JSON.
Backend and frontend ship in the same console application image. The dual-write
compatibility shim protects mixed nodes during a rolling deployment. Existing
active Promotion Codes keep their issued Stripe restrictions; the change applies
to newly issued codes and drafts converted to the new contract.

The implementation stays on `fix/recall-account-offer-auto-apply`, updates PR
#577, and is promoted to `staging` only after verification. `main` is not merged
or pushed by this workflow.

## Non-Goals

- Live foreign-exchange conversion.
- Automatically guessing any operator-entered threshold.
- Additional checkout currencies beyond USD, INR, BRL, and JPY.
- Rewriting already-issued Stripe Promotion Codes.
