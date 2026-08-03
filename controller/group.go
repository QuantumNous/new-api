package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

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
	// Visibility selection is read-through from the database. Read the base
	// group from the same source so a stale Redis group cache cannot produce a
	// ratio/description response inconsistent with the authorization result.
	userGroup, err := model.GetUserGroup(userId, true)
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
	if !model.TokenGroupVisibilityEnabled() {
		// Flag-off is a safe compatibility mode. It must not touch the optional
		// P2 tables, because schema-first rollout intentionally creates them later.
		common.ApiSuccess(c, gin.H{"enabled": false, "policies": []model.TokenGroupVisibilityPolicy{}})
		return
	}
	policies, err := model.GetTokenGroupVisibilityPolicies()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"enabled": model.TokenGroupVisibilityEnabled(), "policies": policies})
}

func SaveTokenGroupVisibilityPolicy(c *gin.Context) {
	if !model.TokenGroupVisibilityEnabled() {
		common.ApiError(c, errors.New("令牌分组可见性功能未启用；请先完成 schema-first 部署"))
		return
	}
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
	if !model.TokenGroupVisibilityEnabled() {
		common.ApiError(c, errors.New("令牌分组可见性功能未启用；请先完成 schema-first 部署"))
		return
	}
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
	auditItems := make([]string, 0, len(request.Policies))
	for _, policy := range request.Policies {
		auditItems = append(auditItems, fmt.Sprintf("%s=%s", policy.Group, policy.Visibility))
	}
	model.RecordLog(c.GetInt("id"), model.LogTypeSystem,
		"管理员批量替换令牌分组可见性策略："+strings.Join(auditItems, ","))
	common.ApiSuccess(c, request.Policies)
}

func DeleteTokenGroupVisibilityPolicy(c *gin.Context) {
	if !model.TokenGroupVisibilityEnabled() {
		common.ApiError(c, errors.New("令牌分组可见性功能未启用；请先完成 schema-first 部署"))
		return
	}
	if err := model.DeleteTokenGroupVisibilityPolicy(c.Param("group")); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RecordLog(c.GetInt("id"), model.LogTypeSystem, "管理员删除令牌分组可见性策略："+c.Param("group"))
	common.ApiSuccess(c, nil)
}
