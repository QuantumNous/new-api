package controller

import (
	"encoding/base64"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const customerUsageSchemaVersion = "flatkey-customer-usage-v1"

type customerUsageCustomer struct {
	CustomerID  string `json:"customer_id"`
	DisplayName string `json:"display_name"`
	Status      string `json:"status"`
}

type customerUsageTransaction struct {
	SourceTransactionID string `json:"source_transaction_id"`
	SourceID            string `json:"source_id"`
	CustomerID          string `json:"customer_id"`
	APIKeyID            string `json:"api_key_id,omitempty"`
	APIKeyName          string `json:"api_key_name,omitempty"`
	ChannelID           string `json:"channel_id"`
	ChannelName         string `json:"channel_name"`
	Model               string `json:"model"`
	RequestedModel      string `json:"requested_model"`
	OccurredAt          string `json:"occurred_at"`
	InputTokens         int64  `json:"input_tokens"`
	OutputTokens        int64  `json:"output_tokens"`
	CacheReadTokens     int64  `json:"cache_read_tokens"`
	CacheCreationTokens int64  `json:"cache_creation_tokens"`
	TotalTokens         int64  `json:"total_tokens"`
	ActualCost          string `json:"actual_cost"`
	Currency            string `json:"currency"`
	Status              string `json:"status"`
	RequestID           string `json:"request_id,omitempty"`
	UpstreamRequestID   string `json:"upstream_request_id,omitempty"`
}

type customerUsageTransactionsResponse struct {
	SchemaVersion string                     `json:"schema_version"`
	Provider      string                     `json:"provider"`
	Customer      customerUsageCustomer      `json:"customer"`
	Period        usagePeriod                `json:"period"`
	Transactions  []customerUsageTransaction `json:"transactions"`
	Pagination    usagePagination            `json:"pagination"`
	GeneratedAt   string                     `json:"generated_at"`
}

type customerUsageSummaryByChannel struct {
	ChannelID   string `json:"channel_id"`
	ChannelName string `json:"channel_name"`
	usageMetrics
}

type customerUsageSummaryResponse struct {
	SchemaVersion string                          `json:"schema_version"`
	Provider      string                          `json:"provider"`
	Customer      customerUsageCustomer           `json:"customer"`
	Period        usagePeriod                     `json:"period"`
	Totals        usageMetrics                    `json:"totals"`
	ByModel       []usageByModel                  `json:"by_model"`
	ByChannel     []customerUsageSummaryByChannel `json:"by_channel"`
	GeneratedAt   string                          `json:"generated_at"`
}

type customerUsageAdjustment struct {
	AdjustmentID        string `json:"adjustment_id"`
	CustomerID          string `json:"customer_id"`
	EventType           string `json:"event_type"`
	SourceTransactionID string `json:"source_transaction_id,omitempty"`
	AmountDeltaUSD      string `json:"amount_delta_usd"`
	Currency            string `json:"currency"`
	OccurredAt          string `json:"occurred_at"`
	ReasonCode          string `json:"reason_code"`
}

type customerUsageAdjustmentsResponse struct {
	SchemaVersion string                    `json:"schema_version"`
	Provider      string                    `json:"provider"`
	CustomerID    string                    `json:"customer_id"`
	Period        usagePeriod               `json:"period"`
	Adjustments   []customerUsageAdjustment `json:"adjustments"`
	Pagination    usagePagination           `json:"pagination"`
	GeneratedAt   string                    `json:"generated_at"`
}

type customerUsageCursor struct {
	Version    int    `json:"v"`
	Kind       string `json:"kind"`
	CustomerID int    `json:"customer_id"`
	Start      int64  `json:"start"`
	End        int64  `json:"end"`
	OccurredAt int64  `json:"created_at"`
	ID         int    `json:"id"`
}

func parseCustomerUsageCustomer(c *gin.Context, raw string) (int, customerUsageCustomer, bool) {
	customerID, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || customerID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid customer_id"})
		return 0, customerUsageCustomer{}, false
	}
	user, err := model.GetUserById(customerID, false)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "customer_not_found"})
		return 0, customerUsageCustomer{}, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query customer failed"})
		return 0, customerUsageCustomer{}, false
	}
	status := "ACTIVE"
	if user.Status != common.UserStatusEnabled {
		status = "DISABLED"
	}
	return customerID, customerUsageCustomer{
		CustomerID:  strconv.Itoa(customerID),
		DisplayName: customerUsageDisplayName(user),
		Status:      status,
	}, true
}

