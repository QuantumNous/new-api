package service

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

// CircuitBreaker manages in-memory temporary failure cooldowns for channels.
// 自适应内存熔断器：在渠道出现持续故障（如 429、5xx、超时）时提供临时冷却隔离，防止流量持续撞墙并支持超时自动半开探测。
type CircuitBreaker struct {
	mu               sync.RWMutex
	breakers         map[int]*channelBreaker
	failureThreshold int           // 触发熔断的连续失败阈值 (默认 3 次)
	baseCooldown     time.Duration // 基础冷却时长 (默认 30 秒)
	maxCooldown      time.Duration // 最大冷却时长 (默认 5 分钟)
}

type channelBreaker struct {
	consecutiveFailures int
	lastFailureTime     time.Time
	cooldownDuration    time.Duration
	cooldownUntil       time.Time
	probing             bool // 是否处于 Half-Open 探测中
}

var (
	GlobalCircuitBreaker = NewCircuitBreaker(3, 30*time.Second, 5*time.Minute)
)

func NewCircuitBreaker(threshold int, baseCooldown time.Duration, maxCooldown time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		breakers:         make(map[int]*channelBreaker),
		failureThreshold: threshold,
		baseCooldown:     baseCooldown,
		maxCooldown:      maxCooldown,
	}
}

// RecordSuccess records a successful request for a channel and resets its failure state.
// 记录请求成功：重置该渠道的连续失败计数与熔断状态。
func (cb *CircuitBreaker) RecordSuccess(channelID int) {
	if channelID <= 0 {
		return
	}
	cb.mu.Lock()
	defer cb.mu.Unlock()

	b, exists := cb.breakers[channelID]
	if !exists {
		return
	}
	if b.consecutiveFailures > 0 || !b.cooldownUntil.IsZero() {
		common.SysLog(fmt.Sprintf("[CircuitBreaker] 渠道 #%d 恢复健康，重置熔断计数", channelID))
	}
	delete(cb.breakers, channelID)
}

// RecordFailure records a failure for a channel and triggers cooldown if threshold is met.
// 记录请求失败：根据错误状态码累计失败次数或直接触发临时熔断。
func (cb *CircuitBreaker) RecordFailure(channelID int, statusCode int) {
	if channelID <= 0 {
		return
	}

	// 仅对可重试或上游服务异常进行熔断统计 (429, 500, 502, 503, 504 或 网络超时)
	if !isSevereOrRetryableStatus(statusCode) {
		return
	}

	cb.mu.Lock()
	defer cb.mu.Unlock()

	b, exists := cb.breakers[channelID]
	now := time.Now()

	if !exists {
		b = &channelBreaker{
			cooldownDuration: cb.baseCooldown,
		}
		cb.breakers[channelID] = b
	}

	b.consecutiveFailures++
	b.lastFailureTime = now
	b.probing = false

	// 遇到 429 (Too Many Requests) 或 503 (Service Unavailable) 或 达到失败阈值，立即触发熔断
	if statusCode == http.StatusTooManyRequests || statusCode == http.StatusServiceUnavailable || b.consecutiveFailures >= cb.failureThreshold {
		if b.cooldownDuration == 0 {
			b.cooldownDuration = cb.baseCooldown
		} else if b.consecutiveFailures > cb.failureThreshold {
			// 指数退避增长冷却时间，最高不超过 maxCooldown
			b.cooldownDuration *= 2
			if b.cooldownDuration > cb.maxCooldown {
				b.cooldownDuration = cb.maxCooldown
			}
		}
		b.cooldownUntil = now.Add(b.cooldownDuration)
		common.SysLog(fmt.Sprintf("[CircuitBreaker] 渠道 #%d 触发临时熔断冷却，连续失败次数: %d, 状态码: %d, 冷却至: %s (%v)",
			channelID, b.consecutiveFailures, statusCode, b.cooldownUntil.Format("15:04:05"), b.cooldownDuration))
	}
}

// IsAvailable checks if the channel is currently available (not in cooldown or half-open ready for probe).
// 检查渠道当前是否可用（未熔断或已到冷却期可进行半开探测）。
func (cb *CircuitBreaker) IsAvailable(channelID int) bool {
	if channelID <= 0 {
		return true
	}
	cb.mu.Lock()
	defer cb.mu.Unlock()

	b, exists := cb.breakers[channelID]
	if !exists {
		return true
	}

	now := time.Now()
	// 如果仍在冷却期内
	if now.Before(b.cooldownUntil) {
		return false
	}

	// 冷却期已过，进入 Half-Open 状态，放行单次探测请求
	if !b.cooldownUntil.IsZero() {
		b.probing = true
		b.cooldownUntil = time.Time{} // 清空冷却期
		common.SysLog(fmt.Sprintf("[CircuitBreaker] 渠道 #%d 冷却期已过，进入半开 (Half-Open) 状态开始探测恢复", channelID))
	}
	return true
}

// FilterAvailableChannels filters out channels currently in cooldown.
// If ALL candidate channels are in cooldown, it gracefully returns all of them to prevent total starvation.
// 过滤候选渠道列表：优先剔除处于熔断冷却期的渠道；如果所有渠道均处于冷却中，则优雅降级返回全量渠道。
func (cb *CircuitBreaker) FilterAvailableChannels(channelIDs []int) []int {
	if len(channelIDs) <= 1 {
		return channelIDs
	}

	cb.mu.RLock()
	now := time.Now()
	available := make([]int, 0, len(channelIDs))

	for _, id := range channelIDs {
		b, exists := cb.breakers[id]
		if !exists || now.After(b.cooldownUntil) {
			available = append(available, id)
		}
	}
	cb.mu.RUnlock()

	// 如果全部都在熔断冷却中，退化返回所有渠道（避免完全无渠道可用）
	if len(available) == 0 {
		return channelIDs
	}
	return available
}

// Reset clears all circuit breaker records.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.breakers = make(map[int]*channelBreaker)
}

func isSevereOrRetryableStatus(statusCode int) bool {
	if statusCode == 0 || statusCode < 100 || statusCode > 599 {
		return true
	}
	if statusCode == http.StatusTooManyRequests || // 429
		statusCode == http.StatusBadGateway || // 502
		statusCode == http.StatusServiceUnavailable || // 503
		statusCode == http.StatusGatewayTimeout || // 504
		statusCode == http.StatusInternalServerError { // 500
		return true
	}
	return operation_setting.ShouldRetryByStatusCode(statusCode)
}
