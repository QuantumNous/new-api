//go:build redis_integration

// 该集成测试需要真实 Redis（compose 中已有 redis 服务）。运行方式：
//
//	go test -tags redis_integration ./common/limiter/ -run TestSlidingWindowAllow_Integration -v
//
// 不带该 tag 时整文件不参与编译，CI 默认跳过；Redis 不可达时 t.Skip。
// 未引入 miniredis，避免新增测试依赖。
package limiter

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
)

func dialTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	addr := os.Getenv("TEST_REDIS_ADDR")
	if addr == "" {
		addr = "127.0.0.1:6379"
	}
	rdb := redis.NewClient(&redis.Options{Addr: addr})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		t.Skipf("redis 不可达 %s: %v", addr, err)
	}
	return rdb
}

func TestSlidingWindowAllow_Integration(t *testing.T) {
	rdb := dialTestRedis(t)
	ctx := context.Background()
	key := "test:sw:integration"
	rdb.Del(ctx, key, key+":seq")
	defer rdb.Del(ctx, key, key+":seq")

	const limit = 5
	const window int64 = 2

	// 前 limit 个请求全部放行（冷启动也不会超过 limit）
	for i := 0; i < limit; i++ {
		allowed, ra, err := SlidingWindowAllow(ctx, rdb, key, limit, window)
		if err != nil || !allowed || ra != 0 {
			t.Fatalf("第 %d 个请求: (%v,%d,%v) 期望 (true,0,nil)", i, allowed, ra, err)
		}
	}

	// 第 limit+1 个必须被拒，且 retryAfter 在 (0, window] 之间
	allowed, ra, err := SlidingWindowAllow(ctx, rdb, key, limit, window)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Fatal("第 limit+1 个请求应被拒绝")
	}
	if ra < 1 || int64(ra) > window {
		t.Fatalf("retryAfter=%d 超出 (0,%d] 范围", ra, window)
	}

	// key 必须有 TTL（修复老令牌桶脚本 EXPIRE 被注释、key 永不过期的问题）
	ttl, err := rdb.PTTL(ctx, key).Result()
	if err != nil {
		t.Fatal(err)
	}
	if ttl <= 0 {
		t.Fatalf("限流 key 没有 TTL: %v", ttl)
	}

	// 等窗口滑过后恢复放行
	time.Sleep(time.Duration(window)*time.Second + 300*time.Millisecond)
	allowed, _, err = SlidingWindowAllow(ctx, rdb, key, limit, window)
	if err != nil || !allowed {
		t.Fatalf("窗口滑过后应恢复放行: (%v,%v)", allowed, err)
	}
}

func TestSlidingWindowAllow_NeverExceedsLimitUnderConcurrency(t *testing.T) {
	rdb := dialTestRedis(t)
	ctx := context.Background()
	key := "test:sw:concurrency"
	rdb.Del(ctx, key, key+":seq")
	defer rdb.Del(ctx, key, key+":seq")

	const limit = 20
	const window int64 = 10
	const fired = 100

	results := make(chan bool, fired)
	for i := 0; i < fired; i++ {
		go func() {
			allowed, _, err := SlidingWindowAllow(ctx, rdb, key, limit, window)
			results <- err == nil && allowed
		}()
	}

	allowed := 0
	for i := 0; i < fired; i++ {
		if <-results {
			allowed++
		}
	}
	// Lua 脚本在 Redis 单线程内原子执行，任意滚动窗口内放行数严格不超过 limit
	if allowed != limit {
		t.Fatalf("并发放行数=%d，期望恰好 %d（既不超也不少）", allowed, limit)
	}
}

// TestSlidingWindowAllow_LegacyTokenBucketHashCollision 复刻 Bug2 的生产现实：
// 旧令牌桶曾在裸 "rateLimit:<userId>" 上 HMSET 出一个 hash（tokens/last_time）且无 TTL。
// 它先锚定根因——直接对被 hash 占用的裸 key 跑滑动窗口必然 WRONGTYPE；
// 再验证修复——middleware 改用的独立 "rateLimit:sw:" 前缀 key 完全不受影响。
//
// 注意：前缀字符串与 middleware.slidingWindowTotalKey 必须保持一致（limiter 包不能反向
// 依赖 middleware，故此处硬编码并以注释约束）。
func TestSlidingWindowAllow_LegacyTokenBucketHashCollision(t *testing.T) {
	rdb := dialTestRedis(t)
	ctx := context.Background()
	const userId = "9876543"
	bareKey := "rateLimit:" + userId  // 旧令牌桶遗留的裸 key
	swKey := "rateLimit:sw:" + userId // 滑动窗口独立 key（须与 middleware.slidingWindowTotalKey 一致）
	rdb.Del(ctx, bareKey, swKey, swKey+":seq")
	// 复刻旧桶残留：HMSET hash，且不设 TTL
	if err := rdb.HSet(ctx, bareKey, "tokens", 2340, "last_time", 1780239204).Err(); err != nil {
		t.Fatal(err)
	}
	defer rdb.Del(ctx, bareKey, swKey, swKey+":seq")

	// 锚定 Bug：对被 hash 占用的裸 key 跑滑动窗口 => 必然 WRONGTYPE
	if _, _, err := SlidingWindowAllow(ctx, rdb, bareKey, 5, 2); err == nil {
		t.Fatal("预期裸 key（被旧令牌桶 hash 占用）跑滑动窗口应报 WRONGTYPE，以锚定 Bug2 根因")
	}

	// 验证修复：独立前缀 key 不受裸 key 类型影响，正常放行
	allowed, _, err := SlidingWindowAllow(ctx, rdb, swKey, 5, 2)
	if err != nil {
		t.Fatalf("独立前缀 key 不应受旧令牌桶 hash 影响，却报错: %v", err)
	}
	if !allowed {
		t.Fatal("首个请求应放行")
	}
}
