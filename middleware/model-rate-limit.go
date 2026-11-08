package middleware

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

const (
	ModelRequestRateLimitCountMark        = "MRRL"
	ModelRequestRateLimitSuccessCountMark = "MRRLS"
)

// Redis限流处理器
func redisRateLimitHandler(subject string, duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := context.Background()
		rdb := common.RDB
		// 初始化
		tb := limiter.New(ctx, rdb)

		// 1. 原子预留成功请求名额：判定与登记在同一个 Lua 脚本里完成，且预留先于
		// 请求处理，因此突发并发无法同时通过"先检查、后记录"的窗口。失败的请求在
		// 退出时归还名额，成功请求则一直占用到滑出窗口。
		if successMaxCount > 0 {
			windowSeconds := duration
			if maxSeconds := int64(math.MaxInt64 / int64(time.Second)); windowSeconds > maxSeconds {
				windowSeconds = maxSeconds
			}
			successKey := fmt.Sprintf("rateLimit:%s:window:%s", ModelRequestRateLimitSuccessCountMark, subject)
			member := common.GetUUID()
			reserved, err := tb.ReserveSuccessSlot(ctx, successKey, successMaxCount, time.Duration(windowSeconds)*time.Second, member)
			if err != nil {
				fmt.Println(common.LogText("failed to reserve the successful request slot: %s", err.Error()))
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
				return
			}
			if !reserved {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": successMaxCount}))
				return
			}
			defer func() {
				if modelRequestSucceeded(c) {
					return
				}
				if err := tb.ReleaseSuccessSlot(ctx, successKey, member); err != nil {
					fmt.Println(common.LogText("failed to release the successful request slot: %s", err.Error()))
				}
			}()
		}

		// 2.检查总请求数限制并记录总请求（当totalMaxCount为0时会自动跳过，使用令牌桶限流器
		if totalMaxCount > 0 {
			totalKey := fmt.Sprintf("rateLimit:%s", subject)
			allowed, err := tb.Allow(
				ctx,
				totalKey,
				limiter.WithCapacity(rateLimitCapacity(totalMaxCount, duration)),
				limiter.WithRate(int64(totalMaxCount)),
				limiter.WithRequested(duration),
			)

			if err != nil {
				fmt.Println(common.LogText("failed to check the total request limit: %s", err.Error()))
				abortWithOpenAiMessage(c, http.StatusInternalServerError, "rate_limit_check_failed")
				return
			}

			if !allowed {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitTotalReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": totalMaxCount}))
				return
			}
		}

		// 3. 处理请求
		c.Next()
	}
}

// 内存限流处理器
func memoryRateLimitHandler(subject string, duration int64, totalMaxCount, successMaxCount int) gin.HandlerFunc {
	inMemoryRateLimiter.Init(time.Duration(setting.ModelRequestRateLimitDurationMinutes) * time.Minute)

	return func(c *gin.Context) {
		totalKey := ModelRequestRateLimitCountMark + subject
		successKey := ModelRequestRateLimitSuccessCountMark + subject

		// 1. 检查总请求数限制（当totalMaxCount为0时跳过）
		if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitTotalReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": totalMaxCount}))
			return
		}

		var reservation *common.RateLimitReservation
		if successMaxCount > 0 {
			reservation = inMemoryRateLimiter.Reserve(successKey, successMaxCount, duration)
			if reservation == nil {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests, i18n.T(c, i18n.MsgRateLimitReached, map[string]any{"Minutes": setting.ModelRequestRateLimitDurationMinutes, "Max": successMaxCount}))
				return
			}
			defer reservation.Complete(false)
		}

		// 3. 处理请求
		c.Next()

		// 4. 如果请求成功，记录到实际的成功请求计数中
		reservation.Complete(modelRequestSucceeded(c))
	}
}

func modelRequestSucceeded(c *gin.Context) bool {
	status, _ := common.GetContextKeyType[*relaycommon.StreamStatus](c, constant.ContextKeyResponseStreamStatus)
	return c.Writer.Status() < 400 && !status.ResponseFailed()
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
		duration := rateLimitDurationSeconds(setting.ModelRequestRateLimitDurationMinutes)
		totalMaxCount := setting.ModelRequestRateLimitCount
		successMaxCount := setting.ModelRequestRateLimitSuccessCount

		// 获取分组
		group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		if group == "" {
			group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
		}

		// 获取分组的限流配置。配置了独立限流的分组按用户和分组单独计数，
		// 其余分组共用该用户的全局计数
		subject := strconv.Itoa(c.GetInt("id"))
		groupTotalCount, groupSuccessCount, found := setting.GetGroupRateLimit(group)
		if found {
			totalMaxCount = groupTotalCount
			successMaxCount = groupSuccessCount
			subject += ":" + group
		}

		// 根据存储类型选择并执行限流处理器
		if common.RedisEnabled {
			redisRateLimitHandler(subject, duration, totalMaxCount, successMaxCount)(c)
		} else {
			memoryRateLimitHandler(subject, duration, totalMaxCount, successMaxCount)(c)
		}
	}
}

func rateLimitDurationSeconds(durationMinutes int) int64 {
	if durationMinutes <= 0 {
		return 0
	}
	minutes := int64(durationMinutes)
	if minutes > math.MaxInt64/60 {
		return math.MaxInt64
	}
	return minutes * 60
}

func rateLimitCapacity(count int, durationSeconds int64) int64 {
	if count <= 0 || durationSeconds <= 0 {
		return 0
	}
	c := int64(count)
	if c > math.MaxInt64/durationSeconds {
		return math.MaxInt64
	}
	return c * durationSeconds
}
