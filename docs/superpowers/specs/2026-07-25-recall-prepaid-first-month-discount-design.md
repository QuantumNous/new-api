# Recall Prepaid First-Month Discount Design

## Goal

Apply an eligible recall subscription offer to the first month of a multi-month Alipay, Pix, or UPI purchase while Stripe Checkout still collects the full multi-month order in one payment.

For `N` purchased months, the charged total is:

`discounted first month + (N - 1) full-price months`

## Confirmed behavior

- The offer applies to Alipay, Pix, and UPI one-time subscription purchases. Balance purchases remain unchanged.
- Percentage and fixed-amount offers discount only one monthly unit, including a one-month purchase.
- Pix uses the configured BRL monthly quote, UPI uses INR, and Alipay uses the plan quote currency.
- Fixed discounts use the matching `currency_options` value, falling back to the primary amount only when its currency matches. A missing matching currency leaves the quote at full price.
- Minimum-amount eligibility is evaluated against the first month's undiscounted price in the quote currency.
- The discount is rounded in minor units and capped at one month's price, so the order total cannot become negative.
- The purchase dialog shows the original multi-month total struck through and the discounted total returned by the backend.

## Approaches considered

### 1. Server-priced first-month reduction in the signed quote — selected

The backend validates the recall claim, calculates one month's discount, signs the original unit amount, total, discount, and recipient identity into the quote token, and revalidates them during purchase. Stripe Checkout receives one line item for the already-authoritative discounted total.

This preserves the existing local-currency quote flow and guarantees that only one month is discounted.

### 2. Apply the existing Stripe Promotion Code to the full one-time order — rejected

The current Checkout line item represents all purchased months. Applying the promotion code directly would discount the entire multi-month subtotal, not only the first month.

### 3. Split Checkout into eligible and ineligible Stripe products — rejected

Separate first-month and remaining-month line items could constrain the coupon to one item, but it requires additional Stripe product lookup and product-scope coupling. It is larger and less reliable than the existing signed-quote boundary.

## Backend design

1. `QuoteSubscriptionPurchase` resolves the normal monthly quote, validates the recall claim against the plan's Stripe Price, and calculates a first-month discount in minor units.
2. The signed quote token binds the original monthly amount, discounted total, discount amount, campaign ID, and recipient ID to user, plan, payment method, month count, request ID, plan revision, and expiry.
3. `PurchaseSubscription` independently validates the raw claim again and requires its recomputed discount and recipient identity to match the signed quote before creating an order.
4. The subscription order stores the validated recall campaign, recipient, Promotion Code, and discount amount. No raw claim is persisted.
5. Stripe Checkout metadata carries those server-generated fields. Recall attribution treats the metadata Promotion Code and discount amount as the authoritative locally applied offer after successful payment.

## Frontend design

1. Quote and purchase requests include `recall_claim` for eligible Stripe recurring, Alipay, Pix, and UPI choices, but never for balance.
2. One-time payment display uses backend quote fields `original_total`, `discount_amount`, and `total`; it does not recalculate local-currency discounts in the browser.
3. Stripe recurring keeps the existing preview and Promotion Code path.

## Error handling and security

- Expired, converted, suppressed, wrong-user, or wrong-price claims fail at quote or purchase time.
- A discounted quote without the matching raw claim is rejected.
- A full-price quote remains valid when no currency-specific fixed discount applies.
- Quote arithmetic requires `total = unit_price * months - first_month_discount` and `0 <= discount <= unit_price`.
- Replayed request IDs reuse the existing order; they cannot alter payment method, months, quote, or recall identity.

## Verification

- Backend tests cover three-month percentage and fixed discounts, local currencies, one-month clamping, full-price fallback, token tampering, missing/mismatched claims, order persistence, Checkout metadata, and attribution parsing.
- Frontend tests cover quote/purchase claim propagation, discounted multi-month totals, original-total strike-through, and unchanged balance behavior.
- Targeted Go tests, wallet tests, typecheck, formatting, and diff checks must pass before opening the PR.
