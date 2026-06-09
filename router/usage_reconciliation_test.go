package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

func TestSetUsageReconciliationRouter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetUsageReconciliationRouter(engine)

	want := map[string]string{
		"/usage/summary":      http.MethodGet,
		"/usage/validation":   http.MethodGet,
		"/usage/transactions": http.MethodGet,
		"/usage/models":       http.MethodGet,
	}
	got := map[string]string{}
	for _, ri := range engine.Routes() {
		if _, ok := want[ri.Path]; ok {
			got[ri.Path] = ri.Method
		}
	}
	for path, method := range want {
		if got[path] != method {
			t.Fatalf("expected route %s %s to be registered, got method %q (all routes: %v)",
				method, path, got[path], engine.Routes())
		}
	}
}

// TestUsageReconciliationRouterRateLimited asserts the /usage group is protected
// by a rate limiter mounted BEFORE the auth middleware, so even unauthenticated
// brute-force attempts are throttled. With the global API limit forced to 2
// requests, the 3rd same-IP request must be rejected with 429 before it ever
// reaches the auth handler (which would otherwise return 503/401).
func TestUsageReconciliationRouterRateLimited(t *testing.T) {
	origEnable := common.GlobalApiRateLimitEnable
	origNum := common.GlobalApiRateLimitNum
	origDur := common.GlobalApiRateLimitDuration
	origRedis := common.RedisEnabled
	t.Cleanup(func() {
		common.GlobalApiRateLimitEnable = origEnable
		common.GlobalApiRateLimitNum = origNum
		common.GlobalApiRateLimitDuration = origDur
		common.RedisEnabled = origRedis
	})
	common.RedisEnabled = false
	common.GlobalApiRateLimitEnable = true
	common.GlobalApiRateLimitNum = 2
	common.GlobalApiRateLimitDuration = 60

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetUsageReconciliationRouter(engine)

	codes := make([]int, 0, 3)
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/usage/summary", nil)
		rec := httptest.NewRecorder()
		engine.ServeHTTP(rec, req)
		codes = append(codes, rec.Code)
	}

	if codes[2] != http.StatusTooManyRequests {
		t.Fatalf("3rd request code = %d, want 429 (rate limit not wired before auth?); codes=%v", codes[2], codes)
	}
	if codes[0] == http.StatusTooManyRequests || codes[1] == http.StatusTooManyRequests {
		t.Fatalf("first two requests must pass the limiter and reach auth, got codes=%v", codes)
	}
}
