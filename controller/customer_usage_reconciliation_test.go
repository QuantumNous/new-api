package controller

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func customerUsageEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/usage/customers/:customer_id", GetCustomerUsageCustomer)
	r.GET("/usage/customer-transactions", GetCustomerUsageTransactions)
	r.GET("/usage/customer-summary", GetCustomerUsageSummary)
	r.GET("/usage/customer-adjustments", GetCustomerUsageAdjustments)
	return r
}

func customerUsageWindow() (time.Time, time.Time) {
	end := time.Now().UTC().Truncate(time.Second)
	return end.Add(-time.Hour), end
}

func TestCustomerUsageSnapshotTransactionsSummaryAndAdjustments(t *testing.T) {
	setupUsageDB(t)
	start, end := customerUsageWindow()
	if err := model.DB.Create(&model.User{Id: 1842, Username: "acme@example.com", DisplayName: "Acme AI", Status: common.UserStatusEnabled}).Error; err != nil {
		t.Fatal(err)
	}
	if err := model.DB.Create(&model.User{Id: 1843, Username: "other@example.com", DisplayName: "Other", AffCode: "other-customer", Status: common.UserStatusEnabled}).Error; err != nil {
		t.Fatal(err)
	}
	seedUsageChannel(t, 302, 1, "Fluere-Acme-OpenAI")
	first := seedUsageLog(t, &model.Log{UserId: 1842, ChannelId: 302, TokenId: 88, TokenName: "acme-production", ModelName: "gpt-4o", PromptTokens: 1200, CompletionTokens: 340, Quota: 6150, CreatedAt: start.Add(5 * time.Minute).Unix(), RequestId: "req_flatkey_001", UpstreamRequestId: "chatcmpl_001", Other: `{}`})
	seedUsageLog(t, &model.Log{UserId: 1842, ChannelId: 302, TokenId: 88, TokenName: "acme-production", ModelName: "gpt-4o", PromptTokens: 1, CompletionTokens: 2, Quota: 30, CreatedAt: start.Add(10 * time.Minute).Unix(), Other: `{}`})
	seedUsageLog(t, &model.Log{UserId: 1843, ChannelId: 302, TokenId: 99, ModelName: "gpt-4o", PromptTokens: 99, CompletionTokens: 99, Quota: 999, CreatedAt: start.Add(8 * time.Minute).Unix(), Other: `{}`})
	seedUsageLog(t, &model.Log{UserId: 1842, Type: model.LogTypeRefund, ChannelId: 302, Quota: -6150, CreatedAt: start.Add(15 * time.Minute).Unix(), Other: `{"task_id":"legacy-refund"}`})
	if err := model.CreateCustomerUsageAdjustment(&model.CustomerUsageAdjustment{AdjustmentID: "refund:task_8c6", CustomerID: 1842, EventType: "REFUND", SourceTransactionID: strconv.Itoa(first.Id), AmountDeltaQuota: -6150, ReasonCode: "ASYNC_TASK_FAILED", OccurredAt: start.Add(20 * time.Minute).Unix()}); err != nil {
		t.Fatal(err)
	}

	e := customerUsageEngine()
	window := "start=" + start.Format(time.RFC3339) + "&end=" + end.Format(time.RFC3339)
	code, snapshot, body := doUsageGET(t, e, "/usage/customers/1842")
	if code != http.StatusOK || snapshot["schema_version"] != customerUsageSchemaVersion {
		t.Fatalf("snapshot status=%d body=%s", code, body)
	}
	customer := snapshot["customer"].(map[string]interface{})
	if customer["display_name"] != "A***" || strings.Contains(body, "acme@example.com") {
		t.Fatalf("customer snapshot leaked identity: %s", body)
	}

	code, txPage, body := doUsageGET(t, e, "/usage/customer-transactions?customer_id=1842&"+window+"&limit=1")
	if code != http.StatusOK {
		t.Fatalf("transactions status=%d body=%s", code, body)
	}
	transactions := txPage["transactions"].([]interface{})
	if len(transactions) != 1 {
		t.Fatalf("transactions=%v", txPage)
	}
	tx := transactions[0].(map[string]interface{})
	if tx["source_transaction_id"] != strconv.Itoa(first.Id) || tx["customer_id"] != "1842" || tx["status"] != "SUCCEEDED" {
		t.Fatalf("unexpected transaction=%v first=%d", tx, first.Id)
	}
	nextCursor := txPage["pagination"].(map[string]interface{})["next_cursor"].(string)
	code, _, _ = doUsageGET(t, e, "/usage/customer-transactions?customer_id=1843&"+window+"&limit=1&cursor="+nextCursor)
	if code != http.StatusBadRequest {
		t.Fatalf("cross-customer cursor status=%d", code)
	}

	code, summary, body := doUsageGET(t, e, "/usage/customer-summary?customer_id=1842&"+window)
	if code != http.StatusOK {
		t.Fatalf("summary status=%d body=%s", code, body)
	}
	totals := summary["totals"].(map[string]interface{})
	if totals["requests"].(float64) != 2 || totals["actual_cost"] != "0.0123600000" {
		t.Fatalf("summary totals=%v", totals)
	}

	code, adjustments, body := doUsageGET(t, e, "/usage/customer-adjustments?customer_id=1842&"+window+"&limit=1000")
	if code != http.StatusOK {
		t.Fatalf("adjustments status=%d body=%s", code, body)
	}
	items := adjustments["adjustments"].([]interface{})
	if len(items) != 1 || items[0].(map[string]interface{})["adjustment_id"] != "refund:task_8c6" {
		t.Fatalf("adjustments=%v", adjustments)
	}
}

