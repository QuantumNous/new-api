package perfmetrics

import (
	"math"
	"sort"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

const (
	adminMinRequestSamples = int64(20)
	adminMinTtftSamples    = int64(10)
	adminMinOutputTokens   = int64(100)
)

type AdminHealth string

const (
	AdminHealthCritical            AdminHealth = "critical"
	AdminHealthDegraded            AdminHealth = "degraded"
	AdminHealthHealthy             AdminHealth = "healthy"
	AdminHealthInsufficientSamples AdminHealth = "insufficient_samples"
	AdminHealthNoSamples           AdminHealth = "no_samples"
)

type AdminTimeRange struct {
	Start int64 `json:"start"`
	End   int64 `json:"end"`
}

type AdminAvailableRange struct {
	OldestBucketTs *int64 `json:"oldest_bucket_ts"`
	NewestBucketTs *int64 `json:"newest_bucket_ts"`
}

type AdminMetricValues struct {
	RequestCount     int64    `json:"request_count"`
	SuccessCount     int64    `json:"success_count"`
	FailureCount     int64    `json:"failure_count"`
	SuccessRate      *float64 `json:"success_rate"`
	AvgLatencyMs     *int64   `json:"avg_latency_ms"`
	AvgTtftMs        *int64   `json:"avg_ttft_ms"`
	TtftSampleCount  int64    `json:"ttft_sample_count"`
	OutputTokens     int64    `json:"output_tokens"`
	AvgTps           *float64 `json:"avg_tps"`
	ActiveGroupCount int      `json:"active_group_count"`
}

type AdminMetricChanges struct {
	RequestCountPct *float64 `json:"request_count_pct"`
	SuccessRatePp   *float64 `json:"success_rate_pp"`
	AvgLatencyPct   *float64 `json:"avg_latency_pct"`
	AvgTtftPct      *float64 `json:"avg_ttft_pct"`
	AvgTpsPct       *float64 `json:"avg_tps_pct"`
}

type AdminGroupResult struct {
	Group           string             `json:"group"`
	Enabled         bool               `json:"enabled"`
	Health          AdminHealth        `json:"health"`
	HealthReasons   []string           `json:"health_reasons"`
	Metrics         AdminMetricValues  `json:"metrics"`
	PreviousMetrics AdminMetricValues  `json:"previous_metrics"`
	Changes         AdminMetricChanges `json:"changes"`
}

type AdminModelResult struct {
	ModelName       string             `json:"model_name"`
	Enabled         bool               `json:"enabled"`
	Health          AdminHealth        `json:"health"`
	HealthReasons   []string           `json:"health_reasons"`
	Metrics         AdminMetricValues  `json:"metrics"`
	PreviousMetrics AdminMetricValues  `json:"previous_metrics"`
	Changes         AdminMetricChanges `json:"changes"`
	Groups          []AdminGroupResult `json:"groups"`
}

type AdminQueryResult struct {
	MetricsEnabled     bool                `json:"metrics_enabled"`
	GeneratedAt        int64               `json:"generated_at"`
	BucketSeconds      int64               `json:"bucket_seconds"`
	ExpectedMaxLag     int64               `json:"expected_max_lag_seconds"`
	RequestedPeriod    AdminTimeRange      `json:"requested_period"`
	ActualPeriod       AdminTimeRange      `json:"actual_period"`
	PreviousPeriod     AdminTimeRange      `json:"previous_period"`
	AvailableRange     AdminAvailableRange `json:"available_range"`
	HasCompleteBuckets bool                `json:"has_complete_buckets"`
	Models             []AdminModelResult  `json:"models"`
}

type modelGroupKey struct {
	model string
	group string
}

func QueryAdmin(startTs int64, endTs int64) (AdminQueryResult, error) {
	setting := perf_metrics_setting.GetSetting()
	bucketSeconds := perf_metrics_setting.GetBucketSeconds()
	actualPeriod, previousPeriod := resolveAdminPeriods(startTs, endTs, bucketSeconds)
	result := AdminQueryResult{
		MetricsEnabled:     setting.Enabled,
		GeneratedAt:        time.Now().Unix(),
		BucketSeconds:      bucketSeconds,
		ExpectedMaxLag:     int64(perf_metrics_setting.GetFlushIntervalMinutes() * 60),
		RequestedPeriod:    AdminTimeRange{Start: startTs, End: endTs},
		ActualPeriod:       actualPeriod,
		PreviousPeriod:     previousPeriod,
		HasCompleteBuckets: actualPeriod.End > actualPeriod.Start,
		Models:             make([]AdminModelResult, 0),
	}

	abilities, err := model.ListEnabledAbilities()
	if err != nil {
		return AdminQueryResult{}, err
	}
	if !setting.Enabled || !result.HasCompleteBuckets {
		result.Models = buildAdminModels(nil, nil, abilities)
		return result, nil
	}

	current, previous, availableRange, err := readAdminCounters(actualPeriod, previousPeriod)
	if err != nil {
		return AdminQueryResult{}, err
	}
	result.AvailableRange = availableRange
	result.Models = buildAdminModels(current, previous, abilities)
	return result, nil
}

func resolveAdminPeriods(startTs int64, endTs int64, bucketSeconds int64) (AdminTimeRange, AdminTimeRange) {
	if bucketSeconds <= 0 {
		bucketSeconds = 3600
	}
	actualStart := alignBucketUp(startTs, bucketSeconds)
	actualEnd := endTs - endTs%bucketSeconds
	if actualEnd <= actualStart {
		return AdminTimeRange{Start: actualStart, End: actualStart}, AdminTimeRange{Start: actualStart, End: actualStart}
	}
	duration := actualEnd - actualStart
	return AdminTimeRange{Start: actualStart, End: actualEnd}, AdminTimeRange{Start: actualStart - duration, End: actualStart}
}

func alignBucketUp(ts int64, bucketSeconds int64) int64 {
	remainder := ts % bucketSeconds
	if remainder == 0 {
		return ts
	}
	return ts + bucketSeconds - remainder
}

func readAdminCounters(currentPeriod AdminTimeRange, previousPeriod AdminTimeRange) (map[modelGroupKey]counters, map[modelGroupKey]counters, AdminAvailableRange, error) {
	hotBucketsMu.RLock()
	defer hotBucketsMu.RUnlock()

	currentRows, err := model.GetPerfMetricGroupSummaries(currentPeriod.Start, currentPeriod.End)
	if err != nil {
		return nil, nil, AdminAvailableRange{}, err
	}
	previousRows, err := model.GetPerfMetricGroupSummaries(previousPeriod.Start, previousPeriod.End)
	if err != nil {
		return nil, nil, AdminAvailableRange{}, err
	}
	oldest, newest, err := model.GetPerfMetricAvailableRange()
	if err != nil {
		return nil, nil, AdminAvailableRange{}, err
	}

	current := adminCountersFromRows(currentRows)
	previous := adminCountersFromRows(previousRows)
	hotBuckets.Range(func(key, value any) bool {
		bucket := key.(bucketKey)
		snapshot := value.(*atomicBucket).snapshot()
		if snapshot.requestCount == 0 {
			return true
		}
		if oldest == nil || bucket.bucketTs < *oldest {
			oldest = int64Pointer(bucket.bucketTs)
		}
		if newest == nil || bucket.bucketTs > *newest {
			newest = int64Pointer(bucket.bucketTs)
		}
		if bucket.bucketTs >= currentPeriod.Start && bucket.bucketTs < currentPeriod.End {
			mergeAdminCounters(current, modelGroupKey{model: bucket.model, group: bucket.group}, snapshot)
		}
		if bucket.bucketTs >= previousPeriod.Start && bucket.bucketTs < previousPeriod.End {
			mergeAdminCounters(previous, modelGroupKey{model: bucket.model, group: bucket.group}, snapshot)
		}
		return true
	})

	return current, previous, AdminAvailableRange{OldestBucketTs: oldest, NewestBucketTs: newest}, nil
}

func adminCountersFromRows(rows []model.PerfMetricGroupSummary) map[modelGroupKey]counters {
	result := make(map[modelGroupKey]counters, len(rows))
	for _, row := range rows {
		result[modelGroupKey{model: row.ModelName, group: row.Group}] = counters{
			requestCount:   row.RequestCount,
			successCount:   row.SuccessCount,
			totalLatencyMs: row.TotalLatencyMs,
			ttftSumMs:      row.TtftSumMs,
			ttftCount:      row.TtftCount,
			outputTokens:   row.OutputTokens,
			generationMs:   row.GenerationMs,
		}
	}
	return result
}

func mergeAdminCounters(values map[modelGroupKey]counters, key modelGroupKey, addition counters) {
	current := values[key]
	current.requestCount += addition.requestCount
	current.successCount += addition.successCount
	current.totalLatencyMs += addition.totalLatencyMs
	current.ttftSumMs += addition.ttftSumMs
	current.ttftCount += addition.ttftCount
	current.outputTokens += addition.outputTokens
	current.generationMs += addition.generationMs
	values[key] = current
}

func buildAdminModels(current map[modelGroupKey]counters, previous map[modelGroupKey]counters, abilities []model.Ability) []AdminModelResult {
	enabledModels := map[string]bool{}
	enabledGroups := map[modelGroupKey]bool{}
	modelNames := map[string]struct{}{}
	for _, ability := range abilities {
		enabledModels[ability.Model] = true
		enabledGroups[modelGroupKey{model: ability.Model, group: ability.Group}] = true
		modelNames[ability.Model] = struct{}{}
	}
	for key, value := range current {
		if value.requestCount > 0 {
			modelNames[key.model] = struct{}{}
		}
	}

	currentTotals := aggregateAdminModelCounters(current)
	previousTotals := aggregateAdminModelCounters(previous)
	models := make([]AdminModelResult, 0, len(modelNames))
	for modelName := range modelNames {
		currentValue := currentTotals[modelName]
		previousValue := previousTotals[modelName]
		metrics := adminMetricValues(currentValue)
		metrics.ActiveGroupCount = countActiveAdminGroups(modelName, current)
		previousMetrics := adminMetricValues(previousValue)
		previousMetrics.ActiveGroupCount = countActiveAdminGroups(modelName, previous)
		health, reasons := classifyAdminHealth(currentValue, previousValue)
		models = append(models, AdminModelResult{
			ModelName:       modelName,
			Enabled:         enabledModels[modelName],
			Health:          health,
			HealthReasons:   reasons,
			Metrics:         metrics,
			PreviousMetrics: previousMetrics,
			Changes:         buildAdminChanges(currentValue, previousValue),
			Groups:          buildAdminGroups(modelName, current, previous, enabledGroups),
		})
	}

	sort.Slice(models, func(i, j int) bool {
		leftRank := adminHealthRank(models[i].Health)
		rightRank := adminHealthRank(models[j].Health)
		if leftRank != rightRank {
			return leftRank < rightRank
		}
		if models[i].Metrics.RequestCount != models[j].Metrics.RequestCount {
			return models[i].Metrics.RequestCount > models[j].Metrics.RequestCount
		}
		return models[i].ModelName < models[j].ModelName
	})
	return models
}

func aggregateAdminModelCounters(values map[modelGroupKey]counters) map[string]counters {
	result := map[string]counters{}
	for key, value := range values {
		current := result[key.model]
		current.requestCount += value.requestCount
		current.successCount += value.successCount
		current.totalLatencyMs += value.totalLatencyMs
		current.ttftSumMs += value.ttftSumMs
		current.ttftCount += value.ttftCount
		current.outputTokens += value.outputTokens
		current.generationMs += value.generationMs
		result[key.model] = current
	}
	return result
}

func countActiveAdminGroups(modelName string, values map[modelGroupKey]counters) int {
	count := 0
	for key, value := range values {
		if key.model == modelName && value.requestCount > 0 {
			count++
		}
	}
	return count
}

func buildAdminGroups(modelName string, current map[modelGroupKey]counters, previous map[modelGroupKey]counters, enabled map[modelGroupKey]bool) []AdminGroupResult {
	groupNames := map[string]struct{}{}
	for key := range enabled {
		if key.model == modelName {
			groupNames[key.group] = struct{}{}
		}
	}
	for key, value := range current {
		if key.model == modelName && value.requestCount > 0 {
			groupNames[key.group] = struct{}{}
		}
	}

	groups := make([]AdminGroupResult, 0, len(groupNames))
	for group := range groupNames {
		key := modelGroupKey{model: modelName, group: group}
		currentValue := current[key]
		previousValue := previous[key]
		health, reasons := classifyAdminHealth(currentValue, previousValue)
		groups = append(groups, AdminGroupResult{
			Group:           group,
			Enabled:         enabled[key],
			Health:          health,
			HealthReasons:   reasons,
			Metrics:         adminMetricValues(currentValue),
			PreviousMetrics: adminMetricValues(previousValue),
			Changes:         buildAdminChanges(currentValue, previousValue),
		})
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].Metrics.RequestCount != groups[j].Metrics.RequestCount {
			return groups[i].Metrics.RequestCount > groups[j].Metrics.RequestCount
		}
		return groups[i].Group < groups[j].Group
	})
	return groups
}

