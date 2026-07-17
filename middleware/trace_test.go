package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestTraceContextGeneratesAndEchoes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestId())
	r.Use(TraceContext())
	r.GET("/v1/chat/completions", func(c *gin.Context) {
		require.NotEmpty(t, c.GetString("thread_id"))
		require.NotEmpty(t, c.GetString("trace_id"))
		require.Empty(t, c.GetString("affinity_trace_id"))
		require.False(t, c.GetBool("trace_client_provided"))
		_, _ = service.GetPreferredChannelByAffinity(c, "gpt-test", "default")
		_, affinityConfigured := service.GetChannelAffinityStatsContext(c)
		require.False(t, affinityConfigured)
		service.RecordChannelAffinity(c, 123)
		c.JSON(200, gin.H{
			"thread_id": c.GetString("thread_id"),
			"trace_id":  c.GetString("trace_id"),
		})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
	r.ServeHTTP(w, req)
	require.Equal(t, 200, w.Code)
	require.NotEmpty(t, w.Header().Get("AH-Thread-Id"))
	require.NotEmpty(t, w.Header().Get("AH-Trace-Id"))
	// When client omits AH-Trace-Id, fallback links to request id.
	require.Equal(t, w.Header().Get(common.RequestIdKey), w.Header().Get("AH-Trace-Id"))
}

func TestTraceContextRespectsClientHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestId())
	r.Use(TraceContext())
	r.GET("/v1/chat/completions", func(c *gin.Context) {
		require.Equal(t, "trace-xyz", c.GetString("affinity_trace_id"))
		require.True(t, c.GetBool("trace_client_provided"))
		_, _ = service.GetPreferredChannelByAffinity(c, "gpt-test", "default")
		_, affinityConfigured := service.GetChannelAffinityStatsContext(c)
		require.True(t, affinityConfigured)
		c.JSON(200, gin.H{
			"thread_id": c.GetString("thread_id"),
			"trace_id":  c.GetString("trace_id"),
		})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
	req.Header.Set("AH-Thread-Id", "thread-abc")
	req.Header.Set("X-Trace-Id", "trace-xyz")
	r.ServeHTTP(w, req)
	require.Equal(t, 200, w.Code)
	require.Equal(t, "thread-abc", w.Header().Get("AH-Thread-Id"))
	require.Equal(t, "trace-xyz", w.Header().Get("AH-Trace-Id"))
	require.Equal(t, "trace-xyz", w.Header().Get("X-Trace-Id"))
}

func TestTraceContextRejectsOversizedAffinityTrace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RequestId())
	r.Use(TraceContext())
	r.GET("/v1/chat/completions", func(c *gin.Context) {
		require.Empty(t, c.GetString("affinity_trace_id"))
		require.False(t, c.GetBool("trace_client_provided"))
		require.NotEqual(t, c.GetHeader("AH-Trace-Id"), c.GetString("trace_id"))
		c.Status(http.StatusNoContent)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/chat/completions", nil)
	req.Header.Set("AH-Trace-Id", string(make([]byte, maxClientTraceIDBytes+1)))
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusNoContent, w.Code)
}

func TestTraceContextRejectsControlCharactersForAffinity(t *testing.T) {
	require.Empty(t, normalizeClientTraceID("trace\tattacker"))
	require.Empty(t, normalizeClientTraceID("trace attacker"))
	require.Equal(t, "trace-safe_123", normalizeClientTraceID(" trace-safe_123 "))
}
