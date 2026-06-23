package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func PermissionAuth(permissions ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		ok, err := model.UserHasAnyPermission(c.GetInt("id"), c.GetInt("role"), permissions...)
		if err != nil {
			common.ApiError(c, err)
			c.Abort()
			return
		}
		if !ok {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": common.TranslateMessage(c, i18n.MsgAuthInsufficientPrivilege),
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
