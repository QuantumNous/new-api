package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func newCriticalRateLimitRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CriticalRateLimit())
	r.GET("/critical", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func newCriticalLimitRequest(remoteAddr string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/critical", nil)
	req.RemoteAddr = remoteAddr
	return req
}

func TestCriticalRateLimitExceed(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	prevLimitEnable := common.CriticalRateLimitEnable
	prevLimitNum := common.CriticalRateLimitNum
	prevLimitDuration := common.CriticalRateLimitDuration
	prevWhitelist := os.Getenv("CRITICAL_RATE_LIMIT_WHITELIST")

	common.RedisEnabled = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 2
	common.CriticalRateLimitDuration = 60
	_ = os.Unsetenv("CRITICAL_RATE_LIMIT_WHITELIST")
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
		common.CriticalRateLimitEnable = prevLimitEnable
		common.CriticalRateLimitNum = prevLimitNum
		common.CriticalRateLimitDuration = prevLimitDuration
		if prevWhitelist == "" {
			_ = os.Unsetenv("CRITICAL_RATE_LIMIT_WHITELIST")
			return
		}
		_ = os.Setenv("CRITICAL_RATE_LIMIT_WHITELIST", prevWhitelist)
	})

	r := newCriticalRateLimitRouter()

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, newCriticalLimitRequest("198.51.100.10:3456"))
		if w.Code != http.StatusOK {
			t.Fatalf("request %d got status %d, want %d", i+1, w.Code, http.StatusOK)
		}
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, newCriticalLimitRequest("198.51.100.10:3456"))
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("request 3 got status %d, want %d", w.Code, http.StatusTooManyRequests)
	}
}

func TestCriticalRateLimitWhitelistBypassesLimit(t *testing.T) {
	prevRedisEnabled := common.RedisEnabled
	prevLimitEnable := common.CriticalRateLimitEnable
	prevLimitNum := common.CriticalRateLimitNum
	prevLimitDuration := common.CriticalRateLimitDuration
	prevWhitelist := os.Getenv("CRITICAL_RATE_LIMIT_WHITELIST")

	common.RedisEnabled = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = 60
	_ = os.Setenv("CRITICAL_RATE_LIMIT_WHITELIST", "198.51.100.20")
	t.Cleanup(func() {
		common.RedisEnabled = prevRedisEnabled
		common.CriticalRateLimitEnable = prevLimitEnable
		common.CriticalRateLimitNum = prevLimitNum
		common.CriticalRateLimitDuration = prevLimitDuration
		if prevWhitelist == "" {
			_ = os.Unsetenv("CRITICAL_RATE_LIMIT_WHITELIST")
			return
		}
		_ = os.Setenv("CRITICAL_RATE_LIMIT_WHITELIST", prevWhitelist)
	})

	r := newCriticalRateLimitRouter()

	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, newCriticalLimitRequest("198.51.100.20:3456"))
		if w.Code != http.StatusOK {
			t.Fatalf("whitelist request %d got status %d, want %d", i+1, w.Code, http.StatusOK)
		}
	}
}
