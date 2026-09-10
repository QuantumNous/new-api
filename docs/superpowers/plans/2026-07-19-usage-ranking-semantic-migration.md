# Usage Ranking Semantic Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root-only, real-time usage-log ranking to both Classic and Default frontends while preserving each frontend's native visual language.

**Architecture:** A new `model/log_ranking.go` query service aggregates consume and error logs directly from the configured log database, with a root-protected `GET /api/log/ranking` controller endpoint. Classic and Default consume the same stable JSON contract but implement separate presentation components: Semi Design/CardPro for Classic and Base UI/TanStack Query/Tailwind for Default.

**Tech Stack:** Go 1.22+, Gin, GORM v2, SQLite/MySQL/PostgreSQL/ClickHouse log databases, React 18 + Semi Design for Classic, React 19 + TypeScript + TanStack Query + Base UI + Tailwind for Default, Bun, i18next.

## Global Constraints

- The ranking endpoint is root-only and MUST use `middleware.RootAuth()`; administrator role 10 is not sufficient.
- The backend MUST support SQLite, MySQL >= 5.7.8, PostgreSQL >= 9.6, and the existing ClickHouse log-database mode.
- The implementation MUST perform real-time aggregation and MUST NOT add a migration, cache, scheduled job, pre-aggregation table, or new dependency.
- Only `sort_by=quota` and `sort_by=request_count` are accepted, both in descending order with a deterministic `user_id ASC, username ASC` tie-breaker.
- The response MUST include paginated users, the full matching-range summary, and per-group breakdown for users on the current page; it MUST NOT include the source project's unused `top10` field.
- Model filtering MUST reuse `applyExplicitLogTextFilter`; channel `0` and empty model/group values mean no filter.
- Quota, token, request, error, and timestamp aggregates MUST use `int64`; ratios MUST be computed in Go with zero-denominator protection.
- Classic MUST be redesigned in the current Classic Semi Design/CardPro/CardTable style; the source screenshot is a functional/data reference only.
- Default MUST use its existing Base UI, TanStack Query, Tailwind, table, responsive, and authentication patterns.
- All user-facing frontend text MUST use the existing i18next locale files.
- Existing usage-log dialogs, filters, routes, and log behavior MUST remain unchanged.
- Protected `new-api` and `QuantumNous` project identity and attribution MUST remain unchanged.

---

### Task 1: Real-time ranking aggregation service

**Files:**
- Create: `model/log_ranking.go`
- Create: `model/log_ranking_test.go`

**Interfaces:**
- Consumes: `LOG_DB *gorm.DB`, `Log`, `LogTypeConsume`, `LogTypeError`, `logGroupCol`, and `applyExplicitLogTextFilter(*gorm.DB, string, string) (*gorm.DB, error)` from `model/log.go`.
- Produces: `GetUsageRanking(UsageRankingQuery) (UsageRankingResult, error)` and the JSON types used by the controller.

- [ ] **Step 1: Write failing aggregation contract tests**

Create deterministic SQLite fixtures containing consume/error logs for multiple users, models, channels, groups, and timestamps. The tests must assert exact pagination, quota/request sorting, token totals, error attribution, latest request time, distinct model count, stream ratio, error rate, group breakdown, filters, empty results, and stable tie ordering. Use this public contract:

```go
type UsageRankingQuery struct {
	StartTimestamp int64
	EndTimestamp   int64
	ModelName      string
	ChannelID      int
	Group          string
	SortBy         string
	Page           int
	PageSize       int
}

func TestGetUsageRankingAggregatesAndPaginates(t *testing.T) {
	result, err := GetUsageRanking(UsageRankingQuery{
		StartTimestamp: 100,
		EndTimestamp:   200,
		SortBy:         UsageRankingSortQuota,
		Page:           1,
		PageSize:       2,
	})
	require.NoError(t, err)
	require.Len(t, result.Items, 2)
	assert.Equal(t, int64(3), result.Total)
	assert.Equal(t, int64(330), result.Summary.Quota)
	assert.Equal(t, int64(4), result.Summary.RequestCount)
	assert.Equal(t, 10, result.Items[0].UserID)
	assert.Equal(t, int64(200), result.Items[0].Quota)
	assert.Equal(t, int64(2), result.Items[0].RequestCount)
	assert.Equal(t, int64(1), result.Items[0].ErrorCount)
	assert.Equal(t, 50.0, result.Items[0].ErrorRate)
}
```

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run: `go test ./model -run TestGetUsageRanking -count=1`

