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

func useModelRequestRateLimitSettings(t *testing.T, groupLimits map[string][2]int, globalTotal, globalSuccess int) {
	t.Helper()

	setting.ModelRequestRateLimitMutex.Lock()
	prevEnabled := setting.ModelRequestRateLimitEnabled
	prevDuration := setting.ModelRequestRateLimitDurationMinutes
	prevTotal := setting.ModelRequestRateLimitCount
	prevSuccess := setting.ModelRequestRateLimitSuccessCount
	prevGroup := setting.ModelRequestRateLimitGroup

	setting.ModelRequestRateLimitEnabled = true
	setting.ModelRequestRateLimitDurationMinutes = 1
	setting.ModelRequestRateLimitCount = globalTotal
	setting.ModelRequestRateLimitSuccessCount = globalSuccess
	setting.ModelRequestRateLimitGroup = groupLimits
	setting.ModelRequestRateLimitMutex.Unlock()

	t.Cleanup(func() {
		setting.ModelRequestRateLimitMutex.Lock()
		setting.ModelRequestRateLimitEnabled = prevEnabled
		setting.ModelRequestRateLimitDurationMinutes = prevDuration
		setting.ModelRequestRateLimitCount = prevTotal
		setting.ModelRequestRateLimitSuccessCount = prevSuccess
		setting.ModelRequestRateLimitGroup = prevGroup
		setting.ModelRequestRateLimitMutex.Unlock()
	})
}

func newModelRateLimitRouter(userID int, userGroup, tokenGroup string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/relay",
		func(c *gin.Context) {
			c.Set("id", userID)
			common.SetContextKey(c, constant.ContextKeyUserGroup, userGroup)
			common.SetContextKey(c, constant.ContextKeyTokenGroup, tokenGroup)
		},
		ModelRequestRateLimit(),
		func(c *gin.Context) {
			c.Status(http.StatusNoContent)
		},
	)
	return router
}

func requestModelRateLimit(router http.Handler) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/relay", nil)
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestModelRequestRateLimitUsesUserGroupNotTokenGroup(t *testing.T) {
	// paid users get a tight success limit; global (and any default token-group
	// config) stays much looser. A key whose token.Group is "default" must
	// still be constrained by the authenticated user's "paid" group.
	useModelRequestRateLimitSettings(t, map[string][2]int{
		"paid":    {0, 1},
		"default": {0, 100},
	}, 0, 100)
	useRateLimitMiniRedis(t)

	router := newModelRateLimitRouter(7, "paid", "default")

	assert.Equal(t, http.StatusNoContent, requestModelRateLimit(router).Code)
	assert.Equal(t, http.StatusTooManyRequests, requestModelRateLimit(router).Code,
		"token group \"default\" must not bypass the user's \"paid\" rate limit")
}

func TestModelRequestRateLimitFallsBackToGlobalWhenUserGroupHasNoOverride(t *testing.T) {
	useModelRequestRateLimitSettings(t, map[string][2]int{
		"paid": {0, 1},
	}, 0, 2)
	useRateLimitMiniRedis(t)

	// User is in "default"; only "paid" has an override, so global success=2 applies
	// even if the token is labeled "paid".
	router := newModelRateLimitRouter(8, "default", "paid")

	assert.Equal(t, http.StatusNoContent, requestModelRateLimit(router).Code)
	assert.Equal(t, http.StatusNoContent, requestModelRateLimit(router).Code)
	assert.Equal(t, http.StatusTooManyRequests, requestModelRateLimit(router).Code,
		"token group must not pull in another group's rate-limit override")
}

func TestModelRequestRateLimitUsesUserGroupInMemoryBackend(t *testing.T) {
	// Group selection happens before the redis/memory branch; cover the memory
	// path so a backend switch cannot reintroduce the token-group bypass.
	useModelRequestRateLimitSettings(t, map[string][2]int{
		"paid":    {0, 1},
		"default": {0, 100},
	}, 0, 100)

	prevRedisEnabled := common.RedisEnabled
	common.RedisEnabled = false
	t.Cleanup(func() { common.RedisEnabled = prevRedisEnabled })

	router := newModelRateLimitRouter(9, "paid", "default")

	assert.Equal(t, http.StatusNoContent, requestModelRateLimit(router).Code)
	assert.Equal(t, http.StatusTooManyRequests, requestModelRateLimit(router).Code,
		"memory backend must also bind limits to the user group")
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