func TestCustomerUsageRejectsExpiredRetentionAndUnknownCustomer(t *testing.T) {
	setupUsageDB(t)
	if err := model.DB.Create(&model.User{Id: 1842, Username: "acme", DisplayName: "Acme", Status: common.UserStatusEnabled}).Error; err != nil {
		t.Fatal(err)
	}
	e := customerUsageEngine()
	code, _, _ := doUsageGET(t, e, "/usage/customers/404")
	if code != http.StatusNotFound {
		t.Fatalf("unknown customer status=%d", code)
	}
	code, _, _ = doUsageGET(t, e, "/usage/customer-summary?customer_id=1842&start=1970-01-01T00:00:00Z&end=1970-01-01T01:00:00Z")
	if code != http.StatusBadRequest {
		t.Fatalf("expired retention status=%d", code)
	}
}

func TestCustomerUsageQueryUsesCompositeLogIndex(t *testing.T) {
	setupUsageDB(t)
	start, end := customerUsageWindow()
	seedUsageLog(t, &model.Log{UserId: 1842, ChannelId: 302, ModelName: "gpt-4o", CreatedAt: start.Add(time.Minute).Unix()})

	type queryPlanRow struct {
		Detail string
	}
	var plan []queryPlanRow
	err := model.LOG_DB.Raw(`EXPLAIN QUERY PLAN
		SELECT id FROM logs
		WHERE user_id = ? AND type = ? AND created_at >= ? AND created_at < ?
		  AND (created_at > ? OR (created_at = ? AND id > ?))
		ORDER BY created_at ASC, id ASC LIMIT ?`,
		1842, model.LogTypeConsume, start.Unix(), end.Unix(), 0, 0, 0, 1001,
	).Scan(&plan).Error
	if err != nil {
		t.Fatalf("explain customer usage query: %v", err)
	}
	planText := ""
	for _, row := range plan {
		planText += row.Detail + "\n"
	}
	if !strings.Contains(planText, "idx_logs_user_created_type") {
		t.Fatalf("customer usage query did not use composite index: %s", planText)
	}
}
