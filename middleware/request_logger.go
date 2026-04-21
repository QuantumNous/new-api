package middleware

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/gin-gonic/gin"
)

// responseBodyWriter wraps gin.ResponseWriter to capture the response body.
type responseBodyWriter struct {
	gin.ResponseWriter
	buf *bytes.Buffer
}

func (w *responseBodyWriter) Write(b []byte) (int, error) {
	w.buf.Write(b)
	return w.ResponseWriter.Write(b)
}

func (w *responseBodyWriter) WriteString(s string) (int, error) {
	w.buf.WriteString(s)
	return w.ResponseWriter.WriteString(s)
}

// RequestLogger logs the inbound request (URL, headers, body) and the
// outbound response body when DEBUG=true.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.DebugEnabled {
			c.Next()
			return
		}

		// --- request ---
		var sb strings.Builder
		sb.WriteString("\n========== Inbound Request ==========\n")
		sb.WriteString(fmt.Sprintf("%s %s\n", c.Request.Method, c.Request.URL.String()))

		sb.WriteString("--- Headers ---\n")
		for key, values := range c.Request.Header {
			for _, v := range values {
				if strings.EqualFold(key, "Authorization") || strings.EqualFold(key, "x-api-key") {
					if len(v) > 12 {
						v = v[:12] + "***"
					}
				}
				sb.WriteString(fmt.Sprintf("%s: %s\n", key, v))
			}
		}

		sb.WriteString("--- Body ---\n")
		bodyStorage, err := common.GetBodyStorage(c)
		if err == nil {
			bodyBytes, err := bodyStorage.Bytes()
			if err == nil {
				sb.Write(bodyBytes)
				sb.WriteString("\n")
			}
		}
		sb.WriteString("=====================================")
		logger.LogDebug(c.Request.Context(), sb.String())

		// --- wrap response writer to capture output ---
		rbw := &responseBodyWriter{ResponseWriter: c.Writer, buf: &bytes.Buffer{}}
		c.Writer = rbw

		c.Next()

		// --- response ---
		var sb2 strings.Builder
		sb2.WriteString("\n========== Inbound Response ==========\n")
		sb2.WriteString(fmt.Sprintf("Status: %d\n", rbw.Status()))
		sb2.WriteString("--- Body ---\n")
		const maxRespBytes = 4 << 10 // 4 KB
		respBytes := rbw.buf.Bytes()
		if len(respBytes) > maxRespBytes {
			sb2.Write(respBytes[:maxRespBytes])
			sb2.WriteString(fmt.Sprintf("\n... (truncated, total %d bytes)", len(respBytes)))
		} else {
			sb2.Write(respBytes)
		}
		sb2.WriteString("\n======================================")
		logger.LogDebug(c.Request.Context(), sb2.String())
	}
}
