package middleware

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

const RouteTagKey = "route_tag"

// RouteTag attaches a route category for access logging.
func RouteTag(tag string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(RouteTagKey, tag)
		c.Next()
	}
}

// SetUpLogger installs access logging that redacts query credentials without changing requests.
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
		path := param.Path
		// OAuth callbacks carry one-time codes and state in the query string.
		// Redact the log value only; the handler still needs the original query.
		if strings.HasPrefix(path, "/api/oauth/") || strings.HasPrefix(path, "/oauth/") {
			path, _, _ = strings.Cut(path, "?")
		} else {
			// RequestURI escapes the path but leaves '#' in RawQuery untouched.
			// Escape it on a copy so credentials cannot be parsed as a fragment.
			logURL := *param.Request.URL
			if _, err := url.ParseQuery(logURL.RawQuery); err != nil {
				// A malformed query cannot be safely redacted; log only the path.
				logURL.RawQuery = ""
				logURL.ForceQuery = false
			}
			logURL.RawQuery = strings.ReplaceAll(logURL.RawQuery, "#", "%23")
			path = relaycommon.SanitizeURLForLog(logURL.RequestURI())
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
	}))
}
