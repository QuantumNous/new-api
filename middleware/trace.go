package middleware

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxClientTraceIDBytes = 256

func normalizeClientTraceID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > maxClientTraceIDBytes {
		return ""
	}
	for _, r := range value {
		if r < 0x21 || r > 0x7e {
			return ""
		}
	}
	return value
}

func firstValidTraceHeader(c *gin.Context, names ...string) string {
	if c == nil || c.Request == nil {
		return ""
	}
	for _, name := range names {
		if value := normalizeClientTraceID(c.GetHeader(name)); value != "" {
			return value
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
		clientThread := firstValidTraceHeader(c,
			"AH-Thread-Id", "Ah-Thread-Id", "X-Thread-Id", "X-Ah-Thread-Id")
		clientTrace := firstValidTraceHeader(c,
			"AH-Trace-Id", "Ah-Trace-Id", "X-Trace-Id", "X-Ah-Trace-Id")

		// Optional coding-tool fallbacks count as client-provided.
		if clientTrace == "" {
			clientTrace = firstValidTraceHeader(c, "Session_id", "Session-Id", "X-Session-Id")
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
