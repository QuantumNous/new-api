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
//
// Compatible with both auth paths:
//   - TokenAuth (relay routes): writes ContextKeyUserRole / ContextKeyUserKYCStatus
//     via userCache.WriteContext(c)
//   - UserAuth (selfRoute / subscriptionRoute): writes "role" / "id" directly
//     via authHelper, does NOT populate the KYC context keys
//
// The middleware reads ContextKey first (TokenAuth path); on miss it falls
// back to "role" + a userCache lookup keyed by "id" (UserAuth path).
func KYCRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.KYCEnabled {
			c.Next()
			return
		}

		role := readUserRole(c)
		if role >= common.RoleAdminUser {
			c.Next()
			return
		}

		kycStatus := readUserKYCStatus(c)
		if kycStatus != model.KYCStatusApproved {
			abortWithOpenAiMessage(c, http.StatusForbidden,
				common.TranslateMessage(c, i18n.MsgKycRequired),
				types.ErrorCodeKYCRequired)
			return
		}
		c.Next()
	}
}

// readUserRole returns the user's role from gin context, preferring the
// TokenAuth-written ContextKeyUserRole and falling back to the UserAuth-
// written "role" key. Returns 0 (RoleGuestUser) when neither is present.
func readUserRole(c *gin.Context) int {
	if v, ok := c.Get(string(constant.ContextKeyUserRole)); ok {
		if role, ok := v.(int); ok {
			return role
		}
	}
	return c.GetInt("role")
}

// readUserKYCStatus returns the user's kyc_status from gin context, preferring
// the TokenAuth-written ContextKeyUserKYCStatus. On miss (UserAuth path) it
// fetches via model.GetUserCache keyed by the "id" context value. Returns 0
// when no user id is set or cache lookup fails.
func readUserKYCStatus(c *gin.Context) int {
	if v, ok := c.Get(string(constant.ContextKeyUserKYCStatus)); ok {
		if status, ok := v.(int); ok {
			return status
		}
	}
	userId := c.GetInt("id")
	if userId <= 0 {
		return 0
	}
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		return 0
	}
	return userCache.KycStatus
}
