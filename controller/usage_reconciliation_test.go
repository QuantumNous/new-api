package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

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
	if err := db.AutoMigrate(&model.Log{}, &model.Channel{}, &model.Token{}, &model.Ability{}); err != nil {
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
	r.GET("/usage/validation", GetUsageValidation)
	r.GET("/usage/transactions", GetUsageTransactions)
	r.GET("/usage/models", GetUsageModels)
	r.GET("/usage/channels", GetUsageChannels)
	r.GET("/usage/channel-summary", GetChannelUsageSummary)
	r.GET("/usage/channel-validation", GetChannelUsageValidation)
	r.GET("/usage/channel-transactions", GetChannelUsageTransactions)
	r.GET("/usage/channel-models", GetChannelUsageModels)
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

func seedUsageAbility(t *testing.T, a *model.Ability) {
	t.Helper()
	if a.Group == "" {
		a.Group = "default"
	}
	if err := model.DB.Create(a).Error; err != nil {
		t.Fatalf("seed ability: %v", err)
	}
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
	if m["provider"] != "flatkey" {
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

func TestUsageValidationAggregation(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 34, 100, "blockRun-claude-0603")
	seedUsageChannel(t, 35, 100, "blockRun-openai-0603")
	seedUsageChannel(t, 99, 1, "plain-openai")

	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 100, CompletionTokens: 20, Quota: 50, CreatedAt: 1100,
		Other: `{"cache_tokens":5,"cache_creation_tokens":3}`})
	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 200, CompletionTokens: 40, Quota: 100, CreatedAt: 1200,
		Other: `{"cache_tokens":10,"cache_creation_tokens":0}`})
	seedUsageLog(t, &model.Log{ChannelId: 35, TokenId: 8, TokenName: "key-b", ModelName: "gpt-4o",
		PromptTokens: 50, CompletionTokens: 10, Quota: 25, CreatedAt: 1300, Other: `{}`})
	seedUsageLog(t, &model.Log{ChannelId: 99, TokenId: 9, ModelName: "x", Quota: 999, CreatedAt: 1400})

	code, m, body := doUsageGET(t, usageEngine(),
		"/usage/validation?period=day&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	if m["provider"] != "flatkey" || m["period"] != "day" {
		t.Fatalf("provider/period=%v/%v", m["provider"], m["period"])
	}
	if m["start"] != "1970-01-01T00:16:40.000Z" || m["end"] != "1970-01-01T00:33:20.000Z" {
		t.Fatalf("window=%v/%v", m["start"], m["end"])
	}
	totals := m["totals"].(map[string]interface{})
	if totals["requests"].(float64) != 3 || totals["actual_cost"] != "0.0003500000" {
		t.Fatalf("totals=%v", totals)
	}
	if _, ok := totals["total_cost"]; ok {
		t.Fatalf("total_cost must not be present: %v", totals)
	}
	byModel := m["by_model"].([]interface{})
	first := byModel[0].(map[string]interface{})
	if first["model"] != "claude-haiku-4-5" || first["channel_id"] != "34" ||
		first["channel_name"] != "blockRun-claude-0603" || first["requests"].(float64) != 2 ||
		first["actual_cost"] != "0.0003000000" {
		t.Fatalf("by_model[0]=%v", first)
	}
	byChannel := m["by_channel"].([]interface{})
	ch0 := byChannel[0].(map[string]interface{})
	if ch0["channel_id"] != "34" || ch0["channel_name"] != "blockRun-claude-0603" ||
		ch0["requests"].(float64) != 2 || ch0["actual_cost"] != "0.0003000000" {
		t.Fatalf("by_channel[0]=%v", ch0)
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
		UpstreamRequestId: "chatcmpl_blockrun_1",
		Other:             `{"cache_tokens":5,"cache_creation_tokens":3,"upstream_model_name":"anthropic/claude-haiku-4.5"}`})
	seedUsageLog(t, &model.Log{ChannelId: 35, TokenId: 8, TokenName: "key-b", ModelName: "gpt-4o",
		PromptTokens: 100, CompletionTokens: 50, Quota: 75, UseTime: 2, RequestId: "req_def", CreatedAt: 1200,
		Other: `{"stream_status":{"status":"error"}}`})
	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 10, CompletionTokens: 5, Quota: 5, CreatedAt: 1300, Other: `{}`})

	code, m, body := doUsageGET(t, usageEngine(),
		"/usage/transactions?period=day&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&page=1&page_size=2")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	if m["provider"] != "flatkey" || m["period"] != "day" {
		t.Fatalf("provider/period=%v/%v", m["provider"], m["period"])
	}
	if m["start"] != "1970-01-01T00:16:40.000Z" || m["end"] != "1970-01-01T00:33:20.000Z" {
		t.Fatalf("window=%v/%v", m["start"], m["end"])
	}
	txns := m["transactions"].([]interface{})
	if len(txns) != 2 {
		t.Fatalf("txns len=%d (page_size=2)", len(txns))
	}
	tx0 := txns[0].(map[string]interface{})
	if tx0["source_id"] != strconv.Itoa(t1.Id) {
		t.Fatalf("source_id=%v, want raw log id %d", tx0["source_id"], t1.Id)
	}
	if tx0["upstream_request_id"] != "chatcmpl_blockrun_1" {
		t.Fatalf("upstream_request_id=%v, want BlockRun call id", tx0["upstream_request_id"])
	}
	if _, ok := tx0["id"]; ok {
		t.Fatalf("id must not be present; use source_id: %v", tx0)
	}
	if _, ok := tx0["transaction_id"]; ok {
		t.Fatalf("transaction_id must not be present; use source_id: %v", tx0)
	}
	if tx0["channel_id"] != "34" || tx0["channel_name"] != "blockRun-claude-0603" {
		t.Fatalf("channel fields=%v / %v", tx0["channel_id"], tx0["channel_name"])
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
	if _, ok := tx0["metadata"]; ok {
		t.Fatalf("metadata must not be present in contract response: %v", tx0)
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

func TestChannelScopedUsageKeepsBlockRunEndpointUnchanged(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 34, 100, "blockRun-llm")
	seedUsageChannel(t, 35, 100, "blockRun-hidden")
	seedUsageChannel(t, 99, 1, "flatkey-openai")

	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "claude-haiku-4-5",
		PromptTokens: 100, CompletionTokens: 20, Quota: 50, CreatedAt: 1100})
	seedUsageLog(t, &model.Log{ChannelId: 99, TokenId: 8, TokenName: "key-b", ModelName: "gpt-4o",
		PromptTokens: 200, CompletionTokens: 40, Quota: 100, CreatedAt: 1200})
	seedUsageLog(t, &model.Log{ChannelId: 35, TokenId: 9, TokenName: "key-c", ModelName: "hidden",
		PromptTokens: 300, CompletionTokens: 60, Quota: 150, CreatedAt: 1300})

	code, m, body := doUsageGET(t, usageEngine(), "/usage/channels")
	if code != http.StatusOK {
		t.Fatalf("channels status=%d body=%s", code, body)
	}
	channels := m["channels"].([]interface{})
	if len(channels) != 3 {
		t.Fatalf("channels len=%d body=%s", len(channels), body)
	}
	if !strings.Contains(body, `"channel_id":"34"`) || !strings.Contains(body, `"channel_id":"35"`) || !strings.Contains(body, `"channel_id":"99"`) {
		t.Fatalf("channels missing expected ids: %s", body)
	}

	code, m, body = doUsageGET(t, usageEngine(),
		"/usage/channel-transactions?period=day&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&channel_ids=99&limit=10")
	if code != http.StatusOK {
		t.Fatalf("channel transactions status=%d body=%s", code, body)
	}
	txns := m["transactions"].([]interface{})
	if len(txns) != 1 {
		t.Fatalf("channel txns len=%d body=%s", len(txns), body)
	}
	txn := txns[0].(map[string]interface{})
	if txn["channel_id"] != "99" || txn["channel_name"] != "flatkey-openai" || txn["model"] != "gpt-4o" {
		t.Fatalf("unexpected channel transaction: %v", txn)
	}

	code, m, body = doUsageGET(t, usageEngine(),
		"/usage/channel-transactions?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&channel_ids=35&limit=10")
	if code != http.StatusOK {
		t.Fatalf("channel 35 transactions status=%d body=%s", code, body)
	}
	txns = m["transactions"].([]interface{})
	if len(txns) != 1 || txns[0].(map[string]interface{})["channel_id"] != "35" {
		t.Fatalf("channel 35 txns unexpected: %s", body)
	}

	code, m, body = doUsageGET(t, usageEngine(),
		"/usage/transactions?period=day&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&page=1&page_size=10")
	if code != http.StatusOK {
		t.Fatalf("blockrun transactions status=%d body=%s", code, body)
	}
	txns = m["transactions"].([]interface{})
	if len(txns) != 2 {
		t.Fatalf("existing blockrun endpoint should still return both BlockRun rows, got %d body=%s", len(txns), body)
	}
	for _, raw := range txns {
		if raw.(map[string]interface{})["channel_id"] == "99" {
			t.Fatalf("non-BlockRun channel leaked into existing endpoint: %s", body)
		}
	}
}

