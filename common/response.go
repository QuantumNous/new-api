package common

import (
	"github.com/gin-gonic/gin"
)

// JSONError 统一的错误响应函数，自动处理流式请求的Content-Type重置
func JSONError(c *gin.Context, statusCode int, errorData interface{}) {
	// 检查是否已经设置了流式响应头，如果是，需要重置为JSON响应头
	if _, exists := c.Get("event_stream_headers_set"); exists {
		c.Writer.Header().Del("Content-Type")
	}
	c.JSON(statusCode, errorData)
}
