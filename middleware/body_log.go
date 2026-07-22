package middleware

import (
	"bytes"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// Sensitive request header names whose values are redacted in capture.
var sensitiveRequestHeaders = map[string]bool{
	"authorization":     true,
	"proxy-authorization": true,
	"x-api-key":         true,
}

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

// HeaderCapture returns a middleware that captures request/response headers
// and bodies into gin.Context for downstream consume-log recording.
//
// Headers are stored as flat JSON objects under common.ContextKeyRequestHdrs
// and common.ContextKeyResponseHdrs. Sensitive headers (Authorization, etc.)
// are redacted to "[REDACTED]".
//
// Bodies are stored under common.ContextKeyRequestBody and
// common.ContextKeyResponseBody. Streaming responses (text/event-stream) are
// skipped for body capture but headers are still captured.
func HeaderCapture() gin.HandlerFunc {
	return func(c *gin.Context) {
		// --- Request headers ---
		if common.StoreRequestHeadersEnabled && c.Request != nil && c.Request.Header != nil {
			hdrs := make(map[string]string, len(c.Request.Header))
			for k, v := range c.Request.Header {
				kl := strings.ToLower(k)
				if sensitiveRequestHeaders[kl] {
					hdrs[k] = "[REDACTED]"
				} else if len(v) > 0 {
					hdrs[k] = v[0]
				}
			}
			c.Set(common.ContextKeyRequestHdrs, hdrs)
		}

		// --- Request body ---
		if common.StoreRequestBodyEnabled {
			if storage, err := common.GetBodyStorage(c); err == nil {
				if bodyBytes, bErr := storage.Bytes(); bErr == nil {
					c.Set(common.ContextKeyRequestBody, string(bodyBytes))
				}
			}
		}

		// --- Response: wrap writer ---
		var wrapper *responseBodyWriter
		if common.StoreResponseBodyEnabled {
			wrapper = &responseBodyWriter{
				ResponseWriter: c.Writer,
				buf:            &bytes.Buffer{},
			}
			c.Writer = wrapper
		}

		c.Next()

		// --- Response headers ---
		if common.StoreResponseHeadersEnabled {
			hdrs := make(map[string]string)
			for k, v := range c.Writer.Header() {
				if len(v) > 0 {
					hdrs[k] = v[0]
				}
			}
			c.Set(common.ContextKeyResponseHdrs, hdrs)
		}

		// --- Response body ---
		if wrapper != nil {
			respContentType := c.Writer.Header().Get("Content-Type")
			if !strings.Contains(respContentType, "text/event-stream") && wrapper.buf.Len() > 0 {
				c.Set(common.ContextKeyResponseBody, wrapper.buf.String())
			}
		}
	}
}
