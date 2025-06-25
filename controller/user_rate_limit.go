package controller

import (
	"net/http"
	"one-api/model"

	"github.com/gin-gonic/gin"
)

// GetSpecificUserRateLimitConfig 获取特定用户的限速配置
func GetSpecificUserRateLimitConfig(c *gin.Context) {
	username := c.Query("username")
	groupName := c.Query("group_name")
	modelName := c.Query("model_name")

	if username == "" || groupName == "" || modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "用户名、分组名、模型名不能为空",
		})
		return
	}

	config, err := model.GetUserRateLimitConfig(username, groupName, modelName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "配置不存在",
		})
		return
	}

	// 只返回需要的字段
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"group_name":            config.GroupName,
			"username":              config.Username,
			"model_name":            config.ModelName,
			"current_rate_limit":    config.CurrentRateLimit,
			"is_rate_limit_enabled": config.IsRateLimitEnabled,
		},
	})
}
