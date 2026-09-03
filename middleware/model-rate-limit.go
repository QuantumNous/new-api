package middleware

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

const (
	ModelRequestRateLimitCountMark        = "MRRL"
	ModelRequestRateLimitSuccessCountMark = "MRRLS"
	modelRateLimitTimeFormat              = "2006-01-02T15:04:05.000Z"
)

type ModelRequestRateLimitCommit func(success bool)

const redisModelSuccessReserveScript = `
local entries = redis.call('LRANGE', KEYS[1], 0, -1)
redis.call('DEL', KEYS[1])
local activeCount = 0
for _, entry in ipairs(entries) do
  local timestamp = string.match(entry, '^([^|]+)')
  if timestamp > ARGV[1] then
    redis.call('RPUSH', KEYS[1], entry)
    activeCount = activeCount + 1
  end
end
if activeCount >= tonumber(ARGV[2]) then
  redis.call('EXPIRE', KEYS[1], ARGV[4])
  return 0
end
redis.call('LPUSH', KEYS[1], ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`

const redisModelSuccessFinalizeScript = `
local length = redis.call('LLEN', KEYS[1])
for index = 0, length - 1 do
  if redis.call('LINDEX', KEYS[1], index) == ARGV[1] then
    if ARGV[2] == '' then
      redis.call('LREM', KEYS[1], 1, ARGV[1])
    else
      redis.call('LSET', KEYS[1], index, ARGV[2])
    end
    return 1
  end
end
return 0
`

func reserveRedisModelSuccess(ctx context.Context, rdb *redis.Client, key string, maxCount int, duration int64) (ModelRequestRateLimitCommit, bool, error) {
	if maxCount <= 0 {
		return func(bool) {}, true, nil
	}
	now := time.Now().UTC()
	reservationID := common.GetUUID()
	timestamp := now.Format(modelRateLimitTimeFormat)
	reservation := timestamp + "|reserved|" + reservationID
	allowed, err := rdb.Eval(
		ctx,
		redisModelSuccessReserveScript,
		[]string{key},
		now.Add(-time.Duration(duration)*time.Second).Format(modelRateLimitTimeFormat),
		maxCount,
		reservation,
		duration,
	).Bool()
	if err != nil || !allowed {
		return nil, allowed, err
	}

	var once sync.Once
	return func(success bool) {
		once.Do(func() {
			finalized := ""
			if success {
				finalized = timestamp + "|committed|" + reservationID
			}
			if err := rdb.Eval(ctx, redisModelSuccessFinalizeScript, []string{key}, reservation, finalized).Err(); err != nil {
				common.SysError("finalize Redis model success rate-limit reservation failed: " + err.Error())
			}
		})
	}, true, nil
}

func reserveMemoryModelSuccess(key string, maxCount int, duration int64) (ModelRequestRateLimitCommit, bool) {
	if maxCount <= 0 {
		return func(bool) {}, true
	}
	reservationID := common.GetUUID()
	if !inMemoryRateLimiter.Reserve(key, maxCount, duration, reservationID) {
		return nil, false
	}
	var once sync.Once
	return func(success bool) {
		once.Do(func() {
			if success {
				inMemoryRateLimiter.CommitReservation(key, reservationID)
				return
			}
			inMemoryRateLimiter.ReleaseReservation(key, reservationID)
		})
	}, true
}

func modelRequestRateLimitConfig(c *gin.Context) (duration int64, totalMaxCount int, successMaxCount int) {
	duration = rateLimitDurationSeconds(setting.ModelRequestRateLimitDurationMinutes)
	totalMaxCount = setting.ModelRequestRateLimitCount
	successMaxCount = setting.ModelRequestRateLimitSuccessCount

	group := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	if group == "" {
		group = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}
	groupTotalCount, groupSuccessCount, found := setting.GetGroupRateLimit(group)
	if found {
		totalMaxCount = groupTotalCount
		successMaxCount = groupSuccessCount
	}
	return duration, totalMaxCount, successMaxCount
}

func newModelRateLimitError(message string, statusCode int) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		fmt.Errorf("%s", message),
		types.ErrorCodeInvalidRequest,
		statusCode,
		types.ErrOptionWithSkipRetry(),
		types.ErrOptionWithNoRecordErrorLog(),
	)
}

