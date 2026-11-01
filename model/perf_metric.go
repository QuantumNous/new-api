package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PerfMetric stores aggregated relay performance metrics for the model square.
type PerfMetric struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	ModelName      string `json:"model_name" gorm:"size:128;uniqueIndex:idx_perf_channel_model_group_bucket,priority:1"`
	Group          string `json:"group" gorm:"column:group;size:64;uniqueIndex:idx_perf_channel_model_group_bucket,priority:2"`
	// ChannelId 是产生该样本的渠道 ID。0 表示历史数据（改造前入库，无渠道归属）。
	ChannelId      int    `json:"channel_id" gorm:"index:idx_perf_channel;uniqueIndex:idx_perf_channel_model_group_bucket,priority:3"`
	BucketTs       int64  `json:"bucket_ts" gorm:"uniqueIndex:idx_perf_channel_model_group_bucket,priority:4;index:idx_perf_bucket_ts"`
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
			{Name: "channel_id"},
			{Name: "bucket_ts"},
		},
		DoUpdates: clause.Assignments(map[string]any{
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
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

type PerfMetricSummaryBucket struct {
	ModelName      string `json:"model_name"`
	BucketTs       int64  `json:"bucket_ts"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

func GetPerfMetricsSummaryAll(startTs int64, endTs int64, groups []string) ([]PerfMetricSummary, error) {
	var summaries []PerfMetricSummary
	query := DB.Model(&PerfMetric{}).
		Select("model_name, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
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

func GetPerfMetricsSummaryBucketsAll(startTs int64, endTs int64, groups []string) ([]PerfMetricSummaryBucket, error) {
	var summaries []PerfMetricSummaryBucket
	query := DB.Model(&PerfMetric{}).
		Select("model_name, bucket_ts, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return summaries, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("model_name, bucket_ts").
		Having("SUM(request_count) > 0").
		Order("bucket_ts ASC").
		Find(&summaries).Error
	return summaries, err
}

// GetRecentPerfMetricSuccessBuckets reads the latest nonempty hours within
// the supplied history window, independently of the summary's reporting window.
func GetRecentPerfMetricSuccessBuckets(modelName string, startTs int64, endTs int64, groups []string, limit int) ([]PerfMetricSummaryBucket, error) {
	if modelName == "" || limit <= 0 || (groups != nil && len(groups) == 0) {
		return nil, nil
	}
	const hourBucket = "bucket_ts - (bucket_ts % 3600)"
	query := DB.Model(&PerfMetric{}).
		Select("model_name, "+hourBucket+" AS bucket_ts, SUM(request_count) AS request_count, SUM(success_count) AS success_count").
		Where("model_name = ? AND bucket_ts >= ? AND bucket_ts <= ? AND request_count > 0", modelName, startTs, endTs)
	if groups != nil {
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	var buckets []PerfMetricSummaryBucket
	err := query.Group("model_name, " + hourBucket).
		Order("bucket_ts DESC").Limit(limit).Find(&buckets).Error
	return buckets, err
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

// PerfMetricChannelSummary 是某个渠道在窗口内的聚合结果。
type PerfMetricChannelSummary struct {
	ChannelId    int   `json:"channel_id"`
	RequestCount int64 `json:"request_count"`
	SuccessCount int64 `json:"success_count"`
}

// PerfMetricsTrustedSince 是 perf 采样数据可采信的最早时间戳（Unix）。
//
// 2026-11-01 00:00 (CST) 之前的样本来自旧采样 bug：success_count 恒为 0
// 或严重偏低（实测 claude 系列 10-26~10-31 成功率 22.8%，而修复后为 91.5%）。
// 这些数据会把真实成功率拉低到失真程度，按渠道统计时必须排除。
const PerfMetricsTrustedSince int64 = 1793462400 // 2026-11-01 00:00:00 +08:00

// GetPerfMetricsByChannel 按渠道聚合窗口内的真实请求与成功数。
//
// 排除两类数据：
//   - channel_id = 0：改造前入库、无渠道归属的历史数据，避免重复计数
//   - 早于 PerfMetricsTrustedSince：旧采样 bug 产生的失真数据
func GetPerfMetricsByChannel(startTs int64, endTs int64) ([]PerfMetricChannelSummary, error) {
	var rows []PerfMetricChannelSummary
	if startTs < PerfMetricsTrustedSince {
		startTs = PerfMetricsTrustedSince
	}
	err := DB.Model(&PerfMetric{}).
		Select("channel_id, SUM(request_count) as request_count, SUM(success_count) as success_count").
		Where("bucket_ts >= ? AND bucket_ts <= ? AND channel_id > 0", startTs, endTs).
		Group("channel_id").
		Having("SUM(request_count) > 0").
		Find(&rows).Error
	return rows, err
}

// GetPerfMetricsSummaryAllTrusted 是按模型聚合的可信版本：
// 同样排除旧采样 bug 时段的数据，供 monitor 降级路径与其它展示使用。
func GetPerfMetricsSummaryAllTrusted(startTs int64, endTs int64) ([]PerfMetricSummary, error) {
	if startTs < PerfMetricsTrustedSince {
		startTs = PerfMetricsTrustedSince
	}
	return GetPerfMetricsSummaryAll(startTs, endTs, nil)
}

// PerfMetricsChannelDataStart 返回该渠道最早一条样本的时间戳，用于判断历史深度。
func PerfMetricsChannelDataStart(channelId int) (int64, error) {
	var ts int64
	err := DB.Model(&PerfMetric{}).
		Select("COALESCE(MIN(bucket_ts), 0)").
		Where("channel_id = ?", channelId).
		Scan(&ts).Error
	return ts, err
}

// migratePerfMetricDropLegacyIndex 在 AutoMigrate 之前删除旧的唯一索引。
//
// 旧索引 idx_perf_model_group_bucket 是 (model_name, group, bucket_ts) 上的
// UNIQUE 约束，加上渠道维度后，同一模型/组在不同渠道的同一小时会撞唯一约束
// 导致写入失败。GORM AutoMigrate 不会自动删除不再引用的索引，必须显式删。
//
// 该函数幂等，可重复执行。
func migratePerfMetricDropLegacyIndex(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	migrator := db.Migrator()
	if !migrator.HasTable(&PerfMetric{}) {
		return nil
	}
	if migrator.HasIndex(&PerfMetric{}, "idx_perf_model_group_bucket") {
		if err := migrator.DropIndex(&PerfMetric{}, "idx_perf_model_group_bucket"); err != nil {
			return err
		}
		common.SysLog("perf_metrics: dropped legacy unique index idx_perf_model_group_bucket")
	}
	return nil
}

// migratePerfMetricBackfillChannel 在 AutoMigrate 之后把历史行的 channel_id 置 0。
//
// 必须在 AutoMigrate 之后调用：新增列在此之前并不存在。
// channel_id = 0 的语义是「无渠道归属的历史数据」，按渠道统计时会被排除，
// 避免与改造后按渠道采集的新数据重复计数。
//
// 该函数幂等，可重复执行。
func migratePerfMetricBackfillChannel(db *gorm.DB) error {
	if db == nil {
		return nil
	}
	migrator := db.Migrator()
	if !migrator.HasTable(&PerfMetric{}) || !migrator.HasColumn(&PerfMetric{}, "channel_id") {
		return nil
	}
	result := db.Model(&PerfMetric{}).
		Where("channel_id IS NULL").
		Update("channel_id", 0)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		common.SysLog(common.LogText("perf_metrics: backfilled %d legacy rows with channel_id=0", result.RowsAffected))
	}
	return nil
}
