package middleware

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/phuslu/log"
)

func SetUpLogger(server *gin.Engine) {
	server.Use(NewLoggerMW(&log.DefaultLogger, func(c *gin.Context) bool {
		return false
	}))
}

// NewLoggerMW FROM https://github.com/phuslu/log-contrib/blob/cb5b9b62dd6179d0ea04803b934977c8add51b4c/gin/gin.go#L10
func NewLoggerMW(logger *log.Logger, skip func(c *gin.Context) bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		if skip != nil && skip(c) {
			return
		}

		reqId := ""
		requestID, exist := c.Get(common.RequestIdKey)
		if exist {
			reqId = requestID.(string)
		}

		end := time.Now()
		latency := end.Sub(start)

		path := c.Request.URL.Path
		if c.Request.URL.RawQuery != "" {
			path = path + "?" + c.Request.URL.RawQuery
		}
		msg := "Request"
		if len(c.Errors) > 0 {
			msg = c.Errors.String()
		}
		status := c.Writer.Status()

		var e *log.Entry
		switch {
		case status >= 400 && status < 500:
			e = logger.Warn()
		case status >= 500:
			e = logger.Error()
		default:
			e = logger.Info()
		}
		e.Int("status", c.Writer.Status()).
			Str("method", c.Request.Method).
			Str("path", path).
			Str(common.RequestIdKey, reqId).
			Str("from_web", "true").
			Str("ip", c.ClientIP()).
			Dur("latency", latency).
			Str("user_agent", c.Request.UserAgent()).
			Msg(msg)
	}
}
