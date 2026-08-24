package perfmetrics

import (
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/QuantumNous/new-api/types"
)

const (
	prometheusMaxModelHistogramModelsEnv     = "PROMETHEUS_MAX_MODEL_HISTOGRAM_MODELS"
	defaultPrometheusMaxModelHistogramModels = 50
	prometheusModelIdleRetention             = time.Hour

	modelDropModelLimit     = "model_limit"
	modelDropInvalidLatency = "invalid_latency"
	modelDropInvalidTTFT    = "invalid_ttft"
	modelDropSeriesLimit    = "series_limit"
)

var modelDropReasons = []string{
	modelDropModelLimit,
	modelDropInvalidLatency,
	modelDropInvalidTTFT,
	modelDropSeriesLimit,
}

var prometheusModelLatencyBucketsSeconds = []float64{
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

var prometheusModelTTFTBucketsSeconds = []float64{
	0.1,
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
}

type prometheusModelDropCounters struct {
	modelLimit     atomic.Int64
	invalidLatency atomic.Int64
	invalidTTFT    atomic.Int64
	seriesLimit    atomic.Int64
}

func (c *prometheusModelDropCounters) add(reason string, count int64) {
	if count <= 0 {
		return
	}
	switch reason {
	case modelDropModelLimit:
		c.modelLimit.Add(count)
	case modelDropInvalidLatency:
		c.invalidLatency.Add(count)
	case modelDropInvalidTTFT:
		c.invalidTTFT.Add(count)
	case modelDropSeriesLimit:
		c.seriesLimit.Add(count)
	}
}

func (c *prometheusModelDropCounters) snapshot() map[string]int64 {
	return map[string]int64{
		modelDropModelLimit:     c.modelLimit.Load(),
		modelDropInvalidLatency: c.invalidLatency.Load(),
		modelDropInvalidTTFT:    c.invalidTTFT.Load(),
		modelDropSeriesLimit:    c.seriesLimit.Load(),
	}
}

type prometheusModelPerformanceBucket struct {
	mu sync.Mutex

	latencyBuckets    []int64
	latencySumSeconds float64
	latencyCount      int64

	ttftBuckets    []int64
	ttftSumSeconds float64
	ttftCount      int64

	streamSuccess int64
	errors        map[string]int64

	lastUpdatedAt int64
	retired       bool

	lastReportedLatencyCount int64
	lastReportedTTFTCount    int64
}

type prometheusModelPerformanceSnapshot struct {
	model string

	latencyBuckets    []int64
	latencySumSeconds float64
	latencyCount      int64

	ttftBuckets    []int64
	ttftSumSeconds float64
	ttftCount      int64

	streamSuccess int64
	errors        map[string]int64

	lastUpdatedAt int64
	bucket        *prometheusModelPerformanceBucket
}

func (s prometheusModelPerformanceSnapshot) seriesCount() int {
	count := 0
	if s.latencyCount > 0 {
		count += len(prometheusModelLatencyBucketsSeconds) + 3
	}
	if s.ttftCount > 0 {
		count += len(prometheusModelTTFTBucketsSeconds) + 3
	}
	if s.streamSuccess > 0 {
		count++
	}
	count += len(s.errors)
	return count
}

func newPrometheusModelPerformanceBucket(now time.Time) *prometheusModelPerformanceBucket {
	return &prometheusModelPerformanceBucket{
		latencyBuckets: make([]int64, len(prometheusModelLatencyBucketsSeconds)),
		ttftBuckets:    make([]int64, len(prometheusModelTTFTBucketsSeconds)),
		errors:         make(map[string]int64),
		lastUpdatedAt:  now.UnixNano(),
	}
}

func (b *prometheusModelPerformanceBucket) addSuccess(
	now time.Time,
	latencySeconds *float64,
	isStream bool,
	ttftSeconds *float64,
) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	if latencySeconds != nil {
		b.latencySumSeconds += *latencySeconds
		b.latencyCount++
		incrementCumulativeBuckets(b.latencyBuckets, prometheusModelLatencyBucketsSeconds, *latencySeconds)
	}
	if ttftSeconds != nil {
		b.ttftSumSeconds += *ttftSeconds
		b.ttftCount++
		incrementCumulativeBuckets(b.ttftBuckets, prometheusModelTTFTBucketsSeconds, *ttftSeconds)
	}
	if isStream {
		b.streamSuccess++
	}
	b.lastUpdatedAt = now.UnixNano()
	return true
}

