package middleware

import (
	"fmt"
	"net/url"

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
	server.Use(redactTaskArtifactAccessQuery())
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
			redactCustomDomainCallbackLogPath(param.Path),
		)
	}))
}

func redactCustomDomainCallbackLogPath(rawPath string) string {
	parsed, err := url.ParseRequestURI(rawPath)
	if err != nil {
		return rawPath
	}
	switch parsed.Path {
	case "/api/stripe/return", "/api/user/epay/return", "/api/reset_password/return", "/user/reset":
	default:
		return rawPath
	}
	query := parsed.Query()
	for _, key := range []string{"trade_no", "out_trade_no", "sign", "email", "token", "context"} {
		if query.Has(key) {
			query.Set(key, "[REDACTED]")
		}
	}
	parsed.RawQuery = query.Encode()
	return parsed.RequestURI()
}
