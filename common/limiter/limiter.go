package limiter

import (
	"context"
	_ "embed"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

//go:embed lua/rate_limit.lua
var rateLimitScript string

//go:embed lua/sliding_window_rate_limit.lua
var slidingWindowScript string

type RedisLimiter struct {
	client           *redis.Client
	limitScriptSHA   string     // 令牌桶脚本 SHA
	slidingWindowSHA string     // 滑动窗口脚本 SHA
	mutex            sync.Mutex // 保护脚本重新加载的并发安全
}

var (
	instance *RedisLimiter
	once     sync.Once
)

func New(ctx context.Context, r *redis.Client) *RedisLimiter {
	once.Do(func() {
		rl := &RedisLimiter{client: r}
		rl.loadScripts(ctx)
		instance = rl
	})

	return instance
}

// loadScripts 加载 Lua 脚本到 Redis，返回是否全部成功
func (rl *RedisLimiter) loadScripts(ctx context.Context) {
	if sha, err := rl.client.ScriptLoad(ctx, rateLimitScript).Result(); err != nil {
		common.SysLog(fmt.Sprintf("Failed to load token bucket script: %v", err))
	} else {
		rl.limitScriptSHA = sha
	}

	if sha, err := rl.client.ScriptLoad(ctx, slidingWindowScript).Result(); err != nil {
		common.SysLog(fmt.Sprintf("Failed to load sliding window script: %v", err))
	} else {
		rl.slidingWindowSHA = sha
	}
}

// isNoScriptErr 检测 Redis NOSCRIPT 错误（脚本缓存丢失）
func isNoScriptErr(err error) bool {
	return err != nil && strings.HasPrefix(err.Error(), "NOSCRIPT")
}

// evalWithRetry 执行 EvalSha，遇到 NOSCRIPT 时自动重载脚本并重试，避免 重启/主从切换后缓存丢失
func (rl *RedisLimiter) evalWithRetry(ctx context.Context, evalFn func() (int, error)) (int, error) {
	result, err := evalFn()
	if isNoScriptErr(err) {
		rl.mutex.Lock()
		rl.loadScripts(ctx)
		rl.mutex.Unlock()
		result, err = evalFn()
	}
	return result, err
}

func (rl *RedisLimiter) Allow(ctx context.Context, key string, opts ...Option) (bool, error) {
	// 默认配置
	config := &Config{
		Capacity:  10,
		Rate:      1,
		Requested: 1,
	}

	// 应用选项模式
	for _, opt := range opts {
		opt(config)
	}

	// 执行限流
	result, err := rl.evalWithRetry(ctx, func() (int, error) {
		return rl.client.EvalSha(
			ctx,
			rl.limitScriptSHA,
			[]string{key},
			config.Requested,
			config.Rate,
			config.Capacity,
		).Int()
	})
	if err != nil {
		return false, fmt.Errorf("rate limit failed: %w", err)
	}
	return result == 1, nil
}

// Config 配置选项模式
type Config struct {
	Capacity  int64
	Rate      int64
	Requested int64
}

type Option func(*Config)

func WithCapacity(c int64) Option {
	return func(cfg *Config) { cfg.Capacity = c }
}

func WithRate(r int64) Option {
	return func(cfg *Config) { cfg.Rate = r }
}

func WithRequested(n int64) Option {
	return func(cfg *Config) { cfg.Requested = n }
}

// AllowSlidingWindow 滑动窗口限流
// key: 限流标识
// maxReq: 时间窗口内最大请求数
// duration: 时间窗口(秒)
// expiration: key 过期时间(秒)
func (rl *RedisLimiter) AllowSlidingWindow(ctx context.Context, key string, maxReq int, duration, expiration int64) (bool, error) {
	timestamp := time.Now().Unix()

	result, err := rl.evalWithRetry(ctx, func() (int, error) {
		return rl.client.EvalSha(
			ctx,
			rl.slidingWindowSHA,
			[]string{key},
			maxReq,
			duration,
			timestamp,
			expiration,
		).Int()
	})
	if err != nil {
		return false, fmt.Errorf("sliding window rate limit failed: %w", err)
	}
	return result == 1, nil
}