func customerUsageDisplayName(user *model.User) string {
	name := []rune(strings.TrimSpace(user.DisplayName))
	if len(name) == 0 {
		return "Customer " + strconv.Itoa(user.Id)
	}
	if len(name) == 1 {
		return string(name) + "***"
	}
	return string(name[:1]) + "***"
}

func parseCustomerUsageTimeRange(c *gin.Context) (int64, int64, time.Time, time.Time, bool) {
	startUnix, endUnix, startT, endT, ok := parseUsageTimeRange(c)
	if !ok {
		return 0, 0, time.Time{}, time.Time{}, false
	}
	if startT.Before(time.Now().UTC().AddDate(-2, 0, 0)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "time range exceeds 24 month retention"})
		return 0, 0, time.Time{}, time.Time{}, false
	}
	return startUnix, endUnix, startT, endT, true
}

func parseCustomerUsageLimit(c *gin.Context) (int, bool) {
	raw := c.Query("limit")
	limit, err := strconv.Atoi(raw)
	if raw == "" || err != nil || limit < 1 || limit > usageTxnMaxCursorLimit {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
		return 0, false
	}
	return limit, true
}

func encodeCustomerUsageCursor(kind string, customerID int, startUnix, endUnix, occurredAt int64, id int) (string, error) {
	data, err := common.Marshal(customerUsageCursor{Version: 1, Kind: kind, CustomerID: customerID, Start: startUnix, End: endUnix, OccurredAt: occurredAt, ID: id})
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeCustomerUsageCursor(raw, kind string, customerID int, startUnix, endUnix int64) (customerUsageCursor, bool) {
	var cursor customerUsageCursor
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || common.Unmarshal(data, &cursor) != nil || cursor.Version != 1 || cursor.Kind != kind ||
		cursor.CustomerID != customerID || cursor.Start != startUnix || cursor.End != endUnix {
		return customerUsageCursor{}, false
	}
	return cursor, true
}

func customerUsageChannels(logs []*model.Log) (map[int]model.BlockRunChannel, error) {
	ids := make([]int, 0, len(logs))
	seen := make(map[int]struct{})
	for _, log := range logs {
		if _, ok := seen[log.ChannelId]; !ok {
			seen[log.ChannelId] = struct{}{}
			ids = append(ids, log.ChannelId)
		}
	}
	if len(ids) == 0 {
		return map[int]model.BlockRunChannel{}, nil
	}
	return model.GetUsageChannelsByIDs(ids)
}

func customerUsageChannelName(log *model.Log, channels map[int]model.BlockRunChannel) string {
	if channel, ok := channels[log.ChannelId]; ok && channel.Name != "" {
		return channel.Name
	}
	return "channel-" + strconv.Itoa(log.ChannelId)
}

// GetCustomerUsageCustomer serves GET /usage/customers/:customer_id.
func GetCustomerUsageCustomer(c *gin.Context) {
	_, customer, ok := parseCustomerUsageCustomer(c, c.Param("customer_id"))
	if !ok {
		return
	}
	c.JSON(http.StatusOK, gin.H{"schema_version": customerUsageSchemaVersion, "customer": customer, "generated_at": usageFormatTime(time.Now())})
}

// GetCustomerUsageTransactions serves GET /usage/customer-transactions.
func GetCustomerUsageTransactions(c *gin.Context) {
	customerID, customer, ok := parseCustomerUsageCustomer(c, c.Query("customer_id"))
	if !ok {
		return
	}
	startUnix, endUnix, startT, endT, ok := parseCustomerUsageTimeRange(c)
	if !ok {
		return
	}
	limit, ok := parseCustomerUsageLimit(c)
	if !ok {
		return
	}
	cursor := customerUsageCursor{}
	if raw := c.Query("cursor"); raw != "" {
		var valid bool
		cursor, valid = decodeCustomerUsageCursor(raw, "transactions", customerID, startUnix, endUnix)
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_cursor"})
			return
		}
	}
	logs, err := model.QueryCustomerUsageLogsAfterCursor(customerID, startUnix, endUnix, limit+1, cursor.OccurredAt, cursor.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query customer usage failed"})
		return
	}
	hasMore := len(logs) > limit
	if hasMore {
		logs = logs[:limit]
	}
	channels, err := customerUsageChannels(logs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query channels failed"})
		return
	}
	nextCursor := ""
	if hasMore {
		last := logs[len(logs)-1]
		nextCursor, err = encodeCustomerUsageCursor("transactions", customerID, startUnix, endUnix, last.CreatedAt, last.Id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encode cursor failed"})
			return
		}
	}
	c.JSON(http.StatusOK, customerUsageTransactionsResponse{
		SchemaVersion: customerUsageSchemaVersion,
		Provider:      usageReconProvider,
		Customer:      customer,
		Period:        usagePeriod{Start: usageFormatTime(startT), End: usageFormatTime(endT), Timezone: "UTC"},
		Transactions:  buildCustomerUsageTransactions(customerID, logs, channels),
		Pagination:    usagePagination{Mode: "cursor", Limit: limit, NextCursor: nextCursor, HasMore: hasMore},
		GeneratedAt:   usageFormatTime(time.Now()),
	})
}

