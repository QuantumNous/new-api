package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func RecordRequestMetrics() gin.HandlerFunc {
	return recordRequestMetrics(nil, true)
}

// RecordRelayRequestMetrics records model and media relay traffic registered
// outside the /api group without including static frontend assets or changing
// the existing /api success-rate population.
func RecordRelayRequestMetrics() gin.HandlerFunc {
	return recordRequestMetrics(isRelayTrafficPath, false)
}

func recordRequestMetrics(shouldRecord func(string) bool, observeOutcome bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if shouldRecord != nil && !shouldRecord(c.Request.URL.Path) {
			c.Next()
			return
		}
		if c.Request.Method == http.MethodOptions || c.Request.URL.Path == "/api/next/dashboard/system-status" {
			c.Next()
			return
		}

		if c.Request.Body != nil {
			c.Request.Body = &countingReadCloser{ReadCloser: c.Request.Body}
		}

		var responseBody *bytes.Buffer
		if observeOutcome {
			responseBody = bytes.NewBuffer(nil)
		}
		writer := &auditResponseWriter{
			ResponseWriter: c.Writer,
			body:           responseBody,
			maxSize:        64 * 1024,
			onWrite:        common.ObserveApplicationResponseBytes,
		}
		c.Writer = writer
		c.Next()

		if observeOutcome {
			common.ObserveRequestOutcome(auditResponseSuccess(writer.Status(), writer.body.Bytes()))
		}
	}
}

type countingReadCloser struct {
	io.ReadCloser
}

func (r *countingReadCloser) Read(p []byte) (int, error) {
	n, err := r.ReadCloser.Read(p)
	if n > 0 {
		common.ObserveApplicationRequestBytes(n)
	}
	return n, err
}

func isRelayTrafficPath(path string) bool {
	for _, prefix := range []string{"/v1", "/v1beta", "/pg", "/kling/v1", "/jimeng", "/mj", "/suno"} {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}

	segments := strings.Split(strings.TrimPrefix(path, "/"), "/")
	return len(segments) >= 2 && segments[0] != "" && segments[1] == "mj"
}
