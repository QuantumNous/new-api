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
// acquire 成功后调用方必须 release（通常用 defer），否则计数会泄漏；
// lease TTL 作为兜底：进程崩溃只增不减时，key 到期后自动归零。
type ConcurrentLimiter struct {
	client              *redis.Client
	concurrentScriptSHA string
	once                sync.Once
}

var (
	concurrentInstance *ConcurrentLimiter
	concurrentOnce     sync.Once
)

func NewConcurrent(ctx context.Context, r *redis.Client) *ConcurrentLimiter {
	concurrentOnce.Do(func() {
		sha, err := r.ScriptLoad(ctx, concurrentLimitScript).Result()
		if err != nil {
			common.SysLog(fmt.Sprintf("Failed to load concurrent limit script: %v", err))
		}
		concurrentInstance = &ConcurrentLimiter{
			client:              r,
			concurrentScriptSHA: sha,
		}
	})
	return concurrentInstance
}

// Acquire 尝试为 key 占用一个并发槽位，成功返回 true。
// maxConcurrent <= 0 表示不限制，直接放行。
// leaseTTL 是 acquire 后 key 的过期兜底时间，防止进程崩溃导致只增不减。
func (cl *ConcurrentLimiter) Acquire(ctx context.Context, key string, maxConcurrent int, leaseTTL time.Duration) (bool, error) {
	if maxConcurrent <= 0 {
		return true, nil
	}
	if cl == nil || cl.client == nil {
		return true, nil
	}
	result, err := cl.client.EvalSha(
		ctx,
		cl.concurrentScriptSHA,
		[]string{key},
		"acquire",
		maxConcurrent,
		int(leaseTTL.Seconds()),
	).Int()
	if err != nil {
		return false, fmt.Errorf("concurrent acquire failed: %w", err)
	}
	return result == 1, nil
}

// Release 释放一个并发槽位，调用前必须已成功 Acquire。
// 使用 defer release 保证请求结束（含 panic/异常）时释放。
func (cl *ConcurrentLimiter) Release(ctx context.Context, key string) {
	if cl == nil || cl.client == nil {
		return
	}
	_, _ = cl.client.EvalSha(
		ctx,
		cl.concurrentScriptSHA,
		[]string{key},
		"release",
	).Int()
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
