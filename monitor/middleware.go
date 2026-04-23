package monitor

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

// PrometheusMiddleware returns a Gin middleware that records HTTP request metrics.
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !Enabled() {
			c.Next()
			return
		}

		HTTPActiveConnections.Inc()
		start := time.Now()

		defer func() {
			HTTPActiveConnections.Dec()

			path := c.FullPath()
			if path == "" {
				path = "unknown"
			}
			method := c.Request.Method
			statusCode := strconv.Itoa(c.Writer.Status())
			duration := time.Since(start).Seconds()

			HTTPRequestsTotal.WithLabelValues(method, path, statusCode).Inc()
			HTTPRequestDuration.WithLabelValues(method, path, statusCode).Observe(duration)
		}()

		c.Next()
	}
}
