# DR-77 Per-Skill Analytics Table UI — PRD

**Status:** eval
**Priority:** P0
**Author:** DeepRouter Engineering
**Created:** 2026-06-24
**Branch:** feat/dr77-per-skill-analytics-table

---

## 1. Background

DR-75 exposes aggregate Skill analytics for Operations. DR-77 adds the
operator-facing per-Skill table so Super Admin and Operations can compare which
Skills are most/least used, sticky, one-and-done, or blocked without exposing
prompt/raw content.

References:

- `docs/skill-marketplace/tasks/04_Analytics_and_Operations.md` §10.3
- `docs/skill-marketplace/tasks/02_UX_Design.md` §4.8.2
- `docs/tasks/dr75-analytics-aggregation-api-prd.md`

## 2. Goals

| # | Goal |
|---|------|
| G1 | Add a sortable, filterable, paginated per-Skill analytics table |
| G2 | Show aggregate columns for usage, activation, stickiness, one-time use, blocks, revenue, and trend |
| G3 | Support slicing by required plan and analytics persona |
| G4 | Keep Operation users on aggregate-only metrics and hide export unless permitted |
| G5 | Keep the UI wired to DR-75 analytics APIs and never expose prompt/raw content |

## 3. Non-Goals

- CSV export implementation.
- Prompt, raw message, provider payload, or package internals.
- Retention cohort dashboards beyond the per-Skill repeat/one-time indicators.

## 4. API/UI Contract

Extend `GET /api/v1/ops/skill-analytics/skills` with aggregate-safe query
params:

- `page`, `limit`
- `sort`
- `status`
- `required_plan`
- `plan`
- `persona`
- `q`
- `start`, `end`, `include_kids`

Rows include:

- Skill name, status, required plan
- Enabled users, active users, successful runs
- Detail CTR, enable rate, first use rate, repeat use rate
- One-time rate: enabled/active analytics identities with exactly one successful run
- Block rate
- Revenue attribution if charging is enabled
- Trend comparing first-half and second-half successful runs in the selected period

## 5. Acceptance

- Table answers most/least used, one-and-done, sticky, and blocked Skills.
- Table is sliceable by required plan and persona.
- Super Admin and Operation see aggregate metrics only; no prompt/raw content.
- Export action is hidden unless permissioned.
- Sorting, filtering, pagination, sticky desktop headers, loading, error, and empty states are covered by focused tests.

## 6. Implementation Notes

- Extended the DR-75 per-Skill endpoint with safe aggregate filters, sort keys,
  `one_time_rate`, and `trend`.
- Added the per-Skill table to the existing Skill Analytics dashboard with
  server-backed sorting, filters, pagination, sticky desktop headers, and hidden
  export.
- Added focused backend and frontend regression tests; no prompt/raw-content
  fields are selected or rendered.
