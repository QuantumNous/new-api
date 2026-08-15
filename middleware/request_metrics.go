package middleware

import (
	"bytes"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func RecordRequestMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		writer := &auditResponseWriter{
			ResponseWriter: c.Writer,
			body:           bytes.NewBuffer(nil),
			maxSize:        64 * 1024,
		}
		c.Writer = writer
		c.Next()
		if c.Request.Method == http.MethodOptions || c.Request.URL.Path == "/api/next/dashboard/system-status" {
			return
		}
		common.ObserveRequestOutcome(auditResponseSuccess(writer.Status(), writer.body.Bytes()))
	}
}
