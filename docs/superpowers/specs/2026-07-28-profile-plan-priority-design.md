# Profile Plan Priority Design

## Goal

Make the active subscription plan the primary account summary on the profile page while keeping wallet balance visible as secondary information.

## Confirmed behavior

- When an active subscription exists, the profile header shows an independent, prominent plan summary.
- The summary shows the plan name, an active badge, remaining days, total plan quota, remaining plan quota, and a usage progress bar.
- When no active subscription exists, the profile header renders no plan section and no empty-plan placeholder.
- Wallet balance moves into the identity area as a compact `Available balance` pill.
- Directly below the balance, the UI renders two complete guidance sentences as separate block rows:
  1. `Balance can be used to purchase plans directly.`
  2. `After plan quota is exhausted, balance is used automatically for API usage billing.`
- The guidance text never uses ellipsis or line clamping. It may wrap naturally on narrow viewports, but neither sentence is truncated.
- Total usage and API requests remain visible as compact secondary statistics.

## Data flow

`Profile` continues to load the user identity and wallet balance from `/api/user/self`. A profile-specific React Query hook loads `/api/subscription/self` through the existing `getSelfSubscriptionFull()` client and converts the optional response into a narrow `ProfileSubscriptionSummary`.

The summary adapter accepts a plan only when `current_subscription` exists and its subscription status is `active`. It reads the title from `current_subscription.plan`, quota totals from the canonical top-level `quota` snapshot with the current subscription amounts as a defensive fallback, and remaining days from `remaining_days`. The header receives only the derived summary instead of the full billing response.

## Component design

- `Profile` owns the subscription query and passes the optional summary to `ProfileHeader`.
- `ProfileHeader` remains responsible for presentation:
  - identity, role, user ID, username, email, and group;
  - secondary available-balance pill and its two guidance rows;
  - conditional active-plan summary;
  - total usage and API request statistics.
- The plan progress percentage is clamped between 0 and 100. Unlimited quotas display the existing translated `Unlimited` label without an artificial finite percentage.
- The responsive layout is mobile-first. The plan summary may stack on small screens, and the guidance sentences remain normal block text without `truncate`, `line-clamp`, or fixed-height clipping.

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
- Render-test that no plan section or placeholder appears without an active plan while identity, balance, total usage, and API requests remain visible.
- Render-test that the two complete balance guidance sentences are separate rows beneath the balance and have no truncation classes.
- Run the profile-focused tests, the complete Bun test suite, typecheck, lint, i18n synchronization/report checks, formatting checks, and `build:check`.
- Verify the final layout in a browser at desktop and mobile viewport widths.

## Scope and deployment

The change is limited to the authenticated console profile UI, its query/adapter, tests, and locale resources. It does not change subscription APIs, billing order, quota settlement, the public website, or router behavior.

`Router deploy: not required.` Only the `newapi-console` frontend build is affected.
