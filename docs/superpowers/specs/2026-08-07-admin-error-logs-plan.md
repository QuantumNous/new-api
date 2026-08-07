# Admin Error Logs (Failed Requests) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Record user-facing API/Relay failures into `logs` (type=5) by default, expose an admin-only Error Logs page with filters including standalone「上游错误 / upstream」.

**Architecture:** Extend existing `model.RecordErrorLog` with required `error_category` in `other` JSON; hook middleware + Relay early-exit + `processChannelError`; add `GET /api/error-log/` (AdminAuth); build `web/default` feature at `/error-logs`. No new table.

**Tech Stack:** Go 1.22+ (Gin, GORM), React 19 / TanStack Router / React Query / Base UI / i18next (Bun), SQLite/MySQL/PostgreSQL-compatible queries.

**Spec:** `docs/superpowers/specs/2026-08-07-admin-error-logs-design.md`

---

### Task 1: Error category constants + RecordErrorLog gate

**Files:**
- Create: `constant/error_log.go`
- Modify: `common/init.go` (default `ERROR_LOG_ENABLED` → true)
- Modify: `model/log.go` (`RecordErrorLog` early return when disabled; ensure `error_category` in other)
- Test: `constant/error_log_test.go` (optional tiny const smoke) or skip — prefer `model` helper test in Task 2

**Step 1: Add category constants**

```go
// constant/error_log.go
package constant

const (
	ErrorCategoryAuth       = "auth"
	ErrorCategoryRateLimit  = "rate_limit"
	ErrorCategoryChannel    = "channel"
	ErrorCategoryValidation = "validation"
	ErrorCategoryQuota      = "quota"
	ErrorCategoryUpstream   = "upstream"
	ErrorCategoryOther      = "other"
)
```

**Step 2: Default env to true**

In `common/init.go`, change:

```go
constant.ErrorLogEnabled = GetEnvOrDefaultBool("ERROR_LOG_ENABLED", true)
```

**Step 3: Gate RecordErrorLog**

At top of `model.RecordErrorLog`:

```go
if !constant.ErrorLogEnabled {
	return
}
if other == nil {
	other = make(map[string]interface{})
}
if _, ok := other["error_category"]; !ok {
	other["error_category"] = constant.ErrorCategoryOther
}
```

Import `constant` in `model/log.go` if missing.

**Step 4: Commit**

```bash
git add constant/error_log.go common/init.go model/log.go
git commit -m "feat(error-log): default-on ErrorLogEnabled and error_category constants"
```

---

### Task 2: Persist ErrorLogEnabled as system option

**Files:**
- Modify: `model/option.go` — OptionMap init + `updateOptionMap` switch case
- Modify: `web/default/src/features/system-settings/types.ts` — add `ErrorLogEnabled: boolean`
- Modify: `web/default/src/features/system-settings/operations/index.tsx` — default
- Modify: `web/default/src/features/system-settings/hooks/use-update-option.ts` — allowlist key
- Modify: `web/default/src/features/system-settings/maintenance/log-settings-section.tsx` — second Switch
- Modify: `web/default/src/features/system-settings/operations/section-registry.tsx` — pass prop if needed

**Step 1: Backend option wiring**

In `model/option.go` InitOptionMap (near LogConsumeEnabled):

```go
common.OptionMap["ErrorLogEnabled"] = strconv.FormatBool(constant.ErrorLogEnabled)
```

In update switch:

```go
case "ErrorLogEnabled":
	constant.ErrorLogEnabled = boolValue
```

**Step 2: Frontend settings UI**

Extend `logSettingsSchema`:

```ts
const logSettingsSchema = z.object({
  LogConsumeEnabled: z.boolean(),
  ErrorLogEnabled: z.boolean(),
})
```

Props: `defaultConsumeEnabled`, `defaultErrorLogEnabled` (or keep one object).

Add Switch labeled with i18n keys:
- `Record error logs`
- Description: `Record failed API requests for admin troubleshooting. Increases database writes.`

On submit, update whichever key changed (same pattern as LogConsumeEnabled).

Wire `use-update-option` allowlist to include `'ErrorLogEnabled'`.

**Step 3: Typecheck frontend**

```bash
cd web/default && bun run typecheck
```

Expected: pass (or only pre-existing unrelated errors).

**Step 4: Commit**

```bash
git add model/option.go web/default/src/features/system-settings
git commit -m "feat(error-log): add ErrorLogEnabled system setting toggle"
```

---

### Task 3: Unified helper `service.RecordRequestErrorLog`

**Files:**
- Create: `service/error_log.go`
- Create: `service/error_log_test.go`
- Modify: `controller/relay.go` `processChannelError` to use helper with `ErrorCategoryUpstream`

**Step 1: Write failing test**

