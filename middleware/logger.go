package middleware

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const RouteTagKey = "route_tag"

func RouteTag(tag string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(RouteTagKey, tag)
		c.Next()
	}
}

func SetUpLogger(server *gin.Engine) {
	server.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		var requestID string
		if param.Keys != nil {
			requestID, _ = param.Keys[common.RequestIdKey].(string)
		}
		tag, _ := param.Keys[RouteTagKey].(string)
		if tag == "" {
			tag = "web"
		}
		return fmt.Sprintf("[GIN] %s | %s | %s | %3d | %13v | %15s | %7s %s\n",
			param.TimeStamp.Format("2006/01/02 - 15:04:05"),
			tag,
			requestID,
			param.StatusCode,
			param.Latency,
			param.ClientIP,
			param.Method,
			sanitizeAccessLogPath(param.Path),
		)
	}))
}

func sanitizeAccessLogPath(path string) string {
	queryIndex := strings.IndexByte(path, '?')
	if queryIndex < 0 {
		return path
	}
	basePath := path[:queryIndex]
	values, err := url.ParseQuery(path[queryIndex+1:])
	if err != nil {
		// A malformed query must not make the logger fall back to emitting raw
		// bytes, because those bytes may still contain an invitation code.
		return basePath + "?[query-redacted]"
	}
	for key := range values {
		if strings.EqualFold(key, "invitation_code") || strings.EqualFold(key, "invite") {
			values[key] = []string{"[REDACTED]"}
		}
	}
	return basePath + "?" + values.Encode()
}
