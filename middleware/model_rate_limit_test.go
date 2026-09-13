package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var memoryModelRateLimitTestID atomic.Int64

func nextMemoryModelRateLimitTestID() int {
	return int(1_000_000_000 + memoryModelRateLimitTestID.Add(1))
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

func TestMemoryModelRateLimitSuccessAdmissionIsAtomicUnderConcurrency(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const (
		requestCount = 50
		maximumCount = 10
		duration     = int64(60)
	)

	id := nextMemoryModelRateLimitTestID()
	entered := make(chan struct{}, requestCount)
	release := make(chan struct{})
	responses := make(chan int, requestCount)

	router := gin.New()
	router.GET(
		"/limited",
		func(c *gin.Context) { c.Set("id", id) },
		memoryRateLimitHandler(duration, 0, maximumCount),
		func(c *gin.Context) {
			entered <- struct{}{}
			<-release
			c.Status(http.StatusNoContent)
		},
	)

	var waitGroup sync.WaitGroup
	waitGroup.Add(requestCount)
	for range requestCount {
		go func() {
			defer waitGroup.Done()
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/limited", nil)
			router.ServeHTTP(recorder, request)
			responses <- recorder.Code
		}()
	}

	for range maximumCount {
		select {
		case <-entered:
		case <-time.After(2 * time.Second):
			close(release)
			waitGroup.Wait()
			t.Fatal("not all reserved requests reached the downstream handler")
		}
	}
	close(release)
	waitGroup.Wait()
	close(responses)

	var noContentCount, tooManyRequestsCount int
	for status := range responses {
		switch status {
		case http.StatusNoContent:
			noContentCount++
		case http.StatusTooManyRequests:
			tooManyRequestsCount++
		default:
			t.Fatalf("unexpected response status %d", status)
		}
	}
	assert.Equal(t, maximumCount, noContentCount)
	assert.Equal(t, requestCount-maximumCount, tooManyRequestsCount)
}

func TestMemoryModelRateLimitFailedRequestReleasesSuccessSlot(t *testing.T) {
	gin.SetMode(gin.TestMode)
	id := nextMemoryModelRateLimitTestID()
	var calls atomic.Int32

	router := gin.New()
	router.GET(
		"/limited",
		func(c *gin.Context) { c.Set("id", id) },
		memoryRateLimitHandler(60, 0, 1),
		func(c *gin.Context) {
			if calls.Add(1) == 1 {
				c.Status(http.StatusBadGateway)
				return
			}
			c.Status(http.StatusNoContent)
		},
	)

	first := httptest.NewRecorder()
	router.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/limited", nil))
	assert.Equal(t, http.StatusBadGateway, first.Code)

	second := httptest.NewRecorder()
	router.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/limited", nil))
	assert.Equal(t, http.StatusNoContent, second.Code)
}