Expected: FAIL because `UsageRankingQuery` and `GetUsageRanking` do not exist.

- [ ] **Step 3: Implement the aggregation types and five-query flow**

Implement the following exported JSON contract in `model/log_ranking.go`:

```go
const (
	UsageRankingSortQuota        = "quota"
	UsageRankingSortRequestCount = "request_count"
)

type UsageRankingGroupStat struct {
	Group             string  `json:"group"`
	Quota             int64   `json:"quota"`
	RequestCount      int64   `json:"request_count"`
	PromptTokens      int64   `json:"prompt_tokens"`
	CompletionTokens  int64   `json:"completion_tokens"`
	TotalTokens       int64   `json:"total_tokens"`
	AverageUseTime    float64 `json:"avg_use_time"`
	StreamCount       int64   `json:"stream_count"`
	StreamRatio       float64 `json:"stream_ratio"`
	ErrorCount        int64   `json:"error_count"`
	ErrorRate         float64 `json:"error_rate"`
	ModelCount        int64   `json:"model_count"`
	TokenCount        int64   `json:"token_count"`
	ChannelCount      int64   `json:"channel_count"`
	LastUsedAt        int64   `json:"last_used_at"`
}

type UsageRankingItem struct {
	Rank               int                     `json:"rank"`
	UserID             int                     `json:"user_id"`
	Username           string                  `json:"username"`
	Quota              int64                   `json:"quota"`
	RequestCount       int64                   `json:"request_count"`
	PromptTokens       int64                   `json:"prompt_tokens"`
	CompletionTokens   int64                   `json:"completion_tokens"`
	TotalTokens        int64                   `json:"total_tokens"`
	AverageUseTime     float64                 `json:"avg_use_time"`
	ErrorCount         int64                   `json:"error_count"`
	ErrorRate          float64                 `json:"error_rate"`
	StreamCount        int64                   `json:"stream_count"`
	StreamRatio        float64                 `json:"stream_ratio"`
	ModelCount         int64                   `json:"model_count"`
	TokenCount         int64                   `json:"token_count"`
	GroupCount         int64                   `json:"group_count"`
	ChannelCount       int64                   `json:"channel_count"`
	LastUsedAt         int64                   `json:"last_used_at"`
	GroupStats         []UsageRankingGroupStat `json:"group_stats"`
}

type UsageRankingSummary struct {
	Quota             int64 `json:"quota"`
	RequestCount      int64 `json:"request_count"`
	PromptTokens      int64 `json:"prompt_tokens"`
	CompletionTokens  int64 `json:"completion_tokens"`
	TotalTokens       int64 `json:"total_tokens"`
	ActiveUserCount   int64 `json:"active_user_count"`
}

type UsageRankingResult struct {
	Items   []UsageRankingItem `json:"items"`
	Total   int64              `json:"total"`
	Summary UsageRankingSummary `json:"summary"`
}
```

Use five bounded aggregation queries: distinct grouped-user count; whole-range consume summary; paged consume users; consume group rows for page identities; error group rows for page identities. Apply the same time/model/channel/group scope to consume and error queries, derive `ErrorCount` by summing error group rows, compute `ErrorRate = error_count / (request_count + error_count) * 100`, and `StreamRatio = stream_count / request_count * 100`. Initialize all slices to empty slices so JSON returns `[]`, not `null`.

- [ ] **Step 4: Run model tests and cross-package compilation**