func adminMetricValues(value counters) AdminMetricValues {
	metrics := AdminMetricValues{
		RequestCount:    value.requestCount,
		SuccessCount:    value.successCount,
		FailureCount:    max(value.requestCount-value.successCount, 0),
		TtftSampleCount: value.ttftCount,
		OutputTokens:    value.outputTokens,
	}
	if value.requestCount > 0 {
		rate := roundAdminMetric(successRate(value))
		latency := avg(value.totalLatencyMs, value.requestCount)
		metrics.SuccessRate = &rate
		metrics.AvgLatencyMs = &latency
	}
	if value.ttftCount > 0 {
		ttft := avg(value.ttftSumMs, value.ttftCount)
		metrics.AvgTtftMs = &ttft
	}
	if value.outputTokens > 0 && value.generationMs > 0 {
		tps := roundAdminMetric(avgTps(value))
		metrics.AvgTps = &tps
	}
	return metrics
}

func buildAdminChanges(current counters, previous counters) AdminMetricChanges {
	changes := AdminMetricChanges{}
	if current.requestCount >= adminMinRequestSamples && previous.requestCount >= adminMinRequestSamples {
		changes.RequestCountPct = adminPercentChange(float64(current.requestCount), float64(previous.requestCount))
		currentRate := successRate(current)
		previousRate := successRate(previous)
		difference := roundAdminMetric(currentRate - previousRate)
		changes.SuccessRatePp = &difference
		changes.AvgLatencyPct = adminPercentChange(float64(avg(current.totalLatencyMs, current.requestCount)), float64(avg(previous.totalLatencyMs, previous.requestCount)))
	}
	if current.ttftCount >= adminMinTtftSamples && previous.ttftCount >= adminMinTtftSamples {
		changes.AvgTtftPct = adminPercentChange(float64(avg(current.ttftSumMs, current.ttftCount)), float64(avg(previous.ttftSumMs, previous.ttftCount)))
	}
	if current.outputTokens >= adminMinOutputTokens && previous.outputTokens >= adminMinOutputTokens && current.generationMs > 0 && previous.generationMs > 0 {
		changes.AvgTpsPct = adminPercentChange(avgTps(current), avgTps(previous))
	}
	return changes
}

