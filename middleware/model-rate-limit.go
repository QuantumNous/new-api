package middleware

import (
	"context"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/common/limiter"
	"one-api/constant"
	"one-api/setting"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

const (
	ModelRequestRateLimitCountMark        = "MRRL"
	ModelRequestRateLimitSuccessCountMark = "MRRLS"
)

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

// Redis限流处理器 (per-user 限流，使用 user ID)
func redisRateLimitHandler(duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	return func(c *gin.Context) {
		// per-user 限流使用 user ID
		userId := c.GetInt("id")
		rateLimitKey := strconv.Itoa(userId)
		ctx := context.Background()
		rdb := common.RDB

		// 1. 检查成功请求数限制
		successKey := fmt.Sprintf("rateLimit:%s:%s", ModelRequestRateLimitSuccessCountMark, rateLimitKey)
		allowed, err := checkRedisRateLimit(ctx, rdb, successKey, successMaxCount, duration)
		if err != nil {
			fmt.Println("检查成功请求数限制失败:", err.Error())
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return
		}
		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到请求数限制：%d分钟内最多请求%d次", setting.ModelRequestRateLimitDurationMinutes, successMaxCount))
			return
		}

		//2.检查总请求数限制并记录总请求（当totalMaxCount为0时会自动跳过，使用令牌桶限流器
		if totalMaxCount > 0 {
			totalKey := fmt.Sprintf("rateLimit:%s", rateLimitKey)
			// 初始化
			tb := limiter.New(ctx, rdb)
			allowed, err = tb.Allow(
				ctx,
				totalKey,
				limiter.WithCapacity(int64(totalMaxCount)*duration),
				limiter.WithRate(int64(totalMaxCount)),
				limiter.WithRequested(duration),
			)

			if err != nil {
				fmt.Println("检查总请求数限制失败:", err.Error())
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
				return
			}

			if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到总请求数限制：%d分钟内最多请求%d次，包括失败次数，请检查您的请求是否正确", setting.ModelRequestRateLimitDurationMinutes, totalMaxCount))
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

// 内存限流处理器 (per-user 限流，使用 user ID)
func memoryRateLimitHandler(duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	inMemoryRateLimiter.Init(time.Duration(setting.ModelRequestRateLimitDurationMinutes) * time.Minute)

	return func(c *gin.Context) {
		// per-user 限流使用 user ID
		userId := c.GetInt("id")
		rateLimitKey := strconv.Itoa(userId)
		totalKey := ModelRequestRateLimitCountMark + rateLimitKey
		successKey := ModelRequestRateLimitSuccessCountMark + rateLimitKey

		// 1. 检查总请求数限制（当totalMaxCount为0时跳过）
		if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
			c.Status(http.StatusTooManyRequests)
			c.Abort()
			return
		}

		// 2. 检查成功请求数限制
		// 使用一个临时key来检查限制，这样可以避免实际记录
		checkKey := successKey + "_check"
		if !inMemoryRateLimiter.Request(checkKey, successMaxCount, duration) {
			c.Status(http.StatusTooManyRequests)
			c.Abort()
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

// Token rate limit constants
const (
	TokenRateLimitCountMark        = "TRL"
	TokenRateLimitSuccessCountMark = "TRLS"
	TokenDailyRateLimitCountMark        = "TDRL"
	TokenDailyRateLimitSuccessCountMark = "TDRLS"
)

// checkTokenRateLimit 检查 token 分钟级限流
func checkTokenRateLimit(c *gin.Context) bool {
	if !setting.TokenRateLimitEnabled {
		return true
	}

	tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	if tokenId == 0 {
		// 如果没有 token ID，跳过 per-key 限流
		return true
	}

	// 获取分组配置（使用 token group）
	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	totalMaxCount := setting.TokenRateLimitCount
	successMaxCount := setting.TokenRateLimitSuccessCount

	// 获取分组的限流配置
	groupTotalCount, groupSuccessCount, found := setting.GetTokenRateLimit(group)
	if found {
		totalMaxCount = groupTotalCount
		successMaxCount = groupSuccessCount
	}

	// 如果两个限制都为0，表示不限制
	if totalMaxCount == 0 && successMaxCount == 0 {
		return true
	}

	rateLimitKey := strconv.Itoa(tokenId)
	duration := int64(setting.TokenRateLimitDurationMinutes * 60)

	if common.RedisEnabled {
		return checkTokenRateLimitRedis(c, rateLimitKey, totalMaxCount, successMaxCount, duration)
	} else {
		return checkTokenRateLimitMemory(c, rateLimitKey, totalMaxCount, successMaxCount, duration)
	}
}

// checkTokenRateLimitRedis Redis版本的分钟级限流检查
func checkTokenRateLimitRedis(c *gin.Context, rateLimitKey string, totalMaxCount, successMaxCount int, duration int64) bool {
	ctx := context.Background()
	rdb := common.RDB

	// 1. 检查成功请求数限制
	if successMaxCount > 0 {
		successKey := fmt.Sprintf("rateLimit:%s:%s", TokenRateLimitSuccessCountMark, rateLimitKey)
		allowed, err := checkRedisRateLimit(ctx, rdb, successKey, successMaxCount, duration)
		if err != nil {
			fmt.Println("检查密钥成功请求数限制失败:", err.Error())
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return false
		}
		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到密钥请求数限制：%d分钟内最多请求%d次", setting.TokenRateLimitDurationMinutes, successMaxCount))
			return false
		}
	}

	// 2. 检查总请求数限制
	if totalMaxCount > 0 {
		totalKey := fmt.Sprintf("rateLimit:%s:%s", TokenRateLimitCountMark, rateLimitKey)
		tb := limiter.New(ctx, rdb)
		allowed, err := tb.Allow(
			ctx,
			totalKey,
			limiter.WithCapacity(int64(totalMaxCount)*duration),
			limiter.WithRate(int64(totalMaxCount)),
			limiter.WithRequested(duration),
		)

		if err != nil {
			fmt.Println("检查密钥总请求数限制失败:", err.Error())
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return false
		}

		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到密钥总请求数限制：%d分钟内最多请求%d次（包括失败请求）", setting.TokenRateLimitDurationMinutes, totalMaxCount))
			return false
		}
	}

	return true
}

// recordTokenRateLimitSuccess 记录分钟级成功请求
func recordTokenRateLimitSuccess(c *gin.Context) {
	if !setting.TokenRateLimitEnabled {
		return
	}

	tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	if tokenId == 0 {
		return
	}

	// 获取分组配置
	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	successMaxCount := setting.TokenRateLimitSuccessCount

	_, groupSuccessCount, found := setting.GetTokenRateLimit(group)
	if found {
		successMaxCount = groupSuccessCount
	}

	if successMaxCount == 0 {
		return
	}

	rateLimitKey := strconv.Itoa(tokenId)

	if common.RedisEnabled {
		ctx := context.Background()
		rdb := common.RDB
		successKey := fmt.Sprintf("rateLimit:%s:%s", TokenRateLimitSuccessCountMark, rateLimitKey)
		recordRedisRequest(ctx, rdb, successKey, successMaxCount)
	} else {
		duration := int64(setting.TokenRateLimitDurationMinutes * 60)
		successKey := TokenRateLimitSuccessCountMark + rateLimitKey
		inMemoryRateLimiter.Request(successKey, successMaxCount, duration)
	}
}

// checkTokenRateLimitMemory 内存版本的分钟级限流检查
func checkTokenRateLimitMemory(c *gin.Context, rateLimitKey string, totalMaxCount, successMaxCount int, duration int64) bool {
	inMemoryRateLimiter.Init(time.Duration(setting.TokenRateLimitDurationMinutes) * time.Minute)

	totalKey := TokenRateLimitCountMark + rateLimitKey
	successKey := TokenRateLimitSuccessCountMark + rateLimitKey

	// 1. 检查总请求数限制
	if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
		abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到密钥总请求数限制：%d分钟内最多请求%d次（包括失败请求）", setting.TokenRateLimitDurationMinutes, totalMaxCount))
		return false
	}

	// 2. 检查成功请求数限制（使用临时key检查）
	if successMaxCount > 0 {
		checkKey := successKey + "_check"
		if !inMemoryRateLimiter.Request(checkKey, successMaxCount, duration) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("您已达到密钥请求数限制：%d分钟内最多请求%d次", setting.TokenRateLimitDurationMinutes, successMaxCount))
			return false
		}
	}

	return true
}

