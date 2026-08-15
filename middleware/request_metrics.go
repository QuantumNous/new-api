package middleware

import (
	"bytes"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func RecordRequestMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions || c.Request.URL.Path == "/api/next/dashboard/system-status" {
			c.Next()
			return
		}

		var requestBody *countingReadCloser
		if c.Request.Body != nil {
			requestBody = &countingReadCloser{ReadCloser: c.Request.Body}
			c.Request.Body = requestBody
		}
		writer := &auditResponseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBuffer(nil),
			maxSize:        64 * 1024,
		}
		c.Writer = writer
		c.Next()

		var requestBytes int64
		if requestBody != nil {
			requestBytes = requestBody.BytesRead()
		}
		common.ObserveApplicationTraffic(requestBytes, writer.BytesWritten())
		common.ObserveRequestOutcome(auditResponseSuccess(writer.Status(), writer.body.Bytes()))
	}
}

type countingReadCloser struct {
	io.ReadCloser
	bytesRead int64
}

func (r *countingReadCloser) Read(p []byte) (int, error) {
	n, err := r.ReadCloser.Read(p)
	if n > 0 {
		r.bytesRead += int64(n)
	}
	return n, err
}

func (r *countingReadCloser) BytesRead() int64 {
	return r.bytesRead
}
