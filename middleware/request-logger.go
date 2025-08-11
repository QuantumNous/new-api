package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
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
			formatMap(headers),
		)

		// 如果启用了请求体日志，则记录请求体
		if EnableRequestBodyLogging && c.Request.Method != "GET" {
			body, err := io.ReadAll(c.Request.Body)
			if err == nil {
				// 尝试解析为JSON
				var jsonBody interface{}
				if err := json.Unmarshal(body, &jsonBody); err == nil {
					logInfo += fmt.Sprintf("\tBody: %s", formatValue(jsonBody))
				} else {
					logInfo += fmt.Sprintf("\tBody: %s", string(body))
				}
				// 恢复请求体
				c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
			}
		}

		// 构建全链路上下文
		requestId := c.GetString(common.RequestIdKey)
		ctx := context.WithValue(c.Request.Context(), common.RequestIdKey, requestId)
		ctx = context.WithValue(ctx, "gin_context", c)

		common.LogInfo(ctx, logInfo)
		c.Next()
	}
}

func formatMap(m map[string]string) string {
	if len(m) == 0 {
		return "{}"
	}
	var pairs []string
	for k, v := range m {
		pairs = append(pairs, fmt.Sprintf("%s: %s", k, v))
	}
	return "{" + strings.Join(pairs, ", ") + "}"
}

func formatValue(v interface{}) string {
	if v == nil {
		return "null"
	}

	// 使用标准JSON格式输出，并去掉换行符
	bytes, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%v", v)
	}
	// 去掉换行符，让日志输出更紧凑
	return strings.ReplaceAll(string(bytes), "\n", "")
}
