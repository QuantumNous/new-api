package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	groupNames := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		groupNames = append(groupNames, groupName)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	userUsableGroups := service.GetUserUsableGroups(userGroup)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		// UserUsableGroups contains the groups that the user can use
		if _, ok := userUsableGroups[groupName]; ok {
			groupInfo := map[string]interface{}{
				"ratio": service.GetUserGroupRatio(userGroup, groupName),
				"desc":  ratio_setting.GetGroupDescription(groupName), // 从分组倍率设置获取描述
			}
			// 添加分组限制信息
			if setting.GroupLimitEnabled {
				limitConfig := setting.GetGroupLimitConfig(groupName)
				groupInfo["concurrency"] = limitConfig.Concurrency
				groupInfo["rpm"] = limitConfig.RPM
				groupInfo["rpd"] = limitConfig.RPD
				groupInfo["tpm"] = limitConfig.TPM
				groupInfo["tpd"] = limitConfig.TPD
			}
			usableGroups[groupName] = groupInfo
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		groupInfo := map[string]interface{}{
			"ratio": "自动",
			"desc":  ratio_setting.GetGroupDescription("auto"), // 从分组倍率设置获取描述
		}
		// auto 分组也添加限制信息（使用用户当前分组的限制）
		if setting.GroupLimitEnabled {
			limitConfig := setting.GetGroupLimitConfig(userGroup)
			groupInfo["concurrency"] = limitConfig.Concurrency
			groupInfo["rpm"] = limitConfig.RPM
			groupInfo["rpd"] = limitConfig.RPD
			groupInfo["tpm"] = limitConfig.TPM
			groupInfo["tpd"] = limitConfig.TPD
		}
		usableGroups["auto"] = groupInfo
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
