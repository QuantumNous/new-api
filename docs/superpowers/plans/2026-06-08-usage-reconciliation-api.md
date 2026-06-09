# Usage Reconciliation API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement two token-guarded, read-only reconciliation endpoints — `GET /usage/summary` and `GET /usage/transactions` — that report new-api's recorded usage/cost for all BlockRun-family channels.

**Architecture:** Static Bearer-token middleware (`middleware/`) guards a root-level `/usage` group. Data access lives in `model/` (channel-type resolution + streaming/paged log queries). The `controller/` layer parses params, aggregates in Go (cache tokens live in the `Other` JSON blob, not columns, and must be summed in Go for cross-DB compatibility), and assembles the response DTOs. The router wires it into `SetRouter`.

**Tech Stack:** Go, Gin, GORM v2, `glebarez/sqlite` (tests), `shopspring/decimal`, `crypto/subtle`.

**Spec:** `docs/superpowers/specs/2026-06-08-blockrun-usage-reconciliation-design.md`

**Key invariants (from spec):**
- Data scope = all channels whose `constant.ChannelTypeNames` value has prefix `blockrun` (case-insensitive); `type = LogTypeConsume`; `created_at ∈ [start,end)`.
- `actual_cost = ΣQuota / common.QuotaPerUnit` (10-decimal string). **`total_cost` is NOT returned** (折前官价 unobtainable — never fake it).
- `provider = "flatkey-newapi"`, `currency = "USD"`, `period.timezone = "UTC"`.
- Range ≤ 31 days; cache tokens from `Other.cache_tokens` (read) / `Other.cache_creation_tokens` (create).
- `metadata = {channel_id, channel_name}` (no `chain`). `status` default `success`, `error` when `Other.stream_status.status=="error"`.

---

## Task 1: Auth middleware (`middleware/usage_recon_auth.go`)

**Files:**
- Create: `middleware/usage_recon_auth.go`
- Test: `middleware/usage_recon_auth_test.go`

- [ ] **Step 1: Write the failing test**

Create `middleware/usage_recon_auth_test.go`:

```go
package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
)

func newUsageAuthEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	g := r.Group("/usage")
	g.Use(UsageReconAuth())
	g.GET("/ping", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	return r
}

func TestUsageReconAuth(t *testing.T) {
	t.Run("503 when env not set", func(t *testing.T) {
		os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503; body=%s", rec.Code, rec.Body.String())
		}
	})

	t.Run("401 when token missing", func(t *testing.T) {
		os.Setenv(UsageReconTokenEnv, "secret")
		defer os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("401 when token wrong", func(t *testing.T) {
		os.Setenv(UsageReconTokenEnv, "secret")
		defer os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		req.Header.Set("Authorization", "Bearer wrong")
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want 401", rec.Code)
		}
	})

	t.Run("200 when Bearer token correct", func(t *testing.T) {
		os.Setenv(UsageReconTokenEnv, "secret")
		defer os.Unsetenv(UsageReconTokenEnv)
		req := httptest.NewRequest(http.MethodGet, "/usage/ping", nil)
		req.Header.Set("Authorization", "Bearer secret")
		rec := httptest.NewRecorder()
		newUsageAuthEngine().ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
		}
	})
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jjcc/develop_project/shulex/new-api/.claude/worktrees/usage-reconciliation-api && go test ./middleware/ -run TestUsageReconAuth -v`
Expected: FAIL — `undefined: UsageReconAuth` / `undefined: UsageReconTokenEnv`.

- [ ] **Step 3: Write minimal implementation**

Create `middleware/usage_recon_auth.go`:

```go
package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

// UsageReconTokenEnv is the env var holding the static shared secret that guards
// the /usage reconciliation endpoints. Empty => endpoints are closed (503).
const UsageReconTokenEnv = "BLOCKRUN_USAGE_SUMMARY_TOKEN"

// UsageReconAuth guards the reconciliation endpoints with a single static
// Bearer token (env). It deliberately does NOT use the JWT / token / user
// system: the token only authenticates the caller, it does not scope a user.
func UsageReconAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		want := strings.TrimSpace(common.GetEnvOrDefaultString(UsageReconTokenEnv, ""))
		if want == "" {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "usage reconciliation token not configured"})
			c.Abort()
			return
		}
		got := usageReconBearer(c.GetHeader("Authorization"))
		if got == "" || subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// usageReconBearer extracts the token from an "Authorization: Bearer <token>"
// header. Only the Bearer scheme is accepted (no ?token= / custom-header fallback).
func usageReconBearer(header string) string {
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return parts[1]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./middleware/ -run TestUsageReconAuth -v`
Expected: PASS (4 subtests).

- [ ] **Step 5: Commit**

```bash
git add middleware/usage_recon_auth.go middleware/usage_recon_auth_test.go
git commit -m "feat(usage-recon): add static Bearer-token auth middleware"
```

---

