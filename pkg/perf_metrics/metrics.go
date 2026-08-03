package perfmetrics

import (
	"context"
	"errors"
	"math"
	"net"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/QuantumNous/new-api/types"
)

var hotBuckets sync.Map
var prometheusPendingBuckets sync.Map
var prometheusChannelBuckets sync.Map
var prometheusChannelModelBuckets sync.Map
var prometheusModelPerformanceBuckets sync.Map
var prometheusRecallTranslationBuckets sync.Map
var prometheusRecallTranslationDurationBuckets sync.Map
var prometheusModelAdmissionMu sync.Mutex
var prometheusModelDroppedSamples prometheusModelDropCounters

var prometheusChannelDurationBucketsSeconds = []float64{
	0.25,
	0.5,
	1,
	2,
	3,
	5,
	10,
	15,
	30,
	60,
	120,
	300,
	600,
}

// seriesSchema is a stable client cache/schema marker. Do not change it when
// hiding fields or making response-only privacy hardening changes.
const seriesSchema = "dbcd0a3c01b55203"

func Init() {
	go flushLoop()
}

func RecordRelaySample(info *relaycommon.RelayInfo, success bool, outputTokens int64, relayErr *types.NewAPIError) {
	if info == nil {
		return
	}
	finalSuccess := success && relayErr == nil
	if finalSuccess && info.IsStream && info.StreamStatus != nil {
		finalSuccess = info.StreamStatus.IsNormalEnd() && !info.StreamStatus.HasErrors()
	}
	now := time.Now()
	hasTtft := info.IsStream && info.HasSendResponse()
	ttftMs := int64(0)
	if hasTtft {
		ttftMs = info.FirstResponseTime.Sub(info.StartTime).Milliseconds()
	}
	latencyMs := now.Sub(info.StartTime).Milliseconds()
	generationMs := latencyMs
	if hasTtft {
		generationMs = now.Sub(info.FirstResponseTime).Milliseconds()
	}
	if generationMs <= 0 {
		generationMs = latencyMs
	}
	recordPrometheusModelPerformance(info, finalSuccess, relayErr, now)
	Record(Sample{
		Model:        info.OriginModelName,
		Group:        info.UsingGroup,
		ChannelID:    info.ChannelId,
		LatencyMs:    latencyMs,
		TtftMs:       ttftMs,
		HasTtft:      hasTtft,
		Success:      finalSuccess,
		OutputTokens: outputTokens,
		GenerationMs: generationMs,
	})
}

func RecordChannelAttempt(
	info *relaycommon.RelayInfo,
	channelID int,
	channelName string,
	startedAt time.Time,
	relayErr *types.NewAPIError,
) {
	if !perf_metrics_setting.GetSetting().Enabled || info == nil || channelID <= 0 {
		return
	}

	now := time.Now()
	durationSeconds := 0.0
	if !startedAt.IsZero() && startedAt.Before(now) {
		durationSeconds = now.Sub(startedAt).Seconds()
	}

	hasTtft := info.IsStream && info.HasSendResponse() && !info.FirstResponseTime.Before(startedAt)
	ttftSeconds := 0.0
	if hasTtft {
		ttftSeconds = info.FirstResponseTime.Sub(startedAt).Seconds()
		if ttftSeconds < 0 {
			hasTtft = false
			ttftSeconds = 0
		}
	}

	status, errorCategory := classifyChannelAttempt(info, relayErr)
	for {
		actual, _ := prometheusChannelBuckets.LoadOrStore(channelID, newPrometheusChannelBucket())
		if actual.(*prometheusChannelBucket).addAttempt(
			channelName,
			status,
			errorCategory,
			durationSeconds,
			ttftSeconds,
			hasTtft,
		) {
			break
		}
		prometheusChannelBuckets.CompareAndDelete(channelID, actual)
	}

	if info.OriginModelName == "" {
		return
	}
	recordPrometheusChannelModelAttempt(channelID, info.OriginModelName, status)
}

