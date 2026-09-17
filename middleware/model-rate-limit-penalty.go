package middleware

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

// 超限惩罚：拒绝延迟（tarpit）与用户级熔断冷却。
//
// 限流命中后若立即返回 429，不遵守 Retry-After 的客户端会以毫秒级频率重试。
// 压测实测：429 平均 40ms 返回，单用户可打到 16000+ req/min，把进程 CPU 顶到 94%，
// 触发 SystemPerformanceCheck 的过载保护，导致本可正常服务的请求也被 503 拒绝。
// 拒绝延迟让"被拒绝"本身带上时间成本，从而给重试风暴设置上界；
// 熔断冷却则让持续超限的用户在一段时间内被挡在限流计数器之前，省掉每次的存储往返。
const (
	// 拒绝延迟档位：按连续超限次数递增
	penaltyFreeStrikes = 2                      // 前 2 次不延迟，容忍偶发突发
	penaltyMildStrikes = 10                     // 第 3~10 次
	penaltyMildDelay   = 500 * time.Millisecond // 第 3~10 次的延迟
	penaltyHeavyDelay  = 5 * time.Second        // 第 10 次以上的延迟

	// 同时处于延迟等待中的请求上限，避免 tarpit 自身占满 goroutine。
	// 该上限全局共享而非按用户划分：连续超限计数是每个用户各自累计的，
	// 但等待席位取自同一个池子。单个用户占满席位时，其余超限请求退化为即时拒绝，
	// 不影响正常请求——只有已被判定超限的请求才会进入等待。
	penaltyMaxWaiting = 512

	// 熔断冷却
	penaltyCooldownStrikes = 20              // 连续超限达到此次数后进入冷却
	penaltyCooldownBase    = 10              // 首次冷却秒数
	penaltyCooldownMax     = 60              // 冷却秒数上限
	penaltyStrikeTTL       = 5 * time.Minute // 连续超限计数的存活时间

	penaltyStrikeKeyPrefix   = "rateLimit:strike:"
	penaltyCooldownKeyPrefix = "rateLimit:cooldown:"

	// 内存后端的条目上限，防止 userId 空间被刷爆
	penaltyMemoryMaxEntries = 10000
)

// penaltyWaitSlots 限制同时睡眠的请求数。缓冲区满时不再延迟，直接拒绝，
// 保证 tarpit 在极端流量下不会放大资源占用。
var penaltyWaitSlots = make(chan struct{}, penaltyMaxWaiting)

type penaltyEntry struct {
	strikes     int64
	cooldownEnd time.Time
	expiresAt   time.Time
}

type penaltyMemoryStore struct {
	mu      sync.Mutex
	entries map[string]*penaltyEntry
}

var penaltyMemory = penaltyMemoryStore{entries: make(map[string]*penaltyEntry)}

// get 返回条目，顺带清理过期数据；条目不存在或已过期时返回 nil。
func (s *penaltyMemoryStore) get(userId string, now time.Time) *penaltyEntry {
	entry, ok := s.entries[userId]
	if !ok {
		return nil
	}
	if now.After(entry.expiresAt) && now.After(entry.cooldownEnd) {
		delete(s.entries, userId)
		return nil
	}
	return entry
}

// evictExpired 在写入前清理过期条目，并在条目数超限时放弃记录新用户，
// 避免恶意构造大量 userId 撑爆内存。
func (s *penaltyMemoryStore) evictExpired(now time.Time) {
	for key, entry := range s.entries {
		if now.After(entry.expiresAt) && now.After(entry.cooldownEnd) {
			delete(s.entries, key)
		}
	}
}

// penaltyCooldownRemaining 返回用户剩余冷却秒数，0 表示不在冷却中。
// 该检查先于限流计数执行，命中时可跳过限流器的存储往返。
func penaltyCooldownRemaining(ctx context.Context, userId string) int64 {
	if common.RedisEnabled {
		ttl, err := common.RDB.TTL(ctx, penaltyCooldownKeyPrefix+userId).Result()
		if err != nil || ttl <= 0 {
			return 0
		}
		return int64(ttl.Seconds()) + 1
	}

	now := time.Now()
	penaltyMemory.mu.Lock()
	defer penaltyMemory.mu.Unlock()
	entry := penaltyMemory.get(userId, now)
	if entry == nil || !now.Before(entry.cooldownEnd) {
		return 0
	}
	return int64(entry.cooldownEnd.Sub(now).Seconds()) + 1
}