## Task 2: Model data access (`model/usage_reconciliation.go`)

**Files:**
- Create: `model/usage_reconciliation.go`
- Test: `model/usage_reconciliation_test.go` (uses the existing `model` package `TestMain` in `model/task_cas_test.go`, which migrates `Log` + `Channel` and sets `DB`/`LOG_DB`)

- [ ] **Step 1: Write the failing test**

Create `model/usage_reconciliation_test.go`:

```go
package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func resetUsageTables(t *testing.T) {
	t.Helper()
	if err := LOG_DB.Exec("DELETE FROM logs").Error; err != nil {
		t.Fatalf("clean logs: %v", err)
	}
	if err := DB.Exec("DELETE FROM channels").Error; err != nil {
		t.Fatalf("clean channels: %v", err)
	}
}

func TestBlockRunChannelTypes(t *testing.T) {
	types := BlockRunChannelTypes()
	set := map[int]bool{}
	for _, ty := range types {
		set[ty] = true
	}
	for _, want := range []int{100, 101, 102} {
		if !set[want] {
			t.Fatalf("expected blockrun type %d in %v", want, types)
		}
	}
	if set[1] { // type 1 is OpenAI, not blockrun
		t.Fatalf("type 1 should not be a blockrun type: %v", types)
	}
}

func TestGetBlockRunChannels(t *testing.T) {
	resetUsageTables(t)
	mustCreate(t, &Channel{Id: 34, Type: 100, Name: "blockRun-claude-0603", Key: "k1"})
	mustCreate(t, &Channel{Id: 35, Type: 100, Name: "blockRun-openai-0603", Key: "k2"})
	mustCreate(t, &Channel{Id: 99, Type: 1, Name: "plain-openai", Key: "k3"})

	got, err := GetBlockRunChannels()
	if err != nil {
		t.Fatalf("GetBlockRunChannels: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("want 2 blockrun channels, got %d (%v)", len(got), got)
	}
	if got[34].Name != "blockRun-claude-0603" || got[34].Type != 100 {
		t.Fatalf("unexpected channel 34: %+v", got[34])
	}
	if _, ok := got[99]; ok {
		t.Fatalf("non-blockrun channel 99 must be excluded")
	}
}

func TestQueryAndCountBlockRunUsageLogs(t *testing.T) {
	resetUsageTables(t)
	mustCreate(t, &Channel{Id: 34, Type: 100, Name: "blockRun-claude-0603", Key: "k1"})
	mustCreate(t, &Channel{Id: 99, Type: 1, Name: "plain-openai", Key: "k3"})

	// in-window consume logs on blockrun channel
	mustCreate(t, &Log{Type: LogTypeConsume, ChannelId: 34, CreatedAt: 1000, ModelName: "m1", PromptTokens: 1})
	mustCreate(t, &Log{Type: LogTypeConsume, ChannelId: 34, CreatedAt: 1500, ModelName: "m2", PromptTokens: 2})
	// excluded: out of window
	mustCreate(t, &Log{Type: LogTypeConsume, ChannelId: 34, CreatedAt: 5000, ModelName: "m3"})
	// excluded: wrong type
	mustCreate(t, &Log{Type: LogTypeError, ChannelId: 34, CreatedAt: 1200, ModelName: "m4"})
	// excluded: non-blockrun channel
	mustCreate(t, &Log{Type: LogTypeConsume, ChannelId: 99, CreatedAt: 1200, ModelName: "m5"})

	ids := []int{34}
	count, err := CountBlockRunUsageLogs(ids, 1000, 2000)
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 2 {
		t.Fatalf("count = %d, want 2", count)
	}

	// streaming returns the 2 in created_at asc order
	var streamed []string
	if err := StreamBlockRunUsageLogs(ids, 1000, 2000, func(l *Log) error {
		streamed = append(streamed, l.ModelName)
		return nil
	}); err != nil {
		t.Fatalf("stream: %v", err)
	}
	if len(streamed) != 2 || streamed[0] != "m1" || streamed[1] != "m2" {
		t.Fatalf("streamed = %v, want [m1 m2]", streamed)
	}

	// paged: page_size 1 → first row only
	paged, err := QueryBlockRunUsageLogsPaged(ids, 1000, 2000, 1, 0)
	if err != nil {
		t.Fatalf("paged: %v", err)
	}
	if len(paged) != 1 || paged[0].ModelName != "m1" {
		t.Fatalf("paged page1 = %v", paged)
	}
}

func mustCreate(t *testing.T, v interface{}) {
	t.Helper()
	db := DB
	if _, ok := v.(*Log); ok {
		db = LOG_DB
	}
	if err := db.Create(v).Error; err != nil {
		t.Fatalf("create %T: %v", v, err)
	}
}

var _ = common.QuotaPerUnit // keep common import stable for sibling tests
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./model/ -run 'TestBlockRunChannelTypes|TestGetBlockRunChannels|TestQueryAndCountBlockRunUsageLogs' -v`
Expected: FAIL — `undefined: BlockRunChannelTypes` etc.

