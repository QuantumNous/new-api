# DR-89 Social Proof on Skill Cards PRD

Status: ship

Ticket: DR-89
Reference: NEW-20 gap review 2026-06-28; docs/skill-marketplace/tasks/02_UX_Design.md; docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md

## Problem

Marketplace cards and Skill detail pages expose plan, kids safety, and lifecycle affordances, but they do not show public trust signals. Users cannot quickly see whether a Skill is reviewed well, downloaded often, new, trending, popular, PLUS-exclusive, or Kids-Safe. This weakens marketplace conversion and makes high-confidence Skills harder to identify.

## Scope

- Extend public marketplace list and detail responses with `rating_summary`, `download_count`, and real-signal badges.
- Count only approved/published public review rows when a review/rating table exists; fail closed to zero ratings if the dependency table is absent on the current main checkout.
- Count downloads from existing no-double-count aggregate signals: enabled/download rows and successful one-time purchase events.
- Render accessible, responsive stars, review count, formatted download count, and badges on Skill cards and Skill detail.
- Add meaningful backend and frontend tests for aggregation, badge derivation, and rendering.

## Requirements

- Rating summary includes average rating and review count. Unapproved, pending, rejected, or workflow-only review rows must not contribute.
- Download count must avoid double-counting the same user/tenant/skill enablement row and add successful purchase events.
- Badges are derived from existing signals:
  - New: published within the last 7 days.
  - Trending: recent successful enable/use growth in the last 7 days.
  - Popular: download count at or above the launch threshold.
  - PLUS-exclusive: paid plan requirement (`pro` or `enterprise`).
  - Kids-Safe: `is_kids_safe=true`.
- UI must expose text equivalents for stars and counts, fit mobile card layouts, and follow `docs/DESIGN.md`.

## Non-Goals

- Building the review submission/moderation workflow.
- Changing entitlement semantics or adding new download event sources.
- Adding a new marketplace sort order.

## Acceptance

- Cards and detail show stars + review count when approved review data exists.
- Cards and detail show a formatted download badge, e.g. `1.2k downloads`.
- New, Trending, Popular, PLUS-exclusive, and Kids-Safe badges render from real backend fields.
- Unapproved reviews are excluded, and download aggregates do not double-count repeated enablement for the same user/tenant/skill.
- Focused backend and frontend tests pass with coverage recorded.

## Verification

- 2026-06-29: Local focused and related verification passed; see `docs/test-results/dr89-social-proof-on-cards-rating-stars-download-coun.txt`.
- 2026-06-29: PR #132 merged after post-rebase local verification and required GitHub checks passed.
