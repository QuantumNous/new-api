package perfmetrics

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	prometheusMaxSeriesPerScrapeEnv     = "PROMETHEUS_MAX_SERIES_PER_SCRAPE"
	defaultPrometheusMaxSeriesPerScrape = 5000
	prometheusSeriesIdleRetention       = 6 * time.Hour
)

func BuildPrometheusText(_ context.Context) (string, error) {
	series := map[prometheusSeriesKey]prometheusCounters{}
	mergePrometheusPendingSnapshots(series)
	channelSnapshots := snapshotPrometheusChannels()
	channelModelSnapshots := snapshotPrometheusChannelModels()
	recallTranslationSnapshots := snapshotPrometheusRecallTranslations()
	recallTranslationDurationSnapshots := snapshotPrometheusRecallTranslationDurations()
	modelPerformanceSnapshots := snapshotPrometheusModelPerformances(time.Now())
	bytePlusRealPersonSnapshot, bytePlusRealPersonActive := snapshotBytePlusRealPersonMetrics()
	baseSeriesCount := len(series)
	for _, snapshot := range channelSnapshots {
		baseSeriesCount += snapshot.seriesCount()
	}
	for _, snapshot := range channelModelSnapshots {
		baseSeriesCount += snapshot.seriesCount()
	}
	baseSeriesCount += recallTranslationSeriesCount(recallTranslationSnapshots, recallTranslationDurationSnapshots)
	maxSeries := prometheusMaxSeriesPerScrape()
	bytePlusRealPersonFixedSeriesCount := bytePlusRealPersonMetricSeriesCount(true)
	hasNonBytePlusMetrics := baseSeriesCount > 0 || len(modelPerformanceSnapshots) > 0
	bytePlusRealPersonEnabled := bytePlusRealPersonActive ||
		(!hasNonBytePlusMetrics && (maxSeries <= 0 || bytePlusRealPersonFixedSeriesCount <= maxSeries))
	baseSeriesCount += bytePlusRealPersonMetricSeriesCount(bytePlusRealPersonEnabled)
	if maxSeries > 0 && baseSeriesCount > maxSeries {
		return "", fmt.Errorf("prometheus series limit exceeded: %d > %d", baseSeriesCount, maxSeries)
	}

	healthSeriesCount := 1 + len(modelDropReasons)
	includeModelHealth := maxSeries <= 0 || maxSeries-baseSeriesCount >= healthSeriesCount
	selectedModelPerformanceSnapshots := []prometheusModelPerformanceSnapshot(nil)
	modelHealthDroppedSamples := map[string]int64(nil)
	seriesCount := baseSeriesCount
	remaining := 0
	if includeModelHealth {
		if maxSeries > 0 {
			remaining = maxSeries - baseSeriesCount - healthSeriesCount
		} else {
			for _, snapshot := range modelPerformanceSnapshots {
				remaining += snapshot.seriesCount()
			}
		}
	}
	selectedSnapshots, newlyDropped := selectPrometheusModelSnapshots(modelPerformanceSnapshots, remaining)
	prometheusModelDroppedSamples.add(modelDropSeriesLimit, newlyDropped)
	if includeModelHealth {
		selectedModelPerformanceSnapshots = selectedSnapshots
		modelHealthDroppedSamples = prometheusModelDroppedSamples.snapshot()
		seriesCount += healthSeriesCount
		for _, snapshot := range selectedModelPerformanceSnapshots {
			seriesCount += snapshot.seriesCount()
		}
	}

	var b strings.Builder
	b.WriteString("# HELP newapi_perf_metrics_series Number of application metric series exposed by this endpoint.\n")
	b.WriteString("# TYPE newapi_perf_metrics_series gauge\n")
	b.WriteString(fmt.Sprintf("newapi_perf_metrics_series %d\n", seriesCount))

	keys := sortedPrometheusSeriesKeys(series)
	b.WriteString("# HELP newapi_model_requests_total Total model requests by model and status.\n")
	b.WriteString("# TYPE newapi_model_requests_total counter\n")
	for _, key := range keys {
		counter := series[key]
		if counter.count == 0 {
			continue
		}
		b.WriteString("newapi_model_requests_total{")
		writePrometheusLabels(&b, key)
		b.WriteString("} ")
		b.WriteString(strconv.FormatInt(counter.count, 10))
		b.WriteByte('\n')
	}

	if includeModelHealth {
		writePrometheusModelPerformanceMetrics(&b, selectedModelPerformanceSnapshots)
		writePrometheusModelHealthMetrics(&b, len(modelPerformanceSnapshots), modelHealthDroppedSamples)
	}
	writeBytePlusRealPersonMetrics(&b, bytePlusRealPersonSnapshot, bytePlusRealPersonEnabled)
	writePrometheusChannelMetrics(&b, channelSnapshots)
	writePrometheusChannelModelMetrics(&b, channelModelSnapshots)
	writePrometheusRecallTranslationMetrics(&b, recallTranslationSnapshots, recallTranslationDurationSnapshots)

	return b.String(), nil
}

