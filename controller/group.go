package controller

import (
	"net/http"
	"sort"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func GetGroups(c *gin.Context) {
	// type=user returns the user identity groups (user.Group), whose authoritative
	// source is the union of plg, the topup group ratio
	// (充值分组比例), and the outer keys of the group-specific ratio (分组专属倍率
	// GroupGroupRatio). Default returns all ratio groups (model/channel pricing
	// groups), used by channel configuration.
	if c.Query("type") == "user" {
		seen := make(map[string]bool)
		userGroups := make([]string, 0)
		addGroup := func(name string) {
			name = common.NormalizeUserIdentityGroup(name)
			if name != "" && !seen[name] {
				seen[name] = true
				userGroups = append(userGroups, name)
			}
		}
		addGroup(common.PLGGroup)
		for _, name := range common.GetTopupGroupRatioKeys() {
			addGroup(name)
		}
		for _, name := range ratio_setting.GetGroupGroupRatioKeys() {
			addGroup(name)
		}
		sort.Strings(userGroups)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    userGroups,
		})
		return
	}

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

	userCache, err := model.GetUserCache(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userGroup = common.NormalizeUserIdentityGroup(userGroup)
	if !common.IsEnterpriseIdentity(userCache.Group, userCache.Role) {
		usableGroups[common.PLGGroup] = map[string]interface{}{
			"ratio": service.GetUserGroupRatio(userGroup, common.PLGGroup),
			"desc":  setting.GetUsableGroupDescription(common.PLGGroup),
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data":    usableGroups,
		})
		return
	}

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
