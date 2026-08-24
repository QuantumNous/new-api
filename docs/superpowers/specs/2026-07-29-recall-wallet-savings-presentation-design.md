# Recall Wallet Savings Presentation Design

## Goal

Make an eligible Recall invitation offer read like an automatically applied coupon at the exact top-up or subscription choice where it applies.

## Confirmed behavior

- Every eligible top-up preset and subscription plan shows four pieces of pricing information:
  1. an `OFF` badge;
  2. the original price with a strikethrough;
  3. the discounted price as the primary price;
  4. the exact saved amount using `Save {{amount}}`.
- Percentage offers use labels such as `20% OFF`.
- Fixed offers use labels such as `2.00 BRL OFF` while the saved amount uses the normal checkout-currency symbol, such as `Save R$2`.
- The presentation appears only when the existing client preview determines that the offer applies to that product, currency, amount, minimum purchase, and expiry.
- Ineligible, expired, zero-value, wrong-product, wrong-currency, and below-minimum offers leave the normal undiscounted presentation unchanged.
- Checkout remains authoritative. The page preview never supplies a calculated discount to the payment API and does not replace server-side offer resolution.

## Approach

Reuse the current `selectBestRecallOffer` and `getRecallPriceDiscount` results. No backend response, database field, payment request, or dependency changes are needed.

Top-up amount buttons will grow from a compact single-price control into a small price tile when a discount applies. The tile order is badge, discounted price, struck original price, then saved amount. Undiscounted tiles keep the existing single-price behavior while sharing the same minimum tile height so the grid remains aligned.

Subscription plan cards retain their existing badge, discounted price, and struck original price. Add the exact saved amount immediately below the price row so it remains associated with the price without competing with the plan benefits.

## Components and content

- Reuse existing theme colors and the green Recall discount pill from subscription cards.
- Reuse the existing `Save {{amount}}` localization key in all supported locales.
- Continue using the existing fixed-discount translation pattern and uppercase badge treatment.
- Format displayed prices and savings with the checkout currency already used by each component.
- Do not introduce a separate coupon-entry control because the offer is account-discovered and automatically applied.

## Error and state behavior

- Offer loading keeps the existing undiscounted state; no placeholder discount is fabricated.
- A discovery failure leaves prices undiscounted while server-side checkout remains responsible for authoritative resolution.
- Changing checkout currency immediately recomputes eligibility, price, badge, and saved amount from the existing offer list.
- Multiple offers continue to use the existing strongest-discount and tie-break selection rules.

## Accessibility and responsive behavior

- Badge and savings text supplement price changes, so the discount is not communicated by color or strikethrough alone.
- All pricing text remains inside the existing clickable top-up button or subscription card reading order.
- Top-up tiles use a minimum height rather than fixed clipping and keep the existing three-column narrow layout and five-column wider layout.

## Testing

- Top-up percentage offer renders the OFF badge, final price, struck original price, and exact saved amount.
- Top-up fixed multi-currency offer renders the fixed OFF badge and currency-correct saved amount.
- An undiscounted top-up remains free of OFF and savings copy.
- Subscription percentage and fixed offers include the exact saved amount in addition to their current badge and price states.
- Existing offer calculation, wallet loading, component tests, typecheck, and build remain green.

## Non-goals

- Returning a discount breakdown from Stripe payment-session creation.
- Trusting the browser preview for billing.
- Changing discount eligibility, stacking, tie-breaks, campaign configuration, or Stripe Promotion Codes.
- Adding a manual coupon input or exposing a raw promotion code.
