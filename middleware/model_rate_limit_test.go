package middleware

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var modelRateLimitTestUserSequence atomic.Int64

func setupModelRequestRateLimitTest(t *testing.T, totalLimit, successLimit int) {
	t.Helper()
	previousEnabled := setting.ModelRequestRateLimitEnabled
	previousDuration := setting.ModelRequestRateLimitDurationMinutes
	previousTotal := setting.ModelRequestRateLimitCount
	previousSuccess := setting.ModelRequestRateLimitSuccessCount
	previousRedis := common.RedisEnabled
	setting.ModelRequestRateLimitMutex.Lock()
	previousGroups := setting.ModelRequestRateLimitGroup
	setting.ModelRequestRateLimitGroup = map[string][2]int{}
	setting.ModelRequestRateLimitMutex.Unlock()
	setting.ModelRequestRateLimitEnabled = true
	setting.ModelRequestRateLimitDurationMinutes = 1
	setting.ModelRequestRateLimitCount = totalLimit
	setting.ModelRequestRateLimitSuccessCount = successLimit
	common.RedisEnabled = false
	t.Cleanup(func() {
		setting.ModelRequestRateLimitEnabled = previousEnabled
		setting.ModelRequestRateLimitDurationMinutes = previousDuration
		setting.ModelRequestRateLimitCount = previousTotal
		setting.ModelRequestRateLimitSuccessCount = previousSuccess
		common.RedisEnabled = previousRedis
		setting.ModelRequestRateLimitMutex.Lock()
		setting.ModelRequestRateLimitGroup = previousGroups
		setting.ModelRequestRateLimitMutex.Unlock()
	})
}

func TestCheckModelRequestRateLimitCommitsOnlySuccessfulRequests(t *testing.T) {
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			setupModelRequestRateLimitTest(t, 0, 1)
			if backend == "redis" {
				useRateLimitMiniRedis(t)
			}
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("id", 900+int(modelRateLimitTestUserSequence.Add(1)))

			commit, apiErr := CheckModelRequestRateLimit(c)
			require.Nil(t, apiErr)
			commit(false)

			commit, apiErr = CheckModelRequestRateLimit(c)
			require.Nil(t, apiErr)
			commit(true)

			_, apiErr = CheckModelRequestRateLimit(c)
			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
		})
	}
}

func TestCheckModelRequestRateLimitReservesSuccessSlotsAtomically(t *testing.T) {
	const (
		requestCount = 16
		successLimit = 3
	)
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			setupModelRequestRateLimitTest(t, 0, successLimit)
			if backend == "redis" {
				useRateLimitMiniRedis(t)
			}

			start := make(chan struct{})
			commits := make(chan ModelRequestRateLimitCommit, requestCount)
			statuses := make(chan int, requestCount)
			var allowed atomic.Int64
			var waitGroup sync.WaitGroup
			userID := 900 + int(modelRateLimitTestUserSequence.Add(1))
			waitGroup.Add(requestCount)
			for range requestCount {
				go func() {
					defer waitGroup.Done()
					<-start
					c, _ := gin.CreateTestContext(httptest.NewRecorder())
					c.Set("id", userID)
					commit, apiErr := CheckModelRequestRateLimit(c)
					if apiErr != nil {
						statuses <- apiErr.StatusCode
						return
					}
					allowed.Add(1)
					commits <- commit
				}()
			}
			close(start)
			waitGroup.Wait()
			close(commits)
			close(statuses)

			assert.Equal(t, int64(successLimit), allowed.Load())
			assert.Len(t, statuses, requestCount-successLimit)
			for status := range statuses {
				assert.Equal(t, http.StatusTooManyRequests, status)
			}
			for commit := range commits {
				commit(true)
			}
		})
	}
}

func TestCheckModelRequestRateLimitDisablesNonPositiveSuccessLimit(t *testing.T) {
	for _, backend := range []string{"memory", "redis"} {
		t.Run(backend, func(t *testing.T) {
			setupModelRequestRateLimitTest(t, 0, -1)
			if backend == "redis" {
				useRateLimitMiniRedis(t)
			}
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Set("id", 900+int(modelRateLimitTestUserSequence.Add(1)))

			for range 2 {
				commit, apiErr := CheckModelRequestRateLimit(c)
				require.Nil(t, apiErr)
				commit(true)
			}
		})
	}
}

func TestResponsesWebSocketHandshakeDoesNotConsumeRequestLimit(t *testing.T) {
	setupModelRequestRateLimitTest(t, 1, 10)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("id", 902)
		c.Next()
	})
	router.GET("/v1/responses", ModelRequestRateLimit(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/v1/responses", nil)
	request.Header.Set("Upgrade", "websocket")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	assert.Equal(t, http.StatusNoContent, response.Code)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("id", 902)
	commit, apiErr := CheckModelRequestRateLimit(c)
	require.Nil(t, apiErr)
	commit(false)
}
