package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func resetChannelRateLimitMemory() {
	channelRateLimitMemory.Lock()
	channelRateLimitMemory.buckets = make(map[string]*memoryTokenBucket)
	channelRateLimitMemory.lastCleanup = 0
	channelRateLimitMemory.Unlock()
}

func TestAllowChannelRateLimitMemoryAllowsConfiguredBurst(t *testing.T) {
	resetChannelRateLimitMemory()

	key := "rateLimit:channel:test"
	require.True(t, allowChannelRateLimitMemory(key, 2, 60))
	require.True(t, allowChannelRateLimitMemory(key, 2, 60))
	require.False(t, allowChannelRateLimitMemory(key, 2, 60))
}

func TestAllowChannelRateLimitMemoryCleansExpiredBuckets(t *testing.T) {
	resetChannelRateLimitMemory()

	now := time.Now().Unix()
	channelRateLimitMemory.Lock()
	channelRateLimitMemory.buckets["rateLimit:channel:stale"] = &memoryTokenBucket{
		tokens:    0,
		lastTime:  now,
		expiresAt: now - 1,
	}
	channelRateLimitMemory.Unlock()

	require.True(t, allowChannelRateLimitMemory("rateLimit:channel:active", 1, 60))

	channelRateLimitMemory.Lock()
	_, staleExists := channelRateLimitMemory.buckets["rateLimit:channel:stale"]
	_, activeExists := channelRateLimitMemory.buckets["rateLimit:channel:active"]
	channelRateLimitMemory.Unlock()

	require.False(t, staleExists)
	require.True(t, activeExists)
}

func TestAllowChannelRateLimitMemoryClampsCapacityImmediately(t *testing.T) {
	resetChannelRateLimitMemory()

	key := "rateLimit:channel:reconfigured"
	now := time.Now().Unix()
	channelRateLimitMemory.Lock()
	channelRateLimitMemory.buckets[key] = &memoryTokenBucket{
		tokens:    60,
		lastTime:  now + 1,
		expiresAt: now + 120,
	}
	channelRateLimitMemory.Unlock()

	require.True(t, allowChannelRateLimitMemory(key, 1, 1))
	require.False(t, allowChannelRateLimitMemory(key, 1, 1))
}

func TestAllowChannelRateLimitRejectsOverflowingCapacity(t *testing.T) {
	allowed, err := allowChannelRateLimit("rateLimit:channel:overflow", 100000000, 100000000)

	require.False(t, allowed)
	require.Error(t, err)
}

func TestCheckSelectedChannelRateLimitRejectsInvalidEnabledSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)
	settingsBytes, err := common.Marshal(dto.ChannelOtherSettings{
		ChannelRateLimitEnabled:       true,
		ChannelRateLimitCount:         0,
		ChannelRateLimitPeriodSeconds: 60,
	})
	require.NoError(t, err)
	channel := &model.Channel{Id: 123, OtherSettings: string(settingsBytes)}
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	retryParam := &service.RetryParam{Ctx: ctx, Retry: common.GetPointer(0)}

	rateLimitErr := CheckSelectedChannelRateLimit(ctx, channel, retryParam, "test-model")

	require.NotNil(t, rateLimitErr)
	require.Equal(t, http.StatusInternalServerError, rateLimitErr.StatusCode)
}

func TestCheckSelectedChannelRateLimitIsUserScoped(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
	})

	resetChannelRateLimitMemory()

	settingsBytes, err := common.Marshal(dto.ChannelOtherSettings{
		ChannelRateLimitEnabled:       true,
		ChannelRateLimitCount:         1,
		ChannelRateLimitPeriodSeconds: 60,
		ChannelRateLimitScope:         dto.ChannelRateLimitScopeChannel,
	})
	require.NoError(t, err)
	channel := &model.Channel{
		Id:            123,
		OtherSettings: string(settingsBytes),
	}

	ctxUser1, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctxUser1, constant.ContextKeyUserId, 1)
	retryUser1 := &service.RetryParam{Ctx: ctxUser1, Retry: common.GetPointer(0)}

	require.Nil(t, CheckSelectedChannelRateLimit(ctxUser1, channel, retryUser1, "test-model"))
	errUser1 := CheckSelectedChannelRateLimit(ctxUser1, channel, retryUser1, "test-model")
	require.NotNil(t, errUser1)
	require.Equal(t, types.ErrorCodeChannelRateLimited, errUser1.GetErrorCode())

	ctxUser2, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctxUser2, constant.ContextKeyUserId, 2)
	retryUser2 := &service.RetryParam{Ctx: ctxUser2, Retry: common.GetPointer(0)}

	require.Nil(t, CheckSelectedChannelRateLimit(ctxUser2, channel, retryUser2, "test-model"))
}
