package middleware

import (
	"context"
	"fmt"
	"one-api/common"
	"strings"

	"github.com/gin-gonic/gin"
)

// EnableRequestBodyLogging 控制是否打印请求体
var EnableRequestBodyLogging bool = false

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 获取请求头
		headers := make(map[string]string)
		for k, v := range c.Request.Header {
			// 跳过敏感信息
			if strings.EqualFold(k, "Authorization") || strings.EqualFold(k, "Cookie") {
				headers[k] = "***"
				continue
			}
			headers[k] = strings.Join(v, ", ")
		}

		// 构建日志信息
		logInfo := fmt.Sprintf("Request: %s %s\tClient IP: %s\tHeaders: %s\t",
			c.Request.Method,
			c.Request.URL.String(),
			c.ClientIP(),
			common.FormatMap(headers),
		)

		// 如果启用了请求体日志，则记录请求体
		if EnableRequestBodyLogging && c.Request.Method != "GET" {
			bodyInfo := common.LogRequestBody(c)
			if bodyInfo != "" {
				logInfo += fmt.Sprintf("\tBody: %s", bodyInfo)
			}
		}

		// 构建全链路上下文
		requestId := c.GetString(common.RequestIdKey)
		ctx := context.WithValue(c.Request.Context(), common.RequestIdKey, requestId)
		ctx = context.WithValue(ctx, "gin_context", c)

		common.LogInfo(ctx, logInfo)

		bodyStr := common.LogRequestBody(c)
		if bodyStr != "" {
			common.LogInfo(ctx, fmt.Sprintf("request body: %s", bodyStr))
		}

		c.Next()
	}
}
