package middleware

import (
	"fmt"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
)

const RouteTagKey = "route_tag"

func RouteTag(tag string) contract.Middleware {
	return func(c contract.Context) {
		c.Set(RouteTagKey, tag)
		c.Next()
	}
}

func SetUpLogger(server contract.Engine) {
	server.UseRequestLog(func(entry contract.RequestLog) string {
		var requestID string
		if entry.Values != nil {
			requestID, _ = entry.Values[common.RequestIdKey].(string)
		}
		tag, _ := entry.Values[RouteTagKey].(string)
		if tag == "" {
			tag = "web"
		}
		return fmt.Sprintf("[FIBER] %s | %s | %s | %3d | %13v | %15s | %7s %s\n",
			entry.Timestamp.Format("2006/01/02 - 15:04:05"),
			tag,
			requestID,
			entry.StatusCode,
			entry.Latency,
			entry.ClientIP,
			entry.Method,
			entry.Path,
		)
	})
}
