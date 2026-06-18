package limiter

import (
	"context"
	_ "embed"
	"fmt"

	"github.com/go-redis/redis/v8"
)

//go:embed lua/sliding_window.lua
var slidingWindowScript string

// slidingWindow 使用 NewScript，Run 时自动 EVALSHA→NOSCRIPT 回退 EVAL，
// 不依赖 limiter.New 的 sync.Once 单例，Redis 重启丢失脚本缓存后也能自愈。
var slidingWindow = redis.NewScript(slidingWindowScript)

// SlidingWindowAllow 滑动窗口限流：保证「任意滚动 window 秒内放行数 <= limit」。
// limit<=0 表示不限制，直接放行。
// 返回 (是否放行, 建议的 Retry-After 秒数, error)；放行时 retryAfter 为 0。
func SlidingWindowAllow(ctx context.Context, rdb *redis.Client, key string, limit int, windowSeconds int64) (allowed bool, retryAfter int, err error) {
	if limit <= 0 {
		return true, 0, nil
	}

	res, err := slidingWindow.Run(ctx, rdb, []string{key}, windowSeconds, limit).Slice()
	if err != nil {
		return false, 0, fmt.Errorf("sliding window rate limit failed: %w", err)
	}
	return parseSlidingWindowResult(res)
}

// parseSlidingWindowResult 解析 Lua 返回的 {allowed, retryAfter} 数组。
// 抽成纯函数以便在无 Redis 环境下单测。
func parseSlidingWindowResult(res []interface{}) (allowed bool, retryAfter int, err error) {
	if len(res) != 2 {
		return false, 0, fmt.Errorf("unexpected sliding window result length: %d", len(res))
	}
	allowedVal, ok := res[0].(int64)
	if !ok {
		return false, 0, fmt.Errorf("unexpected sliding window allowed type: %T", res[0])
	}
	retryVal, ok := res[1].(int64)
	if !ok {
		return false, 0, fmt.Errorf("unexpected sliding window retryAfter type: %T", res[1])
	}
	return allowedVal == 1, int(retryVal), nil
}
