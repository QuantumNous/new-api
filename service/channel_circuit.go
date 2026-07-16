package service

import (
	"github.com/QuantumNous/new-api/constant"
	"sync"
	"time"
)

// CircuitState 熔断器状态
type CircuitState string

const (
	CircuitClosed   CircuitState = "closed"    // 正常
	CircuitOpen     CircuitState = "open"      // 熔断打开，不选
	CircuitHalfOpen CircuitState = "half_open" // 半开，允许探测
)

// ChannelCircuitBreaker 渠道熔断器（本地状态 + Redis 同步）
// 约定：请求路径上只读本地状态，不访问 Redis。
type ChannelCircuitBreaker struct {
	mu sync.RWMutex

	State              CircuitState
	ConsecutiveFailure int       // 连续失败计数
	OpenUntil          time.Time // open 状态过期时间
	HalfOpenLimit      int       // half-open 最大探测数
	HalfOpenInFlight   int       // half-open 进行中的探测数
	HalfOpenSince      time.Time // when current half-open probe started
	LastError          string    // 最近一次错误信息
}

var (
	circuitBreakers sync.Map // map[int]*ChannelCircuitBreaker, key=channelID
)

// getCircuitBreaker 获取或创建渠道熔断器
func getCircuitBreaker(channelID int) *ChannelCircuitBreaker {
	v, _ := circuitBreakers.LoadOrStore(channelID, &ChannelCircuitBreaker{
		State:         CircuitClosed,
		HalfOpenLimit: 1,
	})
	return v.(*ChannelCircuitBreaker)
}

// IsCircuitOpen 判断渠道是否熔断（请求路径使用，读本地状态）
func IsCircuitOpen(channelID int) bool {
	if !constant.ChannelCircuitBreakerEnabled {
		return false
	}

	cb := getCircuitBreaker(channelID)
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	if cb.State == CircuitClosed {
		return false
	}

	if cb.State == CircuitOpen && time.Now().After(cb.OpenUntil) {
		// Cooldown elapsed: still report open so selector must call ProbeHalfOpen.
		return true
	}

	return true
}

// IsInCooldown 判断渠道是否在 429 cooldown 中
func IsInCooldown(channelID int, cooldownUntil time.Time) bool {
	if cooldownUntil.IsZero() {
		return false
	}
	return time.Now().Before(cooldownUntil)
}

// RecordSuccess 成功调用 -> 重置熔断状态
func RecordCircuitSuccess(channelID int) {
	if !constant.ChannelCircuitBreakerEnabled {
		return
	}

	cb := getCircuitBreaker(channelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.State == CircuitHalfOpen {
		cb.HalfOpenInFlight--
		if cb.HalfOpenInFlight < 0 {
			cb.HalfOpenInFlight = 0
		}
		cb.HalfOpenSince = time.Time{}
	}

	cb.State = CircuitClosed
	cb.ConsecutiveFailure = 0
	cb.OpenUntil = time.Time{}
	cb.LastError = ""
}

// RecordFailure 失败调用 -> 可能触发熔断
func RecordCircuitFailure(channelID int, errMsg string) {
	if !constant.ChannelCircuitBreakerEnabled {
		return
	}

	cb := getCircuitBreaker(channelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.ConsecutiveFailure++
	cb.LastError = errMsg

	// 半开状态下失败 -> 立即回退到 open
	if cb.State == CircuitHalfOpen {
		cb.HalfOpenInFlight--
		if cb.HalfOpenInFlight < 0 {
			cb.HalfOpenInFlight = 0
		}
		cb.HalfOpenSince = time.Time{}
		cb.State = CircuitOpen
		cb.OpenUntil = time.Now().Add(time.Duration(constant.ChannelCooldownSeconds) * time.Second)
		return
	}

	// closed 状态下连续失败达到阈值 -> open
	threshold := 3
	if cb.ConsecutiveFailure >= threshold {
		cb.State = CircuitOpen
		cb.OpenUntil = time.Now().Add(time.Duration(constant.ChannelCooldownSeconds) * time.Second)
	}

	// 如果配置了熔断但未启用，不做任何事
}

// ProbeHalfOpen 申请进入 half-open 探测（由选择器调用）
func ProbeHalfOpen(channelID int) bool {
	if !constant.ChannelCircuitBreakerEnabled {
		return true
	}

	cb := getCircuitBreaker(channelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()

	// open 且已过冷却 -> 自动转为 half-open
	if cb.State == CircuitOpen && time.Now().After(cb.OpenUntil) {
		cb.State = CircuitHalfOpen
		cb.HalfOpenInFlight = 0
	}

	if cb.State != CircuitHalfOpen {
		return false
	}

	// Reclaim stuck half-open probes (client cancel / no Record* callback).
	const halfOpenProbeTimeout = 60 * time.Second
	if cb.HalfOpenInFlight > 0 && !cb.HalfOpenSince.IsZero() && time.Since(cb.HalfOpenSince) > halfOpenProbeTimeout {
		cb.HalfOpenInFlight = 0
		cb.HalfOpenSince = time.Time{}
	}

	if cb.HalfOpenInFlight >= cb.HalfOpenLimit {
		return false
	}

	cb.HalfOpenInFlight++
	cb.HalfOpenSince = time.Now()
	return true
}

// GetCircuitState 读取熔断状态（供日志/观测使用）
func GetCircuitState(channelID int) (CircuitState, int, string) {
	cb := getCircuitBreaker(channelID)
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.State, cb.ConsecutiveFailure, cb.LastError
}