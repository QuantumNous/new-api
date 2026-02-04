package common

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-redis/redis/v8"
)

// GroupLimiter 用户组限流器接口
type GroupLimiter interface {
	// CheckConcurrency 检查并发数限制，返回是否允许请求
	// 如果允许，调用者需要在请求完成后调用 ReleaseConcurrency
	CheckConcurrency(userID int, limit int) (allowed bool, err error)
	// ReleaseConcurrency 释放并发计数
	ReleaseConcurrency(userID int) error
	// CheckRPM 检查每分钟请求数限制
	CheckRPM(userID int, limit int) (allowed bool, err error)
	// CheckRPD 检查每日请求数限制
	CheckRPD(userID int, limit int) (allowed bool, err error)
	// RecordRPD 记录每日请求数（用于 RPD，在请求完成后调用）
	RecordRPD(userID int) error
	// CheckTPM 检查每分钟令牌数限制
	CheckTPM(userID int, limit int64, tokens int64) (allowed bool, err error)
	// CheckTPD 检查每日令牌数限制
	CheckTPD(userID int, limit int64, tokens int64) (allowed bool, err error)
	// RecordTokens 记录使用的令牌数（用于 TPM，在请求完成后调用）
	RecordTokens(userID int, tokens int64) error
	// RecordTPD 记录每日令牌使用量（用于 TPD，在请求完成后调用）
	RecordTPD(userID int, tokens int64) error
	// GetCurrentConcurrency 获取当前并发数
	GetCurrentConcurrency(userID int) (int, error)
}

// MemoryGroupLimiter 基于内存的限流器实现
type MemoryGroupLimiter struct {
	// 并发计数器 map[userID]count
	concurrencyMap sync.Map

	// RPM 计数器 map[userID]*slidingWindow
	rpmWindows sync.Map

	// RPD 计数器 map[userID]*dailyRequestCounter
	rpdCounters sync.Map

	// TPM 计数器 map[userID]*slidingWindowInt64
	tpmWindows sync.Map

	// TPD 计数器 map[userID]*dailyTokenCounter
	tpdCounters sync.Map
}

type slidingWindow struct {
	mu       sync.Mutex
	requests []int64 // 请求时间戳列表
}

type slidingWindowInt64 struct {
	mu     sync.Mutex
	tokens []tokenRecord // 令牌记录列表
}

type tokenRecord struct {
	timestamp int64
	count     int64
}

type dailyTokenCounter struct {
	mu     sync.Mutex
	date   string // YYYY-MM-DD
	tokens int64
}

type dailyRequestCounter struct {
	mu       sync.Mutex
	date     string // YYYY-MM-DD
	requests int
}

var globalMemoryLimiter *MemoryGroupLimiter
var memoryLimiterOnce sync.Once

// GetMemoryGroupLimiter 获取全局内存限流器实例
func GetMemoryGroupLimiter() *MemoryGroupLimiter {
	memoryLimiterOnce.Do(func() {
		globalMemoryLimiter = &MemoryGroupLimiter{}
		// 启动清理协程
		go globalMemoryLimiter.cleanupRoutine()
	})
	return globalMemoryLimiter
}

// cleanupRoutine 定期清理过期数据
func (l *MemoryGroupLimiter) cleanupRoutine() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now().Unix()
		oneMinuteAgo := now - 60

		// 清理 RPM 窗口中的过期数据
		l.rpmWindows.Range(func(key, value interface{}) bool {
			sw := value.(*slidingWindow)
			sw.mu.Lock()
			newRequests := make([]int64, 0)
			for _, ts := range sw.requests {
				if ts > oneMinuteAgo {
					newRequests = append(newRequests, ts)
				}
			}
			sw.requests = newRequests
			sw.mu.Unlock()
			return true
		})

		// 清理 TPM 窗口中的过期数据
		l.tpmWindows.Range(func(key, value interface{}) bool {
			sw := value.(*slidingWindowInt64)
			sw.mu.Lock()
			newTokens := make([]tokenRecord, 0)
			for _, tr := range sw.tokens {
				if tr.timestamp > oneMinuteAgo {
					newTokens = append(newTokens, tr)
				}
			}
			sw.tokens = newTokens
			sw.mu.Unlock()
			return true
		})

		// 清理过期的 TPD 计数器
		today := time.Now().Format("2006-01-02")
		l.tpdCounters.Range(func(key, value interface{}) bool {
			dc := value.(*dailyTokenCounter)
			dc.mu.Lock()
			if dc.date != today {
				// 删除过期的计数器
				l.tpdCounters.Delete(key)
			}
			dc.mu.Unlock()
			return true
		})
	}
}