func mergePrometheusPendingSnapshots(series map[prometheusSeriesKey]prometheusCounters) {
	idleCutoff := time.Now().Add(-prometheusSeriesIdleRetention).UnixNano()
	prometheusPendingBuckets.Range(func(key, value any) bool {
		bucket := value.(*prometheusLockedBucket)
		if bucket.retireIfIdle(idleCutoff) {
			prometheusPendingBuckets.CompareAndDelete(key, value)
			return true
		}
		seriesKey := key.(prometheusSeriesKey)
		snapshot := bucket.snapshot()
		if snapshot.isZero() {
			return true
		}
		current := series[seriesKey]
		current.add(snapshot)
		series[seriesKey] = current
		return true
	})
}

func sortedPrometheusSeriesKeys(series map[prometheusSeriesKey]prometheusCounters) []prometheusSeriesKey {
	keys := make([]prometheusSeriesKey, 0, len(series))
	for key := range series {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].model != keys[j].model {
			return keys[i].model < keys[j].model
		}
		return keys[i].status < keys[j].status
	})
	return keys
}

func writePrometheusHistogram(
	b *strings.Builder,
	metricName string,
	model string,
	upperBounds []float64,
	bucketCounts []int64,
	sum float64,
	count int64,
) {
	for i, upperBound := range upperBounds {
		b.WriteString(metricName)
		b.WriteString(`_bucket{model="`)
		b.WriteString(escapePrometheusLabelValue(model))
		b.WriteString(`",le="`)
		b.WriteString(formatPrometheusFloat(upperBound))
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(bucketCounts[i], 10))
		b.WriteByte('\n')
	}
	b.WriteString(metricName)
	b.WriteString(`_bucket{model="`)
	b.WriteString(escapePrometheusLabelValue(model))
	b.WriteString(`",le="+Inf"} `)
	b.WriteString(strconv.FormatInt(count, 10))
	b.WriteByte('\n')
	b.WriteString(metricName)
	b.WriteString(`_sum{model="`)
	b.WriteString(escapePrometheusLabelValue(model))
	b.WriteString(`"} `)
	b.WriteString(formatPrometheusFloat(sum))
	b.WriteByte('\n')
	b.WriteString(metricName)
	b.WriteString(`_count{model="`)
	b.WriteString(escapePrometheusLabelValue(model))
	b.WriteString(`"} `)
	b.WriteString(strconv.FormatInt(count, 10))
	b.WriteByte('\n')
}

