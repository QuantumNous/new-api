package channelflowmetrics

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

const (
	defaultQueryHours = 6
	maxQueryHours     = 24 * 7
	maxQueryMinutes   = maxQueryHours * 60
	flowBucketSeconds = 60
)

var hotBuckets sync.Map

func Init() {
	go flushLoop()
}

func Record(sample Sample) {
	if sample.PoolKey == "" || sample.EventType == "" {
		return
	}
	key := bucketKey{
		poolKey:   sample.PoolKey,
		channelID: sample.ChannelID,
		model:     sample.Model,
		bucketTs:  bucketStart(time.Now().Unix()),
	}
	actual, _ := hotBuckets.LoadOrStore(key, &atomicBucket{})
	actual.(*atomicBucket).add(sample)
	recordRedis(key, sample)
}

func Query(params QueryParams) (TrendResult, error) {
	if params.Minutes <= 0 {
		if params.Hours <= 0 {
			params.Hours = defaultQueryHours
		}
		params.Minutes = params.Hours * 60
	}
	if params.Minutes > maxQueryMinutes {
		params.Minutes = maxQueryMinutes
	}
	endBucket := bucketStart(time.Now().Unix())
	bucketCount := params.Minutes * 60 / flowBucketSeconds
	if bucketCount <= 0 {
		bucketCount = 1
	}
	startBucket := endBucket - int64(bucketCount-1)*flowBucketSeconds

	merged := map[int64]counters{}
	rows, err := model.GetChannelFlowMetricMinutes(params.PoolKey, startBucket, endBucket)
	if err != nil {
		return TrendResult{}, err
	}
	for _, row := range rows {
		mergeCounters(merged, row.BucketTs, metricToCounters(row))
	}

	redisActiveMerged := mergeRedisActiveBucket(merged, params.PoolKey, endBucket)
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.poolKey != params.PoolKey || k.bucketTs < startBucket || k.bucketTs > endBucket {
			return true
		}
		if redisActiveMerged && k.bucketTs == endBucket {
			return true
		}
		mergeCounters(merged, k.bucketTs, value.(*atomicBucket).snapshot())
		return true
	})

	return TrendResult{
		PoolKey: params.PoolKey,
		Points:  buildPoints(merged, startBucket, endBucket),
		Totals:  buildTotals(merged),
	}, nil
}

func bucketStart(ts int64) int64 {
	return ts - (ts % flowBucketSeconds)
}

func mergeCounters(merged map[int64]counters, bucketTs int64, value counters) {
	if !value.hasData() {
		return
	}
	current := merged[bucketTs]
	current.sampleCount += value.sampleCount
	current.runningSum += value.runningSum
	if value.runningMax > current.runningMax {
		current.runningMax = value.runningMax
	}
	current.queuedSum += value.queuedSum
	if value.queuedMax > current.queuedMax {
		current.queuedMax = value.queuedMax
	}
	current.acquiredCount += value.acquiredCount
	current.queuedCount += value.queuedCount
	current.succeededCount += value.succeededCount
	current.failedCount += value.failedCount
	current.releasedCount += value.releasedCount
	current.rejectedCount += value.rejectedCount
	current.timeoutCount += value.timeoutCount
	current.cancelledCount += value.cancelledCount
	current.billingFailedCount += value.billingFailedCount
	current.leaseRenewFail += value.leaseRenewFail
	current.leaseExpiredCount += value.leaseExpiredCount
	current.waitMsSum += value.waitMsSum
	current.waitSampleCount += value.waitSampleCount
	if value.waitMsMax > current.waitMsMax {
		current.waitMsMax = value.waitMsMax
	}
	current.processMsSum += value.processMsSum
	current.processSampleCount += value.processSampleCount
	if value.processMsMax > current.processMsMax {
		current.processMsMax = value.processMsMax
	}
	merged[bucketTs] = current
}

func buildPoints(merged map[int64]counters, startBucket int64, endBucket int64) []ChannelFlowTrendPoint {
	if endBucket < startBucket {
		return []ChannelFlowTrendPoint{}
	}
	points := make([]ChannelFlowTrendPoint, 0, int((endBucket-startBucket)/flowBucketSeconds)+1)
	for ts := startBucket; ts <= endBucket; ts += flowBucketSeconds {
		points = append(points, counterPoint(ts, merged[ts]))
	}
	return points
}

func buildTotals(merged map[int64]counters) ChannelFlowTrendTotals {
	total := counters{}
	for _, value := range merged {
		total = mergeTwoCounters(total, value)
	}
	return ChannelFlowTrendTotals{
		RequestCount:       safeInt(total.requestCount()),
		RunningAvg:         safeInt(avg(total.runningSum, total.sampleCount)),
		RunningMax:         safeInt(total.runningMax),
		QueuedAvg:          safeInt(avg(total.queuedSum, total.sampleCount)),
		QueuedMax:          safeInt(total.queuedMax),
		AcquiredCount:      safeInt(total.acquiredCount),
		QueuedCount:        safeInt(total.queuedCount),
		SucceededCount:     safeInt(total.succeededCount),
		FailedCount:        safeInt(total.failedCount),
		ReleasedCount:      safeInt(total.releasedCount),
		RejectedCount:      safeInt(total.rejectedCount),
		TimeoutCount:       safeInt(total.timeoutCount),
		CancelledCount:     safeInt(total.cancelledCount),
		BillingFailedCount: safeInt(total.billingFailedCount),
		LeaseRenewFail:     safeInt(total.leaseRenewFail),
		LeaseExpiredCount:  safeInt(total.leaseExpiredCount),
		WaitMsAvg:          avg(total.waitMsSum, total.waitSampleCount),
		WaitMsMax:          total.waitMsMax,
		ProcessMsAvg:       avg(total.processMsSum, total.processSampleCount),
		ProcessMsMax:       total.processMsMax,
	}
}