func (b *prometheusModelPerformanceBucket) addError(now time.Time, category string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	b.errors[category]++
	b.lastUpdatedAt = now.UnixNano()
	return true
}

func (b *prometheusModelPerformanceBucket) snapshot(model string) (prometheusModelPerformanceSnapshot, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return prometheusModelPerformanceSnapshot{}, false
	}
	errorsCopy := make(map[string]int64, len(b.errors))
	for category, count := range b.errors {
		errorsCopy[category] = count
	}
	return prometheusModelPerformanceSnapshot{
		model:             model,
		latencyBuckets:    append([]int64(nil), b.latencyBuckets...),
		latencySumSeconds: b.latencySumSeconds,
		latencyCount:      b.latencyCount,
		ttftBuckets:       append([]int64(nil), b.ttftBuckets...),
		ttftSumSeconds:    b.ttftSumSeconds,
		ttftCount:         b.ttftCount,
		streamSuccess:     b.streamSuccess,
		errors:            errorsCopy,
		lastUpdatedAt:     b.lastUpdatedAt,
		bucket:            b,
	}, true
}

func (b *prometheusModelPerformanceBucket) markExported(latencyCount int64, ttftCount int64) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if latencyCount > b.lastReportedLatencyCount {
		b.lastReportedLatencyCount = latencyCount
	}
	if ttftCount > b.lastReportedTTFTCount {
		b.lastReportedTTFTCount = ttftCount
	}
}

func (b *prometheusModelPerformanceBucket) markSeriesLimited(latencyCount int64, ttftCount int64) int64 {
	b.mu.Lock()
	defer b.mu.Unlock()
	droppedLatency := latencyCount - b.lastReportedLatencyCount
	if droppedLatency < 0 {
		droppedLatency = 0
	}
	droppedTTFT := ttftCount - b.lastReportedTTFTCount
	if droppedTTFT < 0 {
		droppedTTFT = 0
	}
	if latencyCount > b.lastReportedLatencyCount {
		b.lastReportedLatencyCount = latencyCount
	}
	if ttftCount > b.lastReportedTTFTCount {
		b.lastReportedTTFTCount = ttftCount
	}
	return droppedLatency + droppedTTFT
}

func (b *prometheusModelPerformanceBucket) retireIfIdle(cutoffUnixNano int64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return true
	}
	if b.lastUpdatedAt == 0 || b.lastUpdatedAt >= cutoffUnixNano {
		return false
	}
	b.retired = true
	return true
}

func recordPrometheusModelPerformance(
	info *relaycommon.RelayInfo,
	success bool,
	relayErr *types.NewAPIError,
	now time.Time,
) {
	if !perf_metrics_setting.GetSetting().Enabled || info == nil || info.OriginModelName == "" {
		return
	}

	if !success {
		category := "other"
		if relayErr != nil {
			_, category = classifyChannelError(relayErr)
		} else {
			_, category = classifyChannelAttempt(info, nil)
		}
		if category == "none" {
			category = "other"
		}
		mutatePrometheusModelPerformance(info.OriginModelName, now, func(bucket *prometheusModelPerformanceBucket) bool {
			return bucket.addError(now, category)
		})
		return
	}

	var latencySeconds *float64
	if !info.StartTime.IsZero() && info.StartTime.Before(now) {
		latency := now.Sub(info.StartTime).Seconds()
		latencySeconds = &latency
	} else {
		prometheusModelDroppedSamples.add(modelDropInvalidLatency, 1)
	}

	var ttftSeconds *float64
	hasFirstResponse := !info.FirstResponseTime.IsZero() &&
		!info.FirstResponseTime.Equal(info.StartTime.Add(-time.Second))
	if info.IsStream && hasFirstResponse {
		if latencySeconds != nil && info.FirstResponseTime.After(info.StartTime) && !info.FirstResponseTime.After(now) {
			ttft := info.FirstResponseTime.Sub(info.StartTime).Seconds()
			ttftSeconds = &ttft
		} else {
			prometheusModelDroppedSamples.add(modelDropInvalidTTFT, 1)
		}
	}

	mutatePrometheusModelPerformance(info.OriginModelName, now, func(bucket *prometheusModelPerformanceBucket) bool {
		return bucket.addSuccess(now, latencySeconds, info.IsStream, ttftSeconds)
	})
}

