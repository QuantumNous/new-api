package middleware

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// firstNonEmptyHeader returns the first non-empty request header value among names.
func firstNonEmptyHeader(c *gin.Context, names ...string) string {
	if c == nil || c.Request == nil {
		return ""
	}
	for _, name := range names {
		v := strings.TrimSpace(c.GetHeader(name))
		if v != "" {
			return v
		}
	}
	return ""
}

// TraceContext injects AxonHub-compatible Thread/Trace IDs for agent observability.
// Accepts AH-* and X-* aliases; generates UUIDs when missing. Echoes headers on the response.
//
// Affinity sticky only uses client-provided Trace IDs (see affinity_trace_id) so
// auto-generated per-request IDs do not pollute the channel affinity LRU.
func TraceContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		clientThread := firstNonEmptyHeader(c,
			"AH-Thread-Id", "Ah-Thread-Id", "X-Thread-Id", "X-Ah-Thread-Id")
		clientTrace := firstNonEmptyHeader(c,
			"AH-Trace-Id", "Ah-Trace-Id", "X-Trace-Id", "X-Ah-Trace-Id")

		// Optional coding-tool fallbacks count as client-provided.
		if clientTrace == "" {
			clientTrace = firstNonEmptyHeader(c, "Session_id", "Session-Id", "X-Session-Id")
		}

		threadID := clientThread
		traceID := clientTrace
		if threadID == "" {
			threadID = uuid.NewString()
		}
		if traceID == "" {
			if rid := c.GetString(common.RequestIdKey); rid != "" {
				traceID = rid
			} else {
				traceID = uuid.NewString()
			}
		}

		c.Set(string(constant.ContextKeyThreadId), threadID)
		c.Set(string(constant.ContextKeyTraceId), traceID)
		c.Set("thread_id", threadID)
		c.Set("trace_id", traceID)
		// Only client-supplied traces are sticky-affinity eligible.
		if clientTrace != "" {
			c.Set("affinity_trace_id", clientTrace)
			c.Set("trace_client_provided", true)
		} else {
			c.Set("trace_client_provided", false)
		}

		c.Header("AH-Thread-Id", threadID)
		c.Header("AH-Trace-Id", traceID)
		c.Header("X-Thread-Id", threadID)
		c.Header("X-Trace-Id", traceID)

		c.Next()
	}
}