Run: `go test ./model -run 'TestGetUsageRanking|TestApplyExplicitLogTextFilter' -count=1`

Expected: PASS.

Run: `go test ./model ./controller ./router -count=1`

Expected: PASS.

- [ ] **Step 5: Commit the aggregation service**

```bash
git add model/log_ranking.go model/log_ranking_test.go
git commit -m "feat: add usage ranking aggregation"
```

### Task 2: Root-only ranking API

**Files:**
- Modify: `controller/log.go`
- Modify: `router/api-router.go`

**Interfaces:**
- Consumes: `model.GetUsageRanking(model.UsageRankingQuery) (model.UsageRankingResult, error)`.
- Produces: `GET /api/log/ranking` returning `{success,message,data:{items,total,page,page_size,summary}}`.

- [ ] **Step 1: Add strict request parsing and response mapping**

Add `GetUsageRanking(c *gin.Context)` to `controller/log.go`. Defaults are local-day start through current time plus one hour, page 1, page size 20, and `sort_by=quota`; maximum page size is 100. Reject malformed timestamps/channel IDs, negative channel IDs/timestamps, and end before start with HTTP 400. Normalize invalid sort values to `quota` and invalid pagination to its documented defaults. Invalid requests use this shape:

```go
c.JSON(http.StatusBadRequest, gin.H{
	"success": false,
	"message": "invalid usage ranking parameters",
})
```

On success, map the model result without renaming its nested fields:

```go
common.ApiSuccess(c, gin.H{
	"items":     result.Items,
	"total":     result.Total,
	"page":      query.Page,
	"page_size": query.PageSize,
	"summary":   result.Summary,
})
```

- [ ] **Step 2: Register the endpoint with root authorization**

In the existing `/api/log` route group, register the exact route before parameterized descendants:

```go
logRoute.GET("/ranking", middleware.RootAuth(), controller.GetUsageRanking)
```

- [ ] **Step 3: Verify routing and backend behavior**

Run: `gofmt -w model/log_ranking.go model/log_ranking_test.go controller/log.go router/api-router.go`

Run: `go test ./model ./controller ./router -count=1`

Expected: PASS.

Run: `go test ./... -count=1`

Expected: PASS, or an existing unrelated package failure documented with the focused packages still passing.

- [ ] **Step 4: Commit the API**

```bash
git add controller/log.go router/api-router.go
git commit -m "feat: expose root usage ranking api"
```

### Task 3: Classic ranking experience in native Classic style

**Files:**
- Create: `web/classic/src/hooks/usage-logs/useUsageRankingData.jsx`
- Create: `web/classic/src/components/table/usage-logs/ranking/UsageRankingTab.jsx`
- Create: `web/classic/src/components/table/usage-logs/ranking/UsageRankingFilters.jsx`
- Create: `web/classic/src/components/table/usage-logs/ranking/UsageRankingSummary.jsx`
- Create: `web/classic/src/components/table/usage-logs/ranking/UsageRankingTable.jsx`
- Create: `web/classic/src/components/table/usage-logs/ranking/usage-ranking-table.css`
- Modify: `web/classic/src/components/table/usage-logs/index.jsx`

**Interfaces:**
- Consumes: `/api/log/ranking`, Classic `API`, `showError`, `renderQuota`, `timestamp2string`, `isRoot`, `useIsMobile`, Semi Design, and existing CardPro conventions.
- Produces: a lazy root-only `logs`/`ranking` local tab switcher without changing the route.

- [ ] **Step 1: Implement ranking query state and lazy loading**

The hook owns the date range, model, channel, group, sort, page, page size, loading state, expanded rows, and response. Fetch only after the Ranking tab becomes active and refetch on submitted filters or pagination. Send Unix seconds as `start_timestamp` and `end_timestamp` and expose:

