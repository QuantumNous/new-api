package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
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

func seedUsageChannel(t *testing.T, id, typ int, name string) {
	t.Helper()
	if err := model.DB.Create(&model.Channel{Id: id, Type: typ, Name: name, Key: "k" + name}).Error; err != nil {
		t.Fatalf("seed channel: %v", err)
	}
}

func seedUsageLog(t *testing.T, l *model.Log) *model.Log {
	t.Helper()
	if l.Type == 0 {
		l.Type = model.LogTypeConsume
	}
	if err := model.LOG_DB.Create(l).Error; err != nil {
		t.Fatalf("seed log: %v", err)
	}
	return l
}

func doUsageGET(t *testing.T, e *gin.Engine, url string) (int, map[string]interface{}, string) {
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
	seedUsageChannel(t, 34, 100, "blockRun-claude-0603")
	seedUsageChannel(t, 35, 100, "blockRun-openai-0603")
	seedUsageChannel(t, 99, 1, "plain-openai")

	// window [1000,2000) seconds since epoch
	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 100, CompletionTokens: 20, Quota: 50, CreatedAt: 1100,
		Other: `{"cache_tokens":5,"cache_creation_tokens":3}`})
	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 200, CompletionTokens: 40, Quota: 100, CreatedAt: 1200,
		Other: `{"cache_tokens":10,"cache_creation_tokens":0}`})
	seedUsageLog(t, &model.Log{ChannelId: 35, TokenId: 8, TokenName: "key-b", ModelName: "gpt-4o",
		PromptTokens: 50, CompletionTokens: 10, Quota: 25, CreatedAt: 1300, Other: `{}`})
	// excluded: non-blockrun channel / out of window / wrong type
	seedUsageLog(t, &model.Log{ChannelId: 99, TokenId: 9, ModelName: "x", Quota: 999, CreatedAt: 1400})
	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, ModelName: "x", Quota: 999, CreatedAt: 9000})
	seedUsageLog(t, &model.Log{Type: model.LogTypeError, ChannelId: 34, CreatedAt: 1500, Quota: 999})

	// 1000s = 1970-01-01T00:16:40Z, 2000s = 1970-01-01T00:33:20Z
	code, m, body := doUsageGET(t, usageEngine(), "/usage/summary?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z")
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
	if totals["actual_cost"] != "0.0003500000" { // 175/500000
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
		code, _, body := doUsageGET(t, e, url)
		if code != http.StatusBadRequest {
			t.Fatalf("url %s: status=%d body=%s, want 400", url, code, body)
		}
	}
}

func TestUsageTransactions(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 34, 100, "blockRun-claude-0603")
	seedUsageChannel(t, 35, 100, "blockRun-openai-0603")

	t1 := seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 1200, CompletionTokens: 320, Quota: 1550, UseTime: 1, RequestId: "req_abc", CreatedAt: 1100,
		Other: `{"cache_tokens":5,"cache_creation_tokens":3,"upstream_model_name":"anthropic/claude-haiku-4.5"}`})
	seedUsageLog(t, &model.Log{ChannelId: 35, TokenId: 8, TokenName: "key-b", ModelName: "gpt-4o",
		PromptTokens: 100, CompletionTokens: 50, Quota: 75, UseTime: 2, RequestId: "req_def", CreatedAt: 1200,
		Other: `{"stream_status":{"status":"error"}}`})
	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 10, CompletionTokens: 5, Quota: 5, CreatedAt: 1300, Other: `{}`})

	code, m, body := doUsageGET(t, usageEngine(),
		"/usage/transactions?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&page=1&page_size=2")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	txns := m["transactions"].([]interface{})
	if len(txns) != 2 {
		t.Fatalf("txns len=%d (page_size=2)", len(txns))
	}
	tx0 := txns[0].(map[string]interface{})
	if tx0["transaction_id"] != "txn_"+strconv.Itoa(t1.Id) {
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