- [ ] **Step 3: Write minimal implementation**

Create `model/usage_reconciliation.go`:

```go
package model

import (
	"strings"

	"github.com/QuantumNous/new-api/constant"

	"gorm.io/gorm"
)

// BlockRunChannel is a lightweight projection of a BlockRun-family channel.
type BlockRunChannel struct {
	Id   int    `json:"id"`
	Name string `json:"name"`
	Type int    `json:"type"`
}

// usageReconLogColumns is the projection used by the reconciliation queries —
// only the columns needed to aggregate / render, skipping content/ip/username/
// upstream_request_id to keep transfer light on large windows.
const usageReconLogColumns = "id, channel_id, token_id, token_name, model_name, prompt_tokens, completion_tokens, quota, use_time, is_stream, request_id, created_at, other"

// BlockRunChannelTypes returns every channel type number whose display name in
// constant.ChannelTypeNames starts with "blockrun" (case-insensitive): currently
// 100/101/102, plus any future BlockRun* type — zero maintenance.
func BlockRunChannelTypes() []int {
	types := make([]int, 0, 4)
	for typ, name := range constant.ChannelTypeNames {
		if strings.HasPrefix(strings.ToLower(name), "blockrun") {
			types = append(types, typ)
		}
	}
	return types
}

// GetBlockRunChannels returns id -> {name,type} for all BlockRun-family channels.
func GetBlockRunChannels() (map[int]BlockRunChannel, error) {
	out := make(map[int]BlockRunChannel)
	types := BlockRunChannelTypes()
	if len(types) == 0 {
		return out, nil
	}
	var chs []BlockRunChannel
	if err := DB.Model(&Channel{}).
		Select("id", "name", "type").
		Where("type IN ?", types).
		Find(&chs).Error; err != nil {
		return nil, err
	}
	for _, ch := range chs {
		out[ch.Id] = ch
	}
	return out, nil
}

func blockRunUsageQuery(channelIDs []int, startUnix, endUnix int64) *gorm.DB {
	return LOG_DB.Model(&Log{}).
		Where("type = ? AND channel_id IN ? AND created_at >= ? AND created_at < ?",
			LogTypeConsume, channelIDs, startUnix, endUnix)
}

// StreamBlockRunUsageLogs scans matching consume logs row-by-row (bounded
// memory) ordered by created_at,id and invokes fn for each. Used by the summary
// aggregation so a wide window does not materialize every row at once.
func StreamBlockRunUsageLogs(channelIDs []int, startUnix, endUnix int64, fn func(*Log) error) error {
	if len(channelIDs) == 0 {
		return nil
	}
	rows, err := blockRunUsageQuery(channelIDs, startUnix, endUnix).
		Select(usageReconLogColumns).
		Order("created_at asc, id asc").
		Rows()
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var log Log
		if err := LOG_DB.ScanRows(rows, &log); err != nil {
			return err
		}
		if err := fn(&log); err != nil {
			return err
		}
	}
	return rows.Err()
}

// CountBlockRunUsageLogs returns the total matching rows (for pagination meta).
func CountBlockRunUsageLogs(channelIDs []int, startUnix, endUnix int64) (int64, error) {
	if len(channelIDs) == 0 {
		return 0, nil
	}
	var total int64
	err := blockRunUsageQuery(channelIDs, startUnix, endUnix).Count(&total).Error
	return total, err
}

// QueryBlockRunUsageLogsPaged returns one page of matching rows, ordered
// created_at,id, for the transactions endpoint.
func QueryBlockRunUsageLogsPaged(channelIDs []int, startUnix, endUnix int64, limit, offset int) ([]*Log, error) {
	if len(channelIDs) == 0 {
		return []*Log{}, nil
	}
	var logs []*Log
	err := blockRunUsageQuery(channelIDs, startUnix, endUnix).
		Select(usageReconLogColumns).
		Order("created_at asc, id asc").
		Limit(limit).Offset(offset).
		Find(&logs).Error
	return logs, err
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./model/ -run 'TestBlockRunChannelTypes|TestGetBlockRunChannels|TestQueryAndCountBlockRunUsageLogs' -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add model/usage_reconciliation.go model/usage_reconciliation_test.go
git commit -m "feat(usage-recon): add blockrun channel + usage-log queries"
```

---

## Task 3: Controller — DTOs, aggregation, handlers (`controller/usage_reconciliation.go`)

**Files:**
- Create: `controller/usage_reconciliation.go`
- Test: `controller/usage_reconciliation_test.go` (own per-test in-memory sqlite; **no** package `TestMain` so existing controller tests are untouched)

- [ ] **Step 1: Write the failing test**

Create `controller/usage_reconciliation_test.go`:

