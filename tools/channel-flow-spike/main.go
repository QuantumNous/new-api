package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

type spikeConfig struct {
	RedisURL       string
	PoolKey        string
	Concurrency    int
	MaxInflight    int
	MaxQueueSize   int
	QueueTimeout   time.Duration
	LeaseTTL       time.Duration
	HoldTime       time.Duration
	HoldJitter     time.Duration
	PollMin        time.Duration
	PollMax        time.Duration
	SampleInterval time.Duration
	Cleanup        bool
}

type redisKeys struct {
	Running string `json:"running"`
	Waiting string `json:"waiting"`
	Seq     string `json:"seq"`
}

type acquireDecision struct {
	Admitted   bool
	Queued     bool
	Rejected   string
	Waited     time.Duration
	QueueScore float64
}

type redisFlowProbe struct {
	rdb  *redis.Client
	keys redisKeys
	cfg  spikeConfig
}

type spikeMetrics struct {
	WatchAttempts int64
	TxConflicts   int64
	Admitted      int64
	Immediate     int64
	Queued        int64
	QueueFull     int64
	QueueTimeout  int64
	Errors        int64
	PeakRunning   int64
	PeakQueued    int64

	mu        sync.Mutex
	latencies []int64
}

type spikeSummary struct {
	Config         map[string]any   `json:"config"`
	Keys           redisKeys        `json:"keys"`
	Totals         map[string]any   `json:"totals"`
	LatencyMs      map[string]int64 `json:"latency_ms"`
	InvariantOK    bool             `json:"invariant_ok"`
	DurationMs     int64            `json:"duration_ms"`
	Recommendation string           `json:"recommendation"`
}

const (
	rejectQueueFull    = "queue_full"
	rejectQueueTimeout = "queue_timeout"
)

