package middleware

import (
	"fmt"
	"net/http"
	"runtime/debug"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func RelayPanicRecover() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				reqID := c.GetString(common.RequestIdKey)
				common.SysLog(fmt.Sprintf("panic detected request_id=%s: %v", reqID, err))
				common.SysLog(fmt.Sprintf("stacktrace from panic: %s", string(debug.Stack())))
				msg := "Internal server error"
				if reqID != "" {
					msg = fmt.Sprintf("Internal server error (request_id=%s)", reqID)
				}
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": gin.H{
						"message": msg,
						"type":    "new_api_panic",
					},
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}
