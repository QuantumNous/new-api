package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// KYCRequired checks that the authenticated user has passed KYC when
// KYCEnabled is true. Admin and Root users are always allowed through.
// Must run after TokenAuth() so that ContextKeyUserRole and
// ContextKeyUserKYCStatus are already written to context.
func KYCRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.KYCEnabled {
			c.Next()
			return
		}
		// Admin (role=10) and Root (role=100) are exempt.
		// role is written by TokenAuth → userCache.WriteContext via ContextKeyUserRole.
		role := c.GetInt(string(constant.ContextKeyUserRole))
		if role >= common.RoleAdminUser {
			c.Next()
			return
		}
		kycStatus := c.GetInt(string(constant.ContextKeyUserKYCStatus))
		if kycStatus != model.KYCStatusApproved {
			abortWithOpenAiMessage(c, http.StatusForbidden,
				common.TranslateMessage(c, i18n.MsgKycRequired),
				types.ErrorCodeKYCRequired)
			return
		}
		c.Next()
	}
}