```go
package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupUsageDB(t *testing.T) {
	t.Helper()
	origDB, origLog := model.DB, model.LOG_DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("sql db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(&model.Log{}, &model.Channel{}, &model.Token{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.LogConsumeEnabled = true
	t.Cleanup(func() { model.DB = origDB; model.LOG_DB = origLog })
}

func usageEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/usage/summary", GetUsageSummary)
	r.GET("/usage/transactions", GetUsageTransactions)
	return r
}

func seedChannel(t *testing.T, id, typ int, name string) {
	t.Helper()
	if err := model.DB.Create(&model.Channel{Id: id, Type: typ, Name: name, Key: "k" + name}).Error; err != nil {
		t.Fatalf("seed channel: %v", err)
	}
}

func seedLog(t *testing.T, l *model.Log) *model.Log {
	t.Helper()
	l.Type = model.LogTypeConsume
	if err := model.LOG_DB.Create(l).Error; err != nil {
		t.Fatalf("seed log: %v", err)
	}
	return l
}

func doGET(t *testing.T, e *gin.Engine, url string) (int, map[string]interface{}, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, url, nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	body := rec.Body.String()
	var m map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &m)
	return rec.Code, m, body
}

func TestUsageSummaryAggregation(t *testing.T) {
	setupUsageDB(t)
	seedChannel(t, 34, 100, "blockRun-claude-0603")
	seedChannel(t, 35, 100, "blockRun-openai-0603")
	seedChannel(t, 99, 1, "plain-openai")

	// window [1000,2000)
	seedLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 100, CompletionTokens: 20, Quota: 50, CreatedAt: 1100,
		Other: `{"cache_tokens":5,"cache_creation_tokens":3}`})
	seedLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 200, CompletionTokens: 40, Quota: 100, CreatedAt: 1200,
		Other: `{"cache_tokens":10,"cache_creation_tokens":0}`})
	seedLog(t, &model.Log{ChannelId: 35, TokenId: 8, TokenName: "key-b", ModelName: "gpt-4o",
		PromptTokens: 50, CompletionTokens: 10, Quota: 25, CreatedAt: 1300, Other: `{}`})
	// excluded: non-blockrun channel / out of window / wrong type
	seedLog(t, &model.Log{ChannelId: 99, TokenId: 9, ModelName: "x", Quota: 999, CreatedAt: 1400})
	seedLog(t, &model.Log{ChannelId: 34, TokenId: 7, ModelName: "x", Quota: 999, CreatedAt: 9000})
	_ = model.LOG_DB.Create(&model.Log{Type: model.LogTypeError, ChannelId: 34, CreatedAt: 1500, Quota: 999}).Error

	code, m, body := doGET(t, usageEngine(), "/usage/summary?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z")
	// 1000s = 1970-01-01T00:16:40Z, 2000s = 1970-01-01T00:33:20Z
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	if m["provider"] != "flatkey-newapi" {
		t.Fatalf("provider=%v", m["provider"])
	}
	totals := m["totals"].(map[string]interface{})
	if totals["requests"].(float64) != 3 {
		t.Fatalf("requests=%v", totals["requests"])
	}
	if totals["input_tokens"].(float64) != 350 || totals["output_tokens"].(float64) != 70 {
		t.Fatalf("io tokens=%v", totals)
	}
	if totals["cache_read_tokens"].(float64) != 15 || totals["cache_creation_tokens"].(float64) != 3 {
		t.Fatalf("cache tokens=%v", totals)
	}
	if totals["total_tokens"].(float64) != 438 {
		t.Fatalf("total_tokens=%v", totals["total_tokens"])
	}
	// 175 / 500000 = 0.00035
	if totals["actual_cost"] != "0.0003500000" {
		t.Fatalf("actual_cost=%v", totals["actual_cost"])
	}
	if _, ok := totals["total_cost"]; ok {
		t.Fatalf("total_cost must NOT be present")
	}
	if !strings.Contains(body, `"by_model"`) || !strings.Contains(body, `"by_api_key"`) {
		t.Fatalf("missing dimensions: %s", body)
	}
	byModel := m["by_model"].([]interface{})
	if len(byModel) != 2 {
		t.Fatalf("by_model len=%d", len(byModel))
	}
	first := byModel[0].(map[string]interface{}) // sorted by requests desc → claude(2) first
	if first["model"] != "claude-haiku-4-5" || first["requests"].(float64) != 2 {
		t.Fatalf("by_model[0]=%v", first)
	}
}

func TestUsageSummaryParamValidation(t *testing.T) {
	setupUsageDB(t)
	e := usageEngine()
	cases := []string{
		"/usage/summary",
		"/usage/summary?start=2026-06-01T00:00:00Z",
		"/usage/summary?start=bad&end=2026-06-02T00:00:00Z",
		"/usage/summary?start=2026-06-02T00:00:00Z&end=2026-06-01T00:00:00Z", // end<start
		"/usage/summary?start=2026-01-01T00:00:00Z&end=2026-03-01T00:00:00Z", // >31 days
	}
	for _, url := range cases {
		code, _, body := doGET(t, e, url)
		if code != http.StatusBadRequest {
			t.Fatalf("url %s: status=%d body=%s, want 400", url, code, body)
		}
	}
}

func TestUsageTransactions(t *testing.T) {
	setupUsageDB(t)
	seedChannel(t, 34, 100, "blockRun-claude-0603")
	seedChannel(t, 35, 100, "blockRun-openai-0603")

	t1 := seedLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 1200, CompletionTokens: 320, Quota: 1550, UseTime: 1, RequestId: "req_abc", CreatedAt: 1100,
		Other: `{"cache_tokens":5,"cache_creation_tokens":3,"upstream_model_name":"anthropic/claude-haiku-4.5"}`})
	seedLog(t, &model.Log{ChannelId: 35, TokenId: 8, TokenName: "key-b", ModelName: "gpt-4o",
		PromptTokens: 100, CompletionTokens: 50, Quota: 75, UseTime: 2, RequestId: "req_def", CreatedAt: 1200,
		Other: `{"stream_status":{"status":"error"}}`})
	seedLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 10, CompletionTokens: 5, Quota: 5, CreatedAt: 1300, Other: `{}`})

	code, m, body := doGET(t, usageEngine(),
		"/usage/transactions?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&page=1&page_size=2")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	txns := m["transactions"].([]interface{})
	if len(txns) != 2 {
		t.Fatalf("txns len=%d (page_size=2)", len(txns))
	}
	tx0 := txns[0].(map[string]interface{})
	if tx0["transaction_id"] != "txn_"+itoa(t1.Id) {
		t.Fatalf("transaction_id=%v", tx0["transaction_id"])
	}
	if tx0["model"] != "anthropic/claude-haiku-4.5" || tx0["requested_model"] != "claude-haiku-4-5" {
		t.Fatalf("model fields=%v / %v", tx0["model"], tx0["requested_model"])
	}
	if tx0["status"] != "success" || tx0["duration_ms"].(float64) != 1000 {
		t.Fatalf("status/duration=%v / %v", tx0["status"], tx0["duration_ms"])
	}
	if tx0["total_tokens"].(float64) != 1528 || tx0["actual_cost"] != "0.0031000000" {
		t.Fatalf("totals=%v / %v", tx0["total_tokens"], tx0["actual_cost"])
	}
	meta := tx0["metadata"].(map[string]interface{})
	if meta["channel_id"].(float64) != 34 || meta["channel_name"] != "blockRun-claude-0603" {
		t.Fatalf("metadata=%v", meta)
	}
	tx1 := txns[1].(map[string]interface{})
	if tx1["status"] != "error" || tx1["model"] != "gpt-4o" {
		t.Fatalf("tx1 status/model=%v / %v", tx1["status"], tx1["model"])
	}
	pg := m["pagination"].(map[string]interface{})
	if pg["total_count"].(float64) != 3 || pg["total_pages"].(float64) != 2 || pg["has_more"] != true {
		t.Fatalf("pagination=%v", pg)
	}
	if strings.Contains(body, "total_cost") || strings.Contains(body, "chain") {
		t.Fatalf("must not contain total_cost or chain: %s", body)
	}
}

func itoa(i int) string {
	return strings_Itoa(i)
}
```