```go
package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
)

func TestBuildErrorLogOther_SetsCategory(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	other := BuildErrorLogOther(c, constant.ErrorCategoryUpstream, map[string]interface{}{
		"status_code": 500,
	})
	if other["error_category"] != constant.ErrorCategoryUpstream {
		t.Fatalf("category=%v", other["error_category"])
	}
	if other["request_path"] != "/v1/chat/completions" {
		t.Fatalf("path=%v", other["request_path"])
	}
}
```

**Step 2: Implement helper**

```go
// service/error_log.go
package service

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const contextKeyErrorLogRecorded = "error_log_recorded"

func MarkErrorLogRecorded(c *gin.Context) {
	c.Set(contextKeyErrorLogRecorded, true)
}

func IsErrorLogRecorded(c *gin.Context) bool {
	v, ok := c.Get(contextKeyErrorLogRecorded)
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

func BuildErrorLogOther(c *gin.Context, category string, extra map[string]interface{}) map[string]interface{} {
	other := make(map[string]interface{})
	for k, v := range extra {
		other[k] = v
	}
	other["error_category"] = category
	if c.Request != nil && c.Request.URL != nil {
		if _, ok := other["request_path"]; !ok {
			other["request_path"] = c.Request.URL.Path
		}
	}
	return other
}

// RecordRequestErrorLog records type=5 once per request (unless force, used for upstream retries).
func RecordRequestErrorLog(c *gin.Context, category string, content string, extra map[string]interface{}, allowRetryDuplicate bool) {
	if !constant.ErrorLogEnabled {
		return
	}
	if !allowRetryDuplicate && IsErrorLogRecorded(c) {
		return
	}
	userId := c.GetInt("id")
	tokenName := c.GetString("token_name")
	modelName := c.GetString("original_model")
	if modelName == "" {
		modelName = c.GetString("model")
	}
	tokenId := c.GetInt("token_id")
	userGroup := c.GetString("group")
	channelId := c.GetInt("channel_id")
	other := BuildErrorLogOther(c, category, extra)
	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		startTime = time.Now()
	}
	useTimeSeconds := int(time.Since(startTime).Seconds())
	isStream := common.GetContextKeyBool(c, constant.ContextKeyIsStream)
	model.RecordErrorLog(c, userId, channelId, modelName, tokenName, content, tokenId, useTimeSeconds, isStream, userGroup, other)
	if !allowRetryDuplicate {
		MarkErrorLogRecorded(c)
	} else {
		// still mark so middleware won't double-write after relay finishes
		MarkErrorLogRecorded(c)
	}
}
```

Note: for upstream retries, call with `allowRetryDuplicate=true` so each failure inserts a row; still Mark so post-relay paths don't add a generic duplicate.

**Step 3: Refactor processChannelError**

Replace inline `RecordErrorLog` block with:

```go
service.RecordRequestErrorLog(c, constant.ErrorCategoryUpstream, err.MaskSensitiveErrorWithStatusCode(), map[string]interface{}{
	"error_type":    err.GetErrorType(),
	"error_code":    err.GetErrorCode(),
	"status_code":   err.StatusCode,
	"channel_id":    channelId,
	"channel_name":  c.GetString("channel_name"),
	"channel_type":  c.GetInt("channel_type"),
	"admin_info":    adminInfo,
}, true)
```

Keep disable-channel logic unchanged. Remove redundant `types.IsRecordErrorLog` check for upstream **or** keep it for non-quota skip semantics — for upstream keep `IsRecordErrorLog` guard before calling helper.

**Step 4: Run test**

```bash
go test ./service -run TestBuildErrorLogOther -count=1
```

Expected: PASS

**Step 5: Commit**

```bash
git add service/error_log.go service/error_log_test.go controller/relay.go
git commit -m "feat(error-log): add RecordRequestErrorLog helper and wire upstream path"
```

---

### Task 4: Hook middleware failures (auth / rate_limit / channel)

**Files:**
- Modify: `middleware/utils.go` — `abortWithOpenAiMessage` / `abortWithMidjourneyMessage` accept category or call recorder
- Modify: `middleware/auth.go` — auth failures → `auth`
- Modify: `middleware/distributor.go` — distribute failures → `channel` (validation-ish body parse → `validation`)
- Modify: `middleware/model-rate-limit.go` — → `rate_limit`
- Modify: `middleware/rate-limit.go` — global API limit on relay paths → `rate_limit`
- Modify: `middleware/performance.go` — overload → `rate_limit`

**Step 1: Extend abort helper**

