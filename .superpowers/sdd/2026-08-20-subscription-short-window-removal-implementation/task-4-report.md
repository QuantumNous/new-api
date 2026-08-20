# Task 4 Report: Wallet/Profile Short-Window Removal

## Status

Complete. Wallet and profile subscription UI now show monthly model quota and media generation credits without rendering 5-hour or 7-day subscription meters. Self/profile normalization no longer synthesizes short-window buckets.

## Changes

- Removed 5-hour and 7-day meters from the wallet current plan card.
- Removed 5-hour and 7-day feature lines from wallet plan cards.
- Removed `window_5h` / `window_7d` from wallet self normalized state.
- Removed `window5h` / `window7d` from profile subscription summaries and profile header rendering.
- Removed self/public-facing `usage_limits`, `window_5h`, and `window_7d` types while preserving plan short-window amount fields for admin/backward-compatible plan parsing.
- Updated wallet/profile fixtures to omit short-window data and keep monthly/media assertions.
- Updated the adjacent profile hook fixture after self-review found its stale short-window summary expectation.

## TDD Evidence

RED:
- `bun test src/features/wallet/components/subscription-plans-card.test.tsx src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/profile/components/profile-header.test.tsx src/features/profile/lib/subscription-summary.test.ts`
- Failed as expected while old UI/normalizers still rendered or synthesized 5-hour / 7-day fields.

GREEN:
- `bun test src/features/wallet/components/subscription-plans-card.test.tsx src/features/wallet/lib/subscription-plan-lifecycle.test.ts src/features/profile/components/profile-header.test.tsx src/features/profile/lib/subscription-summary.test.ts`
- Result: 137 pass, 0 fail.

Additional self-review fixture check:
- `bun test src/features/profile/hooks/use-profile-subscription.test.ts`
- Result: 8 pass, 0 fail.

Typecheck:
- `bun run typecheck`
- Result: pass.

## Absence / Preservation Checks

- 5h/7d absence covered by wallet/profile render assertions and normalized data assertions.
- Monthly model quota presence covered by wallet current-plan and plan-card assertions plus profile monthly quota assertions.
- Media generation credits presence covered by wallet/profile render assertions and summary assertions.
- Media `0` remains `Not included`, not unlimited.
- Monthly fallback remains covered by profile summary and wallet normalizer tests.

## Concerns

- No unresolved concerns for Task 4.
- Admin subscription form was not changed.
- Wallet localized-currency worktree changes were preserved; no unrelated rollback was performed.