func TestChannelScopedUsageModels(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 34, 100, "blockRun-llm")
	seedUsageChannel(t, 99, 1, "flatkey-openai")
	seedUsageAbility(t, &model.Ability{Group: "default", Model: "gpt-4o", ChannelId: 99, Enabled: true})
	seedUsageAbility(t, &model.Ability{Group: "default", Model: "claude-haiku-4-5", ChannelId: 34, Enabled: true})

	origRatio := ratio_setting.GetModelRatioCopy()
	ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4o":2}`)
	t.Cleanup(func() {
		raw, _ := json.Marshal(origRatio)
		ratio_setting.UpdateModelRatioByJSONString(string(raw))
	})

	code, m, body := doUsageGET(t, usageEngine(), "/usage/channel-models?channel_ids=99")
	if code != http.StatusOK {
		t.Fatalf("channel models status=%d body=%s", code, body)
	}
	models := m["models"].([]interface{})
	if len(models) != 1 {
		t.Fatalf("models len=%d body=%s", len(models), body)
	}
	item := models[0].(map[string]interface{})
	if item["model"] != "gpt-4o" || item["channel_id"] != "99" || item["channel_name"] != "flatkey-openai" {
		t.Fatalf("unexpected model item: %v", item)
	}
	if strings.Contains(body, "claude-haiku-4-5") {
		t.Fatalf("unrequested channel model leaked: %s", body)
	}
}