func (l *MemoryGroupLimiter) CheckConcurrency(userID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	key := userID
	for {
		actual, _ := l.concurrencyMap.LoadOrStore(key, new(int32))
		counter := actual.(*int32)
		current := atomic.LoadInt32(counter)

		if int(current) >= limit {
			return false, nil
		}

		if atomic.CompareAndSwapInt32(counter, current, current+1) {
			return true, nil
		}
		// CAS 失败，重试
	}
}

func (l *MemoryGroupLimiter) ReleaseConcurrency(userID int) error {
	key := userID
	if actual, ok := l.concurrencyMap.Load(key); ok {
		counter := actual.(*int32)
		atomic.AddInt32(counter, -1)
	}
	return nil
}

func (l *MemoryGroupLimiter) GetCurrentConcurrency(userID int) (int, error) {
	key := userID
	if actual, ok := l.concurrencyMap.Load(key); ok {
		counter := actual.(*int32)
		return int(atomic.LoadInt32(counter)), nil
	}
	return 0, nil
}

func (l *MemoryGroupLimiter) CheckRPM(userID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	key := userID
	now := time.Now().Unix()
	oneMinuteAgo := now - 60

	actual, _ := l.rpmWindows.LoadOrStore(key, &slidingWindow{requests: make([]int64, 0)})
	sw := actual.(*slidingWindow)

	sw.mu.Lock()
	defer sw.mu.Unlock()

	// 清理过期的请求记录
	newRequests := make([]int64, 0)
	for _, ts := range sw.requests {
		if ts > oneMinuteAgo {
			newRequests = append(newRequests, ts)
		}
	}
	sw.requests = newRequests

	// 检查是否超过限制
	if len(sw.requests) >= limit {
		return false, nil
	}

	// 记录当前请求
	sw.requests = append(sw.requests, now)
	return true, nil
}

func (l *MemoryGroupLimiter) CheckTPD(userID int, limit int64, tokens int64) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	key := userID
	today := time.Now().Format("2006-01-02")

	actual, _ := l.tpdCounters.LoadOrStore(key, &dailyTokenCounter{date: today, tokens: 0})
	dc := actual.(*dailyTokenCounter)

	dc.mu.Lock()
	defer dc.mu.Unlock()

	// 如果日期变了，重置计数器
	if dc.date != today {
		dc.date = today
		dc.tokens = 0
	}

	// 检查是否超过限制
	if dc.tokens+tokens > limit {
		return false, nil
	}

	return true, nil
}

// RecordTPD 记录每日令牌使用量
func (l *MemoryGroupLimiter) RecordTPD(userID int, tokens int64) error {
	if tokens <= 0 {
		return nil
	}

	key := userID
	today := time.Now().Format("2006-01-02")

	actual, _ := l.tpdCounters.LoadOrStore(key, &dailyTokenCounter{date: today, tokens: 0})
	dc := actual.(*dailyTokenCounter)

	dc.mu.Lock()
	defer dc.mu.Unlock()

	// 如果日期变了，重置计数器
	if dc.date != today {
		dc.date = today
		dc.tokens = 0
	}

	dc.tokens += tokens
	return nil
}

func (l *MemoryGroupLimiter) CheckTPM(userID int, limit int64, tokens int64) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	key := userID
	now := time.Now().Unix()
	oneMinuteAgo := now - 60

	actual, _ := l.tpmWindows.LoadOrStore(key, &slidingWindowInt64{tokens: make([]tokenRecord, 0)})
	sw := actual.(*slidingWindowInt64)

	sw.mu.Lock()
	defer sw.mu.Unlock()

	// 清理过期的令牌记录并计算当前使用量
	newTokens := make([]tokenRecord, 0)
	var currentTotal int64 = 0
	for _, tr := range sw.tokens {
		if tr.timestamp > oneMinuteAgo {
			newTokens = append(newTokens, tr)
			currentTotal += tr.count
		}
	}
	sw.tokens = newTokens

	// 检查是否超过限制
	if currentTotal+tokens > limit {
		return false, nil
	}

	return true, nil
}

func (l *MemoryGroupLimiter) RecordTokens(userID int, tokens int64) error {
	if tokens <= 0 {
		return nil
	}

	key := userID
	now := time.Now().Unix()

	actual, _ := l.tpmWindows.LoadOrStore(key, &slidingWindowInt64{tokens: make([]tokenRecord, 0)})
	sw := actual.(*slidingWindowInt64)

	sw.mu.Lock()
	defer sw.mu.Unlock()

	sw.tokens = append(sw.tokens, tokenRecord{timestamp: now, count: tokens})
	return nil
}

