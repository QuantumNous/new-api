package perfmetrics

import (
	"sync"
	"sync/atomic"
	"time"
)

type Store interface {
	Record(sample Sample)
	Query(params QueryParams) (QueryResult, error)
}

type Sample struct {
	Model        string
	Group        string
	ChannelID    int
	LatencyMs    int64
	TtftMs       int64
	HasTtft      bool
	Success      bool
	OutputTokens int64
	GenerationMs int64
}

type QueryParams struct {
	Model string
	Group string
	Hours int
	// Groups, when non-nil, restricts results to these groups (Group must be
	// empty). MergeGroups collapses the matched groups into one "all" series
	// with counter-level (request-weighted) aggregation — averaging the
	// per-group series client-side would weight a 5-request group the same as
	// a 5M-request one.
	Groups      []string
	MergeGroups bool
}

type BucketPoint struct {
	Ts           int64   `json:"ts"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
}

type GroupResult struct {
	Group        string        `json:"group"`
	AvgTtftMs    int64         `json:"avg_ttft_ms"`
	AvgLatencyMs int64         `json:"avg_latency_ms"`
	SuccessRate  float64       `json:"success_rate"`
	AvgTps       float64       `json:"avg_tps"`
	Series       []BucketPoint `json:"series"`
}

type QueryResult struct {
	ModelName    string        `json:"model_name"`
	SeriesSchema string        `json:"series_schema"`
	Groups       []GroupResult `json:"groups"`
}

type ModelSummary struct {
	ModelName    string  `json:"model_name"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
	RequestCount int64   `json:"request_count"`
}

type SummaryAllResult struct {
	Models []ModelSummary `json:"models"`
}

type bucketKey struct {
	model    string
	group    string
	bucketTs int64
}

type prometheusSeriesKey struct {
	model  string
	status string
}

type counters struct {
	requestCount   int64
	successCount   int64
	totalLatencyMs int64
	ttftSumMs      int64
	ttftCount      int64
	outputTokens   int64
	generationMs   int64
}

type atomicBucket struct {
	requestCount   atomic.Int64
	successCount   atomic.Int64
	totalLatencyMs atomic.Int64
	ttftSumMs      atomic.Int64
	ttftCount      atomic.Int64
	outputTokens   atomic.Int64
	generationMs   atomic.Int64
}

type prometheusCounters struct {
	count int64
}

type prometheusLockedBucket struct {
	mu            sync.Mutex
	count         int64
	lastUpdatedAt int64
	retired       bool
}

type prometheusChannelAttemptKey struct {
	status        string
	errorCategory string
}

type prometheusChannelBucket struct {
	mu                 sync.Mutex
	channelName        string
	attempts           map[prometheusChannelAttemptKey]int64
	durationBuckets    []int64
	durationSumSeconds float64
	durationCount      int64
	ttftSumSeconds     float64
	ttftCount          int64
	lastUpdatedAt      int64
	retired            bool
}

type prometheusChannelSnapshot struct {
	channelID          int
	channelName        string
	attempts           map[prometheusChannelAttemptKey]int64
	durationBuckets    []int64
	durationSumSeconds float64
	durationCount      int64
	ttftSumSeconds     float64
	ttftCount          int64
}

type prometheusChannelModelKey struct {
	channelID int
	model     string
}

type prometheusChannelModelBucket struct {
	mu            sync.Mutex
	attempts      map[string]int64
	inputTokens   int64
	outputTokens  int64
	lastUpdatedAt int64
	retired       bool
}

type prometheusChannelModelSnapshot struct {
	channelID    int
	model        string
	attempts     map[string]int64
	inputTokens  int64
	outputTokens int64
}

func (b *atomicBucket) add(sample Sample) {
	b.requestCount.Add(1)
	if sample.Success {
		b.successCount.Add(1)
	}
	if sample.LatencyMs > 0 {
		b.totalLatencyMs.Add(sample.LatencyMs)
	}
	if sample.HasTtft && sample.TtftMs >= 0 {
		b.ttftSumMs.Add(sample.TtftMs)
		b.ttftCount.Add(1)
	}
	if sample.OutputTokens > 0 && sample.GenerationMs > 0 {
		b.outputTokens.Add(sample.OutputTokens)
		b.generationMs.Add(sample.GenerationMs)
	}
}

func (b *atomicBucket) snapshot() counters {
	return counters{
		requestCount:   b.requestCount.Load(),
		successCount:   b.successCount.Load(),
		totalLatencyMs: b.totalLatencyMs.Load(),
		ttftSumMs:      b.ttftSumMs.Load(),
		ttftCount:      b.ttftCount.Load(),
		outputTokens:   b.outputTokens.Load(),
		generationMs:   b.generationMs.Load(),
	}
}

func (b *atomicBucket) drain() counters {
	return counters{
		requestCount:   b.requestCount.Swap(0),
		successCount:   b.successCount.Swap(0),
		totalLatencyMs: b.totalLatencyMs.Swap(0),
		ttftSumMs:      b.ttftSumMs.Swap(0),
		ttftCount:      b.ttftCount.Swap(0),
		outputTokens:   b.outputTokens.Swap(0),
		generationMs:   b.generationMs.Swap(0),
	}
}

func (b *atomicBucket) addCounters(c counters) {
	if c.requestCount != 0 {
		b.requestCount.Add(c.requestCount)
	}
	if c.successCount != 0 {
		b.successCount.Add(c.successCount)
	}
	if c.totalLatencyMs != 0 {
		b.totalLatencyMs.Add(c.totalLatencyMs)
	}
	if c.ttftSumMs != 0 {
		b.ttftSumMs.Add(c.ttftSumMs)
	}
	if c.ttftCount != 0 {
		b.ttftCount.Add(c.ttftCount)
	}
	if c.outputTokens != 0 {
		b.outputTokens.Add(c.outputTokens)
	}
	if c.generationMs != 0 {
		b.generationMs.Add(c.generationMs)
	}
}