func TestChannelTypeNameScopedUsageFeeds(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 34, 100, "blockRun-llm")
	seedUsageChannel(t, 99, 1, "flatkey-openai")
	seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "blockrun-key", ModelName: "claude-haiku-4-5",
		PromptTokens: 100, CompletionTokens: 20, Quota: 50, CreatedAt: 1100})
	seedUsageLog(t, &model.Log{ChannelId: 99, TokenId: 8, TokenName: "flatkey-key", ModelName: "gpt-4o",
		PromptTokens: 200, CompletionTokens: 40, Quota: 100, CreatedAt: 1200})
	seedUsageAbility(t, &model.Ability{Group: "default", Model: "gpt-4o", ChannelId: 99, Enabled: true})
	seedUsageAbility(t, &model.Ability{Group: "default", Model: "claude-haiku-4-5", ChannelId: 34, Enabled: true})

	code, m, body := doUsageGET(t, usageEngine(),
		"/usage/channel-summary?channel_type_name=OpenAI&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z")
	if code != http.StatusOK {
		t.Fatalf("summary status=%d body=%s", code, body)
	}
	totals := m["totals"].(map[string]interface{})
	if totals["requests"].(float64) != 1 || totals["actual_cost"] != "0.0002000000" {
		t.Fatalf("summary totals=%v body=%s", totals, body)
	}
	if strings.Contains(body, "blockrun-key") || strings.Contains(body, "claude-haiku") {
		t.Fatalf("blockrun data leaked into OpenAI summary: %s", body)
	}

	code, m, body = doUsageGET(t, usageEngine(),
		"/usage/channel-validation?name=OpenAI&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z")
	if code != http.StatusOK {
		t.Fatalf("validation status=%d body=%s", code, body)
	}
	byChannel := m["by_channel"].([]interface{})
	if len(byChannel) != 1 || byChannel[0].(map[string]interface{})["channel_id"] != "99" {
		t.Fatalf("validation channels=%v body=%s", byChannel, body)
	}

	code, m, body = doUsageGET(t, usageEngine(),
		"/usage/channel-transactions?channel_type_name=OpenAI&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&limit=10")
	if code != http.StatusOK {
		t.Fatalf("transactions status=%d body=%s", code, body)
	}
	txns := m["transactions"].([]interface{})
	if len(txns) != 1 || txns[0].(map[string]interface{})["channel_id"] != "99" {
		t.Fatalf("transactions=%v body=%s", txns, body)
	}

	code, m, body = doUsageGET(t, usageEngine(), "/usage/channel-models?channel_type_name=OpenAI")
	if code != http.StatusOK {
		t.Fatalf("models status=%d body=%s", code, body)
	}
	models := m["models"].([]interface{})
	if len(models) != 1 || models[0].(map[string]interface{})["model"] != "gpt-4o" {
		t.Fatalf("models=%v body=%s", models, body)
	}
	if strings.Contains(body, "claude-haiku-4-5") {
		t.Fatalf("blockrun model leaked into OpenAI models: %s", body)
	}
}

