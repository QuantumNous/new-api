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

// defaultUserGroup is the system default identity group assigned to every newly
// registered user. It mirrors the `default:'default'` column default on
// model.User.Group (model/user.go). It is always an assignable group even when an
// admin has not listed it in any ratio config, so the user-edit picker can always
// represent a freshly registered user's group.
const defaultUserGroup = "default"

// plgGroup is the single group assigned to PLG users. New users default into it, the
// group concept is hidden from them in the UI, and the backend forces their tokens
// onto it. Shared across the controller package (group.go, token.go).
const plgGroup = "plg"

func userCanUseGroups(userId int) (bool, error) {
	userGroup, err := model.GetUserGroup(userId, true)
	if err != nil {
		return false, err
	}
	return userGroup != "" && userGroup != plgGroup, nil
}

func GetGroups(c *gin.Context) {
	// type=user returns the user identity groups (user.Group), whose authoritative
	// source is the union of the system default group, the topup group ratio
	// (充值分组比例), and the outer keys of the group-specific ratio (分组专属倍率
	// GroupGroupRatio). This mirrors the system-settings group-ratio editor, which
	// treats a parent user group as valid if it is configured in either place — a
	// customer may isolate rates purely via GroupGroupRatio without ever touching
	// TopupGroupRatio. The system default is always included so newly registered
	// users (group=default) remain a selectable option. Used by the admin user-edit
	// form. Default returns all ratio groups (model/channel pricing groups), used by
	// channel configuration.
	if c.Query("type") == "user" {
		seen := make(map[string]bool)
		userGroups := make([]string, 0)
		addGroup := func(name string) {
			if name != "" && !seen[name] {
				seen[name] = true
				userGroups = append(userGroups, name)
			}
		}
		addGroup(defaultUserGroup)
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
	userGroup, _ = model.GetUserGroup(userId, true)

	// PLG users never see the group concept — they only ever get the single plg group.
	// Any non-plg user group keeps full usable-group resolution.
	canUseGroups, err := userCanUseGroups(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !canUseGroups {
		usableGroups[plgGroup] = map[string]interface{}{
			"ratio": service.GetUserGroupRatio(userGroup, plgGroup),
			"desc":  setting.GetUsableGroupDescription(plgGroup),
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