```jsx
return {
  filters,
  setFilters,
  appliedFilters,
  ranking,
  loading,
  activePage,
  pageSize,
  expandedRowKeys,
  setExpandedRowKeys,
  applyFilters,
  resetFilters,
  handlePageChange,
  handlePageSizeChange,
  refresh,
  t,
};
```

When the API returns `success: false` or the request rejects, call `showError` and keep a safe empty response `{items: [], total: 0, summary: {quota: 0, request_count: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, active_user_count: 0}}`.

- [ ] **Step 2: Build Classic filters, summary cards, and responsive ranking rows**

Use Semi `DatePicker`, `Input`, `InputNumber`, `Select`, `Button`, `Card`, `Table`, `Tag`, and `Progress` components. Preserve Classic spacing, rounded cards, compact filters, CardPro pagination, and its current mobile behavior. The table columns are rank, user, consumed quota, requests, tokens, input, output, average duration, errors/rate, stream ratio, models, and latest request time. An expanded row renders all `group_stats` in a compact nested table. Ranking badges distinguish 1/2/3 and ordinary positions without copying the source row-background styling.

- [ ] **Step 3: Add a root-only local tab around the existing log card**

Keep all four existing modals mounted and preserve the current `CardPro` content exactly as the Logs tab body. Use `isRoot()` to decide whether to show a Semi `Tabs` control with `logs` and `ranking`; non-root users render the old page directly. Mount `<UsageRankingTab active={activeTab === 'ranking'} />` only for root users so the endpoint is never requested by other roles.

- [ ] **Step 4: Verify Classic quality gates**

Run from `web/classic`:

```bash
bun run eslint
bun run lint
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Classic**

```bash
git add web/classic/src/hooks/usage-logs/useUsageRankingData.jsx web/classic/src/components/table/usage-logs
git commit -m "feat(classic): add usage ranking view"
```

### Task 4: Default ranking data contract and root-only tab integration

**Files:**
- Modify: `web/default/src/features/usage-logs/types.ts`
- Modify: `web/default/src/features/usage-logs/api.ts`
- Modify: `web/default/src/features/usage-logs/index.tsx`
- Create: `web/default/src/features/usage-logs/components/ranking/usage-ranking-view.tsx`

**Interfaces:**
- Consumes: `api`, `buildQueryParams`, `ROLE.SUPER_ADMIN`, `useAuthStore`, and the Default tabs component.
- Produces: `getUsageRanking(params): Promise<GetUsageRankingResponse>` and a lazy root-only Default ranking view.

- [ ] **Step 1: Define the TypeScript API contract**

Add exact interfaces matching backend snake_case JSON:

```ts
export interface UsageRankingParams {
  start_timestamp?: number
  end_timestamp?: number
  model_name?: string
  channel?: number
  group?: string
  sort_by?: 'quota' | 'request_count'
  p?: number
  page_size?: number
}

export interface UsageRankingGroupStat {
  group: string
  quota: number
  request_count: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  avg_use_time: number
  stream_count: number
  stream_ratio: number
  error_count: number
  error_rate: number
  model_count: number
  token_count: number
  channel_count: number
  last_used_at: number
}