// checkTokenDailyRateLimit 检查 token 每日限流
func checkTokenDailyRateLimit(c *gin.Context) bool {
	if !setting.TokenDailyRateLimitEnabled {
		return true
	}

	tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	if tokenId == 0 {
		// 如果没有 token ID，跳过 per-key 限流
		return true
	}

	// 获取分组配置
	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	totalMaxCount := setting.TokenDailyRateLimitCount
	successMaxCount := setting.TokenDailyRateLimitSuccessCount

	// 获取分组的限流配置
	groupTotalCount, groupSuccessCount, found := setting.GetTokenDailyRateLimit(group)
	if found {
		totalMaxCount = groupTotalCount
		successMaxCount = groupSuccessCount
	}

	// 如果两个限制都为0，表示不限制
	if totalMaxCount == 0 && successMaxCount == 0 {
		return true
	}

	rateLimitKey := strconv.Itoa(tokenId)
	duration := int64(86400) // 24小时 = 86400秒

	if common.RedisEnabled {
		return checkTokenDailyRateLimitRedis(c, rateLimitKey, totalMaxCount, successMaxCount, duration)
	} else {
		return checkTokenDailyRateLimitMemory(c, rateLimitKey, totalMaxCount, successMaxCount, duration)
	}
}

// checkTokenDailyRateLimitRedis Redis版本的每日限流检查
func checkTokenDailyRateLimitRedis(c *gin.Context, rateLimitKey string, totalMaxCount, successMaxCount int, duration int64) bool {
	ctx := context.Background()
	rdb := common.RDB

	// 1. 检查成功请求数限制
	if successMaxCount > 0 {
		successKey := fmt.Sprintf("rateLimit:%s:%s", TokenDailyRateLimitSuccessCountMark, rateLimitKey)
		allowed, err := checkRedisRateLimit(ctx, rdb, successKey, successMaxCount, duration)
		if err != nil {
			fmt.Println("检查每日成功请求数限制失败:", err.Error())
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return false
		}
		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, "您已达到每日请求数限制")
			return false
		}
	}

	// 2. 检查总请求数限制
	if totalMaxCount > 0 {
		totalKey := fmt.Sprintf("rateLimit:%s:%s", TokenDailyRateLimitCountMark, rateLimitKey)
		tb := limiter.New(ctx, rdb)
		allowed, err := tb.Allow(
			ctx,
			totalKey,
			limiter.WithCapacity(int64(totalMaxCount)*duration),
			limiter.WithRate(int64(totalMaxCount)),
			limiter.WithRequested(duration),
		)

		if err != nil {
			fmt.Println("检查每日总请求数限制失败:", err.Error())
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
			return false
		}

		if !allowed {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, "您已达到每日总请求数限制（包括失败请求）")
			return false
		}
	}

	return true
}

