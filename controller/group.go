package controller

import (
	"net/http"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

func addGroupNames(groupSet map[string]bool, groupValues []string) {
	for _, groupValue := range groupValues {
		for _, groupName := range strings.Split(groupValue, ",") {
			groupName = strings.TrimSpace(groupName)
			if groupName != "" {
				groupSet[groupName] = true
			}
		}
	}
}

func GetGroups(c *gin.Context) {
	groupSet := map[string]bool{"default": true}
	for groupName := range ratio_setting.GetGroupRatioCopy() {
		addGroupNames(groupSet, []string{groupName})
	}
	channelGroups, err := model.GetDistinctChannelGroups()
	if err != nil {
		common.SysError("failed to get channel groups: " + err.Error())
	} else {
		addGroupNames(groupSet, channelGroups)
	}
	preparationGroups, err := model.GetDistinctChannelPreparationGroups()
	if err != nil {
		common.SysError("failed to get channel preparation groups: " + err.Error())
	} else {
		addGroupNames(groupSet, preparationGroups)
	}

	groupNames := make([]string, 0, len(groupSet))
	for groupName := range groupSet {
		if groupName != "default" {
			groupNames = append(groupNames, groupName)
		}
	}
	sort.Strings(groupNames)
	groupNames = append([]string{"default"}, groupNames...)
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