// CheckRPD 检查每日请求数限制
func (l *MemoryGroupLimiter) CheckRPD(userID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	key := userID
	today := time.Now().Format("2006-01-02")

	actual, _ := l.rpdCounters.LoadOrStore(key, &dailyRequestCounter{date: today, requests: 0})
	dc := actual.(*dailyRequestCounter)

	dc.mu.Lock()
	defer dc.mu.Unlock()

	// 如果日期变了，重置计数器
	if dc.date != today {
		dc.date = today
		dc.requests = 0
	}

	// 检查是否超过限制
	if dc.requests >= limit {
		return false, nil
	}

	return true, nil
}

// RecordRPD 记录每日请求数
func (l *MemoryGroupLimiter) RecordRPD(userID int) error {
	key := userID
	today := time.Now().Format("2006-01-02")

	actual, _ := l.rpdCounters.LoadOrStore(key, &dailyRequestCounter{date: today, requests: 0})
	dc := actual.(*dailyRequestCounter)

	dc.mu.Lock()
	defer dc.mu.Unlock()

	// 如果日期变了，重置计数器
	if dc.date != today {
		dc.date = today
		dc.requests = 0
	}

	dc.requests++
	return nil
}

// RedisGroupLimiter 基于 Redis 的限流器实现
type RedisGroupLimiter struct{}

var globalRedisLimiter *RedisGroupLimiter
var redisLimiterOnce sync.Once

// GetRedisGroupLimiter 获取全局 Redis 限流器实例
func GetRedisGroupLimiter() *RedisGroupLimiter {
	redisLimiterOnce.Do(func() {
		globalRedisLimiter = &RedisGroupLimiter{}
	})
	return globalRedisLimiter
}

func (l *RedisGroupLimiter) concurrencyKey(userID int) string {
	return fmt.Sprintf("group_limit:concurrency:%d", userID)
}

func (l *RedisGroupLimiter) rpmKey(userID int) string {
	return fmt.Sprintf("group_limit:rpm:%d", userID)
}

func (l *RedisGroupLimiter) tpdKey(userID int, date string) string {
	return fmt.Sprintf("group_limit:tpd:%d:%s", userID, date)
}

func (l *RedisGroupLimiter) tpmKey(userID int) string {
	return fmt.Sprintf("group_limit:tpm:%d", userID)
}

func (l *RedisGroupLimiter) rpdKey(userID int, date string) string {
	return fmt.Sprintf("group_limit:rpd:%d:%s", userID, date)
}

func (l *RedisGroupLimiter) CheckConcurrency(userID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	ctx := context.Background()
	key := l.concurrencyKey(userID)

	// 使用 INCR 增加计数
	current, err := RDB.Incr(ctx, key).Result()
	if err != nil {
		// Redis 错误，降级为允许通过
		SysLog("Redis error in CheckConcurrency: " + err.Error())
		return true, nil
	}

	// 设置过期时间（防止 key 永久存在）
	RDB.Expire(ctx, key, 10*time.Minute)

	if current > int64(limit) {
		// 超过限制，回滚计数
		RDB.Decr(ctx, key)
		return false, nil
	}

	return true, nil
}

func (l *RedisGroupLimiter) ReleaseConcurrency(userID int) error {
	ctx := context.Background()
	key := l.concurrencyKey(userID)

	_, err := RDB.Decr(ctx, key).Result()
	if err != nil {
		SysLog("Redis error in ReleaseConcurrency: " + err.Error())
	}
	return nil
}

func (l *RedisGroupLimiter) GetCurrentConcurrency(userID int) (int, error) {
	ctx := context.Background()
	key := l.concurrencyKey(userID)

	val, err := RDB.Get(ctx, key).Result()
	if err != nil {
		return 0, nil
	}

	count, _ := strconv.Atoi(val)
	return count, nil
}

func (l *RedisGroupLimiter) CheckRPM(userID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	ctx := context.Background()
	key := l.rpmKey(userID)
	now := time.Now().Unix()
	oneMinuteAgo := now - 60

	// 使用 ZRANGEBYSCORE 获取一分钟内的请求数
	count, err := RDB.ZCount(ctx, key, strconv.FormatInt(oneMinuteAgo, 10), "+inf").Result()
	if err != nil {
		SysLog("Redis error in CheckRPM: " + err.Error())
		return true, nil
	}

	if count >= int64(limit) {
		return false, nil
	}

	// 添加当前请求
	member := fmt.Sprintf("%d:%d", now, time.Now().UnixNano())
	RDB.ZAdd(ctx, key, &redis.Z{Score: float64(now), Member: member})
	RDB.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(oneMinuteAgo, 10))
	RDB.Expire(ctx, key, 2*time.Minute)

	return true, nil
}

