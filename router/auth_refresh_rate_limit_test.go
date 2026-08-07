package router

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRefreshExhaustionCannotConsumeGlobalLoginAllowance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer := miniredis.RunT(t)
	redisClient := redis.NewClient(&redis.Options{Addr: redisServer.Addr()})
	require.NoError(t, redisClient.Ping(context.Background()).Err())

	previousRedisEnabled := common.RedisEnabled
	previousRedisClient := common.RDB
	previousGlobalEnabled := common.GlobalApiRateLimitEnable
	previousGlobalLimit := common.GlobalApiRateLimitNum
	previousGlobalDuration := common.GlobalApiRateLimitDuration
	previousRefreshEnabled := common.AuthRefreshRateLimitEnable
	previousRefreshLimit := common.AuthRefreshRateLimitNum
	previousRefreshDuration := common.AuthRefreshRateLimitDuration
	previousCriticalEnabled := common.CriticalRateLimitEnable
	previousCriticalLimit := common.CriticalRateLimitNum
	previousCriticalDuration := common.CriticalRateLimitDuration
	previousTurnstileEnabled := common.TurnstileCheckEnabled
	previousPasswordLoginEnabled := common.PasswordLoginEnabled
	common.RedisEnabled = true
	common.RDB = redisClient
	common.GlobalApiRateLimitEnable = true
	common.GlobalApiRateLimitNum = 1
	common.GlobalApiRateLimitDuration = 43
	common.AuthRefreshRateLimitEnable = true
	common.AuthRefreshRateLimitNum = 1
	common.AuthRefreshRateLimitDuration = 47
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = 53
	common.TurnstileCheckEnabled = false
	common.PasswordLoginEnabled = true
	t.Cleanup(func() {
		_ = redisClient.Close()
		common.RedisEnabled = previousRedisEnabled
		common.RDB = previousRedisClient
		common.GlobalApiRateLimitEnable = previousGlobalEnabled
		common.GlobalApiRateLimitNum = previousGlobalLimit
		common.GlobalApiRateLimitDuration = previousGlobalDuration
		common.AuthRefreshRateLimitEnable = previousRefreshEnabled
		common.AuthRefreshRateLimitNum = previousRefreshLimit
		common.AuthRefreshRateLimitDuration = previousRefreshDuration
		common.CriticalRateLimitEnable = previousCriticalEnabled
		common.CriticalRateLimitNum = previousCriticalLimit
		common.CriticalRateLimitDuration = previousCriticalDuration
		common.TurnstileCheckEnabled = previousTurnstileEnabled
		common.PasswordLoginEnabled = previousPasswordLoginEnabled
	})

	engine := gin.New()
	require.NoError(t, engine.SetTrustedProxies(nil))
	SetApiRouter(engine)

	request := func(path string, body []byte) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "192.0.2.90:12345"
		engine.ServeHTTP(recorder, req)
		return recorder
	}

	assert.NotEqual(t, http.StatusTooManyRequests, request("/api/user/auth/refresh", nil).Code)
	limitedRefresh := request("/api/user/auth/refresh", nil)
	assert.Equal(t, http.StatusTooManyRequests, limitedRefresh.Code)
	assert.Equal(t, "47", limitedRefresh.Header().Get("Retry-After"))
	assert.Equal(t, http.StatusTooManyRequests, request("/api/user/auth/refresh", nil).Code)

	login := request("/api/user/login", []byte(`{}`))
	assert.NotEqual(t, http.StatusTooManyRequests, login.Code)
}
