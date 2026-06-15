package channelflowmetrics

import "sync/atomic"

type Sample struct {
	PoolKey   string
	ChannelID int
	Model     string
	EventType string
	Running   int
	Queued    int
	WaitMs    int64
	ProcessMs int64
}

type QueryParams struct {
	PoolKey string
	Hours   int
}

type TrendResult struct {
	PoolKey string                  `json:"pool_key"`
	Points  []ChannelFlowTrendPoint `json:"points"`
	Totals  ChannelFlowTrendTotals  `json:"totals"`
}

type ChannelFlowTrendPoint struct {
	BucketTs           int64   `json:"bucket_ts"`
	At                 string  `json:"at"`
	Running            float64 `json:"running"`
	RunningAvg         float64 `json:"running_avg"`
	RunningMax         int     `json:"running_max"`
	Queued             float64 `json:"queued"`
	QueuedAvg          float64 `json:"queued_avg"`
	QueuedMax          int     `json:"queued_max"`
	AcquiredCount      int     `json:"acquired_count"`
	QueuedCount        int     `json:"queued_count"`
	ReleasedCount      int     `json:"released_count"`
	RejectedCount      int     `json:"rejected_count"`
	TimeoutCount       int     `json:"timeout_count"`
	CancelledCount     int     `json:"cancelled_count"`
	BillingFailedCount int     `json:"billing_failed_count"`
	LeaseRenewFail     int     `json:"lease_renew_fail"`
	LeaseExpiredCount  int     `json:"lease_expired_count"`
	WaitMsAvg          int64   `json:"wait_ms_avg"`
	WaitMsMax          int64   `json:"wait_ms_max"`
	ProcessMsAvg       int64   `json:"process_ms_avg"`
	ProcessMsMax       int64   `json:"process_ms_max"`
}

type ChannelFlowTrendTotals struct {
	AcquiredCount      int   `json:"acquired_count"`
	QueuedCount        int   `json:"queued_count"`
	ReleasedCount      int   `json:"released_count"`
	RejectedCount      int   `json:"rejected_count"`
	TimeoutCount       int   `json:"timeout_count"`
	CancelledCount     int   `json:"cancelled_count"`
	BillingFailedCount int   `json:"billing_failed_count"`
	LeaseRenewFail     int   `json:"lease_renew_fail"`
	LeaseExpiredCount  int   `json:"lease_expired_count"`
	WaitMsAvg          int64 `json:"wait_ms_avg"`
	WaitMsMax          int64 `json:"wait_ms_max"`
	ProcessMsAvg       int64 `json:"process_ms_avg"`
	ProcessMsMax       int64 `json:"process_ms_max"`
}

type bucketKey struct {
	poolKey   string
	channelID int
	model     string
	bucketTs  int64
}

type counters struct {
	sampleCount        int64
	runningSum         int64
	runningMax         int64
	queuedSum          int64
	queuedMax          int64
	acquiredCount      int64
	queuedCount        int64
	releasedCount      int64
	rejectedCount      int64
	timeoutCount       int64
	cancelledCount     int64
	billingFailedCount int64
	leaseRenewFail     int64
	leaseExpiredCount  int64
	waitMsSum          int64
	waitSampleCount    int64
	waitMsMax          int64
	processMsSum       int64
	processSampleCount int64
	processMsMax       int64
}

type atomicBucket struct {
	sampleCount        atomic.Int64
	runningSum         atomic.Int64
	runningMax         atomic.Int64
	queuedSum          atomic.Int64
	queuedMax          atomic.Int64
	acquiredCount      atomic.Int64
	queuedCount        atomic.Int64
	releasedCount      atomic.Int64
	rejectedCount      atomic.Int64
	timeoutCount       atomic.Int64
	cancelledCount     atomic.Int64
	billingFailedCount atomic.Int64
	leaseRenewFail     atomic.Int64
	leaseExpiredCount  atomic.Int64
	waitMsSum          atomic.Int64
	waitSampleCount    atomic.Int64
	waitMsMax          atomic.Int64
	processMsSum       atomic.Int64
	processSampleCount atomic.Int64
	processMsMax       atomic.Int64
}

