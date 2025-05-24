package middleware

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"one-api/common"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	maxSize = 1024
)

func SetUpLogger(server *gin.Engine) {
	server.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		var requestID string
		if param.Keys != nil {
			requestID = param.Keys[common.RequestIdKey].(string)
		}

		logStr := fmt.Sprintf("[GIN] %s | %s | %3d | %13v | %15s | %7s %s\n",
			param.TimeStamp.Format("2006/01/02 - 15:04:05"),
			requestID,
			param.StatusCode,
			param.Latency,
			param.ClientIP,
			param.Method,
			param.Path,
		)

		logStr += requestLog(param)
		logStr += responseLog(param)

		return logStr
	}))

	// add a middleware to log the response body when gin detail enabled
	server.Use(func(c *gin.Context) {
		c = common.WrapWriter(c)
		c.Next()
	})
}

func requestLog(param gin.LogFormatterParams) string {
	if !common.DebugEnabled || param.Request.Body == nil {
		return ""
	}

	requestBody, ok := param.Keys[common.KeyRequestBody]
	if !ok {
		return ""
	}
	bodyBytes, ok := requestBody.([]byte)
	if !ok {
		return ""
	}
	if len(bodyBytes) > maxSize {
		bodyBytes = append(bodyBytes[:maxSize], []byte("...")...)
	}
	return fmt.Sprintf("Req: %s\n", string(bodyBytes))
}

func responseLog(param gin.LogFormatterParams) string {
	if !common.DebugEnabled {
		return ""
	}
	blw, ok := param.Keys[common.KeyResponseWriter].(common.BodyLogWriter)
	if !ok {
		return ""
	}
	body := blw.String()
	// decompressed gzip response body
	if strings.Contains(param.Request.Header.Get("Accept-Encoding"), "gzip") {
		if reader, err := gzip.NewReader(bytes.NewReader([]byte(body))); err == nil {
			if decompressed, err := io.ReadAll(reader); err == nil {
				body = string(decompressed)
			}
		}
	}

	if len(body) > maxSize {
		body = string(body[:maxSize]) + "..."
	}
	return fmt.Sprintf("Res: %s\n", body)
}
