package perfmetrics

import (
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

var prometheusRecallTranslationDurationBucketsSeconds = []float64{
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

type prometheusRecallTranslationKey struct {
	event      string
	status     string
	errorClass string
}

type prometheusRecallTranslationBucket struct {
	mu              sync.Mutex
	count           int64
	leaseRecoveries int64
	lastUpdatedAt   int64
	retired         bool
}

type prometheusRecallTranslationDurationBucket struct {
	mu                 sync.Mutex
	buckets            []int64
	durationSumSeconds float64
	durationCount      int64
	lastUpdatedAt      int64
	retired            bool
}

type prometheusRecallTranslationSnapshot struct {
	key             prometheusRecallTranslationKey
	count           int64
	leaseRecoveries int64
}

type prometheusRecallTranslationDurationSnapshot struct {
	status             string
	buckets            []int64
	durationSumSeconds float64
	durationCount      int64
}

func RecordRecallTranslationObservation(event, status, errorClass string, leaseRecovered bool, durationMs int64) {
	if !perf_metrics_setting.GetSetting().Enabled {
		return
	}
	key := prometheusRecallTranslationKey{
		event:      normalizeRecallTranslationMetricEvent(event),
		status:     normalizeRecallTranslationMetricStatus(status),
		errorClass: normalizeRecallTranslationMetricErrorClass(errorClass),
	}
	for {
		actual, _ := prometheusRecallTranslationBuckets.LoadOrStore(key, &prometheusRecallTranslationBucket{})
		if actual.(*prometheusRecallTranslationBucket).add(leaseRecovered) {
			break
		}
		prometheusRecallTranslationBuckets.CompareAndDelete(key, actual)
	}
	if !recallTranslationMetricEventHasDuration(key.event) {
		return
	}
	if durationMs < 0 {
		durationMs = 0
	}
	status = key.status
	durationSeconds := float64(durationMs) / 1000
	for {
		actual, _ := prometheusRecallTranslationDurationBuckets.LoadOrStore(
			status,
			&prometheusRecallTranslationDurationBucket{
				buckets: make([]int64, len(prometheusRecallTranslationDurationBucketsSeconds)),
			},
		)
		if actual.(*prometheusRecallTranslationDurationBucket).add(durationSeconds) {
			return
		}
		prometheusRecallTranslationDurationBuckets.CompareAndDelete(status, actual)
	}
}

func recallTranslationMetricEventHasDuration(event string) bool {
	switch event {
	case "succeeded", "failed", "superseded", "lease_lost":
		return true
	default:
		return false
	}
}

func normalizeRecallTranslationMetricEvent(event string) string {
	switch strings.TrimSpace(event) {
	case "queued", "claimed", "running", "succeeded", "failed", "superseded", "lease_lost":
		return strings.TrimSpace(event)
	default:
		return "other"
	}
}

func normalizeRecallTranslationMetricStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "queued", "running", "succeeded", "failed", "superseded":
		return strings.TrimSpace(status)
	default:
		return "other"
	}
}

func normalizeRecallTranslationMetricErrorClass(errorClass string) string {
	switch strings.TrimSpace(errorClass) {
	case "":
		return "none"
	case "invalid_source_snapshot", "translation_failed", "invalid_translation_output", "translation_lease_lost":
		return strings.TrimSpace(errorClass)
	default:
		return "other"
	}
}

func (b *prometheusRecallTranslationBucket) add(leaseRecovered bool) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	b.count++
	if leaseRecovered {
		b.leaseRecoveries++
	}
	b.lastUpdatedAt = time.Now().UnixNano()
	return true
}

func (b *prometheusRecallTranslationBucket) snapshot(key prometheusRecallTranslationKey) prometheusRecallTranslationSnapshot {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return prometheusRecallTranslationSnapshot{}
	}
	return prometheusRecallTranslationSnapshot{
		key:             key,
		count:           b.count,
		leaseRecoveries: b.leaseRecoveries,
	}
}

func (b *prometheusRecallTranslationBucket) retireIfIdle(cutoffUnixNano int64) bool {
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

func (b *prometheusRecallTranslationDurationBucket) add(durationSeconds float64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	b.durationSumSeconds += durationSeconds
	b.durationCount++
	incrementCumulativeBuckets(b.buckets, prometheusRecallTranslationDurationBucketsSeconds, durationSeconds)
	b.lastUpdatedAt = time.Now().UnixNano()
	return true
}

func (b *prometheusRecallTranslationDurationBucket) snapshot(status string) prometheusRecallTranslationDurationSnapshot {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return prometheusRecallTranslationDurationSnapshot{}
	}
	return prometheusRecallTranslationDurationSnapshot{
		status:             status,
		buckets:            append([]int64(nil), b.buckets...),
		durationSumSeconds: b.durationSumSeconds,
		durationCount:      b.durationCount,
	}
}

