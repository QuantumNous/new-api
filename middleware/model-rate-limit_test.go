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

func resetModelRateLimitTestState(t *testing.T) {
	t.Helper()
	originalMode := gin.Mode()
	originalDurationMinutes := setting.ModelRequestRateLimitDurationMinutes
	gin.SetMode(gin.TestMode)
	inMemoryRateLimiter = common.InMemoryRateLimiter{}
	t.Cleanup(func() {
		gin.SetMode(originalMode)
		setting.ModelRequestRateLimitDurationMinutes = originalDurationMinutes
		inMemoryRateLimiter = common.InMemoryRateLimiter{}
	})
}

func performModelRateLimitRequest(handler gin.HandlerFunc, status int) *httptest.ResponseRecorder {
	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		c.Set("id", 123)
		handler(c)
	}, func(c *gin.Context) {
		c.Status(status)
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
	return recorder
}

func TestMemoryModelRateLimitFailedRequestsDoNotConsumeSuccessLimit(t *testing.T) {
	resetModelRateLimitTestState(t)
	setting.ModelRequestRateLimitDurationMinutes = 1
	handler := memoryRateLimitHandler(60, 0, 1)

	failed := performModelRateLimitRequest(handler, http.StatusInternalServerError)
	require.Equal(t, http.StatusInternalServerError, failed.Code)

	firstSuccess := performModelRateLimitRequest(handler, http.StatusOK)
	require.Equal(t, http.StatusOK, firstSuccess.Code)

	secondSuccess := performModelRateLimitRequest(handler, http.StatusOK)
	assert.Equal(t, http.StatusTooManyRequests, secondSuccess.Code)
}

func TestMemoryModelRateLimitZeroSuccessLimitIsUnlimited(t *testing.T) {
	resetModelRateLimitTestState(t)
	setting.ModelRequestRateLimitDurationMinutes = 1
	handler := memoryRateLimitHandler(60, 0, 0)

	firstSuccess := performModelRateLimitRequest(handler, http.StatusOK)
	require.Equal(t, http.StatusOK, firstSuccess.Code)

	secondSuccess := performModelRateLimitRequest(handler, http.StatusOK)
	assert.Equal(t, http.StatusOK, secondSuccess.Code)
}