func TestChannelScopedUsageRejectsUnknownRequestedChannel(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 99, 1, "flatkey-openai")

	code, _, body := doUsageGET(t, usageEngine(),
		"/usage/channel-transactions?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&channel_ids=123&limit=10")
	if code != http.StatusBadRequest {
		t.Fatalf("transactions status=%d body=%s, want 400 for unknown requested channel", code, body)
	}
}

func TestChannelScopedUsageRejectsHugePageOffset(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 99, 1, "flatkey-openai")

	code, _, body := doUsageGET(t, usageEngine(),
		"/usage/channel-transactions?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&channel_ids=99&page=10001&page_size=500")
	if code != http.StatusBadRequest {
		t.Fatalf("huge page status=%d body=%s, want 400", code, body)
	}
}

func TestChannelScopedUsageModelsExcludeDisabledChannels(t *testing.T) {
	setupUsageDB(t)
	if err := model.DB.Create(&model.Channel{
		Id:     99,
		Type:   1,
		Name:   "flatkey-disabled",
		Key:    "k-disabled",
		Status: common.ChannelStatusManuallyDisabled,
	}).Error; err != nil {
		t.Fatalf("seed disabled channel: %v", err)
	}
	seedUsageAbility(t, &model.Ability{Group: "default", Model: "gpt-4o", ChannelId: 99, Enabled: true})

	code, m, body := doUsageGET(t, usageEngine(), "/usage/channel-models?channel_ids=99")
	if code != http.StatusOK {
		t.Fatalf("channel models status=%d body=%s", code, body)
	}
	models := m["models"].([]interface{})
	if len(models) != 0 {
		t.Fatalf("disabled channel models leaked: %s", body)
	}
}

func TestUsageTransactionsCursorPagination(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 34, 100, "blockRun-claude-0603")

	l1 := seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "m1",
		PromptTokens: 1, Quota: 10, CreatedAt: 1100, RequestId: "req_1"})
	l2 := seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "m2",
		PromptTokens: 2, Quota: 20, CreatedAt: 1100, RequestId: "req_2"})
	l3 := seedUsageLog(t, &model.Log{ChannelId: 34, TokenId: 7, TokenName: "key-a", ModelName: "m3",
		PromptTokens: 3, Quota: 30, CreatedAt: 1200, RequestId: "req_3"})

	code, m, body := doUsageGET(t, usageEngine(),
		"/usage/transactions?period=day&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&limit=2")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	txns := m["transactions"].([]interface{})
	if len(txns) != 2 {
		t.Fatalf("txns len=%d body=%s", len(txns), body)
	}
	if txns[0].(map[string]interface{})["source_id"] != strconv.Itoa(l1.Id) ||
		txns[1].(map[string]interface{})["source_id"] != strconv.Itoa(l2.Id) {
		t.Fatalf("first cursor page order=%v", txns)
	}
	pg := m["pagination"].(map[string]interface{})
	if pg["mode"] != "cursor" || pg["limit"].(float64) != 2 || pg["has_more"] != true {
		t.Fatalf("cursor pagination=%v", pg)
	}
	if _, ok := pg["total_count"]; ok {
		t.Fatalf("cursor pagination should not return diagnostic total_count: %v", pg)
	}
	nextCursor, ok := pg["next_cursor"].(string)
	if !ok || nextCursor == "" {
		t.Fatalf("missing next_cursor: %v", pg)
	}

	code, m, body = doUsageGET(t, usageEngine(),
		"/usage/transactions?period=day&start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&limit=2&cursor="+url.QueryEscape(nextCursor))
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	txns = m["transactions"].([]interface{})
	if len(txns) != 1 || txns[0].(map[string]interface{})["source_id"] != strconv.Itoa(l3.Id) {
		t.Fatalf("second cursor page=%v", txns)
	}
	pg = m["pagination"].(map[string]interface{})
	if pg["mode"] != "cursor" || pg["has_more"] != false {
		t.Fatalf("second cursor pagination=%v", pg)
	}
	if _, ok := pg["next_cursor"]; ok {
		t.Fatalf("next_cursor should be omitted when exhausted: %v", pg)
	}
}