func main() {
	cfg := parseFlags()
	if cfg.RedisURL == "" {
		fmt.Fprintln(os.Stderr, "missing -redis or REDIS_CONN_STRING")
		os.Exit(2)
	}
	if cfg.Concurrency <= 0 || cfg.MaxInflight <= 0 {
		fmt.Fprintln(os.Stderr, "-concurrency and -max-inflight must be positive")
		os.Exit(2)
	}

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "parse redis url: %v\n", err)
		os.Exit(2)
	}
	opt.PoolSize = max(cfg.Concurrency/4, 10)
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	ctx, cancel := context.WithTimeout(context.Background(), cfg.QueueTimeout+cfg.HoldTime+30*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		fmt.Fprintf(os.Stderr, "redis ping failed: %v\n", err)
		os.Exit(2)
	}

	keys := redisKeys{
		Running: fmt.Sprintf("new-api:flow-spike:%s:running", cfg.PoolKey),
		Waiting: fmt.Sprintf("new-api:flow-spike:%s:waiting", cfg.PoolKey),
		Seq:     fmt.Sprintf("new-api:flow-spike:%s:seq", cfg.PoolKey),
	}
	probe := &redisFlowProbe{rdb: rdb, keys: keys, cfg: cfg}
	_ = probe.cleanup(ctx)
	defer func() {
		if cfg.Cleanup {
			_ = probe.cleanup(context.Background())
		}
	}()

	metrics := &spikeMetrics{
		latencies: make([]int64, 0, cfg.Concurrency),
	}
	startedAt := time.Now()
	stopSampling := make(chan struct{})
	var samplerDone sync.WaitGroup
	samplerDone.Add(1)
	go samplePeaks(ctx, &samplerDone, probe, metrics, stopSampling)

	var workers sync.WaitGroup
	start := make(chan struct{})
	for i := 0; i < cfg.Concurrency; i++ {
		workers.Add(1)
		go func(index int) {
			defer workers.Done()
			<-start
			runWorker(ctx, probe, metrics, index)
		}(i)
	}
	close(start)
	workers.Wait()
	close(stopSampling)
	samplerDone.Wait()

	summary := buildSummary(cfg, keys, metrics, time.Since(startedAt))
	data, err := common.Marshal(summary)
	if err != nil {
		fmt.Fprintf(os.Stderr, "marshal summary: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(string(data))
	if !summary.InvariantOK {
		os.Exit(1)
	}
}

func parseFlags() spikeConfig {
	defaultRedisURL := os.Getenv("REDIS_CONN_STRING")
	defaultPoolKey := fmt.Sprintf("pool-%d", time.Now().Unix())
	cfg := spikeConfig{}
	flag.StringVar(&cfg.RedisURL, "redis", defaultRedisURL, "Redis URL, defaults to REDIS_CONN_STRING")
	flag.StringVar(&cfg.PoolKey, "pool-key", defaultPoolKey, "temporary Redis key suffix for this run")
	flag.IntVar(&cfg.Concurrency, "concurrency", 1000, "number of simultaneous acquire attempts")
	flag.IntVar(&cfg.MaxInflight, "max-inflight", 60, "running lease cap")
	flag.IntVar(&cfg.MaxQueueSize, "max-queue", 240, "waiting queue cap")
	flag.DurationVar(&cfg.QueueTimeout, "queue-timeout", 10*time.Second, "per-request queue timeout")
	flag.DurationVar(&cfg.LeaseTTL, "lease", 30*time.Second, "running lease TTL")
	flag.DurationVar(&cfg.HoldTime, "hold", 250*time.Millisecond, "simulated upstream processing time")
	flag.DurationVar(&cfg.HoldJitter, "hold-jitter", 150*time.Millisecond, "additional random processing time")
	flag.DurationVar(&cfg.PollMin, "poll-min", 5*time.Millisecond, "minimum waiter self-promote poll interval")
	flag.DurationVar(&cfg.PollMax, "poll-max", 25*time.Millisecond, "maximum waiter self-promote poll interval")
	flag.DurationVar(&cfg.SampleInterval, "sample-interval", 10*time.Millisecond, "peak sampler interval")
	flag.BoolVar(&cfg.Cleanup, "cleanup", true, "delete temporary Redis keys after the run")
	flag.Parse()
	if cfg.QueueTimeout <= 0 {
		cfg.QueueTimeout = 10 * time.Second
	}
	if cfg.LeaseTTL <= 0 {
		cfg.LeaseTTL = 30 * time.Second
	}
	if cfg.PollMin <= 0 {
		cfg.PollMin = 5 * time.Millisecond
	}
	if cfg.PollMax < cfg.PollMin {
		cfg.PollMax = cfg.PollMin
	}
	if cfg.SampleInterval <= 0 {
		cfg.SampleInterval = 10 * time.Millisecond
	}
	return cfg
}

func runWorker(ctx context.Context, probe *redisFlowProbe, metrics *spikeMetrics, index int) {
	requestID := fmt.Sprintf("req-%d-%d", time.Now().UnixNano(), index)
	acquireCtx, cancel := context.WithTimeout(ctx, probe.cfg.QueueTimeout)
	defer cancel()
	startedAt := time.Now()
	decision, err := probe.acquire(acquireCtx, requestID, metrics)
	latencyMs := time.Since(startedAt).Milliseconds()
	metrics.recordLatency(latencyMs)
	if err != nil {
		switch decision.Rejected {
		case rejectQueueFull:
			atomic.AddInt64(&metrics.QueueFull, 1)
		case rejectQueueTimeout:
			atomic.AddInt64(&metrics.QueueTimeout, 1)
		default:
			atomic.AddInt64(&metrics.Errors, 1)
		}
		return
	}
	if !decision.Admitted {
		atomic.AddInt64(&metrics.Errors, 1)
		return
	}
	atomic.AddInt64(&metrics.Admitted, 1)
	if decision.Queued {
		atomic.AddInt64(&metrics.Queued, 1)
	} else {
		atomic.AddInt64(&metrics.Immediate, 1)
	}
	hold := probe.cfg.HoldTime + randomDuration(probe.cfg.HoldJitter)
	time.Sleep(hold)
	if err := probe.release(context.Background(), requestID); err != nil {
		atomic.AddInt64(&metrics.Errors, 1)
	}
}

func (p *redisFlowProbe) acquire(ctx context.Context, requestID string, metrics *spikeMetrics) (acquireDecision, error) {
	enqueued := false
	queuedAt := time.Time{}
	sequenceScore := float64(0)

	for {
		if err := ctx.Err(); err != nil {
			if enqueued {
				_ = p.rdb.ZRem(context.Background(), p.keys.Waiting, requestID).Err()
			}
			return acquireDecision{Rejected: rejectQueueTimeout}, err
		}
		_ = p.cleanupExpiredRunning(ctx)

		decision, done, err := p.tryAcquireOnce(ctx, requestID, enqueued, sequenceScore, queuedAt, metrics)
		if err == nil && done {
			if decision.Rejected != "" {
				return decision, errors.New(decision.Rejected)
			}
			return decision, nil
		}
		if err != nil && !errors.Is(err, redis.TxFailedErr) {
			return decision, err
		}
		if errors.Is(err, redis.TxFailedErr) {
			atomic.AddInt64(&metrics.TxConflicts, 1)
		}
		if !enqueued && decision.Queued {
			enqueued = true
			queuedAt = time.Now()
			sequenceScore = decision.QueueScore
		}
		if decision.Rejected == rejectQueueFull {
			return decision, fmt.Errorf("queue full")
		}
		time.Sleep(p.pollDelay())
	}
}

func (p *redisFlowProbe) tryAcquireOnce(
	ctx context.Context,
	requestID string,
	enqueued bool,
	sequenceScore float64,
	queuedAt time.Time,
	metrics *spikeMetrics,
) (acquireDecision, bool, error) {
	atomic.AddInt64(&metrics.WatchAttempts, 1)
	decision := acquireDecision{}
	err := p.rdb.Watch(ctx, func(tx *redis.Tx) error {
		running, err := tx.ZCard(ctx, p.keys.Running).Result()
		if err != nil {
			return err
		}
		waiting, err := tx.ZCard(ctx, p.keys.Waiting).Result()
		if err != nil {
			return err
		}
		if !enqueued {
			if running < int64(p.cfg.MaxInflight) && waiting == 0 {
				_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
					pipe.ZAdd(ctx, p.keys.Running, &redis.Z{
						Score:  float64(time.Now().Add(p.cfg.LeaseTTL).UnixMilli()),
						Member: requestID,
					})
					return nil
				})
				if err == nil {
					decision = acquireDecision{Admitted: true}
				}
				return err
			}
			if p.cfg.MaxQueueSize > 0 && waiting >= int64(p.cfg.MaxQueueSize) {
				decision = acquireDecision{Rejected: rejectQueueFull}
				return nil
			}
			score, scoreErr := p.nextSequence(ctx, sequenceScore)
			if scoreErr != nil {
				return scoreErr
			}
			_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.ZAdd(ctx, p.keys.Waiting, &redis.Z{
					Score:  score,
					Member: requestID,
				})
				return nil
			})
			if err == nil {
				decision = acquireDecision{Queued: true, QueueScore: score}
			}
			return err
		}

		rank, err := tx.ZRank(ctx, p.keys.Waiting, requestID).Result()
		if errors.Is(err, redis.Nil) {
			return nil
		}
		if err != nil {
			return err
		}
		if rank != 0 || running >= int64(p.cfg.MaxInflight) {
			return nil
		}
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.ZRem(ctx, p.keys.Waiting, requestID)
			pipe.ZAdd(ctx, p.keys.Running, &redis.Z{
				Score:  float64(time.Now().Add(p.cfg.LeaseTTL).UnixMilli()),
				Member: requestID,
			})
			return nil
		})
		if err == nil {
			decision = acquireDecision{
				Admitted: true,
				Queued:   true,
				Waited:   time.Since(queuedAt),
			}
		}
		return err
	}, p.keys.Running, p.keys.Waiting)
	if err != nil {
		return decision, false, err
	}
	if decision.Admitted || decision.Rejected != "" {
		return decision, true, nil
	}
	return decision, false, nil
}

