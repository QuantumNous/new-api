package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
	setupModelRequestRateLimitTest(t, 10, 1)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Set("id", 901)

	commit, apiErr := CheckModelRequestRateLimit(c)
	require.Nil(t, apiErr)
	commit(false)

	commit, apiErr = CheckModelRequestRateLimit(c)
	require.Nil(t, apiErr)
	commit(true)

	_, apiErr = CheckModelRequestRateLimit(c)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusTooManyRequests, apiErr.StatusCode)
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
