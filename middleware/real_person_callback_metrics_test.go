package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"

	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRealPersonVerificationCallbackMetricsRecordsStatusBuckets(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, tc := range []struct {
		name   string
		status int
		want   string
	}{
		{name: "success", status: http.StatusNoContent, want: `newapi_byteplus_real_person_callback_total{status="2xx"} 1`},
		{name: "rate limit", status: http.StatusTooManyRequests, want: `newapi_byteplus_real_person_callback_total{status="429"} 1`},
		{name: "other 4xx", status: http.StatusBadRequest, want: `newapi_byteplus_real_person_callback_total{status="other_4xx"} 1`},
		{name: "5xx", status: http.StatusInternalServerError, want: `newapi_byteplus_real_person_callback_total{status="5xx"} 1`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := callbackMetricValue(t, tc.want)
			engine := gin.New()
			engine.Use(RealPersonVerificationCallbackMetrics())
			engine.GET("/callback/:callback_token", func(c *gin.Context) {
				require.Equal(t, "secret-callback-token", c.Param("callback_token"))
				c.Status(tc.status)
			})

			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/callback/secret-callback-token?resultCode=raw", nil))
			require.Equal(t, tc.status, recorder.Code)

			text, err := perfmetrics.BuildPrometheusText(context.Background())
			require.NoError(t, err)
			require.Contains(t, text, strings.Replace(tc.want, " 1", " "+strconv.FormatInt(before+1, 10), 1))
			require.NotContains(t, text, "secret-callback-token")
			require.NotContains(t, text, "resultCode")
		})
	}
}

func callbackMetricValue(t *testing.T, sample string) int64 {
	t.Helper()
	text, err := perfmetrics.BuildPrometheusText(context.Background())
	require.NoError(t, err)
	prefix := strings.TrimSuffix(sample, " 1")
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, prefix+" ") {
			value, err := strconv.ParseInt(strings.TrimSpace(strings.TrimPrefix(line, prefix)), 10, 64)
			require.NoError(t, err)
			return value
		}
	}
	return 0
}

func TestRealPersonVerificationCallbackRateLimitUsesDedicatedFactory(t *testing.T) {
	source := readMiddlewareSourceForTest(t, "rate-limit.go")
	bodyStart := strings.Index(source, `func RealPersonVerificationCallbackRateLimit() func(c *gin.Context) {`)
	require.NotEqual(t, -1, bodyStart)
	bodyEnd := strings.Index(source[bodyStart:], "\n}\n\nfunc CriticalRateLimit")
	require.NotEqual(t, -1, bodyEnd)
	body := source[bodyStart : bodyStart+bodyEnd+3]
	require.Equal(t, `func RealPersonVerificationCallbackRateLimit() func(c *gin.Context) {
	return rateLimitFactory(120, 60, "RPV_CB")
}
`, body)
	require.NotContains(t, body, "common.RedisEnabled")
	require.NotContains(t, body, "common.RDB")
	require.NotContains(t, body, "memoryRateLimiter")
}

func readMiddlewareSourceForTest(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err)
	return string(data)
}
