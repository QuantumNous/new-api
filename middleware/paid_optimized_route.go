package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	paidOptimizedRouteHeader = "X-NewAPI-Route"
	paidOptimizedRouteValue  = "paid-optimized"
)

// rejectUnpaidOptimizedRoute rejects zero-ratio groups on marked paid relay
// nodes after token or dashboard authentication has populated the group context.
func rejectUnpaidOptimizedRoute(c *gin.Context) bool {
	if c.GetHeader(paidOptimizedRouteHeader) != paidOptimizedRouteValue {
		return false
	}

	common.SetContextKey(c, constant.ContextKeyPaidOptimizedRoute, true)
	userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	if common.GetContextKeyString(c, constant.ContextKeyTokenGroup) == "auto" {
		if len(service.GetUserAutoGroupForRequest(c, userGroup)) == 0 {
			abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgPaidOptimizedRouteAutoGroupDenied), types.ErrorCodeAccessDenied)
			return true
		}
		return false
	}

	usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
	if usingGroup == "" {
		usingGroup = userGroup
	}
	if service.GetUserGroupRatio(userGroup, usingGroup) <= 0 {
		abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgPaidOptimizedRouteFreeGroupDenied), types.ErrorCodeAccessDenied)
		return true
	}

	return false
}

// TokenAuthOnPaidOptimizedRoute requires token authentication only when the
// paid optimized marker is present. It keeps public relay endpoints unchanged
// on ordinary nodes while making them group-aware on the optimized node.
func TokenAuthOnPaidOptimizedRoute() func(c *gin.Context) {
	return func(c *gin.Context) {
		if c.GetHeader(paidOptimizedRouteHeader) == paidOptimizedRouteValue {
			TokenAuth()(c)
			return
		}
		c.Next()
	}
}
