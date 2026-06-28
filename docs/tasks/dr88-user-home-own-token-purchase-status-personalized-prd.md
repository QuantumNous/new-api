# DR-88 User Home Status + Personalized Skills PRD

Status: eval
Ticket: DR-88
Refs: NEW-23 gap review 2026-06-28; NEW-10; NEW-13; NEW-14; NEW-17; NEW-18; DR-54; DR-90; DR-92; DR-97; DR-100

## Context

My Skills only shows downloaded/enabled Skills. A signed-in user needs one
home surface that answers: what is my wallet/subscription/purchase state, what
Skills should I try next, what is new this week for me, and what have I saved.

## Goals

- Add a caller-scoped user home API that returns only the authenticated user's
  wallet balance, recent top-up history summary, subscription/plan status,
  one-time Skill purchase status, saved Skills, personal recommendations, and
  personalized new-this-week Skills.
- Add a user home/dashboard frontend surface that consumes the composed API.
- Reuse existing Skill availability/paywall shapes so locked-but-buyable Skills
  show upgrade/buy actions instead of leaking admin-only data.
- Track user-home Skill impressions and actions with `entry_point=user_home`.

## Non-Goals

- No admin drill-down, cross-user data, or aggregate analytics exposure.
- No new payment provider or checkout flow.
- No new recommendation ML service; compose existing category-affinity and
  new-week Marketplace ranking.

## Requirements

- The API requires the caller's authenticated user id and must ignore any
  caller-supplied user id.
- Token balance is sourced from the existing user quota field and display quota
  conversion helpers.
- Purchase status includes recent one-time Skill orders and durable
  entitlements for the caller.
- Subscription status uses existing active/all subscription records and billing
  preference.
- "Recommended for you" reuses NEW-14 personal recommendation logic.
- "New this week for you" reuses NEW-13/DR-90 new-week published Skills, then
  filters/ranks them by the user's category preference from NEW-14.
- Saved list reuses NEW-10/DR-92 saved Skills.
- Skill cards must include availability lock/CTA data so PLUS/plan and $2
  one-time purchase locks can render as paywall actions.

## Acceptance

- A signed-in user sees wallet balance, subscription/plan status, recent
  purchases, saved Skills, recommended Skills, and new-this-week Skills matched
  to their preferences.
- Locked Skills render as locked-but-actionable with paywall CTA data.
- The API returns only the caller's own data.
- Skill impression/action attribution from this surface uses
  `entry_point=user_home`.

## Evaluation

- Backend: added authenticated `GET /api/v1/marketplace/user-home` composing
  caller-scoped wallet, top-up summary, subscription status, one-time purchase
  entitlements, saved Skills, personal recommendations, and personalized
  new-week Skills.
- Frontend: added `/home` dashboard route and Personal sidebar entry.
- Tests: see `docs/test-results/dr88-user-home-own-token-purchase-status-personalized.txt`.