func (b *prometheusRecallTranslationDurationBucket) retireIfIdle(cutoffUnixNano int64) bool {
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

func snapshotPrometheusRecallTranslations() []prometheusRecallTranslationSnapshot {
	idleCutoff := time.Now().Add(-prometheusSeriesIdleRetention).UnixNano()
	snapshots := make([]prometheusRecallTranslationSnapshot, 0)
	prometheusRecallTranslationBuckets.Range(func(key, value any) bool {
		bucket := value.(*prometheusRecallTranslationBucket)
		if bucket.retireIfIdle(idleCutoff) {
			prometheusRecallTranslationBuckets.CompareAndDelete(key, value)
			return true
		}
		snapshot := bucket.snapshot(key.(prometheusRecallTranslationKey))
		if snapshot.count > 0 {
			snapshots = append(snapshots, snapshot)
		}
		return true
	})
	sort.Slice(snapshots, func(i, j int) bool {
		if snapshots[i].key.event != snapshots[j].key.event {
			return snapshots[i].key.event < snapshots[j].key.event
		}
		if snapshots[i].key.status != snapshots[j].key.status {
			return snapshots[i].key.status < snapshots[j].key.status
		}
		return snapshots[i].key.errorClass < snapshots[j].key.errorClass
	})
	return snapshots
}

func snapshotPrometheusRecallTranslationDurations() []prometheusRecallTranslationDurationSnapshot {
	idleCutoff := time.Now().Add(-prometheusSeriesIdleRetention).UnixNano()
	snapshots := make([]prometheusRecallTranslationDurationSnapshot, 0)
	prometheusRecallTranslationDurationBuckets.Range(func(key, value any) bool {
		bucket := value.(*prometheusRecallTranslationDurationBucket)
		if bucket.retireIfIdle(idleCutoff) {
			prometheusRecallTranslationDurationBuckets.CompareAndDelete(key, value)
			return true
		}
		snapshot := bucket.snapshot(key.(string))
		if snapshot.durationCount > 0 {
			snapshots = append(snapshots, snapshot)
		}
		return true
	})
	sort.Slice(snapshots, func(i, j int) bool {
		return snapshots[i].status < snapshots[j].status
	})
	return snapshots
}

func recallTranslationSeriesCount(
	snapshots []prometheusRecallTranslationSnapshot,
	durationSnapshots []prometheusRecallTranslationDurationSnapshot,
) int {
	count := len(snapshots)
	for _, snapshot := range snapshots {
		if snapshot.leaseRecoveries > 0 {
			count++
		}
	}
	for _, snapshot := range durationSnapshots {
		if snapshot.durationCount > 0 {
			count += len(prometheusRecallTranslationDurationBucketsSeconds) + 3
		}
	}
	return count
}

func writePrometheusRecallTranslationMetrics(
	b *strings.Builder,
	snapshots []prometheusRecallTranslationSnapshot,
	durationSnapshots []prometheusRecallTranslationDurationSnapshot,
) {
	if len(snapshots) > 0 {
		b.WriteString("# HELP newapi_recall_translation_tasks_total Total recall translation task observations by lifecycle event and status.\n")
		b.WriteString("# TYPE newapi_recall_translation_tasks_total counter\n")
		for _, snapshot := range snapshots {
			b.WriteString("newapi_recall_translation_tasks_total{")
			writePrometheusRecallTranslationLabels(b, snapshot.key)
			b.WriteString("} ")
			b.WriteString(strconv.FormatInt(snapshot.count, 10))
			b.WriteByte('\n')
		}
	}
	hasLeaseRecovery := false
	for _, snapshot := range snapshots {
		hasLeaseRecovery = hasLeaseRecovery || snapshot.leaseRecoveries > 0
	}
	if hasLeaseRecovery {
		b.WriteString("# HELP newapi_recall_translation_lease_recoveries_total Total recall translation task claims that recovered an expired lease.\n")
		b.WriteString("# TYPE newapi_recall_translation_lease_recoveries_total counter\n")
		for _, snapshot := range snapshots {
			if snapshot.leaseRecoveries == 0 {
				continue
			}
			b.WriteString("newapi_recall_translation_lease_recoveries_total{")
			writePrometheusRecallTranslationLabels(b, snapshot.key)
			b.WriteString("} ")
			b.WriteString(strconv.FormatInt(snapshot.leaseRecoveries, 10))
			b.WriteByte('\n')
		}
	}
	if len(durationSnapshots) == 0 {
		return
	}
	b.WriteString("# HELP newapi_recall_translation_duration_seconds Recall translation task completion duration by status.\n")
	b.WriteString("# TYPE newapi_recall_translation_duration_seconds histogram\n")
	for _, snapshot := range durationSnapshots {
		for i, upperBound := range prometheusRecallTranslationDurationBucketsSeconds {
			b.WriteString(`newapi_recall_translation_duration_seconds_bucket{status="`)
			b.WriteString(escapePrometheusLabelValue(snapshot.status))
			b.WriteString(`",le="`)
			b.WriteString(formatPrometheusFloat(upperBound))
			b.WriteString(`"} `)
			b.WriteString(strconv.FormatInt(snapshot.buckets[i], 10))
			b.WriteByte('\n')
		}
		b.WriteString(`newapi_recall_translation_duration_seconds_bucket{status="`)
		b.WriteString(escapePrometheusLabelValue(snapshot.status))
		b.WriteString(`",le="+Inf"} `)
		b.WriteString(strconv.FormatInt(snapshot.durationCount, 10))
		b.WriteByte('\n')
		b.WriteString(`newapi_recall_translation_duration_seconds_sum{status="`)
		b.WriteString(escapePrometheusLabelValue(snapshot.status))
		b.WriteString(`"} `)
		b.WriteString(formatPrometheusFloat(snapshot.durationSumSeconds))
		b.WriteByte('\n')
		b.WriteString(`newapi_recall_translation_duration_seconds_count{status="`)
		b.WriteString(escapePrometheusLabelValue(snapshot.status))
		b.WriteString(`"} `)
		b.WriteString(strconv.FormatInt(snapshot.durationCount, 10))
		b.WriteByte('\n')
	}
}

func writePrometheusRecallTranslationLabels(b *strings.Builder, key prometheusRecallTranslationKey) {
	b.WriteString(`event="`)
	b.WriteString(escapePrometheusLabelValue(key.event))
	b.WriteString(`",status="`)
	b.WriteString(escapePrometheusLabelValue(key.status))
	b.WriteString(`",error_class="`)
	b.WriteString(escapePrometheusLabelValue(key.errorClass))
	b.WriteByte('"')
}
