# DR-98 Referral Program Invite Two-Sided Reward Attribution PRD

Status: eval

## Context

NEW-19 asks for a low-friction referral loop: every user gets an invite link/code, referred signup is attributed, and the first qualifying conversion grants a two-sided reward exactly once.

Existing `aff_code` signup plumbing attributes invited users and can grant legacy signup quota, but it does not wait for conversion, does not support configurable reward kinds, and does not expose a user-facing "Invite & earn" surface with funnel status.

## Scope

- Add a referral reward ledger that records invite -> signup -> qualifying conversion -> reward grant.
- Support configurable reward type and amount. DR-98 implements quota/Skill-credit rewards as wallet quota; PLUS-days rewards are recorded as reward kind for future fulfillment but do not mutate subscription state until PLUS-day semantics are finalized.
- Treat successful top-up, PLUS/subscription purchase, and successful one-time Skill purchase as qualifying conversion events.
- Block self-referral, missing inviter, duplicate conversion, and per-inviter fraud caps.
- Make reward granting idempotent by referred user and conversion source.
- Expose current user's invite code/link and aggregate referral funnel stats.
- Add an "Invite & earn" entry point in the console/dashboard that lets the user copy their invite link and see the funnel.
- Add focused backend tests for attribution, idempotency, anti-abuse, and reward grants; add frontend tests for the invite surface behavior.

## Non-Goals

- No cash payout, balance withdrawal, or finance ledger.
- No raw per-user admin export beyond the current user's own referral status.
- No PLUS-day subscription mutation until product defines how free PLUS days interact with paid subscriptions.
- No third-party fraud scoring integration.

## Acceptance

- A referred user who completes one qualifying conversion grants both inviter and invitee the configured reward once.
- Self-referral, duplicate conversion, and fraud-cap overflow are blocked without mutating balances.
- The referral funnel is attributable from invite/signup through conversion.
- Reward granting is idempotent across repeated webhook/callback/order completion attempts.
- A signed-in user can find "Invite & earn", copy their invite link, and see aggregate invite/signup/conversion/reward status.
