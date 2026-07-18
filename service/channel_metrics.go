package service

import (
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

// ChannelMetrics 渠道运行时指标，按 (channelID, group, model) 分桶
type ChannelMetrics struct {
	mu            sync.Mutex    `json:"-"`               // 保护并发写
	SuccessRate   float64       `json:"success_rate"`    // EWMA
	ErrorRate     float64       `json:"error_rate"`      // EWMA
	RateLimitRate float64       `json:"rate_limit_rate"` // EWMA 429 率
	Status5xxRate float64       `json:"status_5xx_rate"` // EWMA 5xx 率
	AvgLatency    time.Duration `json:"avg_latency"`     // EWMA 平均延迟
	SampleCount   int64         `json:"sample_count"`    // 总样本数
	LastSeen      time.Time     `json:"last_seen"`

}

// LocalMetricsSnapshot 进程内本地指标快照，定期从 Redis sync 或直接从本地累加
type LocalMetricsSnapshot struct {
	mu        sync.RWMutex
	metrics   map[metricsKey]*ChannelMetrics
	updatedAt time.Time
}

type metricsKey struct {
	ChannelID int
	Group     string
	Model     string
}

var globalSnapshot = &LocalMetricsSnapshot{
	metrics: make(map[metricsKey]*ChannelMetrics),
}

// ensureKey 获取或创建指定 key 的指标桶
func (s *LocalMetricsSnapshot) ensureKey(key metricsKey) *ChannelMetrics {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.metrics[key]
	if !ok {
		m = &ChannelMetrics{
			SuccessRate: 1.0, // 冷启动默认信任
			AvgLatency:  500 * time.Millisecond,
		}
		s.metrics[key] = m
	}
	return m
}

// EwmaUpdate 更新指标的 EWMA 值
func EwmaUpdate(current, observed, alpha float64) float64 {
	if alpha <= 0 || alpha > 1 {
		alpha = constant.EwmaAlpha
	}
	return alpha*observed + (1-alpha)*current
}

// ObserveSuccess 记录一次成功调用
func ObserveSuccess(channelID int, group, model string, latency time.Duration) {
	alpha := constant.EwmaAlpha
	key := metricsKey{channelID, group, model}
	m := globalSnapshot.ensureKey(key)

	m.mu.Lock()
	defer m.mu.Unlock()

	m.SampleCount++
	m.LastSeen = time.Now()

	// 更新延迟 EWMA
	if m.AvgLatency == 0 {
		m.AvgLatency = latency
	} else {
		m.AvgLatency = time.Duration(EwmaUpdate(float64(m.AvgLatency), float64(latency), alpha))
	}


	// 更新成功率 EWMA
	m.SuccessRate = EwmaUpdate(m.SuccessRate, 1.0, alpha)
	m.ErrorRate = EwmaUpdate(m.ErrorRate, 0, alpha)
	m.RateLimitRate = EwmaUpdate(m.RateLimitRate, 0, alpha)
	m.Status5xxRate = EwmaUpdate(m.Status5xxRate, 0, alpha)
}

// ObserveFailure 记录一次失败
func ObserveFailure(channelID int, group, model string, statusCode int, latency time.Duration) {
	alpha := constant.EwmaAlpha
	key := metricsKey{channelID, group, model}
	m := globalSnapshot.ensureKey(key)

	m.mu.Lock()
	defer m.mu.Unlock()

	m.SampleCount++
	m.LastSeen = time.Now()

	// 更新延迟
	if m.AvgLatency == 0 {
		m.AvgLatency = latency
	} else {
		m.AvgLatency = time.Duration(EwmaUpdate(float64(m.AvgLatency), float64(latency), alpha))
	}

	m.SuccessRate = EwmaUpdate(m.SuccessRate, 0, alpha)
	m.ErrorRate = EwmaUpdate(m.ErrorRate, 1, alpha)

	switch {
	case statusCode == 429:
		m.RateLimitRate = EwmaUpdate(m.RateLimitRate, 1, alpha)
		m.Status5xxRate = EwmaUpdate(m.Status5xxRate, 0, alpha)
	case statusCode >= 500:
		m.Status5xxRate = EwmaUpdate(m.Status5xxRate, 1, alpha)
		m.RateLimitRate = EwmaUpdate(m.RateLimitRate, 0, alpha)
	default:
		m.RateLimitRate = EwmaUpdate(m.RateLimitRate, 0, alpha)
		m.Status5xxRate = EwmaUpdate(m.Status5xxRate, 0, alpha)
	}
}

// GetMetrics 读取指定 (channelID, group, model) 的指标快照
func GetMetrics(channelID int, group, model string) *ChannelMetrics {
	key := metricsKey{channelID, group, model}
	globalSnapshot.mu.RLock()
	m, ok := globalSnapshot.metrics[key]
	globalSnapshot.mu.RUnlock()
	if ok {
		return snapshotChannelMetrics(m)
	}

	// 尝试回退到 (channelID, group)
	key2 := metricsKey{channelID, group, ""}
	globalSnapshot.mu.RLock()
	m2, ok2 := globalSnapshot.metrics[key2]
	globalSnapshot.mu.RUnlock()
	if ok2 {
		return snapshotChannelMetrics(m2)
	}

	// 回退到 (channelID)
	key3 := metricsKey{channelID, "", ""}
	globalSnapshot.mu.RLock()
	m3, ok3 := globalSnapshot.metrics[key3]
	globalSnapshot.mu.RUnlock()
	if ok3 {
		return snapshotChannelMetrics(m3)
	}

	// 无数据，返回中性默认值
	return &ChannelMetrics{
		SuccessRate: 1.0,
		AvgLatency:  500 * time.Millisecond,
	}
}

func snapshotChannelMetrics(m *ChannelMetrics) *ChannelMetrics {
	if m == nil {
		return nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return &ChannelMetrics{
		SuccessRate:    m.SuccessRate,
		ErrorRate:      m.ErrorRate,
		RateLimitRate:  m.RateLimitRate,
		Status5xxRate:  m.Status5xxRate,
		AvgLatency:     m.AvgLatency,
		SampleCount:    m.SampleCount,
		LastSeen:       m.LastSeen,
	}
}


// CurrentConcurrencyTracker 本地并发计数器（原子操作，零网络开销）
type CurrentConcurrencyTracker struct {
	counters sync.Map // map[int]*atomic.Int64
}

var globalConcurrency = &CurrentConcurrencyTracker{}

func (t *CurrentConcurrencyTracker) Inc(channelID int) int64 {
	v, _ := t.counters.LoadOrStore(channelID, new(atomic.Int64))
	return v.(*atomic.Int64).Add(1)
}

func (t *CurrentConcurrencyTracker) Dec(channelID int) int64 {
	v, ok := t.counters.Load(channelID)
	if !ok {
		return 0
	}
	return v.(*atomic.Int64).Add(-1)
}

func (t *CurrentConcurrencyTracker) Get(channelID int) int64 {
	v, ok := t.counters.Load(channelID)
	if !ok {
		return 0
	}
	return v.(*atomic.Int64).Load()
}

// IncChannelConcurrency 增加并发计数
func IncChannelConcurrency(channelID int) int64 {
	return globalConcurrency.Inc(channelID)
}

// DecChannelConcurrency 减少并发计数
func DecChannelConcurrency(channelID int) int64 {
	return globalConcurrency.Dec(channelID)
}

// GetChannelConcurrency 获取当前并发
func GetChannelConcurrency(channelID int) int64 {
	return globalConcurrency.Get(channelID)
}


// SyncAdaptiveMetricsToRedis publishes a compact snapshot for multi-instance
// sticky-or-shared observation. Best-effort; failures are silent.
func SyncAdaptiveMetricsToRedis() {
	if !common.RedisEnabled || common.RDB == nil {
		return
	}
	globalSnapshot.mu.RLock()
	defer globalSnapshot.mu.RUnlock()
	type row struct {
		ChannelID   int     `json:"c"`
		Group       string  `json:"g"`
		Model       string  `json:"m"`
		SuccessRate float64 `json:"s"`
		SampleCount int64   `json:"n"`
	}
	out := make([]row, 0, len(globalSnapshot.metrics))
	for k, m := range globalSnapshot.metrics {
		m.mu.Lock()
		out = append(out, row{k.ChannelID, k.Group, k.Model, m.SuccessRate, m.SampleCount})
		m.mu.Unlock()
	}
	b, err := common.Marshal(out)
	if err != nil {
		return
	}
	key := fmt.Sprintf("newapi:adaptive:metrics:%s", common.NodeName)
	if key == "newapi:adaptive:metrics:" {
		key = "newapi:adaptive:metrics:default"
	}
	_ = common.RedisSet(key, string(b), 2*time.Minute)
}
