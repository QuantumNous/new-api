package middleware

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const affiliateScopeContextKey = "affiliate_scope"

func AffiliateAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		userId := c.GetInt("id")
		role := c.GetInt("role")
		if role == common.RoleRootUser || role == common.RoleAdminUser {
			c.Set(affiliateScopeContextKey, service.ResolveAffiliateAccessScope(service.AffiliateScopeInput{
				UserId: userId,
				Role:   role,
			}))
			c.Next()
			return
		}

		if !common.AffiliateEnabled {
			common.ApiErrorMsg(c, "分销模块未启用")
			c.Abort()
			return
		}
		if model.DB == nil {
			common.ApiErrorMsg(c, "分销数据未初始化")
			c.Abort()
			return
		}

		var profile model.AffiliateProfile
		err := model.DB.
			Where("user_id = ? AND status = ?", userId, model.AffiliateProfileStatusActive).
			First(&profile).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "分销功能未开通")
			c.Abort()
			return
		}
		if err != nil {
			common.ApiError(c, err)
			c.Abort()
			return
		}

		scope := service.ResolveAffiliateAccessScope(service.AffiliateScopeInput{
			UserId:        userId,
			Role:          role,
			ProfileStatus: profile.Status,
			ProfileLevel:  profile.Level,
		})
		if scope.Kind != service.AffiliateScopeAffiliate {
			common.ApiErrorMsg(c, "分销功能未开通")
			c.Abort()
			return
		}
		c.Set(affiliateScopeContextKey, scope)
		c.Next()
	}
}
