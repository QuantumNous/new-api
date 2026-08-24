# Profile Plan Priority Design

## Goal

Make the active subscription plan the primary account summary on the profile page while keeping wallet balance visible as secondary information.

## Confirmed behavior

- When an active subscription exists, the profile header shows an independent, prominent plan summary.
- The summary shows the plan name, an active badge, remaining days, 5-hour and 7-day usage limits, media generation credits, monthly plan quota, remaining monthly quota, and usage progress bars.
- When no active subscription exists, the profile header renders no plan section and no empty-plan placeholder.
- Wallet balance moves into the identity area as a compact `Available balance` pill.
- Directly below the balance, the UI renders two complete guidance sentences as separate block rows:
  1. `Balance can be used to purchase plans directly.`
  2. `After plan quota is exhausted, balance is used automatically for API usage billing.`
- The guidance text never uses ellipsis or line clamping. It may wrap naturally on narrow viewports, but neither sentence is truncated.
- Total usage and API requests remain visible as compact secondary statistics.

## Data flow

`Profile` continues to load the user identity and wallet balance from `/api/user/self`. A profile-specific React Query hook loads `/api/subscription/self` through the existing `getSelfSubscriptionFull()` client and converts the optional response into a narrow `ProfileSubscriptionSummary`.

The summary adapter accepts a plan only when `current_subscription` exists and its subscription status is `active`. It reads the title from `current_subscription.plan`, the monthly quota from `monthly_bucket` with the top-level `quota` snapshot and current subscription amounts as defensive fallbacks, the short-window limits from `window_5h` and `window_7d`, media generation credits from `media_credits`, and remaining days from `remaining_days`. The header receives only the derived summary instead of the full billing response.

Each usage window is normalized into total, used, remaining, unlimited, reset time, and percentage values. Invalid or negative values fall back to zero and percentages are clamped to 0–100. A missing or zero-total 5-hour or 7-day window is treated as unlimited, matching the existing Wallet behavior. A zero-total media window is treated as `Not included` unless the API explicitly marks it unlimited; media credits are displayed as integer credits rather than currency quota.

## Component design

- `Profile` owns the subscription query and passes the optional summary to `ProfileHeader`.
- `ProfileHeader` remains responsible for presentation:
  - identity, role, user ID, username, email, and group;
  - secondary available-balance pill and its two guidance rows;
  - conditional active-plan summary;
  - total usage and API request statistics.
- The approved desktop composition is fixed:
  1. one top row with identity on the left and the compact balance plus two guidance rows on the right;
  2. one full-width horizontal plan band below the complete top row;
  3. two compact usage statistics below the optional plan band.
- The header card spans the full profile content width. Its left edge aligns exactly with the Settings column below, and its right edge aligns exactly with the Passkey/Two-factor column below.
- The plan must not render as a right-side vertical card or as a peer column beside identity.
- The compact plan band is an unfilled section inside the existing Profile header, introduced by one subtle top divider and spacing rather than another nested card. It follows the existing Wallet `CurrentPlanCard` and `UsageWindowMeter` visual language: no full-panel purple tint, no nested bordered meter cards, muted labels, normal title casing, and slim `h-1.5` progress bars. Purple remains an accent for the active badge and progress indicator instead of becoming the section background.
- The Profile summary intentionally does not duplicate Wallet start and end dates. It keeps remaining days as the compact period signal.
- The 5-hour limit, 7-day limit, and media generation credits render as three lightweight usage meters in a `lg:grid-cols-3` row above the monthly quota. Below `lg`, they remain a single column. Each meter shows used versus total, a slim progress bar, and remaining quota. Finite meters include their reset time only when `reset_at > 0`.
- Media generation credits follow Wallet semantics: positive totals show integer used/total and remaining credits, a zero-total non-unlimited window shows the translated `Not included` and `0 remaining` states, and an explicitly unlimited window shows `Unlimited` and `No usage limit`.
- Monthly quota and remaining monthly quota share one horizontal row beneath the three usage meters, separated by a subtle top divider. The monthly progress bar renders beneath them without nested metric cards, and its values use normal foreground emphasis rather than a large purple number.
- On narrow screens, identity, balance guidance, plan band, and statistics stack in that order.
- On narrow screens, the 5-hour, 7-day, and media generation meters stack in that order without horizontal overflow, followed by the monthly quota row.
- When no active subscription exists, the plan band is omitted and statistics follow the top row directly.
- The plan progress percentage is clamped between 0 and 100. Unlimited quotas display the existing translated `Unlimited` label without an artificial finite percentage.
- The responsive layout is mobile-first. The guidance sentences remain normal block text without `truncate`, `line-clamp`, or fixed-height clipping.

## Error and loading behavior

- Profile identity loading remains controlled by the existing `useProfile()` state.
- Subscription loading does not block the profile header. Until subscription data is available, the optional plan section stays hidden.
- A failed, unsuccessful, or incomplete subscription response maps to no summary. The rest of the profile remains usable and no false `No plan` state is shown.
- This read-only enhancement does not display a subscription-error toast because the package section is optional and the requested fallback is to hide it.

## Internationalization and accessibility

- All user-visible labels and guidance use `t()`.
- Any new source keys are added with genuine translations to all eight locale files: English, Chinese, French, Russian, Japanese, Vietnamese, Spanish, and Portuguese.
- Existing semantic labels such as `Available balance`, `Current Plan`, `Active`, `Remaining days`, `Remaining`, and `Unlimited` are reused where suitable.
- The progress component exposes its value through the existing accessible progress primitive; decorative icons are hidden from assistive technology.

## Testing

- Unit-test the summary adapter for an active plan, missing plan, inactive plan, quota fallback, and invalid or failed response data.
- Render-test the header to confirm the plan name, quota values, remaining days, and progress are visible for an active plan.
- Unit-test media-credit normalization for finite, not-included, explicitly unlimited, invalid, and reset-time values.
- Render-test that the 5-hour, 7-day, and media generation meters appear above the monthly quota, show normalized used/total and remaining values, and render unlimited/not-included states correctly.
- Render-test the compact Wallet-derived styling contract: the plan section has no primary-tinted panel background, usage meters have no nested card border/background, the three desktop meters share one responsive grid, and the monthly row is separated beneath them.
- Render-test that no plan section or placeholder appears without an active plan while identity, balance, total usage, and API requests remain visible.
- Render-test that the two complete balance guidance sentences are separate rows beneath the balance and have no truncation classes.
- Render-test that the header no longer has the compact 860px cap and uses the same full-width container edges as the Settings and Passkey columns below.
- Run the profile-focused tests, the complete Bun test suite, typecheck, lint, i18n synchronization/report checks, formatting checks, and `build:check`.
- Verify the final layout in a browser at desktop and mobile viewport widths.

## Scope and deployment

The change is limited to the authenticated console profile UI, its query/adapter, tests, and locale resources. It does not change subscription APIs, billing order, quota settlement, the public website, or router behavior.

`Router deploy: not required.` Only the `newapi-console` frontend build is affected.
