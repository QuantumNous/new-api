package middleware

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
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
	server.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Output: common.LogWriter,
		Formatter: func(param gin.LogFormatterParams) string {
			var requestID string
			if param.Keys != nil {
				requestID, _ = param.Keys[common.RequestIdKey].(string)
			}
			tag, _ := param.Keys[RouteTagKey].(string)
			if tag == "" {
				tag = "web"
			}
			path := param.Path
			// OAuth callbacks carry one-time codes and state in the query string.
			// Redact the log value only; the handler still needs the original query.
			if strings.HasPrefix(path, "/api/oauth/") || strings.HasPrefix(path, "/oauth/") {
				path, _, _ = strings.Cut(path, "?")
			} else if param.Request.URL.RawQuery != "" {
				query := param.Request.URL.Query().Encode()
				path = param.Request.URL.EscapedPath() + relaycommon.SanitizeURLForLog("?"+query)
			} else {
				// param.Path keeps the query the request arrived with, including a
				// credential a handler took out of it, as the Gemini API routes do
				// with ?key=.
				path = param.Request.URL.Path
			}
			return fmt.Sprintf("[GIN] %s | %s | %s | %3d | %13v | %15s | %7s %s\n",
				param.TimeStamp.Format("2006/01/02 - 15:04:05"),
				tag,
				requestID,
				param.StatusCode,
				param.Latency,
				param.ClientIP,
				param.Method,
				path,
			)
		},
	}))
}