```go
func abortWithOpenAiMessage(c *gin.Context, statusCode int, message string, code ...types.ErrorCode) {
	abortWithOpenAiMessageCategory(c, constant.ErrorCategoryOther, statusCode, message, code...)
}

func abortWithOpenAiMessageCategory(c *gin.Context, category string, statusCode int, message string, code ...types.ErrorCode) {
	codeStr := ""
	if len(code) > 0 {
		codeStr = string(code[0])
	}
	// record BEFORE Abort response fields are set is fine
	service.RecordRequestErrorLog(c, category, message, map[string]interface{}{
		"status_code": statusCode,
		"error_code":  codeStr,
	}, false)
	userId := c.GetInt("id")
	c.JSON(statusCode, gin.H{ /* unchanged */ })
	c.Abort()
	logger.LogError(...)
}
```

Update call sites that know the category to use `abortWithOpenAiMessageCategory`. For TokenAuth failures that don't use this helper, call `RecordRequestErrorLog` explicitly before Abort.

**Step 2: Distributor**

Map:
- model access / no channel / channel disabled → `ErrorCategoryChannel`
- invalid body / invalid channel id → `ErrorCategoryValidation`

**Step 3: Manual smoke (dev)**

With server running and ErrorLogEnabled true, call with bad token; confirm row in `logs` type=5 with `other` containing `"error_category":"auth"`.

**Step 4: Commit**

```bash
git add middleware/
git commit -m "feat(error-log): record auth, rate_limit, and channel middleware failures"
```

---

### Task 5: Relay early-exit + quota recording

**Files:**
- Modify: `controller/relay.go` — early returns (validate, GenRelayInfo, sensitive, estimate, price, preconsume, getChannel, body) call `RecordRequestErrorLog` with correct category
- Modify: `service/pre_consume_quota.go` — remove `ErrOptionWithNoRecordErrorLog()` from user-facing insufficient quota errors
- Modify: `service/billing_session.go` — remove `ErrOptionWithNoRecordErrorLog()` from insufficient/pre-consume failures (keep SkipRetry)

**Step 1: Remove NoRecord on quota paths**

Replace calls that append `types.ErrOptionWithNoRecordErrorLog()` for insufficient user/token quota with only `ErrOptionWithSkipRetry()` so they remain recordable when bubbled, **and** explicitly record at Relay early-exit with `ErrorCategoryQuota` (do not rely solely on processChannelError — those paths return before it).

**Step 2: Relay early-exit pattern**

Wherever `newAPIError` is set and function returns without `processChannelError`:

```go
service.RecordRequestErrorLog(c, constant.ErrorCategoryValidation, newAPIError.Error(), map[string]interface{}{
	"error_type":  newAPIError.GetErrorType(),
	"error_code":  newAPIError.GetErrorCode(),
	"status_code": newAPIError.StatusCode,
}, false)
```

Categories:
- validate / sensitive / estimate / price / body → `validation`
- preconsume → `quota`
- getChannel in loop → `channel`
- unknown → `other`

**Step 3: Task + Midjourney**

In `RelayTask` / `RelayMidjourney` failure paths that currently skip `processChannelError` for LocalError or never call it: add `RecordRequestErrorLog` with appropriate category (`upstream` for upstream, else local mapping).

**Step 4: Commit**

```bash
git add controller/relay.go service/pre_consume_quota.go service/billing_session.go
git commit -m "feat(error-log): cover relay early exits, quota, and task/MJ failures"
```

---

### Task 6: Admin query API + hide Error from user logs

**Files:**
- Modify: `model/log.go` — `GetErrorLogs(...)` with category filter; update `GetUserLogs` to exclude `type=5`
- Create: `controller/error_log.go` — `GetErrorLogs`
- Modify: `router/api-router.go` — register route
- Test: `model/log_error_query_test.go` (if DB test harness exists; else manual)

**Step 1: GetUserLogs exclude Error**

When `logType == LogTypeUnknown`:

```go
tx = LOG_DB.Where("logs.user_id = ? AND logs.type <> ?", userId, LogTypeError)
```

When `logType == LogTypeError` for user route: return empty or ApiError forbidden — prefer force empty list for type=5 on `/api/log/self`.

**Step 2: GetErrorLogs**

```go
func GetErrorLogs(startTimestamp, endTimestamp int64, modelName, username, tokenName, keyword, errorCategory, requestId string, channel, userId, startIdx, num int) ([]*Log, int64, error) {
	tx := LOG_DB.Where("logs.type = ?", LogTypeError)
	// same filters as GetAllLogs...
	if errorCategory != "" {
		// Cross-DB: LIKE on Other JSON text — avoid PG-only operators
		tx = tx.Where("logs.other LIKE ?", "%\"error_category\":\""+escapeLike(errorCategory)+"\"%")
	}
	if keyword != "" {
		tx = tx.Where("logs.content LIKE ?", "%"+escapeLike(keyword)+"%")
	}
	if userId != 0 {
		tx = tx.Where("logs.user_id = ?", userId)
	}
	// count + find + channel name enrich (copy from GetAllLogs)
}
```