// penaltyRecordStrike 记录一次超限，返回连续超限次数与本次应施加的冷却秒数
// （0 表示未触发冷却）。冷却时长随触发次数指数退避，上限 penaltyCooldownMax。
func penaltyRecordStrike(ctx context.Context, userId string) (int64, int64) {
	var strikes int64

	if common.RedisEnabled {
		count, err := common.RDB.Incr(ctx, penaltyStrikeKeyPrefix+userId).Result()
		if err != nil {
			return 0, 0
		}
		common.RDB.Expire(ctx, penaltyStrikeKeyPrefix+userId, penaltyStrikeTTL)
		strikes = count
	} else {
		now := time.Now()
		penaltyMemory.mu.Lock()
		entry := penaltyMemory.get(userId, now)
		if entry == nil {
			penaltyMemory.evictExpired(now)
			if len(penaltyMemory.entries) >= penaltyMemoryMaxEntries {
				penaltyMemory.mu.Unlock()
				return 0, 0
			}
			entry = &penaltyEntry{}
			penaltyMemory.entries[userId] = entry
		}
		entry.strikes++
		entry.expiresAt = now.Add(penaltyStrikeTTL)
		strikes = entry.strikes
		penaltyMemory.mu.Unlock()
	}

	if !setting.ModelRequestRateLimitCooldownEnabled || strikes < penaltyCooldownStrikes {
		return strikes, 0
	}

	// 每达到一个 penaltyCooldownStrikes 倍数，冷却时长翻倍
	seconds := int64(penaltyCooldownBase) << ((strikes / penaltyCooldownStrikes) - 1)
	if seconds > penaltyCooldownMax || seconds <= 0 {
		seconds = penaltyCooldownMax
	}

	if common.RedisEnabled {
		common.RDB.Set(ctx, penaltyCooldownKeyPrefix+userId, "1", time.Duration(seconds)*time.Second)
	} else {
		now := time.Now()
		penaltyMemory.mu.Lock()
		if entry := penaltyMemory.get(userId, now); entry != nil {
			entry.cooldownEnd = now.Add(time.Duration(seconds) * time.Second)
		}
		penaltyMemory.mu.Unlock()
	}

	return strikes, seconds
}

// penaltyClearStrikes 在请求通过限流后清除连续超限计数，
// 使惩罚只针对持续超限的调用方，不影响恢复正常的客户端。
func penaltyClearStrikes(ctx context.Context, userId string) {
	if common.RedisEnabled {
		common.RDB.Del(ctx, penaltyStrikeKeyPrefix+userId)
		return
	}

	penaltyMemory.mu.Lock()
	defer penaltyMemory.mu.Unlock()
	if entry, ok := penaltyMemory.entries[userId]; ok && entry.cooldownEnd.Before(time.Now()) {
		delete(penaltyMemory.entries, userId)
	}
}

// penaltyDelayFor 返回给定连续超限次数对应的拒绝前延迟。
func penaltyDelayFor(strikes int64) time.Duration {
	switch {
	case strikes <= penaltyFreeStrikes:
		return 0
	case strikes <= penaltyMildStrikes:
		return penaltyMildDelay
	default:
		return penaltyHeavyDelay
	}
}

// penaltyWait 在拒绝前等待指定时长。客户端断开时立即返回，
// 等待槽位耗尽时也立即返回，两种情况都退化为即时拒绝。
func penaltyWait(c *gin.Context, delay time.Duration) {
	if delay <= 0 {
		return
	}

	select {
	case penaltyWaitSlots <- struct{}{}:
		defer func() { <-penaltyWaitSlots }()
	default:
		return
	}

	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
	case <-c.Request.Context().Done():
	}
}

// abortRateLimited 记录一次超限，按连续超限次数延迟后拒绝请求，
// 并附带 Retry-After 让守规矩的客户端可以退避。
func abortRateLimited(c *gin.Context, userId string, retryAfterSeconds int64, message string) {
	var delay time.Duration
	if setting.ModelRequestRateLimitPenaltyEnabled {
		strikes, cooldownSeconds := penaltyRecordStrike(context.Background(), userId)
		delay = penaltyDelayFor(strikes)
		if cooldownSeconds > retryAfterSeconds {
			retryAfterSeconds = cooldownSeconds
		}
	}
	writeModelRateLimited(c, delay, retryAfterSeconds, message)
}

// abortInCooldown 拒绝冷却期内的请求。与 abortRateLimited 的区别是不累加连续
// 超限计数：冷却期内继续累加会把冷却时长反复重置到上限，让持续重试的客户端
// 永远无法退出冷却，也就拿不到冷却结束后的那次重新尝试。不累加则每轮冷却后
// 都放行一次尝试，客户端的实际请求速率被压到窗口限额之下后即可自行恢复。
// 能进入冷却说明连续超限已达阈值，因此直接按最重档延迟，无需再读取计数。
func abortInCooldown(c *gin.Context, retryAfterSeconds int64, message string) {
	delay := time.Duration(0)
	if setting.ModelRequestRateLimitPenaltyEnabled {
		delay = penaltyHeavyDelay
	}
	writeModelRateLimited(c, delay, retryAfterSeconds, message)
}

func writeModelRateLimited(c *gin.Context, delay time.Duration, retryAfterSeconds int64, message string) {
	penaltyWait(c, delay)
	if retryAfterSeconds > 0 {
		c.Header("Retry-After", strconv.FormatInt(retryAfterSeconds, 10))
	}
	abortWithOpenAiMessage(c, http.StatusTooManyRequests, message)
}
