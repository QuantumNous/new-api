# DR-97 Personalized Recommendations PRD

Status: eval
Ticket: DR-97
Date: 2026-06-29
Module: M13 personalization
Refs: NEW-14 gap review 2026-06-28; DR-167; DR-168; DR-73; DR-81

## Problem

Marketplace recommendations are currently generic. Returning users need useful
Skill discovery based on their own download/use history, and Skill detail pages
need a simple "users who downloaded this also downloaded" source without adding
ML infrastructure.

## Scope

- Add a personal recommendation API that derives the caller's top categories
  from `user_enabled_skills` and `last_used_at`, then recommends other published
  Skills in those categories.
- Add a co-download recommendation API for a target Skill based on other users
  who enabled the same Skill.
- Fall back to existing popular/featured ordering for users with no usable
  history.
- Return the existing `MarketplaceSkill` shape so availability, locked-but-
  buyable state, and badges stay consistent with the Marketplace list API.
- Respect Kids visibility rules through the existing availability resolver.
- Add distinct attribution entry points: `reco_personal` and `reco_codownload`
  for recommendation impressions/detail views/download conversion.

## Non-Goals

- No ML ranking model, vector similarity, or external recommendation service.
- No new entitlement or paywall rules.
- No prompt, package, or usage-content analytics.
- No changes to runtime package execution attribution (`skill_package` remains
  server-authoritative for package execution).

## API Requirements

- `GET /api/v1/marketplace/recommendations/personal?limit=N`
  - Requires a logged-in Marketplace user.
  - Returns category-affinity recommendations when history exists.
  - Returns popular/featured recommendations when history is empty.
- `GET /api/v1/marketplace/skills/:id/recommendations?limit=N`
  - Accepts Skill UUID or slug.
  - Returns co-download recommendations when co-occurrence exists.
  - Falls back to popular/featured excluding the target Skill.
- Both endpoints return a list envelope with `MarketplaceSkill` items.
- Both endpoints cap `limit` with the existing pagination validator.

## Acceptance

- A returning user with downloads in a category receives other published Skills
  from that category, excluding Skills they already enabled.
- Co-download recommendations are ranked by co-occurrence count and exclude the
  target Skill.
- A new user falls back to popular/featured.
- Locked-but-buyable Skills remain visible with upgrade CTA.
- Kids-mode users do not receive non-kids-safe recommendations.
- Recommendation events and download conversion can use
  `entry_point=reco_personal` or `entry_point=reco_codownload`.
