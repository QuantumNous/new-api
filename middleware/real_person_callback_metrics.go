package middleware

import (
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/gin-gonic/gin"
)

func RealPersonVerificationCallbackMetrics() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		perfmetrics.RecordBytePlusRealPersonCallbackStatus(c.Writer.Status())
	}
}
