package controller

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// GetTimeDynamicRatio 获取时间动态倍率配置
func GetTimeDynamicRatio(c *gin.Context) {
	setting := operation_setting.GetTimeDynamicRatioSetting()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    setting,
	})
}

// UpdateTimeDynamicRatio 更新时间动态倍率配置
func UpdateTimeDynamicRatio(c *gin.Context) {
	var req operation_setting.TimeDynamicRatioSetting
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请求参数无效: " + err.Error(),
		})
		return
	}

	// 校验规则合法性
	if errMsg := operation_setting.ValidateTimeDynamicRatioRules(req.Rules); errMsg != "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": errMsg,
		})
		return
	}

	// 使用 ConfigManager 的前缀格式保存 (time_dynamic_ratio_setting.enabled / time_dynamic_ratio_setting.rules)
	// 这样 loadOptionsFromDatabase → handleConfigUpdate 可以正确识别并反序列化到内存结构
	enabledStr := strconv.FormatBool(req.Enabled)
	rulesBytes, err := json.Marshal(req.Rules)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "序列化规则失败: " + err.Error(),
		})
		return
	}

	err = model.UpdateOption("time_dynamic_ratio_setting.enabled", enabledStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "保存全局开关失败: " + err.Error(),
		})
		return
	}

	err = model.UpdateOption("time_dynamic_ratio_setting.rules", string(rulesBytes))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "保存规则失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "保存成功",
	})
}