func (l *RedisGroupLimiter) CheckTPD(userID int, limit int64, tokens int64) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	ctx := context.Background()
	today := time.Now().Format("2006-01-02")
	key := l.tpdKey(userID, today)

	// 获取当前令牌数
	currentStr, err := RDB.Get(ctx, key).Result()
	var current int64 = 0
	if err == nil {
		current, _ = strconv.ParseInt(currentStr, 10, 64)
	}

	// 检查是否超过限制
	if current+tokens > limit {
		return false, nil
	}

	return true, nil
}

// RecordTPD 记录每日令牌使用量
func (l *RedisGroupLimiter) RecordTPD(userID int, tokens int64) error {
	if tokens <= 0 {
		return nil
	}

	ctx := context.Background()
	now := time.Now()
	today := now.Format("2006-01-02")
	key := l.tpdKey(userID, today)

	// 增加令牌计数
	_, err := RDB.IncrBy(ctx, key, tokens).Result()
	if err != nil {
		SysLog("Redis error in RecordTPD: " + err.Error())
		return err
	}

	// 设置过期时间为本地时区的明天午夜
	tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
	RDB.ExpireAt(ctx, key, tomorrow)

	return nil
}

func (l *RedisGroupLimiter) CheckTPM(userID int, limit int64, tokens int64) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	ctx := context.Background()
	key := l.tpmKey(userID)
	now := time.Now().Unix()
	oneMinuteAgo := now - 60

	// 获取一分钟内的令牌总数
	members, err := RDB.ZRangeByScoreWithScores(ctx, key, &redis.ZRangeBy{
		Min: strconv.FormatInt(oneMinuteAgo, 10),
		Max: "+inf",
	}).Result()
	if err != nil {
		SysLog("Redis error in CheckTPM: " + err.Error())
		return true, nil
	}

	var totalTokens int64 = 0
	for _, m := range members {
		// member 格式: "timestamp:count"
		if countStr, ok := m.Member.(string); ok {
			parts := splitMember(countStr)
			if len(parts) >= 2 {
				if count, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
					totalTokens += count
				}
			}
		}
	}

	if totalTokens+tokens > limit {
		return false, nil
	}

	return true, nil
}

func (l *RedisGroupLimiter) RecordTokens(userID int, tokens int64) error {
	if tokens <= 0 {
		return nil
	}

	ctx := context.Background()
	key := l.tpmKey(userID)
	now := time.Now().Unix()
	oneMinuteAgo := now - 60

	// 添加令牌记录
	member := fmt.Sprintf("%d:%d", now, tokens)
	RDB.ZAdd(ctx, key, &redis.Z{Score: float64(now), Member: member})
	RDB.ZRemRangeByScore(ctx, key, "-inf", strconv.FormatInt(oneMinuteAgo, 10))
	RDB.Expire(ctx, key, 2*time.Minute)

	return nil
}

// CheckRPD 检查每日请求数限制
func (l *RedisGroupLimiter) CheckRPD(userID int, limit int) (bool, error) {
	if limit <= 0 {
		return true, nil
	}

	ctx := context.Background()
	today := time.Now().Format("2006-01-02")
	key := l.rpdKey(userID, today)

	// 获取当前请求数
	currentStr, err := RDB.Get(ctx, key).Result()
	var current int = 0
	if err == nil {
		current, _ = strconv.Atoi(currentStr)
	}

	// 检查是否超过限制
	if current >= limit {
		return false, nil
	}

	return true, nil
}

// RecordRPD 记录每日请求数
func (l *RedisGroupLimiter) RecordRPD(userID int) error {
	ctx := context.Background()
	now := time.Now()
	today := now.Format("2006-01-02")
	key := l.rpdKey(userID, today)

	// 增加请求计数
	_, err := RDB.Incr(ctx, key).Result()
	if err != nil {
		SysLog("Redis error in RecordRPD: " + err.Error())
		return err
	}

	// 设置过期时间为本地时区的明天午夜
	tomorrow := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
	RDB.ExpireAt(ctx, key, tomorrow)

	return nil
}

func splitMember(s string) []string {
	result := make([]string, 0, 2)
	idx := 0
	for i, c := range s {
		if c == ':' {
			result = append(result, s[idx:i])
			idx = i + 1
		}
	}
	result = append(result, s[idx:])
	return result
}

// GetGroupLimiter 根据配置返回合适的限流器
func GetGroupLimiter() GroupLimiter {
	if RedisEnabled && RDB != nil {
		return GetRedisGroupLimiter()
	}
	return GetMemoryGroupLimiter()
}
