# Recall Plan ID Eligibility Design

## Goal

Make the active recall subscription offer appear on the eligible public subscription plan and reach Stripe Checkout without exposing Stripe Price IDs from `/api/subscription/plans`.

## Confirmed behavior

- Recall audience eligibility is based on successful purchase history. An empty `audience_config.payment_providers` does not restrict Stripe, Pix, UPI, Alipay, or other successful providers.
- Historical payment provider affects audience selection only. The recall Coupon is still applied only to Stripe recurring Checkout.
- The recall claim response includes internal `subscription_plan_ids`, derived server-side from the campaign's configured Stripe Price IDs.
- The wallet matches eligible subscriptions with the public `plan.id`. Public subscription-plan responses continue omitting `stripe_price_id` and other provider identifiers.
- The wallet forwards `recall_claim` only for an eligible Stripe recurring purchase. The purchase service remains authoritative and resolves the selected plan's Stripe Price ID before applying the Promotion Code.
- Recall Coupons use Stripe `duration=once`, so the discount applies only to the first subscription invoice.

## Options considered

1. Recommended: return internal plan IDs in the validated claim and rely on purchase-time backend validation. This preserves the public-plan security boundary and removes a redundant client validation request that cannot name a hidden Stripe Price.
2. Extend the claim-validation request with `plan_id`. This preserves the extra round trip but expands the API for no additional enforcement because the purchase endpoint already performs the same authoritative validation.
3. Re-expose `stripe_price_id` in public plans. Rejected because it breaks the existing response-sanitization contract.

## Data flow

`recall_claim` -> claim validation -> campaign Stripe Price IDs -> internal plan IDs -> public `plan.id` eligibility preview -> Stripe recurring purchase with `recall_claim` -> backend plan lookup -> authoritative Price validation -> Checkout Promotion Code.

## Verification

- A claim for a configured Stripe Price returns its internal plan ID.
- A public plan object without `stripe_price_id` still renders `20% OFF`, a struck-through original price, and the discounted price when its ID is eligible.
- Ineligible plan IDs remain undiscounted.
- The existing backend checkout tests continue proving that the Promotion Code reaches Stripe Checkout.

