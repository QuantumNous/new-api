package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useConcurrentLimitSetting(t *testing.T, maxConcurrent int) {
	t.Helper()

	previousEnabled := setting.ModelConcurrentLimitEnabled
	previousLimit := setting.ModelConcurrentLimit
	setting.ModelConcurrentLimitEnabled = true
	setting.ModelConcurrentLimit = maxConcurrent
	t.Cleanup(func() {
		setting.ModelConcurrentLimitEnabled = previousEnabled
		setting.ModelConcurrentLimit = previousLimit
	})
}

func waitConcurrentSignal(t *testing.T, ch <-chan struct{}, msg string) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		t.Fatal(msg)
	}
}

func performConcurrentLimitRequest(router http.Handler) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/limited", nil)
	router.ServeHTTP(recorder, request)
	return recorder
}

func newConcurrentLimitTestRouter(t *testing.T, userID int, handlerEntered chan struct{}, releaseHandler chan struct{}) *gin.Engine {
	t.Helper()

	router := gin.New()
	require.NoError(t, router.SetTrustedProxies(nil))
	router.Use(func(c *gin.Context) { c.Set("id", userID) })
	router.Use(ModelConcurrentLimit())
	var handlerOnce sync.Once
	router.GET("/limited", func(c *gin.Context) {
		handlerOnce.Do(func() { close(handlerEntered) })
		<-releaseHandler
		c.Status(http.StatusOK)
	})
	return router
}

func TestModelConcurrentLimit_EnforcedInRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)
	_, redisClient := useRateLimitMiniRedis(t)
	useConcurrentLimitSetting(t, 1)

	const userID = 1101
	key := concurrentKey(concurrentLimitMark, strconv.Itoa(userID))
	handlerEntered := make(chan struct{})
	releaseHandler := make(chan struct{})
	requestDone := make(chan struct{})
	router := newConcurrentLimitTestRouter(t, userID, handlerEntered, releaseHandler)

	var firstCode int
	go func() {
		firstCode = performConcurrentLimitRequest(router).Code
		close(requestDone)
	}()
	waitConcurrentSignal(t, handlerEntered, "first request never reached handler")

	zcard, err := redisClient.ZCard(context.Background(), key).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(1), zcard, "in-flight request must hold one redis lease")

	recorder := performConcurrentLimitRequest(router)
	assert.Equal(t, http.StatusTooManyRequests, recorder.Code, "second concurrent request must be rejected")

	close(releaseHandler)
	waitConcurrentSignal(t, requestDone, "first request never completed")
	assert.Equal(t, http.StatusOK, firstCode)

	zcard, err = redisClient.ZCard(context.Background(), key).Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), zcard, "lease must be released after request completion")

	recorder = performConcurrentLimitRequest(router)
	assert.Equal(t, http.StatusOK, recorder.Code, "released slot must be reusable")
}

func TestModelConcurrentLimit_FallsBackToMemoryWhenRedisDown(t *testing.T) {
	gin.SetMode(gin.TestMode)
	redisServer, _ := useRateLimitMiniRedis(t)
	useConcurrentLimitSetting(t, 1)

	redisServer.Close()

	const userID = 1102
	handlerEntered := make(chan struct{})
	releaseHandler := make(chan struct{})
	requestDone := make(chan struct{})
	router := newConcurrentLimitTestRouter(t, userID, handlerEntered, releaseHandler)

	var firstCode int
	go func() {
		firstCode = performConcurrentLimitRequest(router).Code
		close(requestDone)
	}()
	waitConcurrentSignal(t, handlerEntered, "first request never reached handler")

	recorder := performConcurrentLimitRequest(router)
	assert.Equal(t, http.StatusTooManyRequests, recorder.Code,
		"concurrent limit must still be enforced via the in-memory fallback while redis is down")

	close(releaseHandler)
	waitConcurrentSignal(t, requestDone, "first request never completed")
	assert.Equal(t, http.StatusOK, firstCode)

	recorder = performConcurrentLimitRequest(router)
	assert.Equal(t, http.StatusOK, recorder.Code, "released slot must be reusable after fallback")
}