func writePrometheusModelPerformanceMetrics(b *strings.Builder, snapshots []prometheusModelPerformanceSnapshot) {
	hasLatency := false
	hasTTFT := false
	hasStreamSuccess := false
	hasErrors := false
	for _, snapshot := range snapshots {
		hasLatency = hasLatency || snapshot.latencyCount > 0
		hasTTFT = hasTTFT || snapshot.ttftCount > 0
		hasStreamSuccess = hasStreamSuccess || snapshot.streamSuccess > 0
		hasErrors = hasErrors || len(snapshot.errors) > 0
	}

	if hasLatency {
		b.WriteString("# HELP newapi_model_request_duration_seconds Successful model request duration by model.\n")
		b.WriteString("# TYPE newapi_model_request_duration_seconds histogram\n")
		for _, snapshot := range snapshots {
			if snapshot.latencyCount == 0 {
				continue
			}
			writePrometheusHistogram(
				b,
				"newapi_model_request_duration_seconds",
				snapshot.model,
				prometheusModelLatencyBucketsSeconds,
				snapshot.latencyBuckets,
				snapshot.latencySumSeconds,
				snapshot.latencyCount,
			)
		}
	}

	if hasTTFT {
		b.WriteString("# HELP newapi_model_ttft_seconds Time to first token for successful streaming model requests.\n")
		b.WriteString("# TYPE newapi_model_ttft_seconds histogram\n")
		for _, snapshot := range snapshots {
			if snapshot.ttftCount == 0 {
				continue
			}
			writePrometheusHistogram(
				b,
				"newapi_model_ttft_seconds",
				snapshot.model,
				prometheusModelTTFTBucketsSeconds,
				snapshot.ttftBuckets,
				snapshot.ttftSumSeconds,
				snapshot.ttftCount,
			)
		}
	}

	if hasStreamSuccess {
		b.WriteString("# HELP newapi_model_stream_success_total Total successful streaming model requests.\n")
		b.WriteString("# TYPE newapi_model_stream_success_total counter\n")
		for _, snapshot := range snapshots {
			if snapshot.streamSuccess == 0 {
				continue
			}
			b.WriteString(`newapi_model_stream_success_total{model="`)
			b.WriteString(escapePrometheusLabelValue(snapshot.model))
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.streamSuccess, 10))
			b.WriteByte('\n')
		}
	}

	if hasErrors {
		b.WriteString("# HELP newapi_model_errors_total Total final model request failures by error category.\n")
		b.WriteString("# TYPE newapi_model_errors_total counter\n")
		for _, snapshot := range snapshots {
			categories := make([]string, 0, len(snapshot.errors))
			for category := range snapshot.errors {
				categories = append(categories, category)
			}
			sort.Strings(categories)
			for _, category := range categories {
				b.WriteString(`newapi_model_errors_total{model="`)
				b.WriteString(escapePrometheusLabelValue(snapshot.model))
				b.WriteString(`",error_category="`)
				b.WriteString(escapePrometheusLabelValue(category))
				b.WriteString(`"} `)
				b.WriteString(strconv.FormatInt(snapshot.errors[category], 10))
				b.WriteByte('\n')
			}
		}
	}
}

func writePrometheusModelHealthMetrics(b *strings.Builder, activeModels int, droppedSamples map[string]int64) {
	b.WriteString("# HELP newapi_model_histogram_active_models Number of active model performance metric groups.\n")
	b.WriteString("# TYPE newapi_model_histogram_active_models gauge\n")
	b.WriteString("newapi_model_histogram_active_models ")
	b.WriteString(strconv.Itoa(activeModels))
	b.WriteByte('\n')
	b.WriteString("# HELP newapi_model_histogram_dropped_samples_total Total model histogram observations dropped before export.\n")
	b.WriteString("# TYPE newapi_model_histogram_dropped_samples_total counter\n")
	for _, reason := range modelDropReasons {
		b.WriteString(`newapi_model_histogram_dropped_samples_total{reason="`)
		b.WriteString(escapePrometheusLabelValue(reason))
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(droppedSamples[reason], 10))
		b.WriteByte('\n')
	}
}

func snapshotPrometheusChannels() []prometheusChannelSnapshot {
	idleCutoff := time.Now().Add(-prometheusSeriesIdleRetention).UnixNano()
	snapshots := make([]prometheusChannelSnapshot, 0)
	prometheusChannelBuckets.Range(func(key, value any) bool {
		bucket := value.(*prometheusChannelBucket)
		if bucket.retireIfIdle(idleCutoff) {
			prometheusChannelBuckets.CompareAndDelete(key, value)
			return true
		}
		snapshot := bucket.snapshot(key.(int))
		if snapshot.durationCount > 0 {
			snapshots = append(snapshots, snapshot)
		}
		return true
	})
	sort.Slice(snapshots, func(i, j int) bool {
		return snapshots[i].channelID < snapshots[j].channelID
	})
	return snapshots
}

