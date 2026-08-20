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
	allGroups := make([]string, 0)
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		allGroups = append(allGroups, groupName)
	}
	groupNames := resolveVisibleGroupNames(c.GetInt("role"), c.GetString("group"), allGroups)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    groupNames,
	})
}

// resolveVisibleGroupNames 依据调用者角色决定分组下拉可选项：
// 超级管理员返回全部分组；受限管理员返回「全部分组 ∩ 可见分组」。
func resolveVisibleGroupNames(role int, userGroup string, allGroups []string) []string {
	visible, unrestricted := service.GetUserVisibleGroups(role, userGroup)
	if unrestricted {
		return allGroups
	}
	return resolveVisibleGroupNamesWithVisible(allGroups, visible)
}

func resolveVisibleGroupNamesWithVisible(allGroups, visible []string) []string {
	visibleSet := make(map[string]struct{}, len(visible))
	for _, g := range visible {
		visibleSet[g] = struct{}{}
	}
	filtered := make([]string, 0, len(allGroups))
	for _, g := range allGroups {
		if _, ok := visibleSet[g]; ok {
			filtered = append(filtered, g)
		}
	}
	return filtered
}

func GetUserGroups(c *gin.Context) {
	usableGroups := make(map[string]map[string]interface{})
	userGroup := ""
	userId := c.GetInt("id")
	userGroup, _ = model.GetUserGroup(userId, false)
	userUsableGroups := service.GetUserUsableGroups(userGroup)
	for groupName, _ := range ratio_setting.GetGroupRatioCopy() {
		// UserUsableGroups contains the groups that the user can use
		if desc, ok := userUsableGroups[groupName]; ok {
			usableGroups[groupName] = map[string]interface{}{
				"ratio": service.GetUserGroupRatio(userGroup, groupName),
				"desc":  desc,
			}
		}
	}
	if _, ok := userUsableGroups["auto"]; ok {
		usableGroups["auto"] = map[string]interface{}{
			"ratio": "自动",
			"desc":  setting.GetUsableGroupDescription("auto"),
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    usableGroups,
	})
}