func buildCustomerUsageTransactions(customerID int, logs []*model.Log, channels map[int]model.BlockRunChannel) []customerUsageTransaction {
	transactions := make([]customerUsageTransaction, 0, len(logs))
	for _, log := range logs {
		other := parseUsageOther(log.Other)
		cacheRead := usageOtherInt(other, "cache_tokens")
		cacheCreate := usageOtherInt(other, "cache_creation_tokens")
		id := strconv.Itoa(log.Id)
		transactions = append(transactions, customerUsageTransaction{
			SourceTransactionID: id, SourceID: id, CustomerID: strconv.Itoa(customerID),
			APIKeyID: strconv.Itoa(log.TokenId), APIKeyName: log.TokenName,
			ChannelID: strconv.Itoa(log.ChannelId), ChannelName: customerUsageChannelName(log, channels),
			Model: usageResolveModel(log, other), RequestedModel: log.ModelName,
			OccurredAt:  usageFormatTime(time.Unix(log.CreatedAt, 0)),
			InputTokens: int64(log.PromptTokens), OutputTokens: int64(log.CompletionTokens),
			CacheReadTokens: cacheRead, CacheCreationTokens: cacheCreate,
			TotalTokens: int64(log.PromptTokens) + int64(log.CompletionTokens) + cacheRead + cacheCreate,
			ActualCost:  quotaToUSD(int64(log.Quota)), Currency: usageReconCurrency, Status: "SUCCEEDED",
			RequestID: log.RequestId, UpstreamRequestID: log.UpstreamRequestId,
		})
	}
	return transactions
}

