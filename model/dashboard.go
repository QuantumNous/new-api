package model

import (
	"database/sql"
	"math"

	"github.com/QuantumNous/new-api/common"
)

type DashboardModelUsage struct {
	Tokens             int64
	Quota              int64
	Requests           int64
	SuccessfulRequests int64
	TotalUseTime       int64
}

type DashboardDailyUsage struct {
	Quota             int64
	Requests          int64
	Tokens            int64
	InputTokens       int64
	OutputTokens      int64
	CacheReadTokens   int64
	CacheCreateTokens int64
}

type DashboardUsage struct {
	Tokens             int64
	Quota              int64
	Requests           int64
	SuccessfulRequests int64
	TotalUseTime       int64
	Models             map[string]*DashboardModelUsage
	HourlyRequests     [24]int64
	Daily              map[int64]*DashboardDailyUsage
}

// GetUserDashboardUsage aggregates request logs in Go so time bucketing has
// identical behavior on SQLite, MySQL, PostgreSQL, and the optional log store.
func GetUserDashboardUsage(userID int, startTimestamp, endTimestamp int64, timezoneOffsetMinutes int) (DashboardUsage, error) {
	usage := DashboardUsage{
		Models: make(map[string]*DashboardModelUsage),
		Daily:  make(map[int64]*DashboardDailyUsage),
	}
	rows, err := LOG_DB.Table("logs").
		Select("created_at, type, model_name, quota, prompt_tokens, completion_tokens, use_time, other").
		Where("user_id = ? AND type IN ? AND created_at >= ? AND created_at < ?", userID, []int{LogTypeConsume, LogTypeError}, startTimestamp, endTimestamp).
		Rows()
	if err != nil {
		return usage, err
	}
	defer rows.Close()

	offsetSeconds := int64(timezoneOffsetMinutes) * 60
	for rows.Next() {
		var createdAt int64
		var logType int
		var modelName string
		var quota, promptTokens, completionTokens, useTime int64
		var other sql.NullString
		if err := rows.Scan(&createdAt, &logType, &modelName, &quota, &promptTokens, &completionTokens, &useTime, &other); err != nil {
			return usage, err
		}

		localTimestamp := createdAt + offsetSeconds
		dayStart := localTimestamp - localTimestamp%86400
		hour := int(localTimestamp % 86400 / 3600)
		if hour < 0 || hour >= len(usage.HourlyRequests) {
			continue
		}

		usage.Requests++
		usage.HourlyRequests[hour]++
		day := usage.Daily[dayStart]
		if day == nil {
			day = &DashboardDailyUsage{}
			usage.Daily[dayStart] = day
		}
		day.Requests++

		modelUsage := usage.Models[modelName]
		if modelUsage == nil {
			modelUsage = &DashboardModelUsage{}
			usage.Models[modelName] = modelUsage
		}
		modelUsage.Requests++
		if logType != LogTypeConsume {
			continue
		}

		if quota < 0 {
			quota = 0
		}
		if promptTokens < 0 {
			promptTokens = 0
		}
		if completionTokens < 0 {
			completionTokens = 0
		}
		if useTime < 0 {
			useTime = 0
		}
		cacheReadTokens, cacheCreateTokens, inputTokens := dashboardTokenBreakdown(promptTokens, other.String)
		tokens := promptTokens + completionTokens
		usage.SuccessfulRequests++
		usage.Quota += quota
		usage.Tokens += tokens
		usage.TotalUseTime += useTime
		day.Quota += quota
		day.Tokens += tokens
		day.InputTokens += inputTokens
		day.OutputTokens += completionTokens
		day.CacheReadTokens += cacheReadTokens
		day.CacheCreateTokens += cacheCreateTokens
		modelUsage.SuccessfulRequests++
		modelUsage.Quota += quota
		modelUsage.Tokens += tokens
		modelUsage.TotalUseTime += useTime
	}
	if err := rows.Err(); err != nil {
		return usage, err
	}
	return usage, nil
}

func dashboardTokenBreakdown(promptTokens int64, other string) (cacheRead, cacheCreate, input int64) {
	input = promptTokens
	if other == "" {
		return 0, 0, input
	}

	metadata := make(map[string]interface{})
	if err := common.UnmarshalJsonStr(other, &metadata); err != nil {
		return 0, 0, input
	}

	cacheRead, _ = dashboardMetadataToken(metadata, "cache_tokens")
	if value, ok := dashboardMetadataToken(metadata, "cache_write_tokens"); ok {
		cacheCreate = value
	} else {
		cacheCreate5m, has5m := dashboardMetadataToken(metadata, "cache_creation_tokens_5m")
		cacheCreate1h, has1h := dashboardMetadataToken(metadata, "cache_creation_tokens_1h")
		if has5m || has1h {
			if cacheCreate5m > math.MaxInt64-cacheCreate1h {
				cacheCreate = math.MaxInt64
			} else {
				cacheCreate = cacheCreate5m + cacheCreate1h
			}
		} else {
			cacheCreate, _ = dashboardMetadataToken(metadata, "cache_creation_tokens")
		}
	}

	semantic, _ := metadata["usage_semantic"].(string)
	claude, _ := metadata["claude"].(bool)
	if semantic == "anthropic" || claude {
		return cacheRead, cacheCreate, input
	}
	if totalInput, ok := dashboardMetadataToken(metadata, "input_tokens_total"); ok {
		input = totalInput
	}
	if cacheRead >= input {
		input = 0
	} else {
		input -= cacheRead
	}
	if cacheCreate >= input {
		input = 0
	} else {
		input -= cacheCreate
	}
	return cacheRead, cacheCreate, input
}

func dashboardMetadataToken(metadata map[string]interface{}, key string) (int64, bool) {
	value, ok := metadata[key].(float64)
	if !ok || value < 0 || math.IsNaN(value) || math.IsInf(value, 0) || value > math.MaxInt64 {
		return 0, false
	}
	return int64(math.Round(value)), true
}