// recordTokenDailySuccess 记录每日成功请求
func recordTokenDailySuccess(c *gin.Context) {
	if !setting.TokenDailyRateLimitEnabled {
		return
	}

	tokenId := common.GetContextKeyInt(c, constant.ContextKeyTokenId)
	if tokenId == 0 {
		return
	}

	// 获取分组配置
	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	successMaxCount := setting.TokenDailyRateLimitSuccessCount

	_, groupSuccessCount, found := setting.GetTokenDailyRateLimit(group)
	if found {
		successMaxCount = groupSuccessCount
	}

	if successMaxCount == 0 {
		return
	}

	rateLimitKey := strconv.Itoa(tokenId)

	if common.RedisEnabled {
		ctx := context.Background()
		rdb := common.RDB
		successKey := fmt.Sprintf("rateLimit:%s:%s", TokenDailyRateLimitSuccessCountMark, rateLimitKey)
		recordRedisRequest(ctx, rdb, successKey, successMaxCount)
	} else {
		duration := int64(86400)
		successKey := TokenDailyRateLimitSuccessCountMark + rateLimitKey
		inMemoryRateLimiter.Request(successKey, successMaxCount, duration)
	}
}

// checkTokenDailyRateLimitMemory 内存版本的每日限流检查
func checkTokenDailyRateLimitMemory(c *gin.Context, rateLimitKey string, totalMaxCount, successMaxCount int, duration int64) bool {
	inMemoryRateLimiter.Init(24 * time.Hour)

	totalKey := TokenDailyRateLimitCountMark + rateLimitKey
	successKey := TokenDailyRateLimitSuccessCountMark + rateLimitKey

	// 1. 检查总请求数限制
	if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
		abortWithOpenAiMessage(c, http.StatusTooManyRequests, "您已达到每日总请求数限制（包括失败请求）")
		return false
	}

	// 2. 检查成功请求数限制（使用临时key检查）
	if successMaxCount > 0 {
		checkKey := successKey + "_check"
		if !inMemoryRateLimiter.Request(checkKey, successMaxCount, duration) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, "您已达到每日请求数限制")
			return false
		}
	}

	return true
}

// ModelRequestRateLimit 模型请求限流中间件
func ModelRequestRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		// 1. 先检查 per-key 分钟级限流（新功能）
		if !checkTokenRateLimit(c) {
			return
		}

		// 2. 检查 per-key 每日限流（新功能）
		if !checkTokenDailyRateLimit(c) {
			return
		}

		// 3. 再检查原有的 per-user 限流（保持兼容性）
		if !setting.ModelRequestRateLimitEnabled {
			c.Next()
			// 请求成功后记录 per-key 成功请求
			if c.Writer.Status() < 400 {
				recordTokenRateLimitSuccess(c)
				recordTokenDailySuccess(c)
			}
			return
		}

		// 计算限流参数
		duration := int64(setting.ModelRequestRateLimitDurationMinutes * 60)
		totalMaxCount := setting.ModelRequestRateLimitCount
		successMaxCount := setting.ModelRequestRateLimitSuccessCount

		// per-user 限流使用 user group（不是 token group）
		userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)

		//获取分组的限流配置
		groupTotalCount, groupSuccessCount, found := setting.GetGroupRateLimit(userGroup)
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

		// 请求成功后记录 per-key 成功请求
		if c.Writer.Status() < 400 {
			recordTokenRateLimitSuccess(c)
			recordTokenDailySuccess(c)
		}
	}
}