Use existing `sanitizeLikePattern` if available; never concatenate unsanitized user input without escape.

**Step 3: Controller + router**

```go
// controller/error_log.go
func GetErrorLogs(c *gin.Context) { /* parse query → model.GetErrorLogs → ApiSuccess */ }
```

In `router/api-router.go`:

```go
errorLogRoute := apiRouter.Group("/error-log")
errorLogRoute.Use(middleware.AdminAuth())
{
	errorLogRoute.GET("/", controller.GetErrorLogs)
}
```

**Step 4: Commit**

```bash
git add model/log.go controller/error_log.go router/api-router.go
git commit -m "feat(error-log): admin GET /api/error-log and hide errors from user logs"
```

---

### Task 7: Frontend Error Logs feature page

**Files:**
- Create: `web/default/src/features/error-logs/` (api.ts, constants.ts, types.ts, index.tsx, components/*)
- Create: `web/default/src/routes/_authenticated/error-logs/index.tsx`
- Modify: `web/default/src/hooks/use-sidebar-data.ts` — Admin section item「Error Logs」→ `/error-logs`
- Modify: `web/default/src/hooks/use-sidebar-config.ts` — route module mapping (admin)
- Run route codegen if project requires (`bun run` script that regenerates `routeTree.gen.ts`)

**Step 1: Scaffold feature mirroring usage-logs patterns**

- `api.ts`: `GET /api/error-log/` with query params
- `constants.ts`: `ERROR_CATEGORY_OPTIONS` with `labelKey` for i18n:
  - auth, rate_limit, channel, validation, quota, **upstream** (「Upstream error」), other
- Filter bar: datetime range, category select (include Upstream), username, model, channel, token, request_id, keyword
- Table columns per design
- Empty state when no rows

**Step 2: Route**

```tsx
// routes/_authenticated/error-logs/index.tsx
export const Route = createFileRoute('/_authenticated/error-logs/')({
  beforeLoad: () => { /* admin check same as other admin pages */ },
  component: ErrorLogsPage,
})
```

Ensure non-admin cannot navigate (same pattern as Channels).

**Step 3: Sidebar**

Under Admin group, add:

```ts
{
  title: t('Error Logs'),
  url: '/error-logs',
  icon: /* AlertTriangle or similar Hugeicon */,
}
```

**Step 4: typecheck**

```bash
cd web/default && bun run typecheck
```

**Step 5: Commit**

```bash
git add web/default/src/features/error-logs web/default/src/routes/_authenticated/error-logs web/default/src/hooks/use-sidebar-data.ts web/default/src/hooks/use-sidebar-config.ts web/default/src/routeTree.gen.ts
git commit -m "feat(error-log): admin Error Logs page with category filters"
```

---

### Task 8: i18n keys

**Files:**
- Modify: `web/default/src/i18n/locales/en.json` (and zh, fr, ja, ru, vi) via `@i18n-translate` skill or `bun run i18n:sync` from `web/default`

Keys (English source strings used as keys or as values — follow project flat-key style):

- `Error Logs`
- `Record error logs`
- `Record failed API requests for admin troubleshooting. Increases database writes.`
- Category labels: `Auth`, `Rate limit`, `Channel`, `Validation`, `Quota`, `Upstream error`, `Other`
- Column headers as needed

**Step 1:** Add `t('...')` usages in UI (Task 7), then sync/translate per `@.agents/skills/i18n-translate/SKILL.md`.

**Step 2: Commit**

```bash
git add web/default/src/i18n
git commit -m "chore(i18n): translations for admin error logs"
```

---

### Task 9: End-to-end acceptance checklist

**Manual checks** (local server + admin login):

1. Invalid token → Error Logs shows `auth`
2. Valid token, model with no channel → `channel`
3. User with 0 quota → `quota`
4. Upstream 5xx (or mock) → `upstream`; filter「Upstream error」shows only those
5. User Usage Logs / `/api/log/self` — no type Error rows
6. Toggle ErrorLogEnabled off → new failures do not insert
7. Confirm SQLite path works; if MySQL/PG available, spot-check category LIKE filter

**Step: Commit any small fixes** found during QA.

---

## Notes for implementer

- Always use `common.Marshal` / `Unmarshal` for JSON in Go business code (project Rule 1).
- Do not invent PostgreSQL `@>` / JSONB-only filters without SQLite/MySQL fallback.
- Do not expose `/api/error-log` without `AdminAuth`.
- Do not add Classic theme UI in v1.
- Upstream retries: `allowRetryDuplicate=true` so each attempt is visible; same `request_id`.
- Prefer copying patterns from `features/usage-logs` and `controller/log.go` over greenfield abstractions.
