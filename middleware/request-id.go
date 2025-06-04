package middleware

import (
	"context"
	"one-api/common"

	"github.com/gin-gonic/gin"
)

func RequestId() func(c *gin.Context) {
	return func(c *gin.Context) {
		id := c.GetHeader(common.RequestIdKey)
		if id == "" {
			id = common.GetTimeString() + common.GetRandomString(8)
			c.Header(common.RequestIdKey, id)
		}
		c.Set(common.RequestIdKey, id)
		ctx := context.WithValue(c.Request.Context(), common.RequestIdKey, id)
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}