// GetCustomerUsageSummary serves GET /usage/customer-summary. It streams the
// bounded 31-day window in pages so summary generation does not materialize a
// high-volume customer's entire history in memory.
func GetCustomerUsageSummary(c *gin.Context) {
	customerID, customer, ok := parseCustomerUsageCustomer(c, c.Query("customer_id"))
	if !ok {
		return
	}
	startUnix, endUnix, startT, endT, ok := parseCustomerUsageTimeRange(c)
	if !ok {
		return
	}
	totals := &usageAccum{}
	byModel := map[string]*usageAccum{}
	byChannel := map[int]*usageAccum{}
	channelNames := map[int]string{}
	var cursor customerUsageCursor
	for {
		logs, err := model.QueryCustomerUsageLogsAfterCursor(customerID, startUnix, endUnix, usageTxnMaxCursorLimit, cursor.OccurredAt, cursor.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "query customer usage failed"})
			return
		}
		channels, err := customerUsageChannels(logs)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "query channels failed"})
			return
		}
		for _, log := range logs {
			other := parseUsageOther(log.Other)
			cacheRead, cacheCreate := usageOtherInt(other, "cache_tokens"), usageOtherInt(other, "cache_creation_tokens")
			quota := int64(log.Quota)
			totals.add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, quota)
			modelName := usageResolveModel(log, other)
			if byModel[modelName] == nil {
				byModel[modelName] = &usageAccum{}
			}
			byModel[modelName].add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, quota)
			if byChannel[log.ChannelId] == nil {
				byChannel[log.ChannelId] = &usageAccum{}
			}
			byChannel[log.ChannelId].add(log.PromptTokens, log.CompletionTokens, cacheRead, cacheCreate, quota)
			channelNames[log.ChannelId] = customerUsageChannelName(log, channels)
		}
		if len(logs) < usageTxnMaxCursorLimit {
			break
		}
		last := logs[len(logs)-1]
		cursor.OccurredAt, cursor.ID = last.CreatedAt, last.Id
	}
	channelIDs := make([]int, 0, len(byChannel))
	for channelID := range byChannel {
		channelIDs = append(channelIDs, channelID)
	}
	sort.Ints(channelIDs)
	byChannelItems := make([]customerUsageSummaryByChannel, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		byChannelItems = append(byChannelItems, customerUsageSummaryByChannel{ChannelID: strconv.Itoa(channelID), ChannelName: channelNames[channelID], usageMetrics: byChannel[channelID].metrics()})
	}
	c.JSON(http.StatusOK, customerUsageSummaryResponse{
		SchemaVersion: customerUsageSchemaVersion, Provider: usageReconProvider, Customer: customer,
		Period: usagePeriod{Start: usageFormatTime(startT), End: usageFormatTime(endT), Timezone: "UTC"},
		Totals: totals.metrics(), ByModel: buildUsageByModel(byModel), ByChannel: byChannelItems, GeneratedAt: usageFormatTime(time.Now()),
	})
}

// GetCustomerUsageAdjustments serves GET /usage/customer-adjustments.
func GetCustomerUsageAdjustments(c *gin.Context) {
	customerID, _, ok := parseCustomerUsageCustomer(c, c.Query("customer_id"))
	if !ok {
		return
	}
	startUnix, endUnix, startT, endT, ok := parseCustomerUsageTimeRange(c)
	if !ok {
		return
	}
	limit, ok := parseCustomerUsageLimit(c)
	if !ok {
		return
	}
	cursor := customerUsageCursor{}
	if raw := c.Query("cursor"); raw != "" {
		var valid bool
		cursor, valid = decodeCustomerUsageCursor(raw, "adjustments", customerID, startUnix, endUnix)
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_cursor"})
			return
		}
	}
	adjustments, err := model.QueryCustomerUsageAdjustmentsAfterCursor(customerID, startUnix, endUnix, limit+1, cursor.OccurredAt, cursor.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "query customer adjustments failed"})
		return
	}
	hasMore := len(adjustments) > limit
	if hasMore {
		adjustments = adjustments[:limit]
	}
	nextCursor := ""
	if hasMore {
		last := adjustments[len(adjustments)-1]
		nextCursor, err = encodeCustomerUsageCursor("adjustments", customerID, startUnix, endUnix, last.OccurredAt, last.Id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encode cursor failed"})
			return
		}
	}
	items := make([]customerUsageAdjustment, 0, len(adjustments))
	for _, adjustment := range adjustments {
		items = append(items, customerUsageAdjustment{AdjustmentID: adjustment.AdjustmentID, CustomerID: strconv.Itoa(customerID), EventType: adjustment.EventType, SourceTransactionID: adjustment.SourceTransactionID, AmountDeltaUSD: quotaToUSD(adjustment.AmountDeltaQuota), Currency: usageReconCurrency, OccurredAt: usageFormatTime(time.Unix(adjustment.OccurredAt, 0)), ReasonCode: adjustment.ReasonCode})
	}
	c.JSON(http.StatusOK, customerUsageAdjustmentsResponse{SchemaVersion: customerUsageSchemaVersion, Provider: usageReconProvider, CustomerID: strconv.Itoa(customerID), Period: usagePeriod{Start: usageFormatTime(startT), End: usageFormatTime(endT), Timezone: "UTC"}, Adjustments: items, Pagination: usagePagination{Mode: "cursor", Limit: limit, NextCursor: nextCursor, HasMore: hasMore}, GeneratedAt: usageFormatTime(time.Now())})
}
