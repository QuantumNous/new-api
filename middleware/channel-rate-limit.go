package middleware

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/common/limiter"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type memoryTokenBucket struct {
	tokens    int64
	lastTime  int64
	expiresAt int64
}

var channelRateLimitMemory = struct {
	sync.Mutex
	buckets     map[string]*memoryTokenBucket
	lastCleanup int64
}{
	buckets: make(map[string]*memoryTokenBucket),
}

const channelRateLimitMemoryCleanupIntervalSeconds int64 = 60

func CheckSelectedChannelRateLimit(c *gin.Context, channel *model.Channel, retryParam *service.RetryParam, modelName string) *types.NewAPIError {
	if channel == nil || retryParam == nil {
		return nil
	}
	settings := channel.GetOtherSettings()
	if !settings.ChannelRateLimitEnabled || settings.ChannelRateLimitCount <= 0 || settings.ChannelRateLimitPeriodSeconds <= 0 {
		return nil
	}
	userID := common.GetContextKeyInt(c, constant.ContextKeyUserId)

	if settings.ChannelRateLimitScope == dto.ChannelRateLimitScopeKey && channel.ChannelInfo.IsMultiKey {
		for {
			keyIndex := common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex)
			allowed, err := allowChannelRateLimit(channelRateLimitKey(channel.Id, userID, keyIndex, true), settings.ChannelRateLimitCount, settings.ChannelRateLimitPeriodSeconds)
			if err != nil {
				return newChannelRateLimitError(channel.Id, err, http.StatusInternalServerError)
			}
			if allowed {
				return nil
			}

			retryParam.ExcludeChannelKey(channel.Id, keyIndex)
			setupErr := SetupContextForSelectedChannelWithKeyExclusions(c, channel, modelName, retryParam.ExcludedKeyIndexes(channel.Id))
			if setupErr != nil {
				retryParam.ExcludeChannel(channel.Id)
				retryParam.ResetRetryNextTry()
				return newChannelRateLimitError(channel.Id, nil, http.StatusTooManyRequests)
			}
		}
	}

	allowed, err := allowChannelRateLimit(channelRateLimitKey(channel.Id, userID, 0, false), settings.ChannelRateLimitCount, settings.ChannelRateLimitPeriodSeconds)
	if err != nil {
		return newChannelRateLimitError(channel.Id, err, http.StatusInternalServerError)
	}
	if allowed {
		return nil
	}
	retryParam.ExcludeChannel(channel.Id)
	retryParam.ResetRetryNextTry()
	return newChannelRateLimitError(channel.Id, nil, http.StatusTooManyRequests)
}

func channelRateLimitKey(channelID int, userID int, keyIndex int, keyScope bool) string {
	if keyScope {
		return fmt.Sprintf("rateLimit:channel:%d:user:%d:key:%d", channelID, userID, keyIndex)
	}
	return fmt.Sprintf("rateLimit:channel:%d:user:%d", channelID, userID)
}

func allowChannelRateLimit(key string, count int, periodSeconds int) (bool, error) {
	if common.RedisEnabled {
		ctx := context.Background()
		tb := limiter.New(ctx, common.RDB)
		return tb.Allow(
			ctx,
			key,
			limiter.WithCapacity(int64(count)*int64(periodSeconds)),
			limiter.WithRate(int64(count)),
			limiter.WithRequested(int64(periodSeconds)),
			limiter.WithTTL(channelRateLimitTTLSeconds(int64(periodSeconds))),
		)
	}
	return allowChannelRateLimitMemory(key, int64(count), int64(periodSeconds)), nil
}

func allowChannelRateLimitMemory(key string, count int64, periodSeconds int64) bool {
	now := time.Now().Unix()
	capacity := count * periodSeconds
	requested := periodSeconds
	expiresAt := now + channelRateLimitTTLSeconds(periodSeconds)

	channelRateLimitMemory.Lock()
	defer channelRateLimitMemory.Unlock()

	cleanupExpiredChannelRateLimitBuckets(now)

	bucket, ok := channelRateLimitMemory.buckets[key]
	if !ok {
		channelRateLimitMemory.buckets[key] = &memoryTokenBucket{
			tokens:    capacity - requested,
			lastTime:  now,
			expiresAt: expiresAt,
		}
		return true
	}

	bucket.expiresAt = expiresAt
	elapsed := now - bucket.lastTime
	if elapsed > 0 {
		bucket.tokens += elapsed * count
		if bucket.tokens > capacity {
			bucket.tokens = capacity
		}
		bucket.lastTime = now
	}
	if bucket.tokens < requested {
		return false
	}
	bucket.tokens -= requested
	return true
}

func channelRateLimitTTLSeconds(periodSeconds int64) int64 {
	if periodSeconds <= 0 {
		return channelRateLimitMemoryCleanupIntervalSeconds
	}
	return periodSeconds*2 + channelRateLimitMemoryCleanupIntervalSeconds
}

func cleanupExpiredChannelRateLimitBuckets(now int64) {
	if now-channelRateLimitMemory.lastCleanup < channelRateLimitMemoryCleanupIntervalSeconds {
		return
	}
	for key, bucket := range channelRateLimitMemory.buckets {
		if bucket.expiresAt > 0 && bucket.expiresAt <= now {
			delete(channelRateLimitMemory.buckets, key)
		}
	}
	channelRateLimitMemory.lastCleanup = now
}

func newChannelRateLimitError(channelID int, err error, statusCode int) *types.NewAPIError {
	if err == nil {
		err = errors.New(fmt.Sprintf("channel #%d rate limit reached", channelID))
	}
	return types.NewErrorWithStatusCode(
		err,
		types.ErrorCodeChannelRateLimited,
		statusCode,
		types.ErrOptionWithNoRecordErrorLog(),
	)
}
