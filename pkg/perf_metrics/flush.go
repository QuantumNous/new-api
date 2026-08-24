package perfmetrics

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

func flushLoop() {
	for {
		interval := perf_metrics_setting.GetFlushIntervalMinutes()
		time.Sleep(time.Duration(interval) * time.Minute)
		setting := perf_metrics_setting.GetSetting()
		if !setting.Enabled {
			continue
		}
		flushCompletedBuckets()
		cleanupExpiredMetrics(setting.RetentionDays)
	}
}

func flushCompletedBuckets() {
	currentBucket := bucketStart(time.Now().Unix())
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.bucketTs >= currentBucket {
			return true
		}

		bucket := value.(*atomicBucket)
		drained := bucket.drain()
		if drained.requestCount == 0 {
			deleteOldEmptyBucket(k, key)
			return true
		}

		err := model.UpsertPerfMetric(&model.PerfMetric{
			ModelName:      k.model,
			Group:          k.group,
			BucketTs:       k.bucketTs,
			RequestCount:   drained.requestCount,
			SuccessCount:   drained.successCount,
			TotalLatencyMs: drained.totalLatencyMs,
			TtftSumMs:      drained.ttftSumMs,
			TtftCount:      drained.ttftCount,
			OutputTokens:   drained.outputTokens,
			GenerationMs:   drained.generationMs,
		})
		if err != nil {
			bucket.addCounters(drained)
			common.SysError(fmt.Sprintf("failed to flush perf metric bucket model=%s group=%s bucket=%d: %s", k.model, k.group, k.bucketTs, err.Error()))
			return true
		}

		deleteOldEmptyBucket(k, key)
		return true
	})
}

func deleteOldEmptyBucket(k bucketKey, rawKey any) {
	if k.bucketTs < bucketStart(time.Now().Add(-24*time.Hour).Unix()) {
		hotBuckets.Delete(rawKey)
	}
}

func cleanupExpiredMetrics(retentionDays int) {
	if retentionDays <= 0 {
		return
	}
	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour).Unix()
	if err := model.DeletePerfMetricsBefore(cutoff); err != nil {
		common.SysError("failed to cleanup expired perf metrics: " + err.Error())
	}
}
