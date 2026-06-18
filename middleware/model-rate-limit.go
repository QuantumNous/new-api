package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

const (
	ModelRequestRateLimitCountMark        = "MRRL"
	ModelRequestRateLimitSuccessCountMark = "MRRLS"

	// slidingWindowTotalKeyPrefix 是滑动窗口「总请求计数」在 Redis 中的 key 前缀。
	// 必须独立于旧令牌桶使用的裸 "rateLimit:<userId>" key：旧桶用 HMSET 把该 key
	// 写成 hash 且 EXPIRE 被注释（永不过期），滑动窗口对同名 key 做 sorted set 操作
	// 会触发 WRONGTYPE，导致开启限流后每个请求都 500（rate_limit_check_failed）。
	slidingWindowTotalKeyPrefix = "rateLimit:sw:"
)

// slidingWindowTotalKey 构造滑动窗口总请求计数的 Redis key，带独立 "sw:" 段以与
// 旧令牌桶遗留的裸 key 隔离。抽成函数以便单测锚定该隔离约束。
func slidingWindowTotalKey(userId string) string {
	return slidingWindowTotalKeyPrefix + userId
}

// 检查Redis中的请求限制
func checkRedisRateLimit(ctx context.Context, rdb *redis.Client, key string, maxCount int, duration int64) (bool, error) {
	// 如果maxCount为0，表示不限制
	if maxCount == 0 {
		return true, nil
	}

	// 获取当前计数
	length, err := rdb.LLen(ctx, key).Result()
	if err != nil {
		return false, err
	}

	// 如果未达到限制，允许请求
	if length < int64(maxCount) {
		return true, nil
	}

	// 检查时间窗口
	oldTimeStr, _ := rdb.LIndex(ctx, key, -1).Result()
	oldTime, err := time.Parse(timeFormat, oldTimeStr)
	if err != nil {
		return false, err
	}

	nowTimeStr := time.Now().Format(timeFormat)
	nowTime, err := time.Parse(timeFormat, nowTimeStr)
	if err != nil {
		return false, err
	}
	// 如果在时间窗口内已达到限制，拒绝请求
	subTime := nowTime.Sub(oldTime).Seconds()
	if int64(subTime) < duration {
		rdb.Expire(ctx, key, time.Duration(setting.ModelRequestRateLimitDurationMinutes)*time.Minute)
		return false, nil
	}

	return true, nil
}

// 记录Redis请求
func recordRedisRequest(ctx context.Context, rdb *redis.Client, key string, maxCount int) {
	// 如果maxCount为0，不记录请求
	if maxCount == 0 {
		return
	}

	now := time.Now().Format(timeFormat)
	rdb.LPush(ctx, key, now)
	rdb.LTrim(ctx, key, 0, int64(maxCount-1))
	rdb.Expire(ctx, key, time.Duration(setting.ModelRequestRateLimitDurationMinutes)*time.Minute)
}

// Redis限流处理器
func redisRateLimitHandler(duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := strconv.Itoa(c.GetInt("id"))
		ctx := context.Background()
		rdb := common.RDB

		// 1. 检查成功请求数限制
		successKey := fmt.Sprintf("rateLimit:%s:%s", ModelRequestRateLimitSuccessCountMark, userId)
		allowed, err := checkRedisRateLimit(ctx, rdb, successKey, successMaxCount, duration)
		if err != nil {
			fmt.Println("检查成功请求数限制失败:", err.Error())
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return
		}
		if !allowed {
			c.Header("Retry-After", strconv.Itoa(int(duration)))
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到请求数限制：%d分钟内最多请求%d次", setting.ModelRequestRateLimitDurationMinutes, successMaxCount))
			return
		}

		// 2. 检查总请求数限制（当totalMaxCount为0时不限制）。
		// 改用滑动窗口：保证任意滚动 duration 秒内放行数不超过 totalMaxCount，
		// 杜绝原令牌桶冷启动满桶 + 每秒回填叠加，导致首个窗口放行量翻倍击穿上游 RPM 的问题。
		if totalMaxCount > 0 {
			totalKey := slidingWindowTotalKey(userId)
			var retryAfter int
			allowed, retryAfter, err = limiter.SlidingWindowAllow(ctx, rdb, totalKey, totalMaxCount, duration)
			if err != nil {
				fmt.Println("检查总请求数限制失败:", err.Error())
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
				return
			}

			if !allowed {
				c.Header("Retry-After", strconv.Itoa(retryAfter))
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到总请求数限制：%d分钟内最多请求%d次，包括失败次数，请检查您的请求是否正确", setting.ModelRequestRateLimitDurationMinutes, totalMaxCount))
				return
			}
		}

		// 4. 处理请求
		c.Next()

		// 5. 如果请求成功，记录成功请求
		if c.Writer.Status() < 400 {
			recordRedisRequest(ctx, rdb, successKey, successMaxCount)
		}
	}
}

