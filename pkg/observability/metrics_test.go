package observability

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestMetricsAuthFailsClosedWithoutConfiguredToken(t *testing.T) {
	t.Setenv("METRICS_TOKEN", "")
	require.Equal(t, http.StatusServiceUnavailable, metricsAuthStatus(t, ""))
}

func TestMetricsAuthRejectsInvalidToken(t *testing.T) {
	t.Setenv("METRICS_TOKEN", "metrics-secret")
	require.Equal(t, http.StatusUnauthorized, metricsAuthStatus(t, "Bearer wrong"))
}

func TestMetricsAuthAcceptsConfiguredToken(t *testing.T) {
	t.Setenv("METRICS_TOKEN", "metrics-secret")
	require.Equal(t, http.StatusNoContent, metricsAuthStatus(t, "Bearer metrics-secret"))
}

func metricsAuthStatus(t *testing.T, authorization string) int {
	t.Helper()
	engine := gin.New()
	engine.Use(MetricsAuth())
	engine.GET("/metrics", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	request.Header.Set("Authorization", authorization)
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	return recorder.Code
}
