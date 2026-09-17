package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelRedisRateLimitUsesUTCRegardlessOfLocalTimezone(t *testing.T) {
	redisServer, redisClient := useRateLimitMiniRedis(t)
	previousLocation := time.Local
	time.Local = time.FixedZone("test-utc-plus-eight", 8*60*60)
	t.Cleanup(func() { time.Local = previousLocation })

	ctx := context.Background()
	recordKey := "rateLimit:model-utc-record"
	recordRedisRequest(ctx, redisClient, recordKey, 2)
	recorded, err := redisClient.LIndex(ctx, recordKey, 0).Result()
	require.NoError(t, err)
	recordedAt, err := time.Parse(modelRateLimitTimeFormat, recorded)
	require.NoError(t, err)
	assert.WithinDuration(t, time.Now().UTC(), recordedAt, 2*time.Second)

	checkKey := "rateLimit:model-utc-check"
	withinWindow := time.Now().UTC().Add(-30 * time.Second).Format(modelRateLimitTimeFormat)
	_, err = redisServer.Push(checkKey, withinWindow, withinWindow)
	require.NoError(t, err)
	allowed, err := checkRedisRateLimit(ctx, redisClient, checkKey, 2, 60)
	require.NoError(t, err)
	assert.False(t, allowed, "an existing UTC timestamp inside the window must remain limited on a non-UTC host")
}

// 成功数限制只统计成功请求，失败请求不占配额；拒绝时返回 JSON 错误体而非空 429。
func TestModelMemoryRateLimitSuccessCountIgnoresFailedRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// 限流器是进程级全局且无重置接口，user id 每次唯一才能保证 -count=2 复跑
	userID := int(time.Now().UnixNano() % 1_000_000_000)
	downstreamStatus := http.StatusOK
	router := gin.New()
	router.GET("/limited", func(c *gin.Context) {
		c.Set("id", userID)
	}, memoryRateLimitHandler(60, 0, 2), func(c *gin.Context) {
		c.Status(downstreamStatus)
	})

	do := func(status int) *httptest.ResponseRecorder {
		downstreamStatus = status
		return performRateLimitRequest(router, "/limited", "192.0.2.70:12345")
	}

	for range 5 {
		assert.Equal(t, http.StatusInternalServerError, do(http.StatusInternalServerError).Code, "failed requests must not consume the success quota")
	}

	require.Equal(t, http.StatusOK, do(http.StatusOK).Code)
	require.Equal(t, http.StatusOK, do(http.StatusOK).Code)

	limited := do(http.StatusOK)
	require.Equal(t, http.StatusTooManyRequests, limited.Code)
	assert.Contains(t, limited.Body.String(), "您已达到请求数限制", "429 must carry the same error message as the Redis path")
}