func (b *atomicBucket) add(sample Sample) {
	if sample.Running >= 0 && sample.Queued >= 0 {
		b.sampleCount.Add(1)
		b.runningSum.Add(int64(sample.Running))
		updateAtomicMax(&b.runningMax, int64(sample.Running))
		b.queuedSum.Add(int64(sample.Queued))
		updateAtomicMax(&b.queuedMax, int64(sample.Queued))
	}
	switch sample.EventType {
	case "acquired":
		b.acquiredCount.Add(1)
	case "queued":
		b.queuedCount.Add(1)
	case "released":
		b.releasedCount.Add(1)
	case "rejected":
		b.rejectedCount.Add(1)
	case "timeout":
		b.timeoutCount.Add(1)
	case "cancelled":
		b.cancelledCount.Add(1)
	case "billing_failed":
		b.billingFailedCount.Add(1)
	case "lease_renew_failed":
		b.leaseRenewFail.Add(1)
	case "lease_expired":
		b.leaseExpiredCount.Add(1)
	}
	if sample.WaitMs > 0 {
		b.waitMsSum.Add(sample.WaitMs)
		b.waitSampleCount.Add(1)
		updateAtomicMax(&b.waitMsMax, sample.WaitMs)
	}
	if sample.ProcessMs > 0 {
		b.processMsSum.Add(sample.ProcessMs)
		b.processSampleCount.Add(1)
		updateAtomicMax(&b.processMsMax, sample.ProcessMs)
	}
}

func (b *atomicBucket) snapshot() counters {
	return counters{
		sampleCount:        b.sampleCount.Load(),
		runningSum:         b.runningSum.Load(),
		runningMax:         b.runningMax.Load(),
		queuedSum:          b.queuedSum.Load(),
		queuedMax:          b.queuedMax.Load(),
		acquiredCount:      b.acquiredCount.Load(),
		queuedCount:        b.queuedCount.Load(),
		releasedCount:      b.releasedCount.Load(),
		rejectedCount:      b.rejectedCount.Load(),
		timeoutCount:       b.timeoutCount.Load(),
		cancelledCount:     b.cancelledCount.Load(),
		billingFailedCount: b.billingFailedCount.Load(),
		leaseRenewFail:     b.leaseRenewFail.Load(),
		leaseExpiredCount:  b.leaseExpiredCount.Load(),
		waitMsSum:          b.waitMsSum.Load(),
		waitSampleCount:    b.waitSampleCount.Load(),
		waitMsMax:          b.waitMsMax.Load(),
		processMsSum:       b.processMsSum.Load(),
		processSampleCount: b.processSampleCount.Load(),
		processMsMax:       b.processMsMax.Load(),
	}
}

func (b *atomicBucket) drain() counters {
	return counters{
		sampleCount:        b.sampleCount.Swap(0),
		runningSum:         b.runningSum.Swap(0),
		runningMax:         b.runningMax.Swap(0),
		queuedSum:          b.queuedSum.Swap(0),
		queuedMax:          b.queuedMax.Swap(0),
		acquiredCount:      b.acquiredCount.Swap(0),
		queuedCount:        b.queuedCount.Swap(0),
		releasedCount:      b.releasedCount.Swap(0),
		rejectedCount:      b.rejectedCount.Swap(0),
		timeoutCount:       b.timeoutCount.Swap(0),
		cancelledCount:     b.cancelledCount.Swap(0),
		billingFailedCount: b.billingFailedCount.Swap(0),
		leaseRenewFail:     b.leaseRenewFail.Swap(0),
		leaseExpiredCount:  b.leaseExpiredCount.Swap(0),
		waitMsSum:          b.waitMsSum.Swap(0),
		waitSampleCount:    b.waitSampleCount.Swap(0),
		waitMsMax:          b.waitMsMax.Swap(0),
		processMsSum:       b.processMsSum.Swap(0),
		processSampleCount: b.processSampleCount.Swap(0),
		processMsMax:       b.processMsMax.Swap(0),
	}
}

func (b *atomicBucket) addCounters(c counters) {
	b.sampleCount.Add(c.sampleCount)
	b.runningSum.Add(c.runningSum)
	updateAtomicMax(&b.runningMax, c.runningMax)
	b.queuedSum.Add(c.queuedSum)
	updateAtomicMax(&b.queuedMax, c.queuedMax)
	b.acquiredCount.Add(c.acquiredCount)
	b.queuedCount.Add(c.queuedCount)
	b.releasedCount.Add(c.releasedCount)
	b.rejectedCount.Add(c.rejectedCount)
	b.timeoutCount.Add(c.timeoutCount)
	b.cancelledCount.Add(c.cancelledCount)
	b.billingFailedCount.Add(c.billingFailedCount)
	b.leaseRenewFail.Add(c.leaseRenewFail)
	b.leaseExpiredCount.Add(c.leaseExpiredCount)
	b.waitMsSum.Add(c.waitMsSum)
	b.waitSampleCount.Add(c.waitSampleCount)
	updateAtomicMax(&b.waitMsMax, c.waitMsMax)
	b.processMsSum.Add(c.processMsSum)
	b.processSampleCount.Add(c.processSampleCount)
	updateAtomicMax(&b.processMsMax, c.processMsMax)
}

func updateAtomicMax(target *atomic.Int64, value int64) {
	for {
		current := target.Load()
		if value <= current {
			return
		}
		if target.CompareAndSwap(current, value) {
			return
		}
	}
}
