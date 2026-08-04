package middleware

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

var rateLimitProbeCounter uint64

func runRateLimitProbe(handler gin.HandlerFunc, method, path, ip string) int {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, path, nil)
	context.Request.RemoteAddr = ip + ":443"
	handler(context)
	return context.Writer.Status()
}

func runRateLimitProbeAsUser(handler gin.HandlerFunc, method, path, ip string, userID int) int {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, path, nil)
	context.Request.RemoteAddr = ip + ":443"
	context.Set("id", userID)
	handler(context)
	return context.Writer.Status()
}

// TestAnalysisRateLimitDoesNotBlockLoginBucket is the regression probe for
// the shared-IP bucket reported by the dashboard review: after 21 analysis
// requests from one IP, the login request must still reach the independent
// critical bucket.  The 21st analysis request itself is expected to be 429.
func TestAnalysisRateLimitDoesNotBlockLoginBucket(t *testing.T) {
	previousEnabled := common.CriticalRateLimitEnable
	previousRedis := common.RedisEnabled
	previousNum := common.CriticalRateLimitNum
	previousDuration := common.CriticalRateLimitDuration
	t.Cleanup(func() {
		common.CriticalRateLimitEnable = previousEnabled
		common.RedisEnabled = previousRedis
		common.CriticalRateLimitNum = previousNum
		common.CriticalRateLimitDuration = previousDuration
	})

	common.CriticalRateLimitEnable = true
	common.RedisEnabled = false
	common.CriticalRateLimitNum = 20
	common.CriticalRateLimitDuration = 20 * 60

	// RFC 5737 TEST-NET-2 address; the unique final octet prevents interference
	// from another test that happens to exercise the process-global store.
	probeID := atomic.AddUint64(&rateLimitProbeCounter, 1)
	ip := fmt.Sprintf("198.51.100.%d", probeID%254+1)
	analysisRateLimit := AnalysisRateLimit()
	loginRateLimit := CriticalRateLimit()

	for request := 1; request <= 20; request++ {
		// This unit probe supplies the identity that AdminAuth/UserAuth would
		// populate. End-to-end identity and route ordering are covered by
		// rate-limit_auth_chain_test.go without synthetic c.Set calls.
		status := runRateLimitProbeAsUser(analysisRateLimit, http.MethodGet, "/api/log/analysis", ip, 100000+int(probeID))
		require.Equal(t, http.StatusOK, status, "analysis request %d unexpectedly blocked", request)
	}
	require.Equal(t, http.StatusTooManyRequests,
		runRateLimitProbeAsUser(analysisRateLimit, http.MethodGet, "/api/log/analysis", ip, 100000+int(probeID)),
		"21st analysis request should be limited by the analysis bucket")
	require.Equal(t, http.StatusOK,
		runRateLimitProbe(loginRateLimit, http.MethodPost, "/api/user/login", ip),
		"analysis traffic must not consume the login CriticalRateLimit bucket")
}