func CheckModelRequestRateLimit(c *gin.Context) (ModelRequestRateLimitCommit, *types.NewAPIError) {
	if !setting.ModelRequestRateLimitEnabled {
		return func(bool) {}, nil
	}

	duration, totalMaxCount, successMaxCount := modelRequestRateLimitConfig(c)
	userId := strconv.Itoa(c.GetInt("id"))

	if common.RedisEnabled {
		ctx := context.Background()
		rdb := common.RDB
		successKey := fmt.Sprintf("rateLimit:%s:%s", ModelRequestRateLimitSuccessCountMark, userId)
		commit, allowed, err := reserveRedisModelSuccess(ctx, rdb, successKey, successMaxCount, duration)
		if err != nil {
			fmt.Println("检查成功请求数限制失败:", err.Error())
			return nil, newModelRateLimitError("rate_limit_check_failed", http.StatusInternalServerError)
		}
		if !allowed {
			return nil, newModelRateLimitError(fmt.Sprintf("您已达到请求数限制：%d分钟内最多请求%d次", setting.ModelRequestRateLimitDurationMinutes, successMaxCount), http.StatusTooManyRequests)
		}

		if totalMaxCount > 0 {
			totalKey := fmt.Sprintf("rateLimit:%s", userId)
			tb := limiter.New(ctx, rdb)
			allowed, err = tb.Allow(
				ctx,
				totalKey,
				limiter.WithCapacity(rateLimitCapacity(totalMaxCount, duration)),
				limiter.WithRate(int64(totalMaxCount)),
				limiter.WithRequested(duration),
			)
			if err != nil {
				commit(false)
				fmt.Println("检查总请求数限制失败:", err.Error())
				return nil, newModelRateLimitError("rate_limit_check_failed", http.StatusInternalServerError)
			}
			if !allowed {
				commit(false)
				return nil, newModelRateLimitError(fmt.Sprintf("您已达到总请求数限制：%d分钟内最多请求%d次，包括失败次数，请检查您的请求是否正确", setting.ModelRequestRateLimitDurationMinutes, totalMaxCount), http.StatusTooManyRequests)
			}
		}

		return commit, nil
	}

	inMemoryRateLimiter.Init(time.Duration(setting.ModelRequestRateLimitDurationMinutes) * time.Minute)
	totalKey := ModelRequestRateLimitCountMark + userId
	successKey := ModelRequestRateLimitSuccessCountMark + userId

	if totalMaxCount > 0 && !inMemoryRateLimiter.Request(totalKey, totalMaxCount, duration) {
		return nil, newModelRateLimitError(fmt.Sprintf("您已达到总请求数限制：%d分钟内最多请求%d次，包括失败次数，请检查您的请求是否正确", setting.ModelRequestRateLimitDurationMinutes, totalMaxCount), http.StatusTooManyRequests)
	}
	commit, allowed := reserveMemoryModelSuccess(successKey, successMaxCount, duration)
	if !allowed {
		return nil, newModelRateLimitError(fmt.Sprintf("您已达到请求数限制：%d分钟内最多请求%d次", setting.ModelRequestRateLimitDurationMinutes, successMaxCount), http.StatusTooManyRequests)
	}

	return commit, nil
}

func isResponsesWebSocketHandshake(c *gin.Context) bool {
	return c != nil &&
		c.Request != nil &&
		c.Request.Method == http.MethodGet &&
		c.Request.URL != nil &&
		c.Request.URL.Path == "/v1/responses" &&
		strings.EqualFold(c.Request.Header.Get("Upgrade"), "websocket")
}

// ModelRequestRateLimit 模型请求限流中间件
func ModelRequestRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		if isResponsesWebSocketHandshake(c) {
			c.Next()
			return
		}
		commit, apiErr := CheckModelRequestRateLimit(c)
		if apiErr != nil {
			abortWithOpenAiMessage(c, apiErr.StatusCode, apiErr.Error(), apiErr.GetErrorCode())
			return
		}
		c.Next()
		commit(c.Writer.Status() < 400)
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
