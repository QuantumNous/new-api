package controller

import (
	"encoding/base64"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

const (
	usageReconProvider      = "flatkey"
	usageReconCurrency      = "USD"
	usageReconMaxRange      = 31 * 24 * time.Hour
	usageTxnDefaultPageSize = 100
	usageTxnMaxPageSize     = 500
	usageTxnMaxCursorLimit  = 1000
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
	SourceID            string `json:"source_id"`
	RequestID           string `json:"request_id"`
	APIKeyID            string `json:"api_key_id"`
	APIKeyName          string `json:"api_key_name"`
	ChannelID           string `json:"channel_id"`
	ChannelName         string `json:"channel_name"`
	Model               string `json:"model"`
	RequestedModel      string `json:"requested_model"`
	CreatedAt           string `json:"created_at"`
	InputTokens         int64  `json:"input_tokens"`
	OutputTokens        int64  `json:"output_tokens"`
	CacheReadTokens     int64  `json:"cache_read_tokens"`
	CacheCreationTokens int64  `json:"cache_creation_tokens"`
	TotalTokens         int64  `json:"total_tokens"`
	ActualCost          string `json:"actual_cost"`
	Currency            string `json:"currency"`
	Status              string `json:"status"`
	DurationMs          int64  `json:"duration_ms"`
}

type usagePagination struct {
	Mode       string `json:"mode,omitempty"`
	Page       int    `json:"page,omitempty"`
	PageSize   int    `json:"page_size,omitempty"`
	Limit      int    `json:"limit,omitempty"`
	NextCursor string `json:"next_cursor,omitempty"`
	TotalPages int64  `json:"total_pages,omitempty"`
	TotalCount *int64 `json:"total_count,omitempty"`
	HasMore    bool   `json:"has_more"`
}

type usageTransactionsResponse struct {
	Provider     string             `json:"provider"`
	Period       string             `json:"period"`
	Start        string             `json:"start"`
	End          string             `json:"end"`
	Transactions []usageTransaction `json:"transactions"`
	Pagination   usagePagination    `json:"pagination"`
	GeneratedAt  string             `json:"generated_at"`
}

type usageModelPrice struct {
	Model                   string `json:"model"`
	ChannelID               string `json:"channel_id"`
	ChannelName             string `json:"channel_name"`
	PricingMode             string `json:"pricing_mode"`
	InputPriceUSDPer1M      string `json:"input_price_usd_per_1m,omitempty"`
	OutputPriceUSDPer1M     string `json:"output_price_usd_per_1m,omitempty"`
	CacheReadPriceUSDPer1M  string `json:"cache_read_price_usd_per_1m,omitempty"`
	CacheWritePriceUSDPer1M string `json:"cache_write_price_usd_per_1m,omitempty"`
	RequestPriceUSD         string `json:"request_price_usd,omitempty"`
	Currency                string `json:"currency"`
}

type usageModelsResponse struct {
	Provider    string            `json:"provider"`
	Models      []usageModelPrice `json:"models"`
	GeneratedAt string            `json:"generated_at"`
}

type usageValidationByModel struct {
	Model       string `json:"model"`
	ChannelID   string `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Requests    int64  `json:"requests"`
	ActualCost  string `json:"actual_cost"`
}

type usageValidationByChannel struct {
	ChannelID   string `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	Requests    int64  `json:"requests"`
	ActualCost  string `json:"actual_cost"`
}

type usageValidationResponse struct {
	Provider    string                     `json:"provider"`
	Period      string                     `json:"period"`
	Start       string                     `json:"start"`
	End         string                     `json:"end"`
	Totals      usageMetrics               `json:"totals"`
	ByModel     []usageValidationByModel   `json:"by_model"`
	ByChannel   []usageValidationByChannel `json:"by_channel"`
	GeneratedAt string                     `json:"generated_at"`
}

type usageTransactionCursor struct {
	Version   int   `json:"v"`
	Start     int64 `json:"start"`
	End       int64 `json:"end"`
	Channels  []int `json:"channels"`
	CreatedAt int64 `json:"created_at"`
	ID        int   `json:"id"`
}

// ---- shared helpers ----

func quotaToUSD(quota int64) string {
	return decimal.NewFromInt(quota).Div(decimal.NewFromFloat(common.QuotaPerUnit)).StringFixed(10)
}

func priceToUSD(price float64) string {
	return decimal.NewFromFloat(price).StringFixed(10)
}

func ratioPricePer1MTokensUSD(ratio float64) string {
	return decimal.NewFromFloat(ratio).
		Mul(decimal.NewFromInt(1_000_000)).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		StringFixed(10)
}

func usageFormatTime(t time.Time) string {
	return t.UTC().Format(usageReconMsLayout)
}

func usagePeriodLabel(c *gin.Context) string {
	if period := c.Query("period"); period != "" {
		return period
	}
	return "day"
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
	sort.Ints(ids)
	return ids
}

func encodeUsageTransactionCursor(startUnix, endUnix int64, channelIDs []int, log *model.Log) (string, error) {
	cursor := usageTransactionCursor{
		Version:   1,
		Start:     startUnix,
		End:       endUnix,
		Channels:  append([]int(nil), channelIDs...),
		CreatedAt: log.CreatedAt,
		ID:        log.Id,
	}
	data, err := common.Marshal(cursor)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeUsageTransactionCursor(raw string, startUnix, endUnix int64, channelIDs []int) (usageTransactionCursor, bool) {
	var cursor usageTransactionCursor
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return cursor, false
	}
	if err := common.Unmarshal(data, &cursor); err != nil {
		return cursor, false
	}
	if cursor.Version != 1 || cursor.Start != startUnix || cursor.End != endUnix || !sameIntSlice(cursor.Channels, channelIDs) {
		return cursor, false
	}
	return cursor, true
}

func sameIntSlice(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func buildUsageModelPrice(modelName string, ch model.BlockRunChannel, modelRatios map[string]float64) usageModelPrice {
	out := usageModelPrice{
		Model:       modelName,
		ChannelID:   strconv.Itoa(ch.Id),
		ChannelName: ch.Name,
		PricingMode: "MIXED",
		Currency:    usageReconCurrency,
	}

	if modelPrice, ok := ratio_setting.GetModelPrice(modelName, false); ok {
		out.PricingMode = "REQUEST"
		out.RequestPriceUSD = priceToUSD(modelPrice)
		return out
	}

	matchingName := ratio_setting.FormatMatchingModelName(modelName)
	modelRatio, ok := modelRatios[matchingName]
	if !ok && strings.HasSuffix(matchingName, ratio_setting.CompactModelSuffix) {
		modelRatio, ok = modelRatios[ratio_setting.CompactWildcardModelKey]
	}
	if !ok {
		return out
	}
	completionRatio := ratio_setting.GetCompletionRatio(modelName)
	out.PricingMode = "TOKEN"
	out.InputPriceUSDPer1M = ratioPricePer1MTokensUSD(modelRatio)
	out.OutputPriceUSDPer1M = ratioPricePer1MTokensUSD(modelRatio * completionRatio)
	if cacheRatio, ok := ratio_setting.GetCacheRatio(modelName); ok {
		out.CacheReadPriceUSDPer1M = ratioPricePer1MTokensUSD(modelRatio * cacheRatio)
	}
	if createCacheRatio, ok := ratio_setting.GetCreateCacheRatio(modelName); ok {
		out.CacheWritePriceUSDPer1M = ratioPricePer1MTokensUSD(modelRatio * createCacheRatio)
	}
	return out
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

type usageModelChannelKey struct {
	Model     string
	ChannelID int
}

func buildUsageValidationByModel(m map[usageModelChannelKey]*usageAccum, channels map[int]model.BlockRunChannel) []usageValidationByModel {
	out := make([]usageValidationByModel, 0, len(m))
	for key, acc := range m {
		ch := channels[key.ChannelID]
		out = append(out, usageValidationByModel{
			Model:       key.Model,
			ChannelID:   strconv.Itoa(key.ChannelID),
			ChannelName: ch.Name,
			Requests:    acc.requests,
			ActualCost:  quotaToUSD(acc.quota),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Requests != out[j].Requests {
			return out[i].Requests > out[j].Requests
		}
		if out[i].Model != out[j].Model {
			return out[i].Model < out[j].Model
		}
		return out[i].ChannelID < out[j].ChannelID
	})
	return out
}

func buildUsageValidationByChannel(m map[int]*usageAccum, channels map[int]model.BlockRunChannel) []usageValidationByChannel {
	out := make([]usageValidationByChannel, 0, len(m))
	for id, acc := range m {
		ch := channels[id]
		out = append(out, usageValidationByChannel{
			ChannelID:   strconv.Itoa(id),
			ChannelName: ch.Name,
			Requests:    acc.requests,
			ActualCost:  quotaToUSD(acc.quota),
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Requests != out[j].Requests {
			return out[i].Requests > out[j].Requests
		}
		return out[i].ChannelID < out[j].ChannelID
	})
	return out
}

// GetUsageValidation serves GET /usage/validation.
func GetUsageValidation(c *gin.Context) {
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
	byModel := map[usageModelChannelKey]*usageAccum{}
	byChannel := map[int]*usageAccum{}

	err = model.StreamBlockRunUsageLogs(ids, startUnix, endUnix, func(log *model.Log) error {
		other := parseUsageOther(log.Other)
		cacheRead := usageOtherInt(other, "cache_tokens")
		cacheCreate := usageOtherInt(other, "cache_creation_tokens")
		q := int64(log.Quota)

		totals.add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, q)

		key := usageModelChannelKey{Model: usageResolveModel(log, other), ChannelID: log.ChannelId}
		if byModel[key] == nil {
			byModel[key] = &usageAccum{}
		}
		byModel[key].add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, q)

		if byChannel[log.ChannelId] == nil {
			byChannel[log.ChannelId] = &usageAccum{}
		}
		byChannel[log.ChannelId].add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, q)
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query usage failed"})
		return
	}

	c.JSON(http.StatusOK, usageValidationResponse{
		Provider:    usageReconProvider,
		Period:      usagePeriodLabel(c),
		Start:       usageFormatTime(startT),
		End:         usageFormatTime(endT),
		Totals:      totals.metrics(),
		ByModel:     buildUsageValidationByModel(byModel, channels),
		ByChannel:   buildUsageValidationByChannel(byChannel, channels),
		GeneratedAt: usageFormatTime(time.Now()),
	})
}

// GetUsageTransactions serves GET /usage/transactions.
func GetUsageTransactions(c *gin.Context) {
	startUnix, endUnix, startT, endT, ok := parseUsageTimeRange(c)
	if !ok {
		return
	}
	if c.Query("limit") != "" || c.Query("cursor") != "" {
		getUsageTransactionsCursor(c, startUnix, endUnix, startT, endT)
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

	var totalPages int64
	if pageSize > 0 {
		totalPages = (total + int64(pageSize) - 1) / int64(pageSize)
	}
	c.JSON(http.StatusOK, usageTransactionsResponse{
		Provider:     usageReconProvider,
		Period:       usagePeriodLabel(c),
		Start:        usageFormatTime(startT),
		End:          usageFormatTime(endT),
		Transactions: buildUsageTransactions(logs, channels),
		Pagination: usagePagination{
			Page:       page,
			PageSize:   pageSize,
			TotalPages: totalPages,
			TotalCount: &total,
			HasMore:    int64(page)*int64(pageSize) < total,
		},
		GeneratedAt: usageFormatTime(time.Now()),
	})
}

func getUsageTransactionsCursor(c *gin.Context, startUnix, endUnix int64, startT, endT time.Time) {
	limitRaw := c.Query("limit")
	if limitRaw == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "limit is required for cursor pagination"})
		return
	}
	limit, err := strconv.Atoi(limitRaw)
	if err != nil || limit < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
		return
	}
	if limit > usageTxnMaxCursorLimit {
		limit = usageTxnMaxCursorLimit
	}

	channels, err := model.GetBlockRunChannels()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query channels failed"})
		return
	}
	ids := blockRunChannelIDs(channels)

	var cursor usageTransactionCursor
	if rawCursor := c.Query("cursor"); rawCursor != "" {
		var ok bool
		cursor, ok = decodeUsageTransactionCursor(rawCursor, startUnix, endUnix, ids)
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cursor"})
			return
		}
	}

	logs, err := model.QueryBlockRunUsageLogsAfterCursor(ids, startUnix, endUnix, limit+1, cursor.CreatedAt, cursor.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query failed"})
		return
	}

	hasMore := len(logs) > limit
	if hasMore {
		logs = logs[:limit]
	}
	nextCursor := ""
	if hasMore && len(logs) > 0 {
		nextCursor, err = encodeUsageTransactionCursor(startUnix, endUnix, ids, logs[len(logs)-1])
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encode cursor failed"})
			return
		}
	}

	c.JSON(http.StatusOK, usageTransactionsResponse{
		Provider:     usageReconProvider,
		Period:       usagePeriodLabel(c),
		Start:        usageFormatTime(startT),
		End:          usageFormatTime(endT),
		Transactions: buildUsageTransactions(logs, channels),
		Pagination: usagePagination{
			Mode:       "cursor",
			Limit:      limit,
			NextCursor: nextCursor,
			HasMore:    hasMore,
		},
		GeneratedAt: usageFormatTime(time.Now()),
	})
}