func TestUsageTransactionsCursorRejectsMismatchedWindow(t *testing.T) {
	setupUsageDB(t)
	seedUsageChannel(t, 34, 100, "blockRun-claude-0603")
	seedUsageLog(t, &model.Log{ChannelId: 34, ModelName: "m1", CreatedAt: 1100})
	seedUsageLog(t, &model.Log{ChannelId: 34, ModelName: "m2", CreatedAt: 1200})

	code, m, body := doUsageGET(t, usageEngine(),
		"/usage/transactions?start=1970-01-01T00:16:40Z&end=1970-01-01T00:33:20Z&limit=1")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	cursor := m["pagination"].(map[string]interface{})["next_cursor"].(string)

	code, _, body = doUsageGET(t, usageEngine(),
		"/usage/transactions?start=1970-01-01T00:16:41Z&end=1970-01-01T00:33:20Z&limit=1&cursor="+url.QueryEscape(cursor))
	if code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s, want 400", code, body)
	}
}

func TestUsageModelsOnlyReturnsBlockRunModelsWithPrices(t *testing.T) {
	setupUsageDB(t)
	origSelfUseMode := operation_setting.SelfUseModeEnabled
	origModelPrice := ratio_setting.ModelPrice2JSONString()
	origModelRatio := ratio_setting.ModelRatio2JSONString()
	origCompletionRatio := ratio_setting.CompletionRatio2JSONString()
	origCacheRatio := ratio_setting.CacheRatio2JSONString()
	origCreateCacheRatio := ratio_setting.CreateCacheRatio2JSONString()
	t.Cleanup(func() {
		operation_setting.SelfUseModeEnabled = origSelfUseMode
		_ = ratio_setting.UpdateModelPriceByJSONString(origModelPrice)
		_ = ratio_setting.UpdateModelRatioByJSONString(origModelRatio)
		_ = ratio_setting.UpdateCompletionRatioByJSONString(origCompletionRatio)
		_ = ratio_setting.UpdateCacheRatioByJSONString(origCacheRatio)
		_ = ratio_setting.UpdateCreateCacheRatioByJSONString(origCreateCacheRatio)
	})
	operation_setting.SelfUseModeEnabled = true
	if err := ratio_setting.UpdateModelPriceByJSONString(`{"seedance-2.0":0.012}`); err != nil {
		t.Fatalf("set model price: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4o":1.25}`); err != nil {
		t.Fatalf("set model ratio: %v", err)
	}
	if err := ratio_setting.UpdateCompletionRatioByJSONString(`{"gpt-4o":4}`); err != nil {
		t.Fatalf("set completion ratio: %v", err)
	}
	if err := ratio_setting.UpdateCacheRatioByJSONString(`{"gpt-4o":0.5}`); err != nil {
		t.Fatalf("set cache ratio: %v", err)
	}
	if err := ratio_setting.UpdateCreateCacheRatioByJSONString(`{"gpt-4o":1}`); err != nil {
		t.Fatalf("set create cache ratio: %v", err)
	}

	seedUsageChannel(t, 34, 100, "blockRun-llm")
	seedUsageChannel(t, 36, 100, "blockRun-llm-secondary")
	seedUsageChannel(t, 35, 102, "blockRun-seedance")
	seedUsageChannel(t, 99, 1, "plain-openai")
	seedUsageAbility(t, &model.Ability{ChannelId: 34, Model: "gpt-4o", Enabled: true})
	seedUsageAbility(t, &model.Ability{ChannelId: 36, Model: "gpt-4o", Enabled: true})
	seedUsageAbility(t, &model.Ability{ChannelId: 35, Model: "seedance-2.0", Enabled: true})
	seedUsageAbility(t, &model.Ability{ChannelId: 34, Model: "unpriced-blockrun", Enabled: true})
	seedUsageAbility(t, &model.Ability{ChannelId: 99, Model: "gpt-5", Enabled: true})

	code, m, body := doUsageGET(t, usageEngine(), "/usage/models")
	if code != http.StatusOK {
		t.Fatalf("status=%d body=%s", code, body)
	}
	if m["provider"] != "flatkey" {
		t.Fatalf("provider=%v", m["provider"])
	}
	items := m["models"].([]interface{})
	if len(items) != 4 {
		t.Fatalf("models len=%d body=%s", len(items), body)
	}

	byNameChannel := map[string]map[string]interface{}{}
	for _, raw := range items {
		item := raw.(map[string]interface{})
		byNameChannel[item["model"].(string)+"|"+item["channel_id"].(string)] = item
	}
	if _, ok := byNameChannel["gpt-5|99"]; ok {
		t.Fatalf("non-blockrun channel model leaked: %s", body)
	}
	gpt4o := byNameChannel["gpt-4o|34"]
	if gpt4o["pricing_mode"] != "TOKEN" {
		t.Fatalf("gpt-4o billing=%v", gpt4o)
	}
	if gpt4o["channel_name"] != "blockRun-llm" {
		t.Fatalf("gpt-4o channel=%v", gpt4o)
	}
	if gpt4o["input_price_usd_per_1m"] != "2.5000000000" {
		t.Fatalf("gpt-4o input price=%v", gpt4o["input_price_usd_per_1m"])
	}
	if gpt4o["output_price_usd_per_1m"] != "10.0000000000" ||
		gpt4o["cache_read_price_usd_per_1m"] != "1.2500000000" ||
		gpt4o["cache_write_price_usd_per_1m"] != "2.5000000000" ||
		gpt4o["currency"] != "USD" {
		t.Fatalf("gpt-4o prices=%v", gpt4o)
	}
	if _, ok := byNameChannel["gpt-4o|36"]; !ok {
		t.Fatalf("gpt-4o secondary channel missing: %s", body)
	}
	seedance := byNameChannel["seedance-2.0|35"]
	if seedance["pricing_mode"] != "REQUEST" || seedance["request_price_usd"] != "0.0120000000" ||
		seedance["currency"] != "USD" {
		t.Fatalf("seedance pricing=%v", seedance)
	}
	unpriced := byNameChannel["unpriced-blockrun|34"]
	if unpriced["pricing_mode"] != "MIXED" {
		t.Fatalf("unpriced billing=%v", unpriced)
	}
}

func TestRatioPricePer1MTokensUSDUsesCurrentQuotaPerUnit(t *testing.T) {
	origQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() { common.QuotaPerUnit = origQuotaPerUnit })

	common.QuotaPerUnit = 1_000_000

	if got := ratioPricePer1MTokensUSD(1.25); got != "1.2500000000" {
		t.Fatalf("price=%s, want dynamic quota-per-unit conversion", got)
	}
}

func TestBuildUsageModelPriceUsesCompactWildcardRatio(t *testing.T) {
	origModelPrice := ratio_setting.ModelPrice2JSONString()
	origModelRatio := ratio_setting.ModelRatio2JSONString()
	origCompletionRatio := ratio_setting.CompletionRatio2JSONString()
	t.Cleanup(func() {
		_ = ratio_setting.UpdateModelPriceByJSONString(origModelPrice)
		_ = ratio_setting.UpdateModelRatioByJSONString(origModelRatio)
		_ = ratio_setting.UpdateCompletionRatioByJSONString(origCompletionRatio)
	})

	if err := ratio_setting.UpdateModelPriceByJSONString(`{}`); err != nil {
		t.Fatalf("clear model price: %v", err)
	}
	if err := ratio_setting.UpdateModelRatioByJSONString(`{"*-openai-compact":0.5}`); err != nil {
		t.Fatalf("set model ratio: %v", err)
	}
	if err := ratio_setting.UpdateCompletionRatioByJSONString(`{}`); err != nil {
		t.Fatalf("clear completion ratio: %v", err)
	}

	price := buildUsageModelPrice(
		"gpt-4o-openai-compact",
		model.BlockRunChannel{Id: 34, Name: "blockRun-llm", Type: 100},
		ratio_setting.GetModelRatioCopy(),
	)

	if price.PricingMode != "TOKEN" || price.InputPriceUSDPer1M != "1.0000000000" {
		t.Fatalf("compact wildcard price=%+v", price)
	}
}