// 内存限流处理器
func memoryRateLimitHandler(duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	inMemoryRateLimiter.Init(time.Duration(setting.ModelRequestRateLimitDurationMinutes) * time.Minute)

	return func(c *gin.Context) {
		userId := strconv.Itoa(c.GetInt("id"))
		totalKey := ModelRequestRateLimitCountMark + userId
		successKey := ModelRequestRateLimitSuccessCountMark + userId

		// 1. 检查总请求数限制（当totalMaxCount为0时跳过）。
		// InMemoryRateLimiter 本身即滑动窗口硬上限，这里仅补齐 Retry-After 头与结构化错误体，
		// 与 Redis 路径保持一致，便于客户端按提示退避。
		if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
			c.Header("Retry-After", strconv.Itoa(int(duration)))
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到总请求数限制：%d分钟内最多请求%d次，包括失败次数，请检查您的请求是否正确", setting.ModelRequestRateLimitDurationMinutes, totalMaxCount))
			return
		}

		// 2. 检查成功请求数限制（只读检查，不记录；放行且成功后才在下方记录到 successKey）。
		// 与 Redis 路径一致采用 check-then-act：原先用影子 key successKey+"_check" 做 Request 预检，
		// 会把失败请求也计入，导致 _check 与 successKey 两个计数器漂移、提前误拒，此处改为只读 Check 修正。
		if !inMemoryRateLimiter.Check(successKey, successMaxCount, duration) {
			c.Header("Retry-After", strconv.Itoa(int(duration)))
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到请求数限制：%d分钟内最多请求%d次", setting.ModelRequestRateLimitDurationMinutes, successMaxCount))
			return
		}

		// 3. 处理请求
		c.Next()

		// 4. 如果请求成功，记录到实际的成功请求计数中
		if c.Writer.Status() < 400 {
			inMemoryRateLimiter.Request(successKey, successMaxCount, duration)
		}
	}
}

// rateLimitTier 表示一次请求最终采用的限流档位。
type rateLimitTier struct {
	totalMaxCount   int
	successMaxCount int
	isAdminTier     bool // true=采用了管理员档（不再套用用户档与分组覆盖）
}

// resolveAdminTier 决定是否对当前请求采用管理员档。抽成纯函数以便单测，
// 不依赖 gin.Context / DB / 全局配置。
//   - followUser=true（默认）：管理员跟随用户限流，返回 isAdminTier=false，由调用方走用户档+分组覆盖。
//   - followUser=false 且 isAdmin=true：采用管理员档（adminTotal/adminSuccess），计数 0 表示该项不限制。
//   - followUser=false 且 isAdmin=false：普通用户，返回 isAdminTier=false。
func resolveAdminTier(followUser, isAdmin bool, adminTotal, adminSuccess int) rateLimitTier {
	if followUser || !isAdmin {
		return rateLimitTier{isAdminTier: false}
	}
	return rateLimitTier{totalMaxCount: adminTotal, successMaxCount: adminSuccess, isAdminTier: true}
}

// ModelRequestRateLimit 模型请求限流中间件
func ModelRequestRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		// 在每个请求时检查是否启用限流
		if !setting.ModelRequestRateLimitEnabled {
			c.Next()
			return
		}

		// 计算限流参数
		duration := int64(setting.ModelRequestRateLimitDurationMinutes * 60)

		// 管理员/超级管理员档：当关闭"跟随用户限速"时，管理员/超管（role >= RoleAdminUser）单独管控，
		// 直接使用管理员档总数/成功数，且不套用下方的用户档与分组覆盖。
		// 管理员档计数为 0 表示该项不限制（对管理员/超管豁免）。
		// 注意：中继链路走 TokenAuth，context 里没有 role，需按 userId 查角色；
		// 仅在"关闭跟随"时才查（绝大多数部署默认 true，直接短路，零额外开销）。
		if !setting.ModelRequestRateLimitAdminFollowUser {
			isAdmin := model.IsAdmin(c.GetInt("id"))
			if tier := resolveAdminTier(false, isAdmin, setting.ModelRequestRateLimitAdminCount, setting.ModelRequestRateLimitAdminSuccessCount); tier.isAdminTier {
				if common.RedisEnabled {
					redisRateLimitHandler(duration, tier.totalMaxCount, tier.successMaxCount)(c)
				} else {
					memoryRateLimitHandler(duration, tier.totalMaxCount, tier.successMaxCount)(c)
				}
				return
			}
		}

		totalMaxCount := setting.ModelRequestRateLimitCount
		successMaxCount := setting.ModelRequestRateLimitSuccessCount

		// 获取分组
		group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}

		//获取分组的限流配置
		groupTotalCount, groupSuccessCount, found := setting.GetGroupRateLimit(group)
		if found {
			totalMaxCount = groupTotalCount
			successMaxCount = groupSuccessCount
		}

		// 根据存储类型选择并执行限流处理器
		if common.RedisEnabled {
			redisRateLimitHandler(duration, totalMaxCount, successMaxCount)(c)
		} else {
			memoryRateLimitHandler(duration, totalMaxCount, successMaxCount)(c)
		}
	}
}
