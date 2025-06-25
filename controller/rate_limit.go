package controller

import (
	"net/http"
	"one-api/common"
	"one-api/model"
	"one-api/setting"
	"one-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// RateLimitInfo 限速信息结构体
type RateLimitInfo struct {
	Username                             string  `json:"username"`
	Group                                string  `json:"group"`
	TokenName                            string  `json:"token_name"`
	ModelName                            string  `json:"model_name"`
	ModelRequestRateLimitEnabled         bool    `json:"model_request_rate_limit_enabled"`
	ModelRequestRateLimitCount           int     `json:"model_request_rate_limit_count"`
	ModelRequestRateLimitSuccessCount    int     `json:"model_request_rate_limit_success_count"`
	ModelRequestRateLimitDurationMinutes int     `json:"model_request_rate_limit_duration_minutes"`
	GlobalApiRateLimitEnable             bool    `json:"global_api_rate_limit_enable"`
	GlobalApiRateLimitNum                int     `json:"global_api_rate_limit_num"`
	GlobalApiRateLimitDuration           int64   `json:"global_api_rate_limit_duration"`
	GlobalWebRateLimitEnable             bool    `json:"global_web_rate_limit_enable"`
	GlobalWebRateLimitNum                int     `json:"global_web_rate_limit_num"`
	GlobalWebRateLimitDuration           int64   `json:"global_web_rate_limit_duration"`
	ModelRatio                           float64 `json:"model_ratio"`
	GroupRatio                           float64 `json:"group_ratio"`
	CompletionRatio                      float64 `json:"completion_ratio"`
	CacheRatio                           float64 `json:"cache_ratio"`
}

// GetRateLimitInfo 根据用户名、分组、tokenname、模型名查询当前限速值
func GetRateLimitInfo(c *gin.Context) {
	// 获取查询参数
	username := c.Query("username")
	group := c.Query("group")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")

	// 验证必要参数
	if username == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "用户名不能为空",
		})
		return
	}

	// 获取用户信息
	user, err := model.GetUserByUsername(username)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "用户不存在: " + err.Error(),
		})
		return
	}

	// 如果未指定分组，使用用户默认分组
	if group == "" {
		userGroup, err := model.GetUserGroup(user.Id, false)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "获取用户分组失败: " + err.Error(),
			})
			return
		}
		group = userGroup
	}

	// 构建限速信息
	rateLimitInfo := RateLimitInfo{
		Username:  username,
		Group:     group,
		TokenName: tokenName,
		ModelName: modelName,
	}

	// 获取模型请求限速配置
	rateLimitInfo.ModelRequestRateLimitEnabled = setting.ModelRequestRateLimitEnabled
	rateLimitInfo.ModelRequestRateLimitCount = setting.ModelRequestRateLimitCount
	rateLimitInfo.ModelRequestRateLimitSuccessCount = setting.ModelRequestRateLimitSuccessCount
	rateLimitInfo.ModelRequestRateLimitDurationMinutes = setting.ModelRequestRateLimitDurationMinutes

	// 获取全局API限速配置
	rateLimitInfo.GlobalApiRateLimitEnable = common.GlobalApiRateLimitEnable
	rateLimitInfo.GlobalApiRateLimitNum = common.GlobalApiRateLimitNum
	rateLimitInfo.GlobalApiRateLimitDuration = common.GlobalApiRateLimitDuration

	// 获取全局Web限速配置
	rateLimitInfo.GlobalWebRateLimitEnable = common.GlobalWebRateLimitEnable
	rateLimitInfo.GlobalWebRateLimitNum = common.GlobalWebRateLimitNum
	rateLimitInfo.GlobalWebRateLimitDuration = common.GlobalWebRateLimitDuration

	// 获取模型倍率
	if modelName != "" {
		modelRatio, success := operation_setting.GetModelRatio(modelName)
		if success {
			rateLimitInfo.ModelRatio = modelRatio
		}
	}

	// 获取分组倍率
	rateLimitInfo.GroupRatio = setting.GetGroupRatio(group)

	// 获取完成倍率
	if modelName != "" {
		rateLimitInfo.CompletionRatio = operation_setting.GetCompletionRatio(modelName)
	}

	// 获取缓存倍率
	if modelName != "" {
		cacheRatio, _ := operation_setting.GetCacheRatio(modelName)
		rateLimitInfo.CacheRatio = cacheRatio
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rateLimitInfo,
	})
}

// GetCurrentUserRateLimitInfo 获取当前用户的限速信息
func GetCurrentUserRateLimitInfo(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")

	// 获取查询参数
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")

	// 获取用户分组
	userGroup, err := model.GetUserGroup(userId, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "获取用户分组失败: " + err.Error(),
		})
		return
	}

	// 构建限速信息
	rateLimitInfo := RateLimitInfo{
		Username:  username,
		Group:     userGroup,
		TokenName: tokenName,
		ModelName: modelName,
	}

	// 获取模型请求限速配置
	rateLimitInfo.ModelRequestRateLimitEnabled = setting.ModelRequestRateLimitEnabled
	rateLimitInfo.ModelRequestRateLimitCount = setting.ModelRequestRateLimitCount
	rateLimitInfo.ModelRequestRateLimitSuccessCount = setting.ModelRequestRateLimitSuccessCount
	rateLimitInfo.ModelRequestRateLimitDurationMinutes = setting.ModelRequestRateLimitDurationMinutes

	// 获取全局API限速配置
	rateLimitInfo.GlobalApiRateLimitEnable = common.GlobalApiRateLimitEnable
	rateLimitInfo.GlobalApiRateLimitNum = common.GlobalApiRateLimitNum
	rateLimitInfo.GlobalApiRateLimitDuration = common.GlobalApiRateLimitDuration

	// 获取全局Web限速配置
	rateLimitInfo.GlobalWebRateLimitEnable = common.GlobalWebRateLimitEnable
	rateLimitInfo.GlobalWebRateLimitNum = common.GlobalWebRateLimitNum
	rateLimitInfo.GlobalWebRateLimitDuration = common.GlobalWebRateLimitDuration

	// 获取模型倍率
	if modelName != "" {
		modelRatio, success := operation_setting.GetModelRatio(modelName)
		if success {
			rateLimitInfo.ModelRatio = modelRatio
		}
	}

	// 获取分组倍率
	rateLimitInfo.GroupRatio = setting.GetGroupRatio(userGroup)

	// 获取完成倍率
	if modelName != "" {
		rateLimitInfo.CompletionRatio = operation_setting.GetCompletionRatio(modelName)
	}

	// 获取缓存倍率
	if modelName != "" {
		cacheRatio, _ := operation_setting.GetCacheRatio(modelName)
		rateLimitInfo.CacheRatio = cacheRatio
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rateLimitInfo,
	})
}
