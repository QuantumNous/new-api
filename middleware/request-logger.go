package middleware

import (
	"bytes"
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

		// 获取请求参数 因为param并且后面request会打印所以不在此处打印
		// var params interface{}
		if c.Request.Method == "GET" {
			// params = c.Request.URL.Query()
		} else {
			// 读取请求体
			body, err := io.ReadAll(c.Request.Body)
			if err == nil {
				// 尝试解析为JSON
				var jsonBody interface{}
				if err := json.Unmarshal(body, &jsonBody); err == nil {
					// params = jsonBody
				} else {
					// params = string(body)
				}
				// 恢复请求体
				c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
			}
		}

		// 构建日志信息
		logInfo := fmt.Sprintf("Request: %s %s\tClient IP: %s\tHeaders: %s\t",
			c.Request.Method,
			c.Request.URL.String(),
			c.ClientIP(),
			formatMap(headers),
		)

		// 如果启用了请求体日志，则记录请求体
		if EnableRequestBodyLogging {
			if c.Request.Method != "GET" {
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
		}

		common.SysLog(logInfo)
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
	switch val := v.(type) {
	case string:
		return val
	case map[string]interface{}:
		return formatMapInterface(val)
	case []interface{}:
		return formatArray(val)
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		// 去掉换行符
		return strings.ReplaceAll(string(bytes), "\n", "")
	}
}

func formatMapInterface(m map[string]interface{}) string {
	if len(m) == 0 {
		return "{}"
	}
	var pairs []string
	for k, v := range m {
		// 处理值中的换行符
		valueStr := formatValue(v)
		valueStr = strings.ReplaceAll(valueStr, "\n", "")
		pairs = append(pairs, fmt.Sprintf("%s: %s", k, valueStr))
	}
	return "{" + strings.Join(pairs, ", ") + "}"
}

func formatArray(arr []interface{}) string {
	if len(arr) == 0 {
		return "[]"
	}
	var elements []string
	for _, v := range arr {
		// 处理值中的换行符
		valueStr := formatValue(v)
		valueStr = strings.ReplaceAll(valueStr, "\n", "")
		elements = append(elements, valueStr)
	}
	return "[" + strings.Join(elements, ", ") + "]"
}
