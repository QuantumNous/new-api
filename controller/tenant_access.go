package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

const tenantAccessDeniedMessage = "用户不存在或无权访问"

func requireTenantAccess(c *gin.Context, tenantId int) bool {
	if model.TenantScopeFromContext(c).AllowsTenant(tenantId) {
		return true
	}
	common.ApiErrorMsg(c, tenantAccessDeniedMessage)
	return false
}

func requireUserTenantAccess(c *gin.Context, user *model.User) bool {
	if user == nil {
		common.ApiErrorMsg(c, tenantAccessDeniedMessage)
		return false
	}
	return requireTenantAccess(c, user.TenantId)
}

func requireChannelTenantAccess(c *gin.Context, channel *model.Channel) bool {
	if channel == nil {
		common.ApiErrorMsg(c, tenantAccessDeniedMessage)
		return false
	}
	return requireTenantAccess(c, channel.TenantId)
}

func requireChannelsTenantAccess(c *gin.Context, channels []*model.Channel) bool {
	scope := model.TenantScopeFromContext(c)
	for _, channel := range channels {
		if channel == nil || !scope.AllowsTenant(channel.TenantId) {
			common.ApiErrorMsg(c, tenantAccessDeniedMessage)
			return false
		}
	}
	return true
}

func requireRedemptionTenantAccess(c *gin.Context, redemption *model.Redemption) bool {
	if redemption == nil {
		common.ApiErrorMsg(c, tenantAccessDeniedMessage)
		return false
	}
	return requireTenantAccess(c, redemption.TenantId)
}
