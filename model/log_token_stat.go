package model

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	tokenStatsDefaultRangeSeconds = 24 * 60 * 60
	tokenStatsMaxRangeSeconds     = 30 * 24 * 60 * 60
)

// TokenQuotaData is hourly aggregated usage data by API key.
type TokenQuotaData struct {
	TokenId   int    `json:"token_id"`
	TokenName string `json:"token_name"`
	CreatedAt int64  `json:"created_at"`
	Count     int    `json:"count"`
	Quota     int    `json:"quota"`
	TokenUsed int    `json:"token_used"`
}

// GetLogStatsByToken aggregates consume logs by API key and hour.
// userId = 0 returns all users' data; userId > 0 limits data to that user.
func GetLogStatsByToken(userId int, startTime, endTime int64) ([]*TokenQuotaData, error) {
	var results []*TokenQuotaData

	startTime, endTime, err := normalizeTokenStatsTimeRange(startTime, endTime, time.Now().Unix())
	if err != nil {
		return nil, err
	}

	query := LOG_DB.Table("logs").
		Select(`token_id,
			token_name,
			(created_at - created_at % 3600) AS created_at,
			COUNT(*) AS count,
			COALESCE(SUM(quota), 0) AS quota,
			COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) AS token_used`).
		Where("type = ?", LogTypeConsume).
		Where("token_id != 0").
		Where("token_name != ''").
		Group("token_id, token_name, (created_at - created_at % 3600)").
		Order("(created_at - created_at % 3600)")

	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	}
	if startTime != 0 {
		query = query.Where("created_at >= ?", startTime)
	}
	if endTime != 0 {
		query = query.Where("created_at <= ?", endTime)
	}

	if err := query.Scan(&results).Error; err != nil {
		common.SysError("failed to query token quota data: " + err.Error())
		return nil, err
	}
	return results, nil
}

func normalizeTokenStatsTimeRange(startTime, endTime, now int64) (int64, int64, error) {
	if startTime == 0 && endTime == 0 {
		endTime = now
		startTime = endTime - tokenStatsDefaultRangeSeconds
	} else if endTime == 0 {
		endTime = now
	} else if startTime == 0 {
		startTime = endTime - tokenStatsMaxRangeSeconds
	}

	if endTime < startTime {
		return 0, 0, fmt.Errorf("invalid time range: end_timestamp < start_timestamp")
	}
	if endTime-startTime > tokenStatsMaxRangeSeconds {
		startTime = endTime - tokenStatsMaxRangeSeconds
	}
	return startTime, endTime, nil
}
