package middleware

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func CaptureClientIdentity() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(common.ClientIdentityContextKey, common.IdentifyClient(c.Request.UserAgent()))
		c.Next()
	}
}
