package model

import (
	"context"
	"math"
	"sort"

	"github.com/QuantumNous/new-api/common"
)

type ChannelMonitorPerformanceMetric struct {
	ChannelId             int      `json:"channel_id"`
	ModelName             string   `json:"model_name"`
	SampleCount           int      `json:"sample_count"`
	FirstTokenSampleCount int      `json:"first_token_sample_count"`
	TPSSampleCount        int      `json:"tps_sample_count"`
	AverageFirstTokenMs   *float64 `json:"average_first_token_ms"`
	AverageTPS            *float64 `json:"average_tps"`
	LatestFirstTokenMs    *float64 `json:"latest_first_token_ms"`
	LatestTPS             *float64 `json:"latest_tps"`
	LastUsedTime          int64    `json:"last_used_time"`
}

type ChannelMonitorStabilityMetric struct {
	ChannelId    int     `json:"channel_id"`
	ModelName    string  `json:"model_name"`
	SuccessCount int64   `json:"success_count"`
	FailureCount int64   `json:"failure_count"`
	SampleCount  int64   `json:"sample_count"`
	SuccessRate  float64 `json:"success_rate"`
}

type channelMonitorPerformanceLog struct {
	ChannelId        int
	ModelName        string
	CompletionTokens int
	UseTime          int
	Other            string
	CreatedAt        int64
}

type channelMonitorPerformanceLogOther struct {
	FirstResponseTime *float64 `json:"frt"`
}

type channelMonitorPerformanceAggregate struct {
	channelId             int
	modelName             string
	sampleCount           int
	firstTokenSampleCount int
	tpsSampleCount        int
	firstTokenTotalMs     float64
	tpsTotal              float64
	latestFirstTokenMs    float64
	latestTPS             float64
	hasLatestFirstToken   bool
	hasLatestTPS          bool
	lastUsedTime          int64
}

