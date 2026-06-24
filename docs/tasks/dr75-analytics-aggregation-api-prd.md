# DR-75 Analytics Aggregation API — PRD

**Status:** eval
**Priority:** P0
**Author:** DeepRouter Engineering
**Created:** 2026-06-22
**Branch:** feat/dr75-analytics-aggregation-api

---

## 1. Background

Ops needs aggregate Skill Marketplace analytics for the DR-76 dashboard and the
future per-skill table. Source events are `skill_usage_events`; analytics APIs
must never expose prompts, raw user content, provider payloads, or package
internals.

References:

- `docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md` §11
- `docs/skill-marketplace/tasks/04_Analytics_and_Operations.md` §6, §10.2,
  §10.3
- `docs/tasks/dr76-ops-overview-dashboard-prd.md` §5

## 2. Goals

| # | Goal |
|---|------|
| G1 | Implement `GET /api/v1/ops/skill-analytics/overview` |
| G2 | Implement `GET /api/v1/ops/skill-analytics/skills` |
| G3 | Return only aggregate metrics derived from safe event columns |
| G4 | Exclude `entry_point=admin_preview` from all business metrics |
| G5 | Use `occurred_at` in UTC for date filtering |

## 3. Non-Goals

- Revenue attribution from `skill_billing_events`; charging is disabled for MVP
  and the billing event table is not created/populated yet.
- Funnel, retention, persona dashboards.
- CSV export.
- Prompt/raw-content diagnostics.

## 4. API Contract

### 4.1 Overview

```
GET /api/v1/ops/skill-analytics/overview?start=<ISO8601>&end=<ISO8601>&include_kids=<bool>
```

Returns:

- `wasu`
- `total_skill_runs`
- `detail_ctr`
- `enable_rate`
- `first_use_rate`
- `repeat_use_rate`
- `block_rate`
- `top_block_reason`
- `revenue_attribution_usd`
- `charging_enabled`
- `data_freshness`
- `period_start`
- `period_end`

### 4.2 Per-Skill

```
GET /api/v1/ops/skill-analytics/skills?start=<ISO8601>&end=<ISO8601>&page=1&limit=20&include_kids=<bool>
```

Each row returns:

- `skill_id`
- `skill_name`
- `status`
- `required_plan`
- `enabled_users`
- `active_users`
- `successful_runs`
- `detail_ctr`
- `enable_rate`
- `first_use_rate`
- `repeat_use_rate`
- `block_rate`
- `revenue_attribution_usd`

## 5. Metric Semantics

- Successful runs: `event_type=skill_used AND success=true`.
- WASU: distinct analytics identity with successful `skill_used` in the rolling
  7 days ending at `period_end`.
- Analytics identity is `user_id` when present; otherwise `session_id`. This
  allows anonymous impression/detail events and Kids pseudonymous session events
  to participate where explicitly included, while keeping real Kids user IDs out
  of analytics.
- Kids traffic is excluded from GA business metrics by default. Passing
  `include_kids=true` includes `is_kids_session=true` rows for Safety/internal
  review surfaces.
- Funnel rates are ordered by identity + skill: first timestamps per stage are
  aggregated, then stages count only when
  `impression_at <= detail_at <= enable_at <= first_use_at`. Return `null` when
  the denominator is zero.
- Repeat use rate: distinct `(analytics identity, skill_id)` pairs with two or
  more successful `skill_used` events divided by distinct pairs with one or
  more.
- Block rate: `skill_blocked / (skill_blocked + successful skill_used)`.
- `admin_preview` is excluded before aggregation.
- `data_freshness` returns `ok` when there are no P0 events at all, treating it
  as a no-data/low-traffic state rather than a pipeline failure. Delayed/failed
  still use the latest non-`admin_preview` P0 event timestamp until an ingestion
  heartbeat/watermark table exists.
- Revenue fields return `null` with `charging_enabled=false` until M07 billing
  events are available.

## 6. Acceptance

- Overview and per-skill endpoints return listed aggregate metrics.
- `admin_preview` events do not affect any metric.
- Date filters use UTC `occurred_at`.
- Responses do not select or expose prompt/raw-content fields.
- Charging-disabled MVP returns `revenue_attribution_usd=null` and
  `charging_enabled=false`.