> Note: `strings_Itoa` is a stand-in to avoid an extra import in the test header; in Step 3 we will instead use `strconv` directly in the test. Replace the `itoa` helper and its use with `strconv.Itoa(t1.Id)` and add `"strconv"` to the test imports. (Do this now: change the import block to include `"strconv"`, delete the `itoa`/`strings_Itoa` helper, and use `"txn_"+strconv.Itoa(t1.Id)`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./controller/ -run 'TestUsageSummary|TestUsageTransactions' -v`
Expected: FAIL — `undefined: GetUsageSummary` / `undefined: GetUsageTransactions`.

- [ ] **Step 3: Write minimal implementation**

Create `controller/usage_reconciliation.go`:

```go
package controller

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	usageReconProvider        = "flatkey-newapi"
	usageReconCurrency        = "USD"
	usageReconMaxRange        = 31 * 24 * time.Hour
	usageTxnDefaultPageSize   = 100
	usageTxnMaxPageSize       = 500
	usageReconMsLayout        = "2006-01-02T15:04:05.000Z07:00"
)

// ---- DTOs ----

type usageMetrics struct {
	Requests            int64  `json:"requests"`
	InputTokens         int64  `json:"input_tokens"`
	OutputTokens        int64  `json:"output_tokens"`
	CacheReadTokens     int64  `json:"cache_read_tokens"`
	CacheCreationTokens int64  `json:"cache_creation_tokens"`
	TotalTokens         int64  `json:"total_tokens"`
	ActualCost          string `json:"actual_cost"`
	Currency            string `json:"currency"`
}

