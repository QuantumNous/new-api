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

//go:embed lua/success_rate_limit.lua
var successRateLimitScript string

type RedisLimiter struct {
	client           *redis.Client
	limitScriptSHA   string
	successScriptSHA string
}

var (
	instance *RedisLimiter
	once     sync.Once
)

func New(ctx context.Context, r *redis.Client) *RedisLimiter {
	once.Do(func() {
		instance = loadRedisLimiter(ctx, r)
	})
	if instance.client != r {
		// 更换 Redis 客户端（重新初始化或测试）后必须重新绑定脚本与连接，
		// 否则脚本 SHA 会指向旧客户端。
		instance = loadRedisLimiter(ctx, r)
	}

	return instance
}

func loadRedisLimiter(ctx context.Context, r *redis.Client) *RedisLimiter {
	limitSHA, err := r.ScriptLoad(ctx, rateLimitScript).Result()
	if err != nil {
		common.SysLog(common.LogText("Failed to load rate limit script: %v", err))
	}
	successSHA, err := r.ScriptLoad(ctx, successRateLimitScript).Result()
	if err != nil {
		common.SysLog(common.LogText("Failed to load success rate limit script: %v", err))
	}
	return &RedisLimiter{
		client:           r,
		limitScriptSHA:   limitSHA,
		successScriptSHA: successSHA,
	}
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
	result, err := rl.client.EvalSha(
		ctx,
		rl.limitScriptSHA,
		[]string{key},
		config.Requested,
		config.Rate,
		config.Capacity,
	).Int()

	if err != nil {
		if strings.HasPrefix(err.Error(), "NOSCRIPT ") {
			result, err := rl.client.Eval(
				ctx,
				rateLimitScript,
				[]string{key},
				config.Requested,
				config.Rate,
				config.Capacity,
			).Int()
			if err != nil {
				return false, fmt.Errorf("rate limit failed: %w", err)
			}
			return result == 1, nil
		}
		return false, fmt.Errorf("rate limit failed: %w", err)
	}
	return result == 1, nil
}

// ReserveSuccessSlot 原子地在滑动窗口内为一次请求预留名额：清理过期成员、判断
// 窗口内是否仍有余额、登记本次预留都在同一个 Lua 脚本里完成，不存在客户端
// "先检查、后记录" 的竞态。max <= 0 表示不限制。
func (rl *RedisLimiter) ReserveSuccessSlot(ctx context.Context, key string, max int, window time.Duration, member string) (bool, error) {
	if max <= 0 {
		return true, nil
	}
	result, err := rl.evalScript(ctx, rl.successScriptSHA, successRateLimitScript, []string{key}, window.Milliseconds(), max, member)
	if err != nil {
		return false, err
	}
	return result == 1, nil
}

// ReleaseSuccessSlot 归还 ReserveSuccessSlot 预留的名额，用于失败的请求。
func (rl *RedisLimiter) ReleaseSuccessSlot(ctx context.Context, key, member string) error {
	if member == "" {
		return nil
	}
	return rl.client.ZRem(ctx, key, member).Err()
}

func (rl *RedisLimiter) evalScript(ctx context.Context, sha, script string, keys []string, args ...any) (int64, error) {
	result, err := rl.client.EvalSha(ctx, sha, keys, args...).Int64()
	if err == nil {
		return result, nil
	}
	if !strings.HasPrefix(err.Error(), "NOSCRIPT ") {
		return 0, err
	}
	return rl.client.Eval(ctx, script, keys, args...).Int64()
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
