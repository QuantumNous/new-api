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
	state, err := model.GetTokenGroupVisibilityState()
	if err != nil {
		// Keep the canonical degraded state in the response even when the
		// database read failed.  Administrators must see that this is a
		// database_error/degraded snapshot, never an indistinguishable empty
		// policy list; callers still receive success=false and authorization
		// remains fail-closed.
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error(), "data": state})
		return
	}
	common.ApiSuccess(c, state)
}

func SaveTokenGroupVisibilityPolicy(c *gin.Context) {
	common.ApiError(c, errors.New("单策略写入已停用，请使用带 expected_digest 的批量策略接口"))
}

func ReplaceTokenGroupVisibilityPolicies(c *gin.Context) {
	if !model.TokenGroupVisibilityEnabled() {
		common.ApiError(c, errors.New("令牌分组可见性功能未启用；请先完成 schema-first 部署"))
		return
	}
	var request struct {
		Policies       []model.TokenGroupVisibilityPolicy `json:"policies"`
		ExpectedDigest string                             `json:"expected_digest"`
		AllowEmpty     bool                               `json:"allow_empty"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	state, stateErr := model.GetTokenGroupVisibilityState()
	if stateErr != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": stateErr.Error(), "data": state})
		return
	}
	if state.Degraded || state.Mode == model.TokenGroupVisibilityModeInvalid {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌分组可见性状态降级或运行模式无效，已拒绝写入",
			"data":    state,
		})
		return
	}
	if len(request.Policies) == 0 && !request.AllowEmpty {
		if len(state.Policies) > 0 {
			common.ApiError(c, errors.New("策略列表为空；如需清空全部策略，请显式确认 allow_empty"))
			return
		}
	}
	resultingDigest, err := model.ReplaceTokenGroupVisibilityPoliciesCAS(request.Policies, request.ExpectedDigest)
	if err != nil {
		if errors.Is(err, model.ErrTokenGroupVisibilityConflict) {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": err.Error()})
			return
		}
		common.ApiError(c, err)
		return
	}
	auditItems := make([]string, 0, len(request.Policies))
	for _, policy := range request.Policies {
		auditItems = append(auditItems, fmt.Sprintf("%s=%s", policy.Group, policy.Visibility))
	}
	model.RecordLog(c.GetInt("id"), model.LogTypeSystem,
		"管理员批量替换令牌分组可见性策略："+strings.Join(auditItems, ","))
	state, err = model.GetTokenGroupVisibilityState()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error(), "data": state})
		return
	}
	// Keep a defensive check in the response path: a successful transaction
	// must be immediately readable and its digest must match the CAS result.
	if resultingDigest != state.Digest {
		common.ApiError(c, errors.New("策略写入后回读摘要不一致"))
		return
	}
	common.ApiSuccess(c, state)
}

func DeleteTokenGroupVisibilityPolicy(c *gin.Context) {
	common.ApiError(c, errors.New("单策略删除已停用，请使用带 expected_digest 的批量策略接口"))
}
