package service

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/constant"
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
	Generation         uint64    // invalidates results from requests started before a transition
}

type CircuitPermit struct {
	ChannelID  int
	Generation uint64
	HalfOpen   bool
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


// RecordSuccess 成功调用 -> 重置熔断状态
func RecordCircuitSuccess(channelID int) {
	if !constant.ChannelCircuitBreakerEnabled {
		return
	}

	cb := getCircuitBreaker(channelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()

	// A success without a selection-time permit may be a late result from a
	// request that started before the circuit opened. It must not close an
	// open/half-open circuit.
	if cb.State != CircuitClosed {
		return
	}
	cb.ConsecutiveFailure = 0
	cb.OpenUntil = time.Time{}
	cb.LastError = ""
}

func RecordCircuitSuccessWithPermit(permit CircuitPermit) {
	if !constant.ChannelCircuitBreakerEnabled || permit.ChannelID <= 0 {
		return
	}

	cb := getCircuitBreaker(permit.ChannelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if permit.Generation != cb.Generation {
		return
	}
	if permit.HalfOpen {
		if cb.State != CircuitHalfOpen {
			return
		}
		if cb.HalfOpenInFlight > 0 {
			cb.HalfOpenInFlight--
		}
		cb.State = CircuitClosed
		cb.Generation++
		cb.HalfOpenSince = time.Time{}
	} else if cb.State != CircuitClosed {
		return
	}

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
	cb.mu.RLock()
	permit := CircuitPermit{ChannelID: channelID, Generation: cb.Generation}
	cb.mu.RUnlock()
	RecordCircuitFailureWithPermit(permit, errMsg)
}

func RecordCircuitFailureWithPermit(permit CircuitPermit, errMsg string) {
	if !constant.ChannelCircuitBreakerEnabled || permit.ChannelID <= 0 {
		return
	}

	cb := getCircuitBreaker(permit.ChannelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if permit.Generation != cb.Generation {
		return
	}
	if permit.HalfOpen {
		if cb.State != CircuitHalfOpen {
			return
		}
		if cb.HalfOpenInFlight > 0 {
			cb.HalfOpenInFlight--
		}
		cb.HalfOpenSince = time.Time{}
		cb.State = CircuitOpen
		cb.Generation++
		cb.ConsecutiveFailure++
		cb.LastError = errMsg
		cb.OpenUntil = time.Now().Add(time.Duration(constant.ChannelCooldownSeconds) * time.Second)
		return
	}
	if cb.State != CircuitClosed {
		return
	}

	cb.ConsecutiveFailure++
	cb.LastError = errMsg

	// closed 状态下连续失败达到阈值 -> open
	threshold := 3
	if cb.ConsecutiveFailure >= threshold {
		cb.State = CircuitOpen
		cb.Generation++
		cb.OpenUntil = time.Now().Add(time.Duration(constant.ChannelCooldownSeconds) * time.Second)
	}

	// 如果配置了熔断但未启用，不做任何事
}

func AcquireCircuitPermit(channelID int) (CircuitPermit, bool) {
	if !constant.ChannelCircuitBreakerEnabled {
		return CircuitPermit{ChannelID: channelID}, true
	}

	cb := getCircuitBreaker(channelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.State == CircuitClosed {
		return CircuitPermit{ChannelID: channelID, Generation: cb.Generation}, true
	}
	if cb.State == CircuitOpen && time.Now().After(cb.OpenUntil) {
		cb.State = CircuitHalfOpen
		cb.HalfOpenInFlight = 0
		cb.HalfOpenSince = time.Time{}
	}
	if cb.State != CircuitHalfOpen {
		return CircuitPermit{}, false
	}

	const halfOpenProbeTimeout = 60 * time.Second
	if cb.HalfOpenInFlight > 0 && !cb.HalfOpenSince.IsZero() && time.Since(cb.HalfOpenSince) > halfOpenProbeTimeout {
		// Drop the stuck probe AND bump generation so a late response from the
		// expired permit cannot close the circuit or free a newer probe's slot.
		cb.HalfOpenInFlight = 0
		cb.HalfOpenSince = time.Time{}
		cb.Generation++
	}
	if cb.HalfOpenInFlight >= cb.HalfOpenLimit {
		return CircuitPermit{}, false
	}

	cb.HalfOpenInFlight++
	cb.HalfOpenSince = time.Now()
	return CircuitPermit{ChannelID: channelID, Generation: cb.Generation, HalfOpen: true}, true
}

func ReleaseCircuitPermit(permit CircuitPermit) {
	if !constant.ChannelCircuitBreakerEnabled || !permit.HalfOpen || permit.ChannelID <= 0 {
		return
	}
	cb := getCircuitBreaker(permit.ChannelID)
	cb.mu.Lock()
	defer cb.mu.Unlock()
	if cb.State != CircuitHalfOpen || cb.Generation != permit.Generation {
		return
	}
	if cb.HalfOpenInFlight > 0 {
		cb.HalfOpenInFlight--
	}
	if cb.HalfOpenInFlight == 0 {
		cb.HalfOpenSince = time.Time{}
	}
}


// GetCircuitState 读取熔断状态（供日志/观测使用）
func GetCircuitState(channelID int) (CircuitState, int, string) {
	cb := getCircuitBreaker(channelID)
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.State, cb.ConsecutiveFailure, cb.LastError
}
