# Recall Subscription Discount Design

## Goal

Make a validated recall offer visible on eligible subscription plans and ensure the same claim reaches Stripe Checkout through the flexible self-purchase endpoint.

## Confirmed behavior

- Only Stripe Prices listed in `products.subscription_price_ids` receive the offer.
- Percentage discounts show a dynamic badge such as `20% OFF`, the original monthly price with a line through it, and the calculated discounted price.
- Fixed discounts show the configured reduction (for example `5.00 USD OFF`), the original monthly price with a line through it, and the calculated discounted price.
- Fixed discounts are displayed only when their currency matches the plan currency. Minimum-amount restrictions must also be met.
- The discounted amount is clamped at zero and rounded to currency minor units.
- The purchase dialog uses the same calculation only while `stripe_recurring` is selected. Pix, UPI, Alipay, and balance remain undiscounted.
- Before purchase, the frontend revalidates the claim for the selected subscription Price and sends `recall_claim` only for eligible Stripe recurring purchases.
- The backend independently validates the claim and injects its Stripe Promotion Code into Checkout. The UI calculation is preview-only; Stripe remains authoritative.

## Data flow

`Wallet recall_claim` -> `RecallClaimProvider` -> eligible plan preview -> purchase-time claim validation -> `POST /api/subscription/self/purchase` -> `PurchaseSubscription` -> `ChangeSubscriptionPlan` -> `BuildCheckoutDiscount` -> Stripe Checkout `discounts[].promotion_code`.

## Scope

The change is limited to the flexible subscription purchase flow, recall price helpers, the plan card/purchase dialog, and focused tests. It does not add discounts to Pix, UPI, Alipay, or balance purchases and does not change campaign configuration.

## Verification

- Unit-test percent/fixed calculations, currency mismatch, minimum amount, and zero clamp.
- Render-test eligible/ineligible plan cards and purchase-dialog totals.
- Verify request construction includes the claim only for Stripe recurring.
- Verify the self-purchase backend propagates a valid claim to Stripe Checkout as a Promotion Code with recall metadata.

