package channelflowmetrics

import (
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const flushInterval = time.Minute
const retentionDays = 8

func flushLoop() {
	for {
		time.Sleep(flushInterval)
		flushCompletedBuckets()
		cleanupExpiredMetrics()
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
		if !drained.hasData() {
			hotBuckets.Delete(key)
			return true
		}

		if err := model.UpsertChannelFlowMetricMinute(metricFromCounters(k, drained)); err != nil {
			bucket.addCounters(drained)
			common.SysError(fmt.Sprintf("failed to flush channel flow metric pool=%s channel=%d model=%s bucket=%d: %s", k.poolKey, k.channelID, k.model, k.bucketTs, err.Error()))
			return true
		}

		hotBuckets.Delete(key)
		return true
	})
}

func metricFromCounters(k bucketKey, c counters) *model.ChannelFlowMetricMinute {
	metric := &model.ChannelFlowMetricMinute{
		BucketTs:           k.bucketTs,
		PoolKey:            k.poolKey,
		ChannelId:          k.channelID,
		Model:              k.model,
		SampleCount:        c.sampleCount,
		RunningSum:         c.runningSum,
		RunningMax:         safeInt(c.runningMax),
		QueuedSum:          c.queuedSum,
		QueuedMax:          safeInt(c.queuedMax),
		AcquiredCount:      safeInt(c.acquiredCount),
		QueuedCount:        safeInt(c.queuedCount),
		ReleasedCount:      safeInt(c.releasedCount),
		RejectedCount:      safeInt(c.rejectedCount),
		TimeoutCount:       safeInt(c.timeoutCount),
		CancelledCount:     safeInt(c.cancelledCount),
		BillingFailedCount: safeInt(c.billingFailedCount),
		LeaseRenewFail:     safeInt(c.leaseRenewFail),
		LeaseExpiredCount:  safeInt(c.leaseExpiredCount),
		WaitMsSum:          c.waitMsSum,
		WaitSampleCount:    c.waitSampleCount,
		WaitMsMax:          c.waitMsMax,
		ProcessMsSum:       c.processMsSum,
		ProcessSampleCount: c.processSampleCount,
		ProcessMsMax:       c.processMsMax,
	}
	return metric
}

func cleanupExpiredMetrics() {
	cutoff := time.Now().Add(-retentionDays * 24 * time.Hour).Unix()
	if err := model.DeleteChannelFlowMetricMinutesBefore(cutoff); err != nil {
		common.SysError("failed to cleanup expired channel flow metrics: " + err.Error())
	}
}