export interface UsageRankingItem {
  rank: number
  user_id: number
  username: string
  quota: number
  request_count: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  avg_use_time: number
  error_count: number
  error_rate: number
  stream_count: number
  stream_ratio: number
  model_count: number
  token_count: number
  group_count: number
  channel_count: number
  last_used_at: number
  group_stats: UsageRankingGroupStat[]
}
```

Also define `UsageRankingSummary`, `UsageRankingData`, and `GetUsageRankingResponse` with the backend response envelope. Implement:

```ts
export async function getUsageRanking(
  params: UsageRankingParams = {}
): Promise<GetUsageRankingResponse> {
  const query = buildQueryParams({ p: 1, page_size: 20, sort_by: 'quota', ...params })
  const response = await api.get(`/api/log/ranking?${query}`)
  return response.data
}
```

- [ ] **Step 2: Add a local Logs/Ranking tab only for root on common logs**

Derive root access with `useAuthStore((state) => state.auth.user?.role === ROLE.SUPER_ADMIN)`. Keep task/drawing navigation unchanged. On the `common` section, root users see local `logs` and `ranking` tabs; all other combinations render `UsageLogsTable` exactly as before. Keep local tab state out of the URL. Render the ranking view only while selected so TanStack Query is lazy.

- [ ] **Step 3: Add the ranking query shell**

In `usage-ranking-view.tsx`, own draft/applied filters and pagination. Call `useQuery` with a key containing every applied filter, page, and page size; validate the response `success` flag and throw its message for the shared error state. Compose the filter bar, summary, desktop table, and mobile list created in Task 5.

- [ ] **Step 4: Run Default type checking for the contract**

Run from `web/default`: `bun run typecheck`

Expected: PASS after Task 5 components exist; during this task, failures must only be unresolved imports that Task 5 creates, not contract mismatches.

- [ ] **Step 5: Commit the Default contract and integration**

Commit together with Task 5 after all imported view components compile.

### Task 5: Default native ranking UI and responsive details

**Files:**
- Create: `web/default/src/features/usage-logs/components/ranking/usage-ranking-filter-bar.tsx`
- Create: `web/default/src/features/usage-logs/components/ranking/usage-ranking-summary.tsx`
- Create: `web/default/src/features/usage-logs/components/ranking/usage-ranking-columns.tsx`
- Create: `web/default/src/features/usage-logs/components/ranking/usage-ranking-table.tsx`
- Create: `web/default/src/features/usage-logs/components/ranking/usage-ranking-mobile-list.tsx`

**Interfaces:**
- Consumes: Task 4 ranking types and `UsageRankingView` state; existing Default inputs, buttons, cards, table, badge, collapsible, date/time formatting, quota formatting, and pagination conventions.
- Produces: desktop and mobile Default-native rendering with per-group expansion.

- [ ] **Step 1: Build the filter bar and summary**

Create a typed `UsageRankingFilters` object containing `startTime`, `endTime`, `modelName`, `channel`, `group`, and `sortBy`. The filter bar has apply/reset actions and uses current Default form controls. The four summary cards show quota, requests, tokens, and active users, using the existing quota/token compact formatting helpers and loading skeletons.

- [ ] **Step 2: Build the desktop table and columns**

Use TanStack table column definitions with stable accessors. Render a disclosure button only when `group_stats.length > 0`; display medal/badge treatments for ranks 1-3 and a neutral rank for the rest. Numeric cells are right-aligned and formatted; time is localized. Expanded group content uses the existing table primitives and shows group, quota, requests, errors, and group error rate computed as `errors / (requests + errors)` with zero protection.

- [ ] **Step 3: Build the mobile list**

Use the existing `md:hidden` breakpoint pattern. Each card prominently shows rank, username/user ID, quota, requests, tokens, error rate, and latest request time. A disclosure reveals secondary metrics and the complete group breakdown. Maintain keyboard-accessible buttons and `aria-expanded` state.

- [ ] **Step 4: Run Default quality gates**

Run from `web/default`:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit Default**

```bash
git add web/default/src/features/usage-logs
git commit -m "feat(default): add usage ranking view"
```

### Task 6: Internationalization, integrated QA, and release verification

**Files:**
- Modify: `web/classic/src/locales/en.json`
- Modify: `web/classic/src/locales/zh.json`
- Modify: other Classic locale files reported by its sync tool
- Modify: `web/default/src/i18n/locales/en.json`
- Modify: `web/default/src/i18n/locales/zh.json`
- Modify: `web/default/src/i18n/locales/fr.json`
- Modify: `web/default/src/i18n/locales/ru.json`
- Modify: `web/default/src/i18n/locales/ja.json`
- Modify: `web/default/src/i18n/locales/vi.json`

**Interfaces:**
- Consumes: every English-source key introduced by Tasks 3-5.
- Produces: complete locale coverage and verified end-to-end behavior.

- [ ] **Step 1: Synchronize and translate locale keys**

Run `bun run i18n:sync` in both `web/classic` and `web/default`. Supply human-readable Chinese translations for every new key and non-empty translations/fallbacks in all locale files required by each project. Required concepts include Logs, Ranking, Consumed quota, Request count, Total tokens, Active users, Model, Channel ID, Group, Sort by, Apply filters, Reset, Average duration, Error rate, Stream ratio, Model count, Latest request time, Group breakdown, No ranking data, and refresh/error messages.

- [ ] **Step 2: Run every automated gate**

Run from repository root:

```bash
go test ./model ./controller ./router -count=1
go test ./... -count=1
```

Run from `web/classic`:

```bash
bun run i18n:sync
bun run eslint
bun run lint
bun run build
```

Run from `web/default`:

```bash
bun run i18n:sync
bun run typecheck
bun run lint
bun run format:check
bun run build
```

Expected: all commands exit 0. Any unrelated pre-existing failure must be recorded with its exact command and output while all focused ranking checks remain green.

- [ ] **Step 3: Perform browser acceptance checks in both themes**

With a root session, verify Logs and Ranking tabs, initial lazy request, filters, reset, quota/request sorting, pagination, group expansion, zero/empty state, loading/error state, desktop layout, and mobile layout. With role 10 and ordinary-user sessions, verify the Ranking tab is absent and direct `/api/log/ranking` access is rejected. Confirm the four Classic usage-log modals and all Default common/drawing/task log routes still work.

- [ ] **Step 4: Review the diff for scope and identity safety**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~3..HEAD
```