func buildUsageTransactions(logs []*model.Log, channels map[int]model.BlockRunChannel) []usageTransaction {
	txns := make([]usageTransaction, 0, len(logs))
	for _, log := range logs {
		other := parseUsageOther(log.Other)
		cacheRead := usageOtherInt(other, "cache_tokens")
		cacheCreate := usageOtherInt(other, "cache_creation_tokens")
		ch := channels[log.ChannelId]
		txns = append(txns, usageTransaction{
			SourceID:            strconv.Itoa(log.Id),
			RequestID:           log.RequestId,
			APIKeyID:            strconv.Itoa(log.TokenId),
			APIKeyName:          log.TokenName,
			ChannelID:           strconv.Itoa(log.ChannelId),
			ChannelName:         ch.Name,
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
		})
	}
	return txns
}

// GetUsageModels serves GET /usage/models.
func GetUsageModels(c *gin.Context) {
	modelChannels, err := model.GetBlockRunEnabledModelChannels()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query models failed"})
		return
	}
	modelRatios := ratio_setting.GetModelRatioCopy()

	modelNames := make([]string, 0, len(modelChannels))
	for modelName := range modelChannels {
		modelNames = append(modelNames, modelName)
	}
	sort.Strings(modelNames)

	items := make([]usageModelPrice, 0, len(modelNames))
	for _, modelName := range modelNames {
		channels := modelChannels[modelName]
		sort.Slice(channels, func(i, j int) bool {
			return channels[i].Id < channels[j].Id
		})
		for _, ch := range channels {
			items = append(items, buildUsageModelPrice(modelName, ch, modelRatios))
		}
	}

	c.JSON(http.StatusOK, usageModelsResponse{
		Provider:    usageReconProvider,
		Models:      items,
		GeneratedAt: usageFormatTime(time.Now()),
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