func (p *redisFlowProbe) nextSequence(ctx context.Context, existing float64) (float64, error) {
	if existing > 0 {
		return existing, nil
	}
	seq, err := p.rdb.Incr(ctx, p.keys.Seq).Result()
	return float64(seq), err
}

func (p *redisFlowProbe) release(ctx context.Context, requestID string) error {
	return p.rdb.ZRem(ctx, p.keys.Running, requestID).Err()
}

func (p *redisFlowProbe) cleanupExpiredRunning(ctx context.Context) error {
	return p.rdb.ZRemRangeByScore(ctx, p.keys.Running, "-inf", fmt.Sprintf("%d", time.Now().UnixMilli())).Err()
}

func (p *redisFlowProbe) cleanup(ctx context.Context) error {
	return p.rdb.Del(ctx, p.keys.Running, p.keys.Waiting, p.keys.Seq).Err()
}

func (p *redisFlowProbe) pollDelay() time.Duration {
	window := p.cfg.PollMax - p.cfg.PollMin
	if window <= 0 {
		return p.cfg.PollMin
	}
	return p.cfg.PollMin + time.Duration(rand.Int63n(int64(window)))
}

func randomDuration(maxDuration time.Duration) time.Duration {
	if maxDuration <= 0 {
		return 0
	}
	return time.Duration(rand.Int63n(int64(maxDuration)))
}

