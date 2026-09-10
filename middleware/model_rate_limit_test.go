package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestModelRequestRateLimitUsesUserGroupInsteadOfTokenGroup(t *testing.T) {
	gin.SetMode(gin.TestMode)
	useRateLimitMiniRedis(t)

	previousEnabled := setting.ModelRequestRateLimitEnabled
	previousDuration := setting.ModelRequestRateLimitDurationMinutes
	previousCount := setting.ModelRequestRateLimitCount
	previousSuccessCount := setting.ModelRequestRateLimitSuccessCount
	setting.ModelRequestRateLimitMutex.Lock()
	previousGroups := setting.ModelRequestRateLimitGroup
	setting.ModelRequestRateLimitGroup = map[string][2]int{
		"paid":    {1, 100},
		"default": {10, 100},
	}
	setting.ModelRequestRateLimitMutex.Unlock()
	setting.ModelRequestRateLimitEnabled = true
	setting.ModelRequestRateLimitDurationMinutes = 1
	setting.ModelRequestRateLimitCount = 10
	setting.ModelRequestRateLimitSuccessCount = 100
	t.Cleanup(func() {
		setting.ModelRequestRateLimitEnabled = previousEnabled
		setting.ModelRequestRateLimitDurationMinutes = previousDuration
		setting.ModelRequestRateLimitCount = previousCount
		setting.ModelRequestRateLimitSuccessCount = previousSuccessCount
		setting.ModelRequestRateLimitMutex.Lock()
		setting.ModelRequestRateLimitGroup = previousGroups
		setting.ModelRequestRateLimitMutex.Unlock()
	})

	router := gin.New()
	router.GET(
		"/limited",
		func(c *gin.Context) {
			c.Set("id", 6333)
			common.SetContextKey(c, constant.ContextKeyUserGroup, "paid")
			common.SetContextKey(c, constant.ContextKeyTokenGroup, "default")
		},
		ModelRequestRateLimit(),
		func(c *gin.Context) { c.Status(http.StatusNoContent) },
	)

	first := httptest.NewRecorder()
	router.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/limited", nil))
	assert.Equal(t, http.StatusNoContent, first.Code)

	second := httptest.NewRecorder()
	router.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/limited", nil))
	assert.Equal(t, http.StatusTooManyRequests, second.Code)
}

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