func mutatePrometheusModelPerformance(
	model string,
	now time.Time,
	mutate func(*prometheusModelPerformanceBucket) bool,
) {
	mutatePrometheusModelPerformanceWithLoader(model, now, loadOrCreatePrometheusModelBucket, mutate)
}

func mutatePrometheusModelPerformanceWithLoader(
	model string,
	now time.Time,
	load func(string, time.Time) (*prometheusModelPerformanceBucket, bool),
	mutate func(*prometheusModelPerformanceBucket) bool,
) {
	for {
		bucket, admitted := load(model, now)
		if !admitted {
			return
		}
		if mutate(bucket) {
			return
		}
		prometheusModelPerformanceBuckets.CompareAndDelete(model, bucket)
	}
}

func loadOrCreatePrometheusModelBucket(model string, now time.Time) (*prometheusModelPerformanceBucket, bool) {
	if value, ok := prometheusModelPerformanceBuckets.Load(model); ok {
		return value.(*prometheusModelPerformanceBucket), true
	}

	prometheusModelAdmissionMu.Lock()
	defer prometheusModelAdmissionMu.Unlock()
	if value, ok := prometheusModelPerformanceBuckets.Load(model); ok {
		return value.(*prometheusModelPerformanceBucket), true
	}

	pruneIdlePrometheusModelPerformanceBuckets(now)
	maxModels := common.GetEnvOrDefault(
		prometheusMaxModelHistogramModelsEnv,
		defaultPrometheusMaxModelHistogramModels,
	)
	if maxModels > 0 && syncMapLenForPrometheusModelPerformance() >= maxModels {
		prometheusModelDroppedSamples.add(modelDropModelLimit, 1)
		return nil, false
	}

	bucket := newPrometheusModelPerformanceBucket(now)
	prometheusModelPerformanceBuckets.Store(model, bucket)
	return bucket, true
}

func snapshotPrometheusModelPerformances(now time.Time) []prometheusModelPerformanceSnapshot {
	prometheusModelAdmissionMu.Lock()
	pruneIdlePrometheusModelPerformanceBuckets(now)
	snapshots := make([]prometheusModelPerformanceSnapshot, 0)
	prometheusModelPerformanceBuckets.Range(func(key, value any) bool {
		if snapshot, ok := value.(*prometheusModelPerformanceBucket).snapshot(key.(string)); ok {
			snapshots = append(snapshots, snapshot)
		}
		return true
	})
	prometheusModelAdmissionMu.Unlock()

	sort.Slice(snapshots, func(i, j int) bool {
		if snapshots[i].lastUpdatedAt != snapshots[j].lastUpdatedAt {
			return snapshots[i].lastUpdatedAt > snapshots[j].lastUpdatedAt
		}
		return snapshots[i].model < snapshots[j].model
	})
	return snapshots
}

func selectPrometheusModelSnapshots(
	snapshots []prometheusModelPerformanceSnapshot,
	remaining int,
) ([]prometheusModelPerformanceSnapshot, int64) {
	selected := make([]prometheusModelPerformanceSnapshot, 0, len(snapshots))
	var dropped int64
	exhausted := false
	for _, snapshot := range snapshots {
		seriesCount := snapshot.seriesCount()
		if !exhausted && seriesCount <= remaining {
			selected = append(selected, snapshot)
			remaining -= seriesCount
			if snapshot.bucket != nil {
				snapshot.bucket.markExported(snapshot.latencyCount, snapshot.ttftCount)
			}
			continue
		}
		exhausted = true
		if snapshot.bucket != nil {
			dropped += snapshot.bucket.markSeriesLimited(snapshot.latencyCount, snapshot.ttftCount)
		}
	}
	return selected, dropped
}

func pruneIdlePrometheusModelPerformanceBuckets(now time.Time) {
	idleCutoff := now.Add(-prometheusModelIdleRetention).UnixNano()
	prometheusModelPerformanceBuckets.Range(func(key, value any) bool {
		bucket := value.(*prometheusModelPerformanceBucket)
		if bucket.retireIfIdle(idleCutoff) {
			prometheusModelPerformanceBuckets.CompareAndDelete(key, value)
		}
		return true
	})
}

func syncMapLenForPrometheusModelPerformance() int {
	count := 0
	prometheusModelPerformanceBuckets.Range(func(_, _ any) bool {
		count++
		return true
	})
	return count
}

func incrementCumulativeBuckets(counts []int64, upperBounds []float64, value float64) {
	for i, upperBound := range upperBounds {
		if value <= upperBound {
			counts[i]++
		}
	}
}
