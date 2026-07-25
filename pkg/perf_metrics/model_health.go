package perfmetrics

import (
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

const (
	maxDetailSeriesPoints = int64(720)

	ModelHealthMinimumRequests = int64(20)
	ModelHealthHealthyRate     = 99.9
	ModelHealthWatchRate       = 99.0

	ModelHealthDataQualityMode = "best_effort_persisted"

	ModelHealthCaveatClientDisconnects = "client_disconnects_counted_as_failures"
	ModelHealthCaveatUnflushedNodeData = "unflushed_node_data_undetectable"
)

var ErrInvalidModelHealthHours = errors.New("hours must be one of 24, 168, or 720")
var ErrModelHealthModelRequired = errors.New("model is required")

type ModelHealthState string

const (
	ModelHealthInsufficient ModelHealthState = "insufficient"
	ModelHealthHealthy      ModelHealthState = "healthy"
	ModelHealthWatch        ModelHealthState = "watch"
	ModelHealthDegraded     ModelHealthState = "degraded"
)

type ModelHealthCaveat struct {
	Code        string `json:"code"`
	Description string `json:"description"`
}

type ModelHealthDataQuality struct {
	Mode                   string              `json:"mode"`
	CompletenessGuaranteed bool                `json:"completeness_guaranteed"`
	Caveats                []ModelHealthCaveat `json:"caveats"`
}

type ModelHealthPolicy struct {
	MinimumRequests       int64   `json:"minimum_requests"`
	HealthySuccessRatePct float64 `json:"healthy_success_rate_pct"`
	WatchSuccessRatePct   float64 `json:"watch_success_rate_pct"`
}

type ModelHealthMetadata struct {
	CollectionEnabled bool                   `json:"collection_enabled"`
	RetentionDays     int                    `json:"retention_days"`
	RequestedHours    int                    `json:"requested_hours"`
	BucketSeconds     int64                  `json:"bucket_seconds"`
	WindowStart       int64                  `json:"window_start"`
	DataCutoff        int64                  `json:"data_cutoff"`
	FirstObservedAt   *int64                 `json:"first_observed_at"`
	LastObservedAt    *int64                 `json:"last_observed_at"`
	GeneratedAt       int64                  `json:"generated_at"`
	HealthPolicy      ModelHealthPolicy      `json:"health_policy"`
	DataQuality       ModelHealthDataQuality `json:"data_quality"`
}

type ModelHealthModel struct {
	ModelName       string           `json:"model_name"`
	Health          ModelHealthState `json:"health"`
	RequestCount    int64            `json:"request_count"`
	SuccessCount    int64            `json:"success_count"`
	SuccessRate     float64          `json:"success_rate"`
	AvgLatencyMs    float64          `json:"avg_latency_ms"`
	AvgTtftMs       *float64         `json:"avg_ttft_ms"`
	AvgTps          *float64         `json:"avg_tps"`
	FirstObservedAt *int64           `json:"first_observed_at"`
	LastObservedAt  *int64           `json:"last_observed_at"`
}

type ModelHealthFleetSummary struct {
	ModelCount                int     `json:"model_count"`
	SufficientlySampledModels int     `json:"sufficiently_sampled_models"`
	HealthyModels             int     `json:"healthy_models"`
	WatchModels               int     `json:"watch_models"`
	DegradedModels            int     `json:"degraded_models"`
	InsufficientModels        int     `json:"insufficient_models"`
	RequestCount              int64   `json:"request_count"`
	SuccessCount              int64   `json:"success_count"`
	SuccessRate               float64 `json:"success_rate"`
}

type ModelHealthOverview struct {
	ModelHealthMetadata
	Fleet  ModelHealthFleetSummary `json:"fleet"`
	Models []ModelHealthModel      `json:"models"`
}

type ModelHealthSeriesPoint struct {
	Ts           int64            `json:"ts"`
	Health       ModelHealthState `json:"health"`
	RequestCount int64            `json:"request_count"`
	SuccessCount int64            `json:"success_count"`
	SuccessRate  float64          `json:"success_rate"`
	AvgLatencyMs float64          `json:"avg_latency_ms"`
	AvgTtftMs    *float64         `json:"avg_ttft_ms"`
	AvgTps       *float64         `json:"avg_tps"`
}

type ModelHealthGroup struct {
	Group        string           `json:"group"`
	Health       ModelHealthState `json:"health"`
	RequestCount int64            `json:"request_count"`
	SuccessCount int64            `json:"success_count"`
	SuccessRate  float64          `json:"success_rate"`
	AvgLatencyMs float64          `json:"avg_latency_ms"`
	AvgTtftMs    *float64         `json:"avg_ttft_ms"`
	AvgTps       *float64         `json:"avg_tps"`
}

type ModelHealthDetail struct {
	ModelHealthMetadata
	Model  ModelHealthModel         `json:"model"`
	Series []ModelHealthSeriesPoint `json:"series"`
	Groups []ModelHealthGroup       `json:"groups"`
}

func ValidateModelHealthHours(hours int) error {
	switch hours {
	case 24, 168, 720:
		return nil
	default:
		return ErrInvalidModelHealthHours
	}
}

// ModelHealthDataCutoff returns the start of the first excluded bucket. A
// bucket is eligible only after its end has had one flush interval plus the
// fixed grace period to reach the shared database.
func ModelHealthDataCutoff(nowUnix int64, bucketSeconds int64, flushIntervalMinutes int) int64 {
	if bucketSeconds <= 0 {
		bucketSeconds = 3600
	}
	if flushIntervalMinutes < 1 {
		flushIntervalMinutes = 1
	}
	safeBefore := nowUnix - int64(flushIntervalMinutes)*60 - 60
	return safeBefore - safeBefore%bucketSeconds
}

func ClassifyModelHealth(requestCount int64, successRate float64) ModelHealthState {
	if requestCount < ModelHealthMinimumRequests {
		return ModelHealthInsufficient
	}
	if successRate >= ModelHealthHealthyRate {
		return ModelHealthHealthy
	}
	if successRate >= ModelHealthWatchRate {
		return ModelHealthWatch
	}
	return ModelHealthDegraded
}

func GetModelHealthOverview(hours int) (ModelHealthOverview, error) {
	if err := ValidateModelHealthHours(hours); err != nil {
		return ModelHealthOverview{}, err
	}

	now := time.Now().Unix()
	setting := perf_metrics_setting.GetSetting()
	bucketSeconds := modelHealthBucketSeconds(setting.BucketTime)
	cutoff := ModelHealthDataCutoff(now, bucketSeconds, setting.FlushInterval)
	start := cutoff - int64(hours)*3600
	rows, err := model.GetModelHealthSummaries(start, cutoff)
	if err != nil {
		return ModelHealthOverview{}, err
	}

	models := make([]ModelHealthModel, 0, len(rows))
	fleet := ModelHealthFleetSummary{ModelCount: len(rows)}
	var firstObserved *int64
	var lastObserved *int64
	for _, row := range rows {
		item := buildModelHealthModel(row.ModelName, row)
		models = append(models, item)
		fleet.RequestCount += row.RequestCount
		fleet.SuccessCount += row.SuccessCount
		switch item.Health {
		case ModelHealthHealthy:
			fleet.HealthyModels++
			fleet.SufficientlySampledModels++
		case ModelHealthWatch:
			fleet.WatchModels++
			fleet.SufficientlySampledModels++
		case ModelHealthDegraded:
			fleet.DegradedModels++
			fleet.SufficientlySampledModels++
		case ModelHealthInsufficient:
			fleet.InsufficientModels++
		}
		updateObservedBounds(&firstObserved, &lastObserved, row.FirstBucketTs, row.LastBucketTs)
	}
	if fleet.RequestCount > 0 {
		fleet.SuccessRate = percentage(fleet.SuccessCount, fleet.RequestCount)
	}
	sort.Slice(models, func(i, j int) bool {
		leftPriority := modelHealthSortPriority(models[i].Health)
		rightPriority := modelHealthSortPriority(models[j].Health)
		if leftPriority != rightPriority {
			return leftPriority < rightPriority
		}
		if models[i].RequestCount != models[j].RequestCount {
			return models[i].RequestCount > models[j].RequestCount
		}
		return models[i].ModelName < models[j].ModelName
	})

	return ModelHealthOverview{
		ModelHealthMetadata: buildModelHealthMetadata(now, hours, setting, bucketSeconds, start, cutoff, firstObserved, lastObserved),
		Fleet:               fleet,
		Models:              models,
	}, nil
}

func GetModelHealthDetail(modelName string, hours int) (ModelHealthDetail, error) {
	modelName = strings.TrimSpace(modelName)
	if modelName == "" {
		return ModelHealthDetail{}, ErrModelHealthModelRequired
	}
	if err := ValidateModelHealthHours(hours); err != nil {
		return ModelHealthDetail{}, err
	}

	now := time.Now().Unix()
	setting := perf_metrics_setting.GetSetting()
	bucketSeconds := modelHealthBucketSeconds(setting.BucketTime)
	cutoff := ModelHealthDataCutoff(now, bucketSeconds, setting.FlushInterval)
	start := cutoff - int64(hours)*3600
	seriesRows, err := model.GetModelHealthSeries(modelName, start, cutoff)
	if err != nil {
		return ModelHealthDetail{}, err
	}
	groupRows, err := model.GetModelHealthGroups(modelName, start, cutoff)
	if err != nil {
		return ModelHealthDetail{}, err
	}

	rolledSeries := rollupModelHealthSeries(seriesRows, start, int64(hours)*3600, bucketSeconds)
	total := model.ModelHealthAggregate{ModelName: modelName}
	var firstObserved *int64
	var lastObserved *int64
	for _, row := range seriesRows {
		addModelHealthCounters(&total, row)
		updateObservedBounds(&firstObserved, &lastObserved, row.BucketTs, row.BucketTs)
	}
	if firstObserved != nil {
		total.FirstBucketTs = *firstObserved
		total.LastBucketTs = *lastObserved
	}

	series := make([]ModelHealthSeriesPoint, 0, len(rolledSeries))
	for _, row := range rolledSeries {
		metrics := calculateModelHealthMetrics(row)
		series = append(series, ModelHealthSeriesPoint{
			Ts:           row.BucketTs,
			Health:       ClassifyModelHealth(row.RequestCount, metrics.successRate),
			RequestCount: row.RequestCount,
			SuccessCount: row.SuccessCount,
			SuccessRate:  metrics.successRate,
			AvgLatencyMs: metrics.avgLatencyMs,
			AvgTtftMs:    metrics.avgTtftMs,
			AvgTps:       metrics.avgTps,
		})
	}

	groups := make([]ModelHealthGroup, 0, len(groupRows))
	for _, row := range groupRows {
		metrics := calculateModelHealthMetrics(row)
		groups = append(groups, ModelHealthGroup{
			Group:        row.GroupName,
			Health:       ClassifyModelHealth(row.RequestCount, metrics.successRate),
			RequestCount: row.RequestCount,
			SuccessCount: row.SuccessCount,
			SuccessRate:  metrics.successRate,
			AvgLatencyMs: metrics.avgLatencyMs,
			AvgTtftMs:    metrics.avgTtftMs,
			AvgTps:       metrics.avgTps,
		})
	}

	return ModelHealthDetail{
		ModelHealthMetadata: buildModelHealthMetadata(now, hours, setting, bucketSeconds, start, cutoff, firstObserved, lastObserved),
		Model:               buildModelHealthModel(modelName, total),
		Series:              series,
		Groups:              groups,
	}, nil
}

func rollupModelHealthSeries(rows []model.ModelHealthAggregate, windowStart int64, windowSeconds int64, bucketSeconds int64) []model.ModelHealthAggregate {
	rollupSeconds := modelHealthDetailRollupSeconds(windowSeconds, bucketSeconds)
	byRollup := make(map[int64]model.ModelHealthAggregate, maxDetailSeriesPoints)
	for _, row := range rows {
		rollupTs := windowStart + ((row.BucketTs - windowStart) / rollupSeconds * rollupSeconds)
		rolled := byRollup[rollupTs]
		rolled.BucketTs = rollupTs
		addModelHealthCounters(&rolled, row)
		byRollup[rollupTs] = rolled
	}

	timestamps := make([]int64, 0, len(byRollup))
	for ts := range byRollup {
		timestamps = append(timestamps, ts)
	}
	sort.Slice(timestamps, func(i, j int) bool { return timestamps[i] < timestamps[j] })
	rolled := make([]model.ModelHealthAggregate, 0, len(timestamps))
	for _, ts := range timestamps {
		rolled = append(rolled, byRollup[ts])
	}
	return rolled
}

func modelHealthDetailRollupSeconds(windowSeconds int64, bucketSeconds int64) int64 {
	if bucketSeconds <= 0 {
		bucketSeconds = 3600
	}
	windowBuckets := (windowSeconds + bucketSeconds - 1) / bucketSeconds
	if windowBuckets < 1 {
		windowBuckets = 1
	}
	factor := 1 + (windowBuckets-1)/maxDetailSeriesPoints
	return factor * bucketSeconds
}

type modelHealthMetrics struct {
	successRate  float64
	avgLatencyMs float64
	avgTtftMs    *float64
	avgTps       *float64
}

func calculateModelHealthMetrics(row model.ModelHealthAggregate) modelHealthMetrics {
	metrics := modelHealthMetrics{}
	if row.RequestCount > 0 {
		metrics.successRate = percentage(row.SuccessCount, row.RequestCount)
		metrics.avgLatencyMs = float64(row.TotalLatencyMs) / float64(row.RequestCount)
	}
	if row.TtftCount > 0 {
		value := float64(row.TtftSumMs) / float64(row.TtftCount)
		metrics.avgTtftMs = &value
	}
	if row.GenerationMs > 0 {
		value := float64(row.OutputTokens) * 1000 / float64(row.GenerationMs)
		metrics.avgTps = &value
	}
	return metrics
}

func buildModelHealthModel(modelName string, row model.ModelHealthAggregate) ModelHealthModel {
	metrics := calculateModelHealthMetrics(row)
	var firstObserved *int64
	var lastObserved *int64
	if row.RequestCount > 0 {
		first := row.FirstBucketTs
		last := row.LastBucketTs
		firstObserved = &first
		lastObserved = &last
	}
	return ModelHealthModel{
		ModelName:       modelName,
		Health:          ClassifyModelHealth(row.RequestCount, metrics.successRate),
		RequestCount:    row.RequestCount,
		SuccessCount:    row.SuccessCount,
		SuccessRate:     metrics.successRate,
		AvgLatencyMs:    metrics.avgLatencyMs,
		AvgTtftMs:       metrics.avgTtftMs,
		AvgTps:          metrics.avgTps,
		FirstObservedAt: firstObserved,
		LastObservedAt:  lastObserved,
	}
}

func buildModelHealthMetadata(now int64, hours int, setting perf_metrics_setting.PerfMetricsSetting, bucketSeconds int64, start int64, cutoff int64, firstObserved *int64, lastObserved *int64) ModelHealthMetadata {
	return ModelHealthMetadata{
		CollectionEnabled: setting.Enabled,
		RetentionDays:     setting.RetentionDays,
		RequestedHours:    hours,
		BucketSeconds:     bucketSeconds,
		WindowStart:       start,
		DataCutoff:        cutoff,
		FirstObservedAt:   firstObserved,
		LastObservedAt:    lastObserved,
		GeneratedAt:       now,
		HealthPolicy: ModelHealthPolicy{
			MinimumRequests:       ModelHealthMinimumRequests,
			HealthySuccessRatePct: ModelHealthHealthyRate,
			WatchSuccessRatePct:   ModelHealthWatchRate,
		},
		DataQuality: ModelHealthDataQuality{
			Mode:                   ModelHealthDataQualityMode,
			CompletenessGuaranteed: false,
			Caveats: []ModelHealthCaveat{
				{
					Code:        ModelHealthCaveatClientDisconnects,
					Description: "Client disconnects are counted as unsuccessful final requests.",
				},
				{
					Code:        ModelHealthCaveatUnflushedNodeData,
					Description: "Metrics lost before a node flushes them cannot be detected from persisted data.",
				},
			},
		},
	}
}

func addModelHealthCounters(target *model.ModelHealthAggregate, row model.ModelHealthAggregate) {
	target.RequestCount += row.RequestCount
	target.SuccessCount += row.SuccessCount
	target.TotalLatencyMs += row.TotalLatencyMs
	target.TtftSumMs += row.TtftSumMs
	target.TtftCount += row.TtftCount
	target.OutputTokens += row.OutputTokens
	target.GenerationMs += row.GenerationMs
}

func updateObservedBounds(first **int64, last **int64, rowFirst int64, rowLast int64) {
	if *first == nil || rowFirst < **first {
		value := rowFirst
		*first = &value
	}
	if *last == nil || rowLast > **last {
		value := rowLast
		*last = &value
	}
}

func percentage(numerator int64, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) * 100 / float64(denominator)
}

func modelHealthSortPriority(state ModelHealthState) int {
	switch state {
	case ModelHealthDegraded:
		return 0
	case ModelHealthWatch:
		return 1
	case ModelHealthInsufficient:
		return 2
	case ModelHealthHealthy:
		return 3
	default:
		return 4
	}
}

func modelHealthBucketSeconds(bucketTime string) int64 {
	switch bucketTime {
	case "minute":
		return 60
	case "5min":
		return 300
	case "hour":
		return 3600
	default:
		return 3600
	}
}