type usagePeriod struct {
	Start    string `json:"start"`
	End      string `json:"end"`
	Timezone string `json:"timezone"`
}

type usageByModel struct {
	Model string `json:"model"`
	usageMetrics
}

type usageByAPIKey struct {
	APIKeyID   string `json:"api_key_id"`
	APIKeyName string `json:"api_key_name"`
	usageMetrics
}

type usageSummaryResponse struct {
	Provider    string          `json:"provider"`
	Period      usagePeriod     `json:"period"`
	Totals      usageMetrics    `json:"totals"`
	ByAPIKey    []usageByAPIKey `json:"by_api_key"`
	ByModel     []usageByModel  `json:"by_model"`
	GeneratedAt string          `json:"generated_at"`
}

type usageTransaction struct {
	TransactionID       string                 `json:"transaction_id"`
	RequestID           string                 `json:"request_id"`
	APIKeyID            string                 `json:"api_key_id"`
	APIKeyName          string                 `json:"api_key_name"`
	Model               string                 `json:"model"`
	RequestedModel      string                 `json:"requested_model"`
	CreatedAt           string                 `json:"created_at"`
	InputTokens         int64                  `json:"input_tokens"`
	OutputTokens        int64                  `json:"output_tokens"`
	CacheReadTokens     int64                  `json:"cache_read_tokens"`
	CacheCreationTokens int64                  `json:"cache_creation_tokens"`
	TotalTokens         int64                  `json:"total_tokens"`
	ActualCost          string                 `json:"actual_cost"`
	Currency            string                 `json:"currency"`
	Status              string                 `json:"status"`
	DurationMs          int64                  `json:"duration_ms"`
	Metadata            map[string]interface{} `json:"metadata"`
}

type usagePagination struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int64 `json:"total_pages"`
	TotalCount int64 `json:"total_count"`
	HasMore    bool  `json:"has_more"`
}

type usageTransactionsResponse struct {
	Transactions []usageTransaction `json:"transactions"`
	Pagination   usagePagination    `json:"pagination"`
	GeneratedAt  string             `json:"generated_at"`
}

// ---- shared helpers ----

func quotaToUSD(quota int64) string {
	return decimal.NewFromInt(quota).Div(decimal.NewFromFloat(common.QuotaPerUnit)).StringFixed(10)
}

func parseOther(s string) map[string]interface{} {
	if s == "" {
		return nil
	}
	m, err := common.StrToMap(s)
	if err != nil {
		return nil
	}
	return m
}

// otherInt reads an integer-valued key from the Other map. common.Unmarshal uses
// the std json lib, so JSON numbers arrive as float64; other types handled defensively.
func otherInt(other map[string]interface{}, key string) int64 {
	if other == nil {
		return 0
	}
	switch n := other[key].(type) {
	case float64:
		return int64(n)
	case int:
		return int64(n)
	case int64:
		return n
	case string:
		i, _ := strconv.ParseInt(n, 10, 64)
		return i
	}
	return 0
}

func resolveModel(log *model.Log, other map[string]interface{}) string {
	if other != nil {
		if s, ok := other["upstream_model_name"].(string); ok && s != "" {
			return s
		}
	}
	return log.ModelName
}

func resolveStatus(other map[string]interface{}) string {
	if other != nil {
		if ss, ok := other["stream_status"].(map[string]interface{}); ok {
			if st, ok := ss["status"].(string); ok && st == "error" {
				return "error"
			}
		}
	}
	return "success"
}

// parseUsageTimeRange parses+validates start/end. On error it writes the 400 and
// returns ok=false.
func parseUsageTimeRange(c *gin.Context) (startUnix, endUnix int64, startT, endT time.Time, ok bool) {
	startStr, endStr := c.Query("start"), c.Query("end")
	if startStr == "" || endStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start and end are required"})
		return
	}
	var err error
	if startT, err = time.Parse(time.RFC3339, startStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start, use RFC3339"})
		return
	}
	if endT, err = time.Parse(time.RFC3339, endStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end, use RFC3339"})
		return
	}
	startT, endT = startT.UTC(), endT.UTC()
	if !endT.After(startT) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "end must be after start"})
		return
	}
	if endT.Sub(startT) > usageReconMaxRange {
		c.JSON(http.StatusBadRequest, gin.H{"error": "time range exceeds 31 days"})
		return
	}
	return startT.Unix(), endT.Unix(), startT, endT, true
}

func blockRunChannelIDs(channels map[int]model.BlockRunChannel) []int {
	ids := make([]int, 0, len(channels))
	for id := range channels {
		ids = append(ids, id)
	}
	return ids
}

// ---- aggregation ----

type usageAccum struct {
	requests, input, output, cacheRead, cacheCreate, quota int64
}

