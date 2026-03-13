package limiter

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
)

// 测试前需要启动 Redis: docker run -d -p 6379:6379 redis:latest
// 运行测试: go test -v ./common/limiter/...

func newTestRedisClient() *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   2, // 使用独立的测试 DB，避免污染生产数据
	})
}

// resetLimiterSingleton 重置单例，允许测试间独立初始化
// 注意：这是测试专用的 hack，生产代码不应依赖此方法
func resetLimiterSingleton() {
	once = sync.Once{}
	instance = nil
}

// ==================== 滑动窗口基本功能测试 ====================

func TestAllowSlidingWindow_Basic(t *testing.T) {
	resetLimiterSingleton()
	ctx := context.Background()
	rdb := newTestRedisClient()
	defer rdb.Close()

	rl := New(ctx, rdb)
	key := fmt.Sprintf("test:sliding:%d", time.Now().UnixNano())
	defer rdb.Del(ctx, key)

	maxReq := 3
	duration := int64(10)   // 10 秒窗口
	expiration := int64(60) // 60 秒过期

	// 前 3 次请求应该全部放行
	for i := 1; i <= maxReq; i++ {
		allowed, err := rl.AllowSlidingWindow(ctx, key, maxReq, duration, expiration)
		if err != nil {
			t.Fatalf("第 %d 次请求出错: %v", i, err)
		}
		if !allowed {
			t.Errorf("第 %d 次请求应该放行，但被拒绝", i)
		}
	}

	// 第 4 次请求应该被拒绝（窗口内已有 3 个请求）
	allowed, err := rl.AllowSlidingWindow(ctx, key, maxReq, duration, expiration)
	if err != nil {
		t.Fatalf("第 4 次请求出错: %v", err)
	}
	if allowed {
		t.Error("第 4 次请求应该被拒绝，但被放行")
	}

	t.Log("✓ 基本限流逻辑正确：3 次放行，第 4 次拒绝")
}

func TestAllowSlidingWindow_WindowExpiry(t *testing.T) {
	resetLimiterSingleton()
	ctx := context.Background()
	rdb := newTestRedisClient()
	defer rdb.Close()

	rl := New(ctx, rdb)
	key := fmt.Sprintf("test:sliding:expiry:%d", time.Now().UnixNano())
	defer rdb.Del(ctx, key)

	maxReq := 2
	duration := int64(2) // 2 秒窗口（短窗口便于测试）
	expiration := int64(60)

	// 消耗完配额
	for i := 0; i < maxReq; i++ {
		rl.AllowSlidingWindow(ctx, key, maxReq, duration, expiration)
	}

	// 此时应该被拒绝
	allowed, _ := rl.AllowSlidingWindow(ctx, key, maxReq, duration, expiration)
	if allowed {
		t.Error("配额用完后应该被拒绝")
	}

	// 等待窗口过期
	t.Log("等待 2 秒让窗口过期...")
	time.Sleep(time.Duration(duration+1) * time.Second)

	// 窗口过期后应该放行
	allowed, err := rl.AllowSlidingWindow(ctx, key, maxReq, duration, expiration)
	if err != nil {
		t.Fatalf("窗口过期后请求出错: %v", err)
	}
	if !allowed {
		t.Error("窗口过期后应该放行，但被拒绝")
	}

	t.Log("✓ 窗口过期后正确恢复配额")
}

// ==================== 并发竞态测试（核心：验证原子性修复） ====================

