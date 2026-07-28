package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
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
	userId := c.GetInt("id")
	userGroup, err := model.GetUserGroup(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userUsableGroups, err := service.GetUserSelectableTokenGroups(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	usableGroups := make(map[string]map[string]interface{})
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

func GetTokenGroupVisibilityPolicies(c *gin.Context) {
	policies, err := model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"enabled": model.TokenGroupVisibilityEnabled(), "policies": policies})
}

func SaveTokenGroupVisibilityPolicy(c *gin.Context) {
	var policy model.TokenGroupVisibilityPolicy
	if err := c.ShouldBindJSON(&policy); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.SaveTokenGroupVisibilityPolicy(policy); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(c.GetInt("id"), model.LogTypeSystem, "管理员更新令牌分组可见性策略："+policy.Group)
	common.ApiSuccess(c, policy)
}

func ReplaceTokenGroupVisibilityPolicies(c *gin.Context) {
	var request struct {
		Policies []model.TokenGroupVisibilityPolicy `json:"policies"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ReplaceTokenGroupVisibilityPolicies(request.Policies); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(c.GetInt("id"), model.LogTypeSystem, "管理员批量替换令牌分组可见性策略")
	common.ApiSuccess(c, request.Policies)
}

func DeleteTokenGroupVisibilityPolicy(c *gin.Context) {
	if err := model.DeleteTokenGroupVisibilityPolicy(c.Param("group")); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(c.GetInt("id"), model.LogTypeSystem, "管理员删除令牌分组可见性策略："+c.Param("group"))
	common.ApiSuccess(c, nil)
}
