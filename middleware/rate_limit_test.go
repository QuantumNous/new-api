package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func TestSuggestionRateLimitUsesDedicatedSettings(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalRedisEnabled := common.RedisEnabled
	originalEnable := common.SuggestionRateLimitEnable
	originalNum := common.SuggestionRateLimitNum
	originalDuration := common.SuggestionRateLimitDuration
	originalLimiter := inMemoryRateLimiter

	common.RedisEnabled = false
	common.SuggestionRateLimitEnable = true
	common.SuggestionRateLimitNum = 1
	common.SuggestionRateLimitDuration = 60
	inMemoryRateLimiter = common.InMemoryRateLimiter{}

	t.Cleanup(func() {
		common.RedisEnabled = originalRedisEnabled
		common.SuggestionRateLimitEnable = originalEnable
		common.SuggestionRateLimitNum = originalNum
		common.SuggestionRateLimitDuration = originalDuration
		inMemoryRateLimiter = originalLimiter
	})

	router := gin.New()
	router.GET(
		"/suggestions",
		func(c *gin.Context) {
			c.Set("id", 1)
			c.Next()
		},
		SuggestionRateLimit(),
		func(c *gin.Context) {
			c.Status(http.StatusOK)
		},
	)

	first := httptest.NewRecorder()
	router.ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/suggestions", nil))
	if first.Code != http.StatusOK {
		t.Fatalf("expected first suggestion request to pass, got %d", first.Code)
	}

	second := httptest.NewRecorder()
	router.ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/suggestions", nil))
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected second suggestion request to be rate limited, got %d", second.Code)
	}
}
