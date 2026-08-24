package model

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PerfMetric stores aggregated relay performance metrics for the model square.
type PerfMetric struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	ModelName      string `json:"model_name" gorm:"size:128;uniqueIndex:idx_perf_model_group_bucket,priority:1"`
	Group          string `json:"group" gorm:"column:group;size:64;uniqueIndex:idx_perf_model_group_bucket,priority:2"`
	BucketTs       int64  `json:"bucket_ts" gorm:"uniqueIndex:idx_perf_model_group_bucket,priority:3;index:idx_perf_bucket_ts"`
	RequestCount   int64  `json:"-" gorm:"default:0"`
	SuccessCount   int64  `json:"-" gorm:"default:0"`
	TotalLatencyMs int64  `json:"-" gorm:"default:0"`
	TtftSumMs      int64  `json:"-" gorm:"default:0"`
	TtftCount      int64  `json:"-" gorm:"default:0"`
	OutputTokens   int64  `json:"-" gorm:"default:0"`
	GenerationMs   int64  `json:"-" gorm:"default:0"`
}

func (PerfMetric) TableName() string {
	return "perf_metrics"
}

func UpsertPerfMetric(metric *PerfMetric) error {
	if metric == nil || metric.RequestCount == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "model_name"},
			{Name: "group"},
			{Name: "bucket_ts"},
		},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"request_count":    gorm.Expr("perf_metrics.request_count + ?", metric.RequestCount),
			"success_count":    gorm.Expr("perf_metrics.success_count + ?", metric.SuccessCount),
			"total_latency_ms": gorm.Expr("perf_metrics.total_latency_ms + ?", metric.TotalLatencyMs),
			"ttft_sum_ms":      gorm.Expr("perf_metrics.ttft_sum_ms + ?", metric.TtftSumMs),
			"ttft_count":       gorm.Expr("perf_metrics.ttft_count + ?", metric.TtftCount),
			"output_tokens":    gorm.Expr("perf_metrics.output_tokens + ?", metric.OutputTokens),
			"generation_ms":    gorm.Expr("perf_metrics.generation_ms + ?", metric.GenerationMs),
		}),
	}).Create(metric).Error
}

func GetPerfMetrics(modelName string, group string, startTs int64, endTs int64) ([]PerfMetric, error) {
	ensurePerfMetricColumnsInitialized()

	var metrics []PerfMetric
	query := DB.Model(&PerfMetric{}).
		Where("model_name = ? AND bucket_ts >= ? AND bucket_ts <= ?", modelName, startTs, endTs)
	if group != "" {
		query = query.Where(commonGroupCol+" = ?", group)
	}
	err := query.Order("bucket_ts ASC").Find(&metrics).Error
	return metrics, err
}

type PerfMetricSummary struct {
	ModelName      string `json:"model_name"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	TtftSumMs      int64  `json:"ttft_sum_ms"`
	TtftCount      int64  `json:"ttft_count"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

// ModelHealthAggregate contains persisted counter sums used by the model
// health APIs. FirstBucketTs and LastBucketTs are bucket start timestamps.
type ModelHealthAggregate struct {
	ModelName      string `json:"model_name"`
	GroupName      string `json:"group"`
	BucketTs       int64  `json:"bucket_ts"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	TtftSumMs      int64  `json:"ttft_sum_ms"`
	TtftCount      int64  `json:"ttft_count"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
	FirstBucketTs  int64  `json:"first_bucket_ts"`
	LastBucketTs   int64  `json:"last_bucket_ts"`
}

// GetModelHealthSummaries returns one database-aggregated row per model. The
// cutoff is exclusive so callers can omit buckets that may still be flushing.
func GetModelHealthSummaries(startTs int64, cutoffTs int64) ([]ModelHealthAggregate, error) {
	var summaries []ModelHealthAggregate
	err := DB.Model(&PerfMetric{}).
		Select("model_name, SUM(request_count) AS request_count, SUM(success_count) AS success_count, SUM(total_latency_ms) AS total_latency_ms, SUM(ttft_sum_ms) AS ttft_sum_ms, SUM(ttft_count) AS ttft_count, SUM(output_tokens) AS output_tokens, SUM(generation_ms) AS generation_ms, MIN(bucket_ts) AS first_bucket_ts, MAX(bucket_ts) AS last_bucket_ts").
		Where("bucket_ts >= ? AND bucket_ts < ?", startTs, cutoffTs).
		Group("model_name").
		Having("SUM(request_count) > 0").
		Find(&summaries).Error
	return summaries, err
}

// GetModelHealthSeries returns persisted counters aggregated across groups for
// each bucket of a single model. The cutoff is exclusive.
func GetModelHealthSeries(modelName string, startTs int64, cutoffTs int64) ([]ModelHealthAggregate, error) {
	var series []ModelHealthAggregate
	err := DB.Model(&PerfMetric{}).
		Select("bucket_ts, SUM(request_count) AS request_count, SUM(success_count) AS success_count, SUM(total_latency_ms) AS total_latency_ms, SUM(ttft_sum_ms) AS ttft_sum_ms, SUM(ttft_count) AS ttft_count, SUM(output_tokens) AS output_tokens, SUM(generation_ms) AS generation_ms").
		Where("model_name = ? AND bucket_ts >= ? AND bucket_ts < ?", modelName, startTs, cutoffTs).
		Group("bucket_ts").
		Having("SUM(request_count) > 0").
		Order("bucket_ts ASC").
		Find(&series).Error
	return series, err
}

// GetModelHealthGroups returns persisted counters aggregated across the whole
// requested window for each group of a single model. The cutoff is exclusive.
func GetModelHealthGroups(modelName string, startTs int64, cutoffTs int64) ([]ModelHealthAggregate, error) {
	ensurePerfMetricColumnsInitialized()

	var groups []ModelHealthAggregate
	groupSelection := commonGroupCol + " AS group_name"
	err := DB.Model(&PerfMetric{}).
		Select(groupSelection+", SUM(request_count) AS request_count, SUM(success_count) AS success_count, SUM(total_latency_ms) AS total_latency_ms, SUM(ttft_sum_ms) AS ttft_sum_ms, SUM(ttft_count) AS ttft_count, SUM(output_tokens) AS output_tokens, SUM(generation_ms) AS generation_ms").
		Where("model_name = ? AND bucket_ts >= ? AND bucket_ts < ?", modelName, startTs, cutoffTs).
		Group("group").
		Having("SUM(request_count) > 0").
		Order(commonGroupCol + " ASC").
		Find(&groups).Error
	return groups, err
}

func GetPerfMetricsSummaryAll(startTs int64, endTs int64, groups []string) ([]PerfMetricSummary, error) {
	ensurePerfMetricColumnsInitialized()

	var summaries []PerfMetricSummary
	query := DB.Model(&PerfMetric{}).
		Select("model_name, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(ttft_sum_ms) as ttft_sum_ms, SUM(ttft_count) as ttft_count, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return summaries, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("model_name").
		Having("SUM(request_count) > 0").
		Find(&summaries).Error
	return summaries, err
}

func ensurePerfMetricColumnsInitialized() {
	if commonGroupCol == "" {
		initCol()
	}
}

func DeletePerfMetricsBefore(cutoffTs int64) error {
	if cutoffTs <= 0 {
		return nil
	}
	return DB.Where("bucket_ts < ?", cutoffTs).Delete(&PerfMetric{}).Error
}

func PerfMetricStartTime(hours int) int64 {
	if hours <= 0 {
		hours = 24
	}
	return time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
}