func TestAllowSlidingWindow_ConcurrentRace(t *testing.T) {
	resetLimiterSingleton()
	ctx := context.Background()
	rdb := newTestRedisClient()
	defer rdb.Close()

	rl := New(ctx, rdb)
	key := fmt.Sprintf("test:sliding:race:%d", time.Now().UnixNano())
	defer rdb.Del(ctx, key)

	maxReq := 10
	duration := int64(60)
	expiration := int64(120)

	concurrency := 1000 // 1000 个并发 goroutine
	var allowedCount atomic.Int64
	var rejectedCount atomic.Int64
	var errorCount atomic.Int64

	var wg sync.WaitGroup
	wg.Add(concurrency)

	// 使用 channel 同步启动，确保真正的并发
	startSignal := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		go func() {
			defer wg.Done()
			<-startSignal // 等待信号，所有 goroutine 同时开始

			allowed, err := rl.AllowSlidingWindow(ctx, key, maxReq, duration, expiration)
			if err != nil {
				errorCount.Add(1)
				return
			}
			if allowed {
				allowedCount.Add(1)
			} else {
				rejectedCount.Add(1)
			}
		}()
	}

	// 发送启动信号
	close(startSignal)
	wg.Wait()

	allowed := allowedCount.Load()
	rejected := rejectedCount.Load()
	errors := errorCount.Load()

	t.Logf("并发测试结果: 放行=%d, 拒绝=%d, 错误=%d", allowed, rejected, errors)

	// 核心断言：放行数量必须 <= maxReq
	// 如果存在竞态条件，放行数可能超过 maxReq
	if allowed > int64(maxReq) {
		t.Errorf("❌ 竞态条件！放行数 %d 超过限制 %d", allowed, maxReq)
	} else {
		t.Logf("✓ 无竞态条件：放行数 %d <= 限制 %d", allowed, maxReq)
	}

	if errors > 0 {
		t.Errorf("存在 %d 个错误", errors)
	}
}

// ==================== NOSCRIPT 恢复测试 ====================

func TestEvalWithRetry_NoScriptRecovery(t *testing.T) {
	resetLimiterSingleton()
	ctx := context.Background()
	rdb := newTestRedisClient()
	defer rdb.Close()

	rl := New(ctx, rdb)
	key := fmt.Sprintf("test:noscript:%d", time.Now().UnixNano())
	defer rdb.Del(ctx, key)

	// 先验证正常工作
	allowed, err := rl.AllowSlidingWindow(ctx, key, 5, 60, 120)
	if err != nil {
		t.Fatalf("初始请求失败: %v", err)
	}
	if !allowed {
		t.Fatal("初始请求应该放行")
	}

	// 模拟 Redis 重启：清除所有脚本缓存
	t.Log("执行 SCRIPT FLUSH 模拟 Redis 重启...")
	if err := rdb.ScriptFlush(ctx).Err(); err != nil {
		t.Fatalf("SCRIPT FLUSH 失败: %v", err)
	}

	// 清除 key 以便重新测试
	rdb.Del(ctx, key)

	// 再次请求，应该自动恢复（evalWithRetry 会重新加载脚本）
	allowed, err = rl.AllowSlidingWindow(ctx, key, 5, 60, 120)
	if err != nil {
		t.Errorf("❌ NOSCRIPT 恢复失败: %v", err)
	} else if !allowed {
		t.Error("恢复后请求应该放行")
	} else {
		t.Log("✓ NOSCRIPT 自动恢复成功")
	}
}

// ==================== 令牌桶限流测试 ====================

func TestAllow_TokenBucket(t *testing.T) {
	resetLimiterSingleton()
	ctx := context.Background()
	rdb := newTestRedisClient()
	defer rdb.Close()

	rl := New(ctx, rdb)
	key := fmt.Sprintf("test:bucket:%d", time.Now().UnixNano())
	defer rdb.Del(ctx, key)

	// 配置：容量 5，速率 1/秒
	capacity := int64(5)
	rate := int64(1)

	// 快速消耗完令牌桶
	allowedCount := 0
	for i := 0; i < 10; i++ {
		allowed, err := rl.Allow(ctx, key, WithCapacity(capacity), WithRate(rate))
		if err != nil {
			t.Fatalf("令牌桶请求出错: %v", err)
		}
		if allowed {
			allowedCount++
		}
	}

	t.Logf("令牌桶测试: 10 次请求，放行 %d 次", allowedCount)

	// 放行数应该接近容量（令牌桶初始满）
	if allowedCount < int(capacity)-1 || allowedCount > int(capacity)+1 {
		t.Errorf("令牌桶放行数 %d 不符合预期（容量 %d）", allowedCount, capacity)
	} else {
		t.Log("✓ 令牌桶限流正确")
	}
}

// ==================== isNoScriptErr 单元测试 ====================

func TestIsNoScriptErr(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{"nil error", nil, false},
		{"NOSCRIPT error", fmt.Errorf("NOSCRIPT No matching script"), true},
		{"other error", fmt.Errorf("connection refused"), false},
		{"NOSCRIPT prefix", fmt.Errorf("NOSCRIPT xxx"), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isNoScriptErr(tt.err)
			if result != tt.expected {
				t.Errorf("isNoScriptErr(%v) = %v, want %v", tt.err, result, tt.expected)
			}
		})
	}
}
