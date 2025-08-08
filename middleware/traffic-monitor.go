package middleware

import (
	"one-api/common"

	"github.com/gin-gonic/gin"
)

// TrafficMonitorMiddleware Gin中间件，用于记录请求
func TrafficMonitorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 跳过健康检查和监控端点的流量统计
		path := c.Request.URL.Path
		if path == "/health" || path == "/metrics" || path == "/traffic-stats" {
			c.Next()
			return
		}

		// 记录请求开始
		common.RecordRequest()

		// 请求处理完成后记录请求结束
		c.Next()

		// 记录请求结束
		common.RecordRequestEnd()
	}
}