func snapshotPrometheusChannelModels() []prometheusChannelModelSnapshot {
	idleCutoff := time.Now().Add(-prometheusSeriesIdleRetention).UnixNano()
	snapshots := make([]prometheusChannelModelSnapshot, 0)
	prometheusChannelModelBuckets.Range(func(key, value any) bool {
		bucket := value.(*prometheusChannelModelBucket)
		if bucket.retireIfIdle(idleCutoff) {
			prometheusChannelModelBuckets.CompareAndDelete(key, value)
			return true
		}
		seriesKey := key.(prometheusChannelModelKey)
		snapshot := bucket.snapshot(seriesKey)
		if snapshot.seriesCount() > 0 {
			snapshots = append(snapshots, snapshot)
		}
		return true
	})
	sort.Slice(snapshots, func(i, j int) bool {
		if snapshots[i].channelID != snapshots[j].channelID {
			return snapshots[i].channelID < snapshots[j].channelID
		}
		return snapshots[i].model < snapshots[j].model
	})
	return snapshots
}

func writePrometheusChannelMetrics(b *strings.Builder, snapshots []prometheusChannelSnapshot) {
	if len(snapshots) == 0 {
		return
	}

	b.WriteString("# HELP newapi_channel_info Current display name for a stable channel ID.\n")
	b.WriteString("# TYPE newapi_channel_info gauge\n")
	for _, snapshot := range snapshots {
		b.WriteString("newapi_channel_info{")
		writePrometheusChannelIDLabel(b, snapshot.channelID)
		b.WriteString(`,channel_name="`)
		b.WriteString(escapePrometheusLabelValue(snapshot.channelName))
		b.WriteString(`"} 1`)
		b.WriteByte('\n')
	}

	b.WriteString("# HELP newapi_channel_attempts_total Total real upstream channel attempts, including retries.\n")
	b.WriteString("# TYPE newapi_channel_attempts_total counter\n")
	for _, snapshot := range snapshots {
		keys := sortedPrometheusChannelAttemptKeys(snapshot.attempts)
		for _, key := range keys {
			b.WriteString("newapi_channel_attempts_total{")
			writePrometheusChannelIDLabel(b, snapshot.channelID)
			b.WriteString(`,status="`)
			b.WriteString(escapePrometheusLabelValue(key.status))
			b.WriteString(`",error_category="`)
			b.WriteString(escapePrometheusLabelValue(key.errorCategory))
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.attempts[key], 10))
			b.WriteByte('\n')
		}
	}

	b.WriteString("# HELP newapi_channel_request_duration_seconds Total duration of real upstream channel attempts.\n")
	b.WriteString("# TYPE newapi_channel_request_duration_seconds histogram\n")
	for _, snapshot := range snapshots {
		for i, upperBound := range prometheusChannelDurationBucketsSeconds {
			b.WriteString("newapi_channel_request_duration_seconds_bucket{")
			writePrometheusChannelIDLabel(b, snapshot.channelID)
			b.WriteString(`,le="`)
			b.WriteString(formatPrometheusFloat(upperBound))
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.durationBuckets[i], 10))
			b.WriteByte('\n')
		}
		b.WriteString("newapi_channel_request_duration_seconds_bucket{")
		writePrometheusChannelIDLabel(b, snapshot.channelID)
		b.WriteString(`,le="+Inf"} `)
		b.WriteString(strconv.FormatInt(snapshot.durationCount, 10))
		b.WriteByte('\n')
		b.WriteString("newapi_channel_request_duration_seconds_sum{")
		writePrometheusChannelIDLabel(b, snapshot.channelID)
		b.WriteString("} ")
		b.WriteString(formatPrometheusFloat(snapshot.durationSumSeconds))
		b.WriteByte('\n')
		b.WriteString("newapi_channel_request_duration_seconds_count{")
		writePrometheusChannelIDLabel(b, snapshot.channelID)
		b.WriteString("} ")
		b.WriteString(strconv.FormatInt(snapshot.durationCount, 10))
		b.WriteByte('\n')
	}

	b.WriteString("# HELP newapi_channel_ttft_seconds Time to first token for streaming channel attempts.\n")
	b.WriteString("# TYPE newapi_channel_ttft_seconds summary\n")
	for _, snapshot := range snapshots {
		if snapshot.ttftCount == 0 {
			continue
		}
		b.WriteString("newapi_channel_ttft_seconds_sum{")
		writePrometheusChannelIDLabel(b, snapshot.channelID)
		b.WriteString("} ")
		b.WriteString(formatPrometheusFloat(snapshot.ttftSumSeconds))
		b.WriteByte('\n')
		b.WriteString("newapi_channel_ttft_seconds_count{")
		writePrometheusChannelIDLabel(b, snapshot.channelID)
		b.WriteString("} ")
		b.WriteString(strconv.FormatInt(snapshot.ttftCount, 10))
		b.WriteByte('\n')
	}
}

