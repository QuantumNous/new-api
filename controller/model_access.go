package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

func resolveTokenModelAccessFromContext(c *gin.Context) (*service.ResolvedTokenModelAccess, error) {
	modelLimits := map[string]bool{}
	if value, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit); ok {
		if limits, valid := value.(map[string]bool); valid {
			modelLimits = limits
		}
	}
	modelBlacklist := map[string]bool{}
	if value, ok := common.GetContextKey(c, constant.ContextKeyTokenModelBlacklist); ok {
		if blacklist, valid := value.(map[string]bool); valid {
			modelBlacklist = blacklist
		}
	}

	userSetting, _ := common.GetContextKeyType[dto.UserSetting](c, constant.ContextKeyUserSetting)
	return service.ResolveTokenModelAccess(service.TokenModelAccessInput{
		IdentityGroup:         common.GetContextKeyString(c, constant.ContextKeyUserGroup),
		TokenGroup:            common.GetContextKeyString(c, constant.ContextKeyTokenGroup),
		AcceptUnpriced:        operation_setting.SelfUseModeEnabled || userSetting.AcceptUnsetRatioModel,
		ModelLimitsEnabled:    common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled),
		ModelLimits:           modelLimits,
		ModelBlacklistEnabled: common.GetContextKeyBool(c, constant.ContextKeyTokenModelBlacklistEnabled),
		ModelBlacklist:        modelBlacklist,
	})
}

func GetUserModelAccess(c *gin.Context) {
	user, err := model.GetUserCache(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	access, err := service.ResolveUserModelAccess(user)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, access)
}