func RecordChannelTokens(info *relaycommon.RelayInfo, inputTokens int64, outputTokens int64) {
	if !perf_metrics_setting.GetSetting().Enabled || info == nil {
		return
	}
	if info.ChannelId <= 0 || info.OriginModelName == "" || (inputTokens <= 0 && outputTokens <= 0) {
		return
	}
	if status, _ := classifyChannelAttempt(info, nil); status != "success" {
		return
	}

	key := prometheusChannelModelKey{channelID: info.ChannelId, model: info.OriginModelName}
	for {
		actual, _ := prometheusChannelModelBuckets.LoadOrStore(key, newPrometheusChannelModelBucket())
		if actual.(*prometheusChannelModelBucket).addTokens(inputTokens, outputTokens) {
			return
		}
		prometheusChannelModelBuckets.CompareAndDelete(key, actual)
	}
}

func classifyChannelAttempt(info *relaycommon.RelayInfo, relayErr *types.NewAPIError) (string, string) {
	if relayErr != nil || info == nil || !info.IsStream || info.StreamStatus == nil {
		return classifyChannelError(relayErr)
	}

	streamStatus := info.StreamStatus
	switch streamStatus.EndReason {
	case relaycommon.StreamEndReasonClientGone:
		return "client_cancel", "client_cancel"
	case relaycommon.StreamEndReasonTimeout, relaycommon.StreamEndReasonFirstResponseTimeout:
		return "error", "timeout"
	}
	if !streamStatus.IsNormalEnd() || streamStatus.HasErrors() {
		return "error", "other"
	}
	return "success", "none"
}

func recordPrometheusChannelModelAttempt(channelID int, modelName string, status string) {
	key := prometheusChannelModelKey{channelID: channelID, model: modelName}
	for {
		actual, _ := prometheusChannelModelBuckets.LoadOrStore(key, newPrometheusChannelModelBucket())
		if actual.(*prometheusChannelModelBucket).addAttempt(status) {
			return
		}
		prometheusChannelModelBuckets.CompareAndDelete(key, actual)
	}
}

func classifyChannelError(relayErr *types.NewAPIError) (string, string) {
	if relayErr == nil {
		return "success", "none"
	}
	if errors.Is(relayErr, context.Canceled) {
		return "client_cancel", "client_cancel"
	}

	errorCode := relayErr.GetErrorCode()
	if errors.Is(relayErr, context.DeadlineExceeded) ||
		errorCode == types.ErrorCodeChannelResponseTimeExceeded ||
		relayErr.StatusCode == http.StatusRequestTimeout ||
		relayErr.StatusCode == http.StatusGatewayTimeout {
		return "error", "timeout"
	}
	var networkError net.Error
	if errors.As(relayErr, &networkError) && networkError.Timeout() {
		return "error", "timeout"
	}

	if relayErr.StatusCode == http.StatusTooManyRequests {
		return "error", "rate_limit"
	}
	if relayErr.StatusCode == http.StatusUnauthorized ||
		relayErr.StatusCode == http.StatusForbidden ||
		errorCode == types.ErrorCodeChannelInvalidKey {
		return "error", "auth"
	}

	switch errorCode {
	case types.ErrorCodeReadResponseBodyFailed,
		types.ErrorCodeBadResponse,
		types.ErrorCodeBadResponseBody,
		types.ErrorCodeEmptyResponse:
		return "error", "bad_response"
	case types.ErrorCodeDoRequestFailed,
		types.ErrorCodeAwsInvokeError,
		types.ErrorCodeChannelAwsClientError:
		return "error", "network"
	}

	if relayErr.StatusCode >= http.StatusBadRequest && relayErr.StatusCode < http.StatusInternalServerError {
		return "error", "upstream_4xx"
	}
	if relayErr.StatusCode >= http.StatusInternalServerError && relayErr.StatusCode <= 599 {
		return "error", "upstream_5xx"
	}
	return "error", "other"
}

func Record(sample Sample) {
	setting := perf_metrics_setting.GetSetting()
	if !setting.Enabled || sample.Model == "" {
		return
	}
	if sample.Group == "" {
		sample.Group = "default"
	}
	if sample.LatencyMs < 0 {
		sample.LatencyMs = 0
	}

	key := bucketKey{
		model:    sample.Model,
		group:    sample.Group,
		bucketTs: bucketStart(time.Now().Unix()),
	}
	actual, _ := hotBuckets.LoadOrStore(key, &atomicBucket{})
	actual.(*atomicBucket).add(sample)
	recordPrometheusPending(sample)
}

