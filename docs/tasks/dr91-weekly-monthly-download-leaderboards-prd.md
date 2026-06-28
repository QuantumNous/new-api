# DR-91 Weekly & Monthly Download Leaderboards PRD

Status: eval
Ticket: DR-91
Ref: NEW-12 gap review 2026-06-28
Phase: 2
Modules: M13/M09

## Problem

The Skill Marketplace has discovery surfaces for featured, new, recommended, and usage-driven popularity, but it does not expose a clear acquisition signal. Users need weekly and monthly download leaderboards so they can discover Skills that other users are actively adopting now.

Admins also need download velocity beside usage metrics so they can spot fast-growing Skills before usage volume catches up.

## Goals

- Rank published Skills by rolling 7-day and 30-day download count.
- Count downloads from acquisition events only: `skill_enabled` package-download events and successful `skill_purchased` events.
- Exclude deprecated, archived, draft, and missing Skills from public rankings.
- Provide optional per-category filtering for top lists.
- Render "This Week" and "This Month" rails in Marketplace.
- Attribute leaderboard impressions and clicks with `entry_point=leaderboard_weekly` and `entry_point=leaderboard_monthly`.
- Surface 7-day and 30-day download velocity in admin per-Skill listing/analytics alongside existing usage data.

## Non-Goals

- No ML or personalized ranking changes.
- No durable materialized leaderboard tables in this ticket.
- No revenue attribution changes.
- No changes to runtime skill execution authorization.

## Backend Contract

### Marketplace Leaderboards

Add a public marketplace leaderboard endpoint:

`GET /api/v1/marketplace/leaderboards/downloads?window=7d|30d&category=<optional>&limit=<1..100>`

Response uses the standard list envelope with `MarketplaceSkill` rows extended by:

- `download_count`: downloads in the selected rolling window.
- `rank`: 1-based rank after ordering.
- `window`: `7d` or `30d`.

Ranking order:

1. `download_count DESC`
2. `LOWER(skills.name) ASC`
3. `skills.id ASC`

Counting rules:

- Include `skill_usage_events.event_type = skill_enabled` when `success=true`, `skill_id IS NOT NULL`, and `entry_point` is a download/acquisition source.
- Include `skill_usage_events.event_type = skill_purchased` when `success=true`.
- Use server-authoritative `occurred_at`.
- Use rolling windows ending at request time.
- Join to `skills` and require `skills.status = published`.
- Category filter applies to `skills.category`.

### Entry Points

Add entry points:

- `leaderboard_weekly`
- `leaderboard_monthly`

Allow both entry points for privacy-safe marketplace `skill_impression` and `skill_detail_view` events. Allow both as download attribution values so a package download from a leaderboard rail is counted with the correct source.

### Admin Velocity

Extend per-Skill admin/ops rows with:

- `downloads_7d`
- `downloads_30d`

These values must be computed from the same acquisition counting rules and appear beside usage metrics in admin Skill surfaces.

## Frontend Contract

Marketplace renders two compact rails above the card grid:

- This Week
- This Month

Each rail displays ranked Skill cards/items from the corresponding leaderboard endpoint. If the user has selected a category filter, the rails use that category as the per-category top list. Empty/error states should not block the main Marketplace list.

Clicking a leaderboard item opens Skill detail and records `skill_detail_view` with the matching leaderboard entry point. Impressions are recorded once per loaded rail item with the matching entry point.

Admin Skills table/mobile rows show download velocity as 7d and 30d counts.

## Acceptance

- Weekly and monthly download leaderboards render and rank by download count in window.
- Per-category top list works through category filtering.
- Deprecated and archived Skills are excluded.
- Leaderboard impressions and clicks are tracked with the weekly/monthly entry points.
- Admin per-Skill dashboard/listing shows download velocity alongside usage-oriented metrics.
- Meaningful backend and frontend tests cover ranking, exclusion, attribution, and velocity display.