func (c *counters) addSample(sample Sample) {
	c.requestCount++
	if sample.Success {
		c.successCount++
	}
	if sample.LatencyMs > 0 {
		c.totalLatencyMs += sample.LatencyMs
	}
	if sample.HasTtft && sample.TtftMs >= 0 {
		c.ttftSumMs += sample.TtftMs
		c.ttftCount++
	}
	if sample.OutputTokens > 0 && sample.GenerationMs > 0 {
		c.outputTokens += sample.OutputTokens
		c.generationMs += sample.GenerationMs
	}
}

func (c *counters) add(other counters) {
	c.requestCount += other.requestCount
	c.successCount += other.successCount
	c.totalLatencyMs += other.totalLatencyMs
	c.ttftSumMs += other.ttftSumMs
	c.ttftCount += other.ttftCount
	c.outputTokens += other.outputTokens
	c.generationMs += other.generationMs
}

func (c counters) isZero() bool {
	return c.requestCount == 0 &&
		c.successCount == 0 &&
		c.totalLatencyMs == 0 &&
		c.ttftSumMs == 0 &&
		c.ttftCount == 0 &&
		c.outputTokens == 0 &&
		c.generationMs == 0
}

func (b *prometheusLockedBucket) add(sample Sample) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	b.count++
	b.lastUpdatedAt = time.Now().UnixNano()
	return true
}

func (b *prometheusLockedBucket) snapshot() prometheusCounters {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return prometheusCounters{}
	}
	out := prometheusCounters{
		count: b.count,
	}
	return out
}

func (b *prometheusLockedBucket) retireIfIdle(cutoffUnixNano int64) bool {
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

func (c prometheusCounters) isZero() bool {
	return c.count == 0
}

func (c *prometheusCounters) add(other prometheusCounters) {
	c.count += other.count
}

func newPrometheusChannelBucket() *prometheusChannelBucket {
	return &prometheusChannelBucket{
		attempts:        make(map[prometheusChannelAttemptKey]int64),
		durationBuckets: make([]int64, len(prometheusChannelDurationBucketsSeconds)),
	}
}

func (b *prometheusChannelBucket) addAttempt(
	channelName string,
	status string,
	errorCategory string,
	durationSeconds float64,
	ttftSeconds float64,
	hasTtft bool,
) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	b.channelName = channelName
	b.attempts[prometheusChannelAttemptKey{status: status, errorCategory: errorCategory}]++
	b.durationSumSeconds += durationSeconds
	b.durationCount++
	for i, upperBound := range prometheusChannelDurationBucketsSeconds {
		if durationSeconds <= upperBound {
			b.durationBuckets[i]++
		}
	}
	if hasTtft {
		b.ttftSumSeconds += ttftSeconds
		b.ttftCount++
	}
	b.lastUpdatedAt = time.Now().UnixNano()
	return true
}

func (b *prometheusChannelBucket) snapshot(channelID int) prometheusChannelSnapshot {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return prometheusChannelSnapshot{}
	}
	attempts := make(map[prometheusChannelAttemptKey]int64, len(b.attempts))
	for key, count := range b.attempts {
		attempts[key] = count
	}
	return prometheusChannelSnapshot{
		channelID:          channelID,
		channelName:        b.channelName,
		attempts:           attempts,
		durationBuckets:    append([]int64(nil), b.durationBuckets...),
		durationSumSeconds: b.durationSumSeconds,
		durationCount:      b.durationCount,
		ttftSumSeconds:     b.ttftSumSeconds,
		ttftCount:          b.ttftCount,
	}
}

func (b *prometheusChannelBucket) retireIfIdle(cutoffUnixNano int64) bool {
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

func (s prometheusChannelSnapshot) seriesCount() int {
	if s.durationCount == 0 {
		return 0
	}
	count := 1 + len(s.attempts) + len(prometheusChannelDurationBucketsSeconds) + 3
	if s.ttftCount > 0 {
		count += 2
	}
	return count
}

func newPrometheusChannelModelBucket() *prometheusChannelModelBucket {
	return &prometheusChannelModelBucket{attempts: make(map[string]int64)}
}

func (b *prometheusChannelModelBucket) addAttempt(status string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	b.attempts[status]++
	b.lastUpdatedAt = time.Now().UnixNano()
	return true
}

func (b *prometheusChannelModelBucket) addTokens(inputTokens int64, outputTokens int64) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return false
	}
	if inputTokens > 0 {
		b.inputTokens += inputTokens
	}
	if outputTokens > 0 {
		b.outputTokens += outputTokens
	}
	b.lastUpdatedAt = time.Now().UnixNano()
	return true
}

func (b *prometheusChannelModelBucket) snapshot(key prometheusChannelModelKey) prometheusChannelModelSnapshot {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.retired {
		return prometheusChannelModelSnapshot{}
	}
	attempts := make(map[string]int64, len(b.attempts))
	for status, count := range b.attempts {
		attempts[status] = count
	}
	return prometheusChannelModelSnapshot{
		channelID:    key.channelID,
		model:        key.model,
		attempts:     attempts,
		inputTokens:  b.inputTokens,
		outputTokens: b.outputTokens,
	}
}

func (b *prometheusChannelModelBucket) retireIfIdle(cutoffUnixNano int64) bool {
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

func (s prometheusChannelModelSnapshot) seriesCount() int {
	count := len(s.attempts)
	if s.inputTokens > 0 {
		count++
	}
	if s.outputTokens > 0 {
		count++
	}
	return count
}
