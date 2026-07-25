# Recall Campaign Product Selector Design

## Goal

Replace free-form Stripe Price ID fields in the recall campaign editor with configured product selectors. Administrators should select eligible top-up and subscription products without copying Stripe identifiers manually.

## Scope

- Change only the product portion of the recall campaign editor.
- Keep the stored `product_scope.topup_price_ids` and `product_scope.subscription_price_ids` contract unchanged.
- Keep minimum amount, coupon expiry, promotion validity, enrollment, and concurrency behavior unchanged.
- Reuse existing authenticated APIs; do not add a backend endpoint or query Stripe directly from the browser.

## Data Sources

- Top-up options come from `GET /api/user/topup/info`, using the configured amount-to-Stripe-Price mapping.
- Subscription options come from `GET /api/subscription/admin/plans`, limited to enabled plans with a non-empty Stripe Price ID.
- Top-up labels show the configured recharge amount and Price ID.
- Subscription labels show the plan title, price/currency, and Price ID.

## Interaction

- Render separate multi-select controls for top-up products and subscription products.
- Selecting and clearing options updates the existing form arrays directly.
- Do not provide a manual Price ID entry path.
- Disable the selectors when the campaign is immutable, consistent with the rest of the editor.
- Show loading and load-failure states without discarding already selected values.
- When an existing selected Price ID is no longer present in current configuration, keep it visible as an unavailable selected option so opening or editing a draft does not silently mutate its scope.
- If a group has no configured options, explain where the administrator must configure them.

## Validation

- The existing form rule still requires at least one selected Price.
- Backend activation and preview continue to validate Price activity, Price type, Product mapping, and shared-Product safety.
- API failures block choosing new products but do not erase stored selections.

## Testing

- Component tests cover loading configured options, selecting and clearing both product groups, immutable mode, empty/error states, and unavailable saved selections.
- Existing schema tests continue to prove that at least one Price is required.
- Run targeted frontend tests, TypeScript checking, localization synchronization, formatting/lint checks, and the production build before promotion.