func writePrometheusChannelModelMetrics(b *strings.Builder, snapshots []prometheusChannelModelSnapshot) {
	if len(snapshots) == 0 {
		return
	}

	b.WriteString("# HELP newapi_channel_model_attempts_total Total channel attempts by model and outcome.\n")
	b.WriteString("# TYPE newapi_channel_model_attempts_total counter\n")
	for _, snapshot := range snapshots {
		statuses := make([]string, 0, len(snapshot.attempts))
		for status := range snapshot.attempts {
			statuses = append(statuses, status)
		}
		sort.Strings(statuses)
		for _, status := range statuses {
			b.WriteString("newapi_channel_model_attempts_total{")
			writePrometheusChannelModelLabels(b, snapshot.channelID, snapshot.model)
			b.WriteString(`,status="`)
			b.WriteString(escapePrometheusLabelValue(status))
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.attempts[status], 10))
			b.WriteByte('\n')
		}
	}

	b.WriteString("# HELP newapi_channel_model_input_tokens_total Actual input tokens settled by channel and model.\n")
	b.WriteString("# TYPE newapi_channel_model_input_tokens_total counter\n")
	for _, snapshot := range snapshots {
		if snapshot.inputTokens == 0 {
			continue
		}
		b.WriteString("newapi_channel_model_input_tokens_total{")
		writePrometheusChannelModelLabels(b, snapshot.channelID, snapshot.model)
		b.WriteString("} ")
		b.WriteString(strconv.FormatInt(snapshot.inputTokens, 10))
		b.WriteByte('\n')
	}

	b.WriteString("# HELP newapi_channel_model_output_tokens_total Actual output tokens settled by channel and model.\n")
	b.WriteString("# TYPE newapi_channel_model_output_tokens_total counter\n")
	for _, snapshot := range snapshots {
		if snapshot.outputTokens == 0 {
			continue
		}
		b.WriteString("newapi_channel_model_output_tokens_total{")
		writePrometheusChannelModelLabels(b, snapshot.channelID, snapshot.model)
		b.WriteString("} ")
		b.WriteString(strconv.FormatInt(snapshot.outputTokens, 10))
		b.WriteByte('\n')
	}
}

func sortedPrometheusChannelAttemptKeys(attempts map[prometheusChannelAttemptKey]int64) []prometheusChannelAttemptKey {
	keys := make([]prometheusChannelAttemptKey, 0, len(attempts))
	for key := range attempts {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if keys[i].status != keys[j].status {
			return keys[i].status < keys[j].status
		}
		return keys[i].errorCategory < keys[j].errorCategory
	})
	return keys
}

func writePrometheusChannelIDLabel(b *strings.Builder, channelID int) {
	b.WriteString(`channel_id="`)
	b.WriteString(strconv.Itoa(channelID))
	b.WriteByte('"')
}

func writePrometheusChannelModelLabels(b *strings.Builder, channelID int, modelName string) {
	writePrometheusChannelIDLabel(b, channelID)
	b.WriteString(`,model="`)
	b.WriteString(escapePrometheusLabelValue(modelName))
	b.WriteByte('"')
}

func formatPrometheusFloat(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func writePrometheusLabels(b *strings.Builder, key prometheusSeriesKey) {
	b.WriteString(`model="`)
	b.WriteString(escapePrometheusLabelValue(key.model))
	b.WriteString(`",status="`)
	b.WriteString(escapePrometheusLabelValue(key.status))
	b.WriteByte('"')
}

func escapePrometheusLabelValue(value string) string {
	replacer := strings.NewReplacer(
		"\\", "\\\\",
		"\n", "\\n",
		"\"", "\\\"",
	)
	return replacer.Replace(value)
}

func prometheusMaxSeriesPerScrape() int {
	return common.GetEnvOrDefault(prometheusMaxSeriesPerScrapeEnv, defaultPrometheusMaxSeriesPerScrape)
}
