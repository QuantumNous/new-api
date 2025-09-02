package controller

import (
	"encoding/json"
	"net/http"
	"one-api/common"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetPricing(c *gin.Context) {
	// 检查模型广场访问权限
	if !checkPricingAccess(c) {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "需要登录才能访问模型广场",
		})
		return
	}

	pricing := model.GetPricing()
	userId, exists := c.Get("id")
	usableGroup := map[string]string{}
	groupRatio := map[string]float64{}
	for s, f := range ratio_setting.GetGroupRatioCopy() {
		groupRatio[s] = f
	}
	var group string
	if exists {
		user, err := model.GetUserCache(userId.(int))
		if err == nil {
			group = user.Group
			for g := range groupRatio {
				ratio, ok := ratio_setting.GetGroupGroupRatio(group, g)
				if ok {
					groupRatio[g] = ratio
				}
			}
		}
	}

	usableGroup = setting.GetUserUsableGroups(group)
	// check groupRatio contains usableGroup
	for group := range ratio_setting.GetGroupRatioCopy() {
		if _, ok := usableGroup[group]; !ok {
			delete(groupRatio, group)
		}
	}

	c.JSON(200, gin.H{
		"success":            true,
		"data":               pricing,
		"vendors":            model.GetVendors(),
		"group_ratio":        groupRatio,
		"usable_group":       usableGroup,
		"supported_endpoint": model.GetSupportedEndpointMap(),
		"auto_groups":        setting.AutoGroups,
	})
}

// checkPricingAccess 检查用户是否有权限访问模型广场
func checkPricingAccess(c *gin.Context) bool {
	// 获取顶栏模块配置
	common.OptionMapRWMutex.RLock()
	headerNavModulesRaw, exists := common.OptionMap["HeaderNavModules"]
	common.OptionMapRWMutex.RUnlock()

	if !exists || headerNavModulesRaw == "" {
		// 如果没有配置，默认允许访问
		return true
	}

	// 解析配置
	var config map[string]interface{}
	if err := json.Unmarshal([]byte(headerNavModulesRaw), &config); err != nil {
		// 解析失败时采用安全优先策略，拒绝访问
		return false
	}

	// 检查pricing模块配置
	pricingConfig, hasPricing := config["pricing"]
	if !hasPricing {
		// 如果没有pricing配置，默认允许访问
		return true
	}

	// 检查模块是否启用
	if !isPricingModuleEnabled(pricingConfig) {
		return false
	}

	// 检查是否需要登录
	if isPricingRequireAuth(pricingConfig) {
		// 需要登录，检查用户是否已登录
		userId, exists := c.Get("id")
		if !exists || userId == nil {
			return false // 用户未登录
		}

		// 从数据库获取用户信息验证角色
		user, err := model.GetUserById(userId.(int), false)
		if err != nil {
			return false // 获取用户信息失败
		}

		return user.Role >= common.RoleCommonUser
	}

	// 不需要登录，允许访问
	return true
}

// isPricingModuleEnabled 检查pricing模块是否启用
func isPricingModuleEnabled(moduleValue interface{}) bool {
	switch v := moduleValue.(type) {
	case bool:
		return v
	case map[string]interface{}:
		if enabled, hasEnabled := v["enabled"]; hasEnabled {
			if enabledBool, ok := enabled.(bool); ok {
				return enabledBool
			}
		}
		return true // 如果没有enabled字段，默认启用
	default:
		return true
	}
}

// isPricingRequireAuth 检查pricing模块是否需要登录
func isPricingRequireAuth(moduleValue interface{}) bool {
	if objValue, ok := moduleValue.(map[string]interface{}); ok {
		if requireAuth, hasRequireAuth := objValue["requireAuth"]; hasRequireAuth {
			if requireAuthBool, ok := requireAuth.(bool); ok {
				return requireAuthBool
			}
		}
	}
	// 默认不需要登录
	return false
}

func ResetModelRatio(c *gin.Context) {
	defaultStr := ratio_setting.DefaultModelRatio2JSONString()
	err := model.UpdateOption("ModelRatio", defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	err = ratio_setting.UpdateModelRatioByJSONString(defaultStr)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "重置模型倍率成功",
	})
}