func Query(params QueryParams) (QueryResult, error) {
	if params.Hours <= 0 {
		params.Hours = 24
	}
	if params.Hours > 24*30 {
		params.Hours = 24 * 30
	}
	endTs := time.Now().Unix()
	startTs := endTs - int64(params.Hours)*3600

	allowedGroups := allowedGroupSet(params.Groups)
	groupAllowed := func(group string) bool {
		if params.Group != "" {
			return group == params.Group
		}
		if allowedGroups == nil {
			return true
		}
		_, ok := allowedGroups[group]
		return ok
	}

	merged := map[bucketKey]counters{}
	rows, err := model.GetPerfMetrics(params.Model, params.Group, startTs, endTs)
	if err != nil {
		return QueryResult{}, err
	}
	for _, row := range rows {
		if !groupAllowed(row.Group) {
			continue
		}
		mergeCounters(merged, bucketKey{
			model:    row.ModelName,
			group:    row.Group,
			bucketTs: row.BucketTs,
		}, counters{
			requestCount:   row.RequestCount,
			successCount:   row.SuccessCount,
			totalLatencyMs: row.TotalLatencyMs,
			ttftSumMs:      row.TtftSumMs,
			ttftCount:      row.TtftCount,
			outputTokens:   row.OutputTokens,
			generationMs:   row.GenerationMs,
		})
	}

	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.model != params.Model || k.bucketTs < startTs || k.bucketTs > endTs {
			return true
		}
		if !groupAllowed(k.group) {
			return true
		}
		mergeCounters(merged, k, value.(*atomicBucket).snapshot())
		return true
	})

	if params.MergeGroups {
		collapsed := map[bucketKey]counters{}
		for k, v := range merged {
			k.group = "all"
			mergeCounters(collapsed, k, v)
		}
		merged = collapsed
	}

	return buildQueryResult(params.Model, merged), nil
}

func QuerySummaryAll(hours int, groups []string) (SummaryAllResult, error) {
	if hours <= 0 {
		hours = 24
	}
	if hours > 24*30 {
		hours = 24 * 30
	}
	endTs := time.Now().Unix()
	startTs := endTs - int64(hours)*3600
	allowedGroups := allowedGroupSet(groups)

	rows, err := model.GetPerfMetricsSummaryAll(startTs, endTs, groups)
	if err != nil {
		return SummaryAllResult{}, err
	}

	totals := map[string]counters{}
	for _, row := range rows {
		totals[row.ModelName] = counters{
			requestCount:   row.RequestCount,
			successCount:   row.SuccessCount,
			totalLatencyMs: row.TotalLatencyMs,
			ttftSumMs:      row.TtftSumMs,
			ttftCount:      row.TtftCount,
			outputTokens:   row.OutputTokens,
			generationMs:   row.GenerationMs,
		}
	}

	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.bucketTs < startTs || k.bucketTs > endTs {
			return true
		}
		if allowedGroups != nil {
			if _, ok := allowedGroups[k.group]; !ok {
				return true
			}
		}
		snap := value.(*atomicBucket).snapshot()
		if snap.requestCount == 0 {
			return true
		}
		cur := totals[k.model]
		cur.requestCount += snap.requestCount
		cur.successCount += snap.successCount
		cur.totalLatencyMs += snap.totalLatencyMs
		cur.ttftSumMs += snap.ttftSumMs
		cur.ttftCount += snap.ttftCount
		cur.outputTokens += snap.outputTokens
		cur.generationMs += snap.generationMs
		totals[k.model] = cur
		return true
	})

	models := make([]ModelSummary, 0, len(totals))
	for name, total := range totals {
		if total.requestCount == 0 {
			continue
		}
		avgLatency := total.totalLatencyMs / total.requestCount
		successRate := float64(total.successCount) / float64(total.requestCount) * 100
		avgTps := 0.0
		if total.generationMs > 0 {
			avgTps = float64(total.outputTokens) / (float64(total.generationMs) / 1000.0)
		}
		avgTtft := int64(0)
		if total.ttftCount > 0 {
			avgTtft = total.ttftSumMs / total.ttftCount
		}
		models = append(models, ModelSummary{
			ModelName:    name,
			AvgLatencyMs: avgLatency,
			AvgTtftMs:    avgTtft,
			SuccessRate:  math.Round(successRate*100) / 100,
			AvgTps:       math.Round(avgTps*100) / 100,
			RequestCount: total.requestCount,
		})
	}
	sort.Slice(models, func(i, j int) bool {
		return models[i].RequestCount > models[j].RequestCount
	})

	return SummaryAllResult{Models: models}, nil
}