func samplePeaks(ctx context.Context, wg *sync.WaitGroup, probe *redisFlowProbe, metrics *spikeMetrics, stop <-chan struct{}) {
	defer wg.Done()
	ticker := time.NewTicker(probe.cfg.SampleInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-stop:
			return
		case <-ticker.C:
			running, err := probe.rdb.ZCard(ctx, probe.keys.Running).Result()
			if err == nil {
				updatePeak(&metrics.PeakRunning, running)
			}
			queued, err := probe.rdb.ZCard(ctx, probe.keys.Waiting).Result()
			if err == nil {
				updatePeak(&metrics.PeakQueued, queued)
			}
		}
	}
}

func updatePeak(target *int64, value int64) {
	for {
		current := atomic.LoadInt64(target)
		if value <= current {
			return
		}
		if atomic.CompareAndSwapInt64(target, current, value) {
			return
		}
	}
}

func (m *spikeMetrics) recordLatency(latencyMs int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.latencies = append(m.latencies, latencyMs)
}

func buildSummary(cfg spikeConfig, keys redisKeys, metrics *spikeMetrics, duration time.Duration) spikeSummary {
	latency := latencySummary(metrics.latencies)
	watchAttempts := atomic.LoadInt64(&metrics.WatchAttempts)
	conflicts := atomic.LoadInt64(&metrics.TxConflicts)
	peakRunning := atomic.LoadInt64(&metrics.PeakRunning)
	invariantOK := cfg.MaxInflight <= 0 || peakRunning <= int64(cfg.MaxInflight)
	recommendation := "WATCH/MULTI shape is acceptable for the next backend prototype if conflict rate and p99 are within SLO."
	if watchAttempts > 0 && float64(conflicts)/float64(watchAttempts) > 0.2 {
		recommendation = "Conflict rate is high; benchmark Lua or redesign before productionizing Redis backend."
	}
	if !invariantOK {
		recommendation = "Invariant failed; do not use this Redis algorithm without fixing over-admission."
	}
	return spikeSummary{
		Config: map[string]any{
			"concurrency":     cfg.Concurrency,
			"max_inflight":    cfg.MaxInflight,
			"max_queue_size":  cfg.MaxQueueSize,
			"queue_timeout":   cfg.QueueTimeout.String(),
			"lease":           cfg.LeaseTTL.String(),
			"hold":            cfg.HoldTime.String(),
			"hold_jitter":     cfg.HoldJitter.String(),
			"poll_min":        cfg.PollMin.String(),
			"poll_max":        cfg.PollMax.String(),
			"sample_interval": cfg.SampleInterval.String(),
		},
		Keys: keys,
		Totals: map[string]any{
			"watch_attempts": watchAttempts,
			"tx_conflicts":   conflicts,
			"conflict_rate":  ratio(conflicts, watchAttempts),
			"admitted":       atomic.LoadInt64(&metrics.Admitted),
			"immediate":      atomic.LoadInt64(&metrics.Immediate),
			"queued":         atomic.LoadInt64(&metrics.Queued),
			"queue_full":     atomic.LoadInt64(&metrics.QueueFull),
			"queue_timeout":  atomic.LoadInt64(&metrics.QueueTimeout),
			"errors":         atomic.LoadInt64(&metrics.Errors),
			"peak_running":   peakRunning,
			"peak_queued":    atomic.LoadInt64(&metrics.PeakQueued),
		},
		LatencyMs:      latency,
		InvariantOK:    invariantOK,
		DurationMs:     duration.Milliseconds(),
		Recommendation: recommendation,
	}
}

func latencySummary(values []int64) map[string]int64 {
	if len(values) == 0 {
		return map[string]int64{"p50": 0, "p95": 0, "p99": 0, "max": 0}
	}
	sortedValues := append([]int64(nil), values...)
	sort.Slice(sortedValues, func(i int, j int) bool {
		return sortedValues[i] < sortedValues[j]
	})
	return map[string]int64{
		"p50": percentile(sortedValues, 0.50),
		"p95": percentile(sortedValues, 0.95),
		"p99": percentile(sortedValues, 0.99),
		"max": sortedValues[len(sortedValues)-1],
	}
}

func percentile(sortedValues []int64, percentileValue float64) int64 {
	if len(sortedValues) == 0 {
		return 0
	}
	index := int(float64(len(sortedValues)-1) * percentileValue)
	return sortedValues[index]
}

func ratio(numerator int64, denominator int64) float64 {
	if denominator == 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}

func max(left int, right int) int {
	if left > right {
		return left
	}
	return right
}