// GetChannelMonitorPerformanceMetrics aggregates the same per-request timing
// values shown by usage logs: other.frt and completion_tokens / use_time.
func GetChannelMonitorPerformanceMetrics(ctx context.Context, startTimestamp int64) ([]ChannelMonitorPerformanceMetric, error) {
	rows, err := LOG_DB.WithContext(ctx).
		Model(&Log{}).
		Select("channel_id, model_name, completion_tokens, use_time, other, created_at").
		Where("type = ?", LogTypeConsume).
		Where("is_stream = ?", true).
		Where("channel_id > ?", 0).
		Where("model_name <> ?", "").
		Where("created_at >= ?", startTimestamp).
		Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type performanceKey struct {
		channelId int
		modelName string
	}
	aggregates := make(map[performanceKey]*channelMonitorPerformanceAggregate)
	for rows.Next() {
		var log channelMonitorPerformanceLog
		if err := rows.Scan(
			&log.ChannelId,
			&log.ModelName,
			&log.CompletionTokens,
			&log.UseTime,
			&log.Other,
			&log.CreatedAt,
		); err != nil {
			return nil, err
		}

		var firstTokenMs *float64
		if log.Other != "" {
			var other channelMonitorPerformanceLogOther
			if err := common.UnmarshalJsonStr(log.Other, &other); err == nil &&
				other.FirstResponseTime != nil &&
				*other.FirstResponseTime > 0 &&
				!math.IsNaN(*other.FirstResponseTime) &&
				!math.IsInf(*other.FirstResponseTime, 0) {
				firstTokenMs = other.FirstResponseTime
			}
		}

		var tps *float64
		if log.UseTime > 0 && log.CompletionTokens > 0 {
			value := float64(log.CompletionTokens) / float64(log.UseTime)
			if !math.IsNaN(value) && !math.IsInf(value, 0) {
				tps = &value
			}
		}
		if firstTokenMs == nil && tps == nil {
			continue
		}

		key := performanceKey{channelId: log.ChannelId, modelName: log.ModelName}
		aggregate, exists := aggregates[key]
		if !exists {
			aggregate = &channelMonitorPerformanceAggregate{
				channelId: log.ChannelId,
				modelName: log.ModelName,
			}
			aggregates[key] = aggregate
		}
		aggregate.sampleCount++
		if firstTokenMs != nil {
			aggregate.firstTokenSampleCount++
			aggregate.firstTokenTotalMs += *firstTokenMs
		}
		if tps != nil {
			aggregate.tpsSampleCount++
			aggregate.tpsTotal += *tps
		}
		if log.CreatedAt >= aggregate.lastUsedTime {
			aggregate.lastUsedTime = log.CreatedAt
			aggregate.hasLatestFirstToken = firstTokenMs != nil
			aggregate.hasLatestTPS = tps != nil
			if firstTokenMs != nil {
				aggregate.latestFirstTokenMs = *firstTokenMs
			}
			if tps != nil {
				aggregate.latestTPS = *tps
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	metrics := make([]ChannelMonitorPerformanceMetric, 0, len(aggregates))
	for _, aggregate := range aggregates {
		metric := ChannelMonitorPerformanceMetric{
			ChannelId:             aggregate.channelId,
			ModelName:             aggregate.modelName,
			SampleCount:           aggregate.sampleCount,
			FirstTokenSampleCount: aggregate.firstTokenSampleCount,
			TPSSampleCount:        aggregate.tpsSampleCount,
			LastUsedTime:          aggregate.lastUsedTime,
		}
		if aggregate.firstTokenSampleCount > 0 {
			value := aggregate.firstTokenTotalMs / float64(aggregate.firstTokenSampleCount)
			metric.AverageFirstTokenMs = &value
		}
		if aggregate.tpsSampleCount > 0 {
			value := aggregate.tpsTotal / float64(aggregate.tpsSampleCount)
			metric.AverageTPS = &value
		}
		if aggregate.hasLatestFirstToken {
			value := aggregate.latestFirstTokenMs
			metric.LatestFirstTokenMs = &value
		}
		if aggregate.hasLatestTPS {
			value := aggregate.latestTPS
			metric.LatestTPS = &value
		}
		metrics = append(metrics, metric)
	}
	sort.Slice(metrics, func(i int, j int) bool {
		if metrics[i].ModelName == metrics[j].ModelName {
			return metrics[i].ChannelId < metrics[j].ChannelId
		}
		return metrics[i].ModelName < metrics[j].ModelName
	})
	return metrics, nil
}

// GetChannelMonitorStabilityMetrics measures upstream attempt stability from
// successful consume logs and error logs. Retry-attempt errors are included so
// a channel failure is still counted when a later fallback channel succeeds.
func GetChannelMonitorStabilityMetrics(ctx context.Context, startTimestamp int64) ([]ChannelMonitorStabilityMetric, error) {
	type stabilityRow struct {
		ChannelId int
		ModelName string
		Type      int
		Count     int64
	}
	var rows []stabilityRow
	err := LOG_DB.WithContext(ctx).
		Model(&Log{}).
		Select("channel_id, model_name, type, COUNT(*) AS count").
		Where("type IN ?", []int{LogTypeConsume, LogTypeError}).
		Where("channel_id > ?", 0).
		Where("created_at >= ?", startTimestamp).
		Group("channel_id, model_name, type").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	type stabilityKey struct {
		channelId int
		modelName string
	}
	aggregates := make(map[stabilityKey]*ChannelMonitorStabilityMetric)
	for _, row := range rows {
		key := stabilityKey{channelId: row.ChannelId, modelName: row.ModelName}
		metric := aggregates[key]
		if metric == nil {
			metric = &ChannelMonitorStabilityMetric{
				ChannelId: row.ChannelId,
				ModelName: row.ModelName,
			}
			aggregates[key] = metric
		}
		if row.Type == LogTypeConsume {
			metric.SuccessCount += row.Count
		} else {
			metric.FailureCount += row.Count
		}
	}

	metrics := make([]ChannelMonitorStabilityMetric, 0, len(aggregates))
	for _, metric := range aggregates {
		metric.SampleCount = metric.SuccessCount + metric.FailureCount
		if metric.SampleCount > 0 {
			metric.SuccessRate = float64(metric.SuccessCount) / float64(metric.SampleCount)
		}
		metrics = append(metrics, *metric)
	}
	sort.Slice(metrics, func(i int, j int) bool {
		if metrics[i].ModelName == metrics[j].ModelName {
			return metrics[i].ChannelId < metrics[j].ChannelId
		}
		return metrics[i].ModelName < metrics[j].ModelName
	})
	return metrics, nil
}