func allowedGroupSet(groups []string) map[string]struct{} {
	if groups == nil {
		return nil
	}
	allowed := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		allowed[group] = struct{}{}
	}
	return allowed
}

func bucketStart(ts int64) int64 {
	bucketSeconds := perf_metrics_setting.GetBucketSeconds()
	if bucketSeconds <= 0 {
		bucketSeconds = 3600
	}
	return ts - (ts % bucketSeconds)
}

func mergeCounters(merged map[bucketKey]counters, key bucketKey, value counters) {
	if value.requestCount == 0 {
		return
	}
	current := merged[key]
	current.requestCount += value.requestCount
	current.successCount += value.successCount
	current.totalLatencyMs += value.totalLatencyMs
	current.ttftSumMs += value.ttftSumMs
	current.ttftCount += value.ttftCount
	current.outputTokens += value.outputTokens
	current.generationMs += value.generationMs
	merged[key] = current
}

func buildQueryResult(modelName string, merged map[bucketKey]counters) QueryResult {
	groupBuckets := map[string]map[int64]counters{}
	for key, value := range merged {
		if value.requestCount == 0 {
			continue
		}
		if _, ok := groupBuckets[key.group]; !ok {
			groupBuckets[key.group] = map[int64]counters{}
		}
		groupBuckets[key.group][key.bucketTs] = value
	}

	groups := make([]string, 0, len(groupBuckets))
	for group := range groupBuckets {
		groups = append(groups, group)
	}
	sort.Strings(groups)

	results := make([]GroupResult, 0, len(groups))
	for _, group := range groups {
		buckets := groupBuckets[group]
		timestamps := make([]int64, 0, len(buckets))
		for ts := range buckets {
			timestamps = append(timestamps, ts)
		}
		sort.Slice(timestamps, func(i, j int) bool {
			return timestamps[i] < timestamps[j]
		})

		total := counters{}
		series := make([]BucketPoint, 0, len(timestamps))
		for _, ts := range timestamps {
			value := buckets[ts]
			total.requestCount += value.requestCount
			total.successCount += value.successCount
			total.totalLatencyMs += value.totalLatencyMs
			total.ttftSumMs += value.ttftSumMs
			total.ttftCount += value.ttftCount
			total.outputTokens += value.outputTokens
			total.generationMs += value.generationMs
			series = append(series, bucketPoint(ts, value))
		}

		results = append(results, GroupResult{
			Group:        group,
			AvgTtftMs:    avg(total.ttftSumMs, total.ttftCount),
			AvgLatencyMs: avg(total.totalLatencyMs, total.requestCount),
			SuccessRate:  successRate(total),
			AvgTps:       avgTps(total),
			Series:       series,
		})
	}

	return QueryResult{
		ModelName:    modelName,
		SeriesSchema: seriesSchema,
		Groups:       results,
	}
}

func bucketPoint(ts int64, value counters) BucketPoint {
	return BucketPoint{
		Ts:           ts,
		AvgTtftMs:    avg(value.ttftSumMs, value.ttftCount),
		AvgLatencyMs: avg(value.totalLatencyMs, value.requestCount),
		SuccessRate:  successRate(value),
		AvgTps:       avgTps(value),
	}
}

func avg(sum int64, count int64) int64 {
	if count <= 0 {
		return 0
	}
	return sum / count
}

func successRate(value counters) float64 {
	if value.requestCount <= 0 {
		return 0
	}
	return float64(value.successCount) / float64(value.requestCount) * 100
}

func avgTps(value counters) float64 {
	if value.outputTokens <= 0 || value.generationMs <= 0 {
		return 0
	}
	return float64(value.outputTokens) / (float64(value.generationMs) / 1000)
}

func recordPrometheusPending(sample Sample) {
	if sample.Model == "" {
		return
	}
	key := prometheusSeriesKey{
		model:  sample.Model,
		status: prometheusStatus(sample.Success),
	}
	for {
		actual, _ := prometheusPendingBuckets.LoadOrStore(key, &prometheusLockedBucket{})
		if actual.(*prometheusLockedBucket).add(sample) {
			return
		}
		prometheusPendingBuckets.CompareAndDelete(key, actual)
	}
}

func prometheusStatus(success bool) string {
	if success {
		return "success"
	}
	return "error"
}