func mergeTwoCounters(current counters, value counters) counters {
	current.sampleCount += value.sampleCount
	current.runningSum += value.runningSum
	if value.runningMax > current.runningMax {
		current.runningMax = value.runningMax
	}
	current.queuedSum += value.queuedSum
	if value.queuedMax > current.queuedMax {
		current.queuedMax = value.queuedMax
	}
	current.acquiredCount += value.acquiredCount
	current.queuedCount += value.queuedCount
	current.succeededCount += value.succeededCount
	current.failedCount += value.failedCount
	current.releasedCount += value.releasedCount
	current.rejectedCount += value.rejectedCount
	current.timeoutCount += value.timeoutCount
	current.cancelledCount += value.cancelledCount
	current.billingFailedCount += value.billingFailedCount
	current.leaseRenewFail += value.leaseRenewFail
	current.leaseExpiredCount += value.leaseExpiredCount
	current.waitMsSum += value.waitMsSum
	current.waitSampleCount += value.waitSampleCount
	if value.waitMsMax > current.waitMsMax {
		current.waitMsMax = value.waitMsMax
	}
	current.processMsSum += value.processMsSum
	current.processSampleCount += value.processSampleCount
	if value.processMsMax > current.processMsMax {
		current.processMsMax = value.processMsMax
	}
	return current
}

func counterPoint(ts int64, value counters) ChannelFlowTrendPoint {
	runningAvg := float64(0)
	queuedAvg := float64(0)
	if value.sampleCount > 0 {
		runningAvg = float64(value.runningSum) / float64(value.sampleCount)
		queuedAvg = float64(value.queuedSum) / float64(value.sampleCount)
	}
	return ChannelFlowTrendPoint{
		BucketTs:           ts,
		At:                 time.Unix(ts, 0).Format("15:04"),
		Running:            runningAvg,
		RunningAvg:         runningAvg,
		RunningMax:         safeInt(value.runningMax),
		Queued:             queuedAvg,
		QueuedAvg:          queuedAvg,
		QueuedMax:          safeInt(value.queuedMax),
		RequestCount:       safeInt(value.requestCount()),
		AcquiredCount:      safeInt(value.acquiredCount),
		QueuedCount:        safeInt(value.queuedCount),
		SucceededCount:     safeInt(value.succeededCount),
		FailedCount:        safeInt(value.failedCount),
		ReleasedCount:      safeInt(value.releasedCount),
		RejectedCount:      safeInt(value.rejectedCount),
		TimeoutCount:       safeInt(value.timeoutCount),
		CancelledCount:     safeInt(value.cancelledCount),
		BillingFailedCount: safeInt(value.billingFailedCount),
		LeaseRenewFail:     safeInt(value.leaseRenewFail),
		LeaseExpiredCount:  safeInt(value.leaseExpiredCount),
		WaitMsAvg:          avg(value.waitMsSum, value.waitSampleCount),
		WaitMsMax:          value.waitMsMax,
		ProcessMsAvg:       avg(value.processMsSum, value.processSampleCount),
		ProcessMsMax:       value.processMsMax,
	}
}

func metricToCounters(metric model.ChannelFlowMetricMinute) counters {
	return counters{
		sampleCount:        metric.SampleCount,
		runningSum:         metric.RunningSum,
		runningMax:         int64(metric.RunningMax),
		queuedSum:          metric.QueuedSum,
		queuedMax:          int64(metric.QueuedMax),
		acquiredCount:      int64(metric.AcquiredCount),
		queuedCount:        int64(metric.QueuedCount),
		succeededCount:     int64(metric.SucceededCount),
		failedCount:        int64(metric.FailedCount),
		releasedCount:      int64(metric.ReleasedCount),
		rejectedCount:      int64(metric.RejectedCount),
		timeoutCount:       int64(metric.TimeoutCount),
		cancelledCount:     int64(metric.CancelledCount),
		billingFailedCount: int64(metric.BillingFailedCount),
		leaseRenewFail:     int64(metric.LeaseRenewFail),
		leaseExpiredCount:  int64(metric.LeaseExpiredCount),
		waitMsSum:          metric.WaitMsSum,
		waitSampleCount:    metric.WaitSampleCount,
		waitMsMax:          metric.WaitMsMax,
		processMsSum:       metric.ProcessMsSum,
		processSampleCount: metric.ProcessSampleCount,
		processMsMax:       metric.ProcessMsMax,
	}
}

func avg(sum int64, count int64) int64 {
	if count <= 0 {
		return 0
	}
	return sum / count
}

func safeInt(value int64) int {
	if value <= 0 {
		return 0
	}
	return int(value)
}

func (c counters) hasData() bool {
	return c.sampleCount > 0 ||
		c.acquiredCount > 0 ||
		c.queuedCount > 0 ||
		c.succeededCount > 0 ||
		c.failedCount > 0 ||
		c.releasedCount > 0 ||
		c.rejectedCount > 0 ||
		c.timeoutCount > 0 ||
		c.cancelledCount > 0 ||
		c.billingFailedCount > 0 ||
		c.leaseRenewFail > 0 ||
		c.leaseExpiredCount > 0 ||
		c.waitSampleCount > 0 ||
		c.processSampleCount > 0
}

func (c counters) requestCount() int64 {
	return c.acquiredCount + c.rejectedCount + c.timeoutCount + c.billingFailedCount
}
