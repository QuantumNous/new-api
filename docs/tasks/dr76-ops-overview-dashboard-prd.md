# DR-76 Ops Overview Dashboard — PRD

**Status:** In Progress
**Priority:** P0
**Author:** DeepRouter Engineering
**Created:** 2026-06-21
**Branch:** feat/dr-76-ops-overview-dashboard

---

## 1. Background

DR-75 will expose a `/api/v1/ops/skill-analytics/overview` aggregation API
(status: To Do). DR-76 is the operator-facing dashboard UI that renders those
metrics. Platform operators (Operation, Product/Growth roles) need a single-pane
view of skill health so they can detect engagement drops, block-rate spikes, or
revenue anomalies without SQL queries.

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | Surface 9 P0 skill-health metrics with a date-range control |
| G2 | Distinguish "no data in period" from "tracking pipeline failed" |
| G3 | Gate access to ROLE ≥ ADMIN (same threshold as the admin sidebar group) |
| G4 | Be wired and ready to drop real DR-75 data in without a UI rewrite |

---

## 3. Non-Goals

- Per-skill drilldown (DR-77+)
- Custom date range picker (P1 — only presets ship in this DR)
- Export to CSV
- Real-time streaming / WebSocket updates
- Sparkline trend charts (P1)

---

## 4. Route

`/skill-analytics` — added to the **Admin** sidebar group, visible only to
users with `userRole >= ROLE.ADMIN`.

---

## 5. API Contract (defined here; DR-75 implements)

```
GET /api/v1/ops/skill-analytics/overview
Query: start=<ISO8601>&end=<ISO8601>
Auth:  admin session (same as other /api/v1/ops/* endpoints)

200 OK
{
  "wasu":                    <integer|null>,   // Weekly Active Skill Users
  "total_skill_runs":        <integer|null>,
  "detail_ctr":              <float|null>,     // 0.0–1.0
  "enable_rate":             <float|null>,     // 0.0–1.0
  "first_use_rate":          <float|null>,     // 0.0–1.0
  "repeat_use_rate":         <float|null>,     // 0.0–1.0
  "block_rate":              <float|null>,     // 0.0–1.0
  "top_block_reason":        <string|null>,    // see §6
  "revenue_attribution_usd": <float|null>,     // null = charging disabled
  "charging_enabled":        <boolean>,
  "data_freshness":          "ok"|"delayed"|"failed",
  "period_start":            <ISO8601>,
  "period_end":              <ISO8601>
}
```

### 5.1 Block reason values

`plan_required` | `subscription_inactive` | `quota_exceeded` |
`kids_blocked` | `safety_violation` | `unknown`

### 5.2 data_freshness semantics

| Value | Meaning | UI treatment |
|-------|---------|--------------|
| `ok` | pipeline is current | no banner |
| `delayed` | pipeline is running but >15 min behind | yellow banner |
| `failed` | pipeline is down | orange banner; show `—` on all metric cards |

---

## 6. P0 Metric Cards

| Card | Field | Format | Empty label |
|------|-------|--------|-------------|
| WASU | `wasu` | integer with comma separators | No data |
| Total Skill Runs | `total_skill_runs` | integer | No data |
| Skill Detail CTR | `detail_ctr` | "34.2%" | No data |
| Enable Rate | `enable_rate` | "%" | No data |
| First Use Rate | `first_use_rate` | "%" | No data |
| Repeat Use Rate | `repeat_use_rate` | "%" | No data |
| Block Rate | `block_rate` | "%" | No data |
| Top Block Reason | `top_block_reason` | label string | No data |
| Revenue Attribution | `revenue_attribution_usd` | "$1,234.56" | Hidden if `!charging_enabled` |

---

## 7. Date Range Control

Presets: **24h** / **7d** (default) / **30d**.
Custom date picker: P1 — render as disabled button for now.

The control computes `start`/`end` in the browser at query time (not cached).

---

## 8. Empty States

| State | Trigger | Display |
|-------|---------|---------|
| Loading | `isLoading` | Skeleton cards |
| No data | `data_freshness === 'ok'` + metric value is `null` | Card shows `—`, description "No data in this period" |
| Tracking failure | `data_freshness === 'failed'` | Orange banner at top; all cards show `—` |
| API error | `isError` (e.g. 404 while DR-75 is To Do) | Error message in page |

---

## 9. Role Access

- Sidebar entry: Admin group → visible only when `userRole >= ROLE.ADMIN`
- Page guard: redirect to `/dashboard/overview` if `userRole < ROLE.ADMIN`

---

## 10. Acceptance Criteria

- [ ] All 9 P0 cards render with correct labels and formats
- [ ] Default date range is 7d
- [ ] Switching preset refreshes the query
- [ ] Tracking-failure banner shown when `data_freshness === 'failed'`
- [ ] No data → card shows `—`; loading → skeleton
- [ ] Revenue card is hidden when `charging_enabled === false`
- [ ] Non-admin user navigating directly to `/skill-analytics` is redirected
- [ ] Sidebar entry appears for ADMIN+ and is absent for USER role
- [ ] i18n keys present in en.json + zh.json; no Chinese values in en.json after `i18n:sync`

---

## 11. Dependencies

| Dep | Status |
|-----|--------|
| DR-75 Analytics aggregation API | To Do — UI shows error state until ready |
| DR-68 Skill relay (data source) | Merged (PR #80) |
