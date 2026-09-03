package limiter

import (
	"context"
	_ "embed"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

//go:embed lua/concurrent_limit.lua
var concurrentLimitScript string

// ConcurrentLimiter 限制同一 key 的在途请求数量 (in-flight)，
// 区别于令牌桶/滑动窗口的"时间窗口内累计请求数"。
// acquire 成功后调用方必须 release（通常用 defer），否则计数会泄漏。
// Redis 实现以 sorted set 记录每个请求独立的 lease（member = lease ID，
// score = 过期时间戳）：lease TTL 仅作为进程崩溃后的自动回收兜底，
// 存活请求通过 KeepAlive 续租，长请求不会因 TTL 到期丢失槽位，
// release 只移除自己的 lease，不会误减重建后的计数。
type ConcurrentLimiter struct {
	client *redis.Client
	script *redis.Script
}

func NewConcurrent(r *redis.Client) *ConcurrentLimiter {
	return &ConcurrentLimiter{
		client: r,
		script: redis.NewScript(concurrentLimitScript),
	}
}

// Acquire 尝试为 key 占用一个并发槽位，成功时返回本次占用的
// lease ID（Release / KeepAlive 必须回传同一 ID），被限流或出错时
// 返回空 lease ID。maxConcurrent <= 0 表示不限制，直接放行。
func (cl *ConcurrentLimiter) Acquire(ctx context.Context, key string, maxConcurrent int, leaseTTL time.Duration) (string, bool, error) {
	if maxConcurrent <= 0 {
		return "", true, nil
	}
	if cl == nil || cl.client == nil {
		return "", true, nil
	}
	leaseID := common.GetUUID()
	result, err := cl.script.Run(
		ctx,
		cl.client,
		[]string{key},
		"acquire",
		maxConcurrent,
		int(leaseTTL.Seconds()),
		leaseID,
	).Int()
	if err != nil {
		return "", false, fmt.Errorf("concurrent acquire failed: %w", err)
	}
	if result != 1 {
		return "", false, nil
	}
	return leaseID, true, nil
}

// KeepAlive 周期性续租 Acquire 占用的槽位，直到 ctx 被取消
// （通常在 Release 时触发）。lease 已被清理时退出；Redis 瞬时故障时
// 重试，故障持续超过 lease TTL 则槽位按崩溃兜底语义自动回收。
func (cl *ConcurrentLimiter) KeepAlive(ctx context.Context, key string, leaseID string, leaseTTL time.Duration) {
	if cl == nil || cl.client == nil || leaseID == "" {
		return
	}
	interval := leaseTTL / 3
	if interval < time.Second {
		interval = time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			result, err := cl.script.Run(ctx, cl.client, []string{key}, "renew", int(leaseTTL.Seconds()), leaseID).Int()
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				common.SysError(fmt.Sprintf("concurrent lease renew failed for key %s: %v", key, err))
				continue
			}
			if result != 1 {
				return
			}
		}
	}
}

// Release 释放 Acquire 占用的槽位，调用前必须已成功 Acquire。
// 使用 defer release 保证请求结束（含 panic/异常）时释放。
func (cl *ConcurrentLimiter) Release(ctx context.Context, key string, leaseID string) {
	if cl == nil || cl.client == nil || leaseID == "" {
		return
	}
	_, _ = cl.script.Run(ctx, cl.client, []string{key}, "release", leaseID).Int()
}

// --- 内存回退实现 (Redis 不可用时使用，单实例) ---

type InMemoryConcurrentLimiter struct {
	store map[string]*int64
	mutex sync.Mutex
}

var (
	inMemConcurrent     *InMemoryConcurrentLimiter
	inMemConcurrentOnce sync.Once
)

func GetInMemoryConcurrent() *InMemoryConcurrentLimiter {
	inMemConcurrentOnce.Do(func() {
		inMemConcurrent = &InMemoryConcurrentLimiter{
			store: make(map[string]*int64),
		}
	})
	return inMemConcurrent
}

func (l *InMemoryConcurrentLimiter) Acquire(key string, maxConcurrent int) bool {
	if maxConcurrent <= 0 {
		return true
	}
	l.mutex.Lock()
	defer l.mutex.Unlock()
	counter, ok := l.store[key]
	if !ok {
		var v int64 = 0
		counter = &v
		l.store[key] = counter
	}
	current := atomic.LoadInt64(counter)
	if current >= int64(maxConcurrent) {
		return false
	}
	atomic.AddInt64(counter, 1)
	return true
}

func (l *InMemoryConcurrentLimiter) Release(key string) {
	l.mutex.Lock()
	counter, ok := l.store[key]
	l.mutex.Unlock()
	if !ok {
		return
	}
	// 不低于 0，防止重复 release 导致负数
	for {
		current := atomic.LoadInt64(counter)
		if current <= 0 {
			return
		}
		if atomic.CompareAndSwapInt64(counter, current, current-1) {
			return
		}
	}
}
