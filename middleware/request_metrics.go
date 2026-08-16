package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const relayRequestFailedKey = "relay_request_metrics_failed"

// MarkRelayRequestFailed overrides response-based inference when the relay
// execution layer detects a failure after the HTTP response has started.
func MarkRelayRequestFailed(c *gin.Context) {
	c.Set(relayRequestFailedKey, true)
}

func RecordRequestMetrics() gin.HandlerFunc {
	return recordRequestMetrics(nil, nil)
}

// RecordRelayRequestMetrics records traffic and outcomes for model and media
// relay APIs registered outside the /api group, excluding static frontend assets.
func RecordRelayRequestMetrics() gin.HandlerFunc {
	return recordRequestMetrics(isRelayTrafficPath, common.ObserveRequestOutcome)
}

func recordRequestMetrics(shouldRecord func(string) bool, observeOutcome func(bool)) gin.HandlerFunc {
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
		if observeOutcome != nil {
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

		if observeOutcome != nil {
			success := auditResponseSuccess(writer.Status(), writer.body.Bytes())
			if c.GetBool(relayRequestFailedKey) {
				success = false
			}
			observeOutcome(success)
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
	if path == "/api/mj" || strings.HasPrefix(path, "/api/mj/") {
		return false
	}

	for _, prefix := range []string{"/v1", "/v1beta", "/pg", "/kling/v1", "/jimeng", "/mj", "/suno"} {
		if path == prefix || strings.HasPrefix(path, prefix+"/") {
			return true
		}
	}

	segments := strings.Split(strings.TrimPrefix(path, "/"), "/")
	return len(segments) >= 2 && segments[0] != "" && segments[1] == "mj"
}
