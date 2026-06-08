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
	usageReconProvider      = "flatkey-newapi"
	usageReconCurrency      = "USD"
	usageReconMaxRange      = 31 * 24 * time.Hour
	usageTxnDefaultPageSize = 100
	usageTxnMaxPageSize     = 500
	usageReconMsLayout      = "2006-01-02T15:04:05.000Z07:00"
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

func parseUsageOther(s string) map[string]interface{} {
	if s == "" {
		return nil
	}
	m, err := common.StrToMap(s)
	if err != nil {
		return nil
	}
	return m
}

// usageOtherInt reads an integer-valued key from the Other map. common.Unmarshal
// uses the std json lib, so JSON numbers arrive as float64; other types are
// handled defensively.
func usageOtherInt(other map[string]interface{}, key string) int64 {
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

func usageResolveModel(log *model.Log, other map[string]interface{}) string {
	if other != nil {
		if s, ok := other["upstream_model_name"].(string); ok && s != "" {
			return s
		}
	}
	return log.ModelName
}

func usageResolveStatus(other map[string]interface{}) string {
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
		other := parseUsageOther(log.Other)
		cacheRead := usageOtherInt(other, "cache_tokens")
		cacheCreate := usageOtherInt(other, "cache_creation_tokens")
		q := int64(log.Quota)

		totals.add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, q)

		mName := usageResolveModel(log, other)
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
		ByAPIKey:    buildUsageByAPIKey(byKey, keyName),
		ByModel:     buildUsageByModel(byModel),
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

func buildUsageByModel(m map[string]*usageAccum) []usageByModel {
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

func buildUsageByAPIKey(m map[int]*usageAccum, names map[int]string) []usageByAPIKey {
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
	page := parseUsagePositiveInt(c.Query("page"), 1)
	pageSize := parseUsagePositiveInt(c.Query("page_size"), usageTxnDefaultPageSize)
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
		other := parseUsageOther(log.Other)
		cacheRead := usageOtherInt(other, "cache_tokens")
		cacheCreate := usageOtherInt(other, "cache_creation_tokens")
		ch := channels[log.ChannelId]
		txns = append(txns, usageTransaction{
			TransactionID:       "txn_" + strconv.Itoa(log.Id),
			RequestID:           log.RequestId,
			APIKeyID:            strconv.Itoa(log.TokenId),
			APIKeyName:          log.TokenName,
			Model:               usageResolveModel(log, other),
			RequestedModel:      log.ModelName,
			CreatedAt:           time.Unix(log.CreatedAt, 0).UTC().Format(usageReconMsLayout),
			InputTokens:         int64(log.PromptTokens),
			OutputTokens:        int64(log.CompletionTokens),
			CacheReadTokens:     cacheRead,
			CacheCreationTokens: cacheCreate,
			TotalTokens:         int64(log.PromptTokens) + int64(log.CompletionTokens) + cacheRead + cacheCreate,
			ActualCost:          quotaToUSD(int64(log.Quota)),
			Currency:            usageReconCurrency,
			Status:              usageResolveStatus(other),
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

func parseUsagePositiveInt(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 {
		return def
	}
	return n
}