Expected: no whitespace errors; only ranking-related source, test, plan/spec, and locale files are present; the user's unrelated CSV files remain untracked and untouched; protected project identity is unchanged.

- [ ] **Step 5: Commit translations and verification fixes**

```bash
git add web/classic/src/locales web/default/src/i18n/locales
git commit -m "i18n: translate usage ranking"
```

### Task 7: Per-group model and channel consumption distribution

**Files:**
- Modify: `model/log_ranking.go`
- Modify: `model/log_ranking_test.go`
- Modify: `web/classic/src/components/table/usage-logs/ranking/UsageRankingTable.jsx`
- Modify: `web/classic/src/components/table/usage-logs/ranking/usage-ranking-table.css`
- Modify: `web/default/src/features/usage-logs/types.ts`
- Modify: `web/default/src/features/usage-logs/components/ranking/usage-ranking-table.tsx`
- Modify: `web/default/src/features/usage-logs/components/ranking/usage-ranking-mobile-list.tsx`
- Modify: both frontend locale sets

**Interfaces:**
- Produces `UsageRankingGroupStat.model_stats` and `UsageRankingGroupStat.channel_stats` as non-null arrays.
- Each distribution item includes quota, quota ratio, request count, prompt/completion/total tokens, and last-used time; channel items additionally include channel ID and optional channel name.

- [ ] **Step 1: Add a failing backend contract test**

Seed one user/group with two models and two channels, including one model used across both channels. Assert exact per-model and per-channel totals, quota ratios, sorting, channel-name enrichment, and non-null nested arrays.

- [ ] **Step 2: Implement two bounded aggregation queries**

Scope both queries to the current page identities and all active filters. Assemble rows by the existing `usageRankingGroupIdentity`, calculate quota ratios in Go, and batch-resolve channel names from the main database without changing the authoritative channel ID.

- [ ] **Step 3: Render both distributions in Classic and Default**

Show model and channel sections immediately inside each expanded group. Use each frontend's native components, compact progress bars for quota share, responsive desktop tables, and readable mobile cards without an extra disclosure click.

- [ ] **Step 4: Add translations and verify**

Add all user-facing keys to every supported locale, then run focused Go tests, full Go tests, Classic formatting/build checks, Default typecheck/lint/build checks, and desktop/mobile browser QA.
