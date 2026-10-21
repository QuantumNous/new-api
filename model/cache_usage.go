package model

import (
	"context"
	"errors"
	"math"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// CacheUsageFilter scopes a cache statistic to a user or a model. Group filters
// follow the same visibility rules as the model square's performance metrics.
type CacheUsageFilter struct {
	UserID         int
	ModelName      string
	Group          string
	AllowedGroups  []string
	StartTimestamp int64
	EndTimestamp   int64
}

// cacheTokensFromLog normalizes existing usage logs without changing billing.
// OpenAI prompt tokens include cache reads/writes; Anthropic input excludes them.
func cacheTokensFromLog(promptTokens int64, rawOther string) (input, read float64, known bool) {
	var other struct {
		CacheTokens         *int64 `json:"cache_tokens"`
		InputTokensTotal    *int64 `json:"input_tokens_total"`
		CacheWriteTokens    int64  `json:"cache_write_tokens"`
		CacheCreationTokens int64  `json:"cache_creation_tokens"`
		CacheCreation5m     int64  `json:"cache_creation_tokens_5m"`
		CacheCreation1h     int64  `json:"cache_creation_tokens_1h"`
		Claude              bool   `json:"claude"`
		UsageSemantic       string `json:"usage_semantic"`
		AdminInfo           struct {
			UsageBillingPath string `json:"usage_billing_path"`
			LocalCountTokens bool   `json:"local_count_tokens"`
		} `json:"admin_info"`
	}
	if err := common.UnmarshalJsonStr(rawOther, &other); err != nil {
		return 0, 0, false
	}
	if other.AdminInfo.LocalCountTokens || other.AdminInfo.UsageBillingPath == "local" || strings.HasSuffix(other.AdminInfo.UsageBillingPath, "-estimated") {
		return 0, 0, false
	}
	if other.CacheTokens == nil {
		return 0, 0, promptTokens == 0
	}
	if promptTokens < 0 || *other.CacheTokens < 0 || other.CacheWriteTokens < 0 || other.CacheCreationTokens < 0 || other.CacheCreation5m < 0 || other.CacheCreation1h < 0 {
		return 0, 0, false
	}
	input, read = float64(promptTokens), float64(*other.CacheTokens)
	if other.InputTokensTotal != nil {
		input = float64(*other.InputTokensTotal)
	} else if other.UsageSemantic == "anthropic" || (other.UsageSemantic == "" && other.Claude) {
		// The split TTL counters describe the same writes as the total, so use
		// the largest available total rather than adding overlapping counters.
		writes := max(float64(other.CacheWriteTokens), float64(other.CacheCreationTokens), float64(other.CacheCreation5m)+float64(other.CacheCreation1h))
		input += read + writes
	}
	if input < 0 || read > input {
		return 0, 0, false
	}
	return input, read, true
}

// GetCacheHitRate weights cache reads by total input tokens, never by request
// count or output tokens. Streaming rows keeps the memory cost independent of
// traffic volume and avoids database-specific JSON operators. Existing logs
// are included immediately; no migration or historical backfill is needed.
func GetCacheHitRate(ctx context.Context, filter CacheUsageFilter) (rate *float64, err error) {
	if filter.UserID <= 0 && filter.ModelName == "" {
		return nil, common.NewMessage("Invalid parameters")
	}
	if filter.StartTimestamp <= 0 || filter.EndTimestamp < filter.StartTimestamp {
		return nil, common.NewMessage("Invalid parameters")
	}
	if filter.AllowedGroups != nil && len(filter.AllowedGroups) == 0 {
		return nil, nil
	}
	query := LOG_DB.WithContext(ctx).Model(&Log{}).
		Select("prompt_tokens, other").
		Where("type = ? AND created_at >= ? AND created_at <= ?", LogTypeConsume, filter.StartTimestamp, filter.EndTimestamp)
	if filter.UserID > 0 {
		query = query.Where("user_id = ?", filter.UserID)
	}
	if filter.ModelName != "" {
		query = query.Where("model_name = ?", filter.ModelName)
	}
	if filter.Group != "" {
		query = query.Where(logGroupCol+" = ?", filter.Group)
	}
	if filter.AllowedGroups != nil {
		query = query.Where(logGroupCol+" IN ?", filter.AllowedGroups)
	}
	rows, err := query.Rows()
	if err != nil {
		return nil, err
	}
	defer func() { err = errors.Join(err, rows.Close()) }()
	var totalInput, totalRead float64
	unknown := false
	for rows.Next() {
		var prompt int64
		var other string
		if err := rows.Scan(&prompt, &other); err != nil {
			return nil, err
		}
		input, read, known := cacheTokensFromLog(prompt, other)
		unknown = unknown || !known
		totalInput += input
		totalRead += read
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if unknown || totalInput <= 0 || math.IsInf(totalInput, 0) || math.IsInf(totalRead, 0) {
		return nil, nil
	}
	value := totalRead / totalInput * 100
	return &value, nil
}