func adminPercentChange(current float64, previous float64) *float64 {
	if previous <= 0 || math.IsNaN(current) || math.IsInf(current, 0) {
		return nil
	}
	change := roundAdminMetric((current - previous) / previous * 100)
	return &change
}

func classifyAdminHealth(current counters, previous counters) (AdminHealth, []string) {
	if current.requestCount == 0 {
		return AdminHealthNoSamples, []string{"no_samples"}
	}
	if current.requestCount < adminMinRequestSamples {
		return AdminHealthInsufficientSamples, []string{"insufficient_samples"}
	}

	currentRate := successRate(current)
	criticalReasons := make([]string, 0, 2)
	if currentRate < 90 {
		criticalReasons = append(criticalReasons, "success_rate_critical")
	}
	if previous.requestCount >= adminMinRequestSamples && currentRate-successRate(previous) <= -10 {
		criticalReasons = append(criticalReasons, "success_rate_regression_critical")
	}
	if len(criticalReasons) > 0 {
		return AdminHealthCritical, criticalReasons
	}

	degradedReasons := make([]string, 0, 4)
	if currentRate < 98 {
		degradedReasons = append(degradedReasons, "success_rate_degraded")
	}
	if previous.requestCount >= adminMinRequestSamples {
		previousRate := successRate(previous)
		if currentRate-previousRate <= -3 {
			degradedReasons = append(degradedReasons, "success_rate_regression")
		}
		currentLatency := avg(current.totalLatencyMs, current.requestCount)
		previousLatency := avg(previous.totalLatencyMs, previous.requestCount)
		if previousLatency > 0 && currentLatency-previousLatency >= 500 && float64(currentLatency)/float64(previousLatency) >= 1.5 {
			degradedReasons = append(degradedReasons, "latency_regression")
		}
	}
	if current.ttftCount >= adminMinTtftSamples && previous.ttftCount >= adminMinTtftSamples {
		currentTtft := avg(current.ttftSumMs, current.ttftCount)
		previousTtft := avg(previous.ttftSumMs, previous.ttftCount)
		if previousTtft > 0 && currentTtft-previousTtft >= 300 && float64(currentTtft)/float64(previousTtft) >= 1.5 {
			degradedReasons = append(degradedReasons, "ttft_regression")
		}
	}
	if current.outputTokens >= adminMinOutputTokens && previous.outputTokens >= adminMinOutputTokens && current.generationMs > 0 && previous.generationMs > 0 {
		previousTps := avgTps(previous)
		if previousTps > 0 && (avgTps(current)-previousTps)/previousTps <= -0.3 {
			degradedReasons = append(degradedReasons, "tps_regression")
		}
	}
	if len(degradedReasons) > 0 {
		return AdminHealthDegraded, degradedReasons
	}
	return AdminHealthHealthy, []string{}
}

func adminHealthRank(health AdminHealth) int {
	switch health {
	case AdminHealthCritical:
		return 0
	case AdminHealthDegraded:
		return 1
	case AdminHealthHealthy:
		return 2
	case AdminHealthInsufficientSamples:
		return 3
	default:
		return 4
	}
}

func roundAdminMetric(value float64) float64 {
	return math.Round(value*100) / 100
}

func int64Pointer(value int64) *int64 {
	return &value
}
