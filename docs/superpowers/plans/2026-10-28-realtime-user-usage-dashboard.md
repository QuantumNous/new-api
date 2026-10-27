# Realtime User Usage Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-only, five-second polling dashboard that shows per-user API activity for the last minute and a ten-minute trend.

**Architecture:** Add a bounded backend snapshot endpoint that aggregates recent consume logs by user and returns summary, user rows, and minute buckets. Add a focused React component under the existing Dashboard Users section, with React Query polling, selected-user trend state, and existing VChart/UI primitives. Keep billing untouched and reuse the shared total-token/cache usage semantics.

**Tech Stack:** Go, Gin, GORM, existing log model, React 19, TypeScript, TanStack Query, VChart, Tailwind, i18next.

---

### Task 1: Define and test the realtime aggregation contract

**Files:**
- Create: `model/realtime_usage.go`
- Test: `model/realtime_usage_test.go`

- [ ] Write deterministic tests for window validation, per-user aggregation, minute bucketing, cache read/write total tokens, and error-rate calculation using explicit `Log` fixtures.
- [ ] Run `go test ./model -run RealtimeUsage -count=1` and confirm the new tests fail before implementation.
- [ ] Implement `RealtimeUsageSnapshot` types and a GORM query over `LOG_DB.logs` filtered by `type = LogTypeConsume` and `created_at >= now-window`; aggregate bounded rows in Go so JSON cache fields use the same parser as total-token statistics.
- [ ] Enforce `window_seconds` 30–300, `trend_minutes` 5–30, and `limit` 5–100 with defaults 60, 10, and 20.
- [ ] Run the focused tests until they pass.

### Task 2: Expose the protected backend endpoint

**Files:**
- Create: `controller/realtime_usage.go`
- Modify: `router/api-router.go`
- Test: `controller/realtime_usage_test.go`

- [ ] Add a failing controller test proving a common user receives a forbidden response and an admin receives the snapshot contract.
- [ ] Register `GET /api/dashboard/realtime-users` inside the existing authenticated admin route group.
- [ ] Parse query parameters, call the model snapshot function, and return `{success, data}` with `summary`, `users`, `trend`, and `updated_at`.
- [ ] Preserve last-known data behavior in the frontend; return a normal structured error for invalid parameters or database errors.
- [ ] Run controller tests and the relevant router test.

### Task 3: Add frontend API and types

**Files:**
- Modify: `web/src/features/dashboard/api.ts`
- Modify: `web/src/features/dashboard/types.ts`
- Modify: `web/src/i18n/locales/en.json`
- Modify: `web/src/i18n/locales/zh.json`

- [ ] Add typed `RealtimeUsageSnapshot`, summary, user-row, and trend interfaces.
- [ ] Add `getRealtimeUserUsage()` with the three bounded query parameters.
- [ ] Add English and Chinese keys for status, metrics, empty/error states, refresh controls, and table labels.
- [ ] Run the frontend type checker after the API/types changes.

### Task 4: Build the realtime Users panel

**Files:**
- Create: `web/src/features/dashboard/components/users/realtime-user-usage.tsx`
- Modify: `web/src/features/dashboard/components/users/user-charts.tsx`

- [ ] Add a React Query hook with a five-second refetch interval, disabled refetch while `document.hidden`, and retained previous data on errors.
- [ ] Render the live status bar, four summary cards, searchable/sortable user table, selected-user trend chart, loading skeleton, empty state, and stale/error indicator.
- [ ] Use existing Dashboard panel classes, VChart theme wiring, icon badges, and i18n `t()` calls; use teal/amber/red states for active, elevated, and error conditions.
- [ ] Add the panel as a tab or subpanel in the existing Users section without changing existing historical charts.
- [ ] Run `bun run typecheck` and `bun run build` from `web/`.

### Task 5: Validate the feature end to end

**Files:**
- Modify: `web/src/features/dashboard/components/users/realtime-user-usage.tsx` only if validation finds UI issues.

- [ ] Run focused Go model/controller tests and frontend checks.
- [ ] Verify the endpoint returns no users for an empty window, ranks users by TPM, includes cache read/write tokens, and reports errors correctly.
- [ ] Manually verify five-second refresh, pause-on-hidden-tab, search, sort, selected-user trend, empty state, forbidden response, and stale-data error state.
- [ ] Review `git diff --check` and commit the completed feature on `codex/realtime-usage-dashboard`.