func (a *usageAccum) add(promptTokens, completionTokens int, cacheRead, cacheCreate, quota int64) {
	a.requests++
	a.input += int64(promptTokens)
	a.output += int64(completionTokens)
	a.cacheRead += cacheRead
	a.cacheCreate += cacheCreate
	a.quota += quota
}

func (a *usageAccum) metrics() usageMetrics {
	return usageMetrics{
		Requests:            a.requests,
		InputTokens:         a.input,
		OutputTokens:        a.output,
		CacheReadTokens:     a.cacheRead,
		CacheCreationTokens: a.cacheCreate,
		TotalTokens:         a.input + a.output + a.cacheRead + a.cacheCreate,
		ActualCost:          quotaToUSD(a.quota),
		Currency:            usageReconCurrency,
	}
}

// ---- handlers ----

// GetUsageSummary serves GET /usage/summary.
func GetUsageSummary(c *gin.Context) {
	startUnix, endUnix, startT, endT, ok := parseUsageTimeRange(c)
	if !ok {
		return
	}
	channels, err := model.GetBlockRunChannels()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query channels failed"})
		return
	}
	ids := blockRunChannelIDs(channels)

	totals := &usageAccum{}
	byModel := map[string]*usageAccum{}
	byKey := map[int]*usageAccum{}
	keyName := map[int]string{}

	err = model.StreamBlockRunUsageLogs(ids, startUnix, endUnix, func(log *model.Log) error {
		other := parseOther(log.Other)
		cacheRead := otherInt(other, "cache_tokens")
		cacheCreate := otherInt(other, "cache_creation_tokens")
		q := int64(log.Quota)

		totals.add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, q)

		mName := resolveModel(log, other)
		if byModel[mName] == nil {
			byModel[mName] = &usageAccum{}
		}
		byModel[mName].add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, q)

		if byKey[log.TokenId] == nil {
			byKey[log.TokenId] = &usageAccum{}
		}
		byKey[log.TokenId].add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, q)
		keyName[log.TokenId] = log.TokenName
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query usage failed"})
		return
	}

	c.JSON(http.StatusOK, usageSummaryResponse{
		Provider:    usageReconProvider,
		Period:      usagePeriod{Start: startT.Format(time.RFC3339), End: endT.Format(time.RFC3339), Timezone: "UTC"},
		Totals:      totals.metrics(),
		ByAPIKey:    buildByAPIKey(byKey, keyName),
		ByModel:     buildByModel(byModel),
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

func buildByModel(m map[string]*usageAccum) []usageByModel {
	out := make([]usageByModel, 0, len(m))
	for name, acc := range m {
		out = append(out, usageByModel{Model: name, usageMetrics: acc.metrics()})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Requests != out[j].Requests {
			return out[i].Requests > out[j].Requests
		}
		return out[i].Model < out[j].Model
	})
	return out
}

func buildByAPIKey(m map[int]*usageAccum, names map[int]string) []usageByAPIKey {
	out := make([]usageByAPIKey, 0, len(m))
	for id, acc := range m {
		out = append(out, usageByAPIKey{APIKeyID: strconv.Itoa(id), APIKeyName: names[id], usageMetrics: acc.metrics()})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Requests != out[j].Requests {
			return out[i].Requests > out[j].Requests
		}
		return out[i].APIKeyID < out[j].APIKeyID
	})
	return out
}

// GetUsageTransactions serves GET /usage/transactions.
func GetUsageTransactions(c *gin.Context) {
	startUnix, endUnix, _, _, ok := parseUsageTimeRange(c)
	if !ok {
		return
	}
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), usageTxnDefaultPageSize)
	if pageSize > usageTxnMaxPageSize {
		pageSize = usageTxnMaxPageSize
	}

	channels, err := model.GetBlockRunChannels()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query channels failed"})
		return
	}
	ids := blockRunChannelIDs(channels)

	total, err := model.CountBlockRunUsageLogs(ids, startUnix, endUnix)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "count failed"})
		return
	}
	logs, err := model.QueryBlockRunUsageLogsPaged(ids, startUnix, endUnix, pageSize, (page-1)*pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	txns := make([]usageTransaction, 0, len(logs))
	for _, log := range logs {
		other := parseOther(log.Other)
		cacheRead := otherInt(other, "cache_tokens")
		cacheCreate := otherInt(other, "cache_creation_tokens")
		ch := channels[log.ChannelId]
		txns = append(txns, usageTransaction{
			TransactionID:       "txn_" + strconv.Itoa(log.Id),
			RequestID:           log.RequestId,
			APIKeyID:            strconv.Itoa(log.TokenId),
			APIKeyName:          log.TokenName,
			Model:               resolveModel(log, other),
			RequestedModel:      log.ModelName,
			CreatedAt:           time.Unix(log.CreatedAt, 0).UTC().Format(usageReconMsLayout),
			InputTokens:         int64(log.PromptTokens),
			OutputTokens:        int64(log.CompletionTokens),
			CacheReadTokens:     cacheRead,
			CacheCreationTokens: cacheCreate,
			TotalTokens:         int64(log.PromptTokens) + int64(log.CompletionTokens) + cacheRead + cacheCreate,
			ActualCost:          quotaToUSD(int64(log.Quota)),
			Currency:            usageReconCurrency,
			Status:              resolveStatus(other),
			DurationMs:          int64(log.UseTime) * 1000,
			Metadata:            map[string]interface{}{"channel_id": log.ChannelId, "channel_name": ch.Name},
		})
	}

	var totalPages int64
	if pageSize > 0 {
		totalPages = (total + int64(pageSize) - 1) / int64(pageSize)
	}
	c.JSON(http.StatusOK, usageTransactionsResponse{
		Transactions: txns,
		Pagination: usagePagination{
			Page:       page,
			PageSize:   pageSize,
			TotalPages: totalPages,
			TotalCount: total,
			HasMore:    int64(page)*int64(pageSize) < total,
		},
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

func parsePositiveInt(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		return def
	}
	return n
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./controller/ -run 'TestUsageSummary|TestUsageTransactions' -v`
Expected: PASS (all subtests).

- [ ] **Step 5: Commit**

```bash
git add controller/usage_reconciliation.go controller/usage_reconciliation_test.go
git commit -m "feat(usage-recon): add /usage/summary + /usage/transactions handlers"
```

---

## Task 4: Router wiring (`router/usage_reconciliation.go` + `router/main.go`)

**Files:**
- Create: `router/usage_reconciliation.go`
- Modify: `router/main.go` (inside `SetRouter`, after `SetVideoRouter(router)`)

- [ ] **Step 1: Create the router file**

Create `router/usage_reconciliation.go`:

```go
package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// SetUsageReconciliationRouter mounts the root-level, static-token-guarded
// BlockRun usage reconciliation endpoints. Mounted on the root engine (NOT under
// /api) so the path is exactly /usage/summary and /usage/transactions; does not
// collide with the authenticated /api/usage/token route.
func SetUsageReconciliationRouter(router *gin.Engine) {
	g := router.Group("/usage")
	g.Use(middleware.UsageReconAuth())
	g.GET("/summary", controller.GetUsageSummary)
	g.GET("/transactions", controller.GetUsageTransactions)
}
```

- [ ] **Step 2: Wire into `SetRouter`**

In `router/main.go`, inside `func SetRouter`, find:

```go
	SetVideoRouter(router)
```

and add immediately after it:

```go
	SetUsageReconciliationRouter(router)
```

- [ ] **Step 3: Verify the package builds**

Run: `go build ./router/...`
Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add router/usage_reconciliation.go router/main.go
git commit -m "feat(usage-recon): mount /usage reconciliation routes in SetRouter"
```

---

## Task 5: Full verification

- [ ] **Step 1: Format**

Run: `gofmt -w middleware/usage_recon_auth.go middleware/usage_recon_auth_test.go model/usage_reconciliation.go model/usage_reconciliation_test.go controller/usage_reconciliation.go controller/usage_reconciliation_test.go router/usage_reconciliation.go`
Expected: no output.

- [ ] **Step 2: Vet + build whole module**

Run: `go vet ./middleware/... ./model/... ./controller/... ./router/... && go build ./...`
Expected: no errors.

- [ ] **Step 3: Run all affected package tests**

Run: `go test ./middleware/ ./model/ ./controller/ -run 'UsageRecon|BlockRun|Usage' -v`
Expected: all PASS.

- [ ] **Step 4: Run the full affected packages' tests (regression check)**

Run: `go test ./middleware/ ./model/ ./controller/ ./router/`
Expected: PASS (confirms nothing else broke — especially existing `controller` tests, since we added no package `TestMain`).

- [ ] **Step 5: Final commit (if gofmt changed anything)**

```bash
git add -A
git commit -m "chore(usage-recon): gofmt + vet pass" || echo "nothing to commit"
```

---

## Self-Review checklist (completed during authoring)

- **Spec coverage:** auth (Task 1), channel-scope + queries + index/streaming (Task 2), summary + transactions + cost/cache/no-total_cost/metadata/status/pagination/range-cap (Task 3), routing (Task 4). ✓
- **Placeholder scan:** the `itoa`/`strings_Itoa` stand-in in Task 3 Step 1 is called out explicitly with the exact fix (use `strconv.Itoa`) — apply it before running. No other placeholders.
- **Type consistency:** `usageMetrics` embedded in `usageByModel`/`usageByAPIKey`; `model.BlockRunChannel`, `model.StreamBlockRunUsageLogs`, `model.GetBlockRunChannels`, `model.CountBlockRunUsageLogs`, `model.QueryBlockRunUsageLogsPaged` names match between model (Task 2) and controller (Task 3). `middleware.UsageReconAuth` / `middleware.UsageReconTokenEnv` match between Task 1 and Task 4. ✓
```
