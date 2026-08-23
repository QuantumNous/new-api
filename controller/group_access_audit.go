package controller

import (
	"net/http"
	"sort"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

type tokenGroupAccessAudit struct {
	ID                 int      `json:"id"`
	Name               string   `json:"name"`
	Status             int      `json:"status"`
	ExpiredTime        int64    `json:"expired_time"`
	RemainQuota        int      `json:"remain_quota"`
	UnlimitedQuota     bool     `json:"unlimited_quota"`
	ConfiguredGroup    string   `json:"configured_group"`
	EffectiveGroups    []string `json:"effective_groups"`
	CrossGroupRetry    bool     `json:"cross_group_retry"`
	ModelLimitsEnabled bool     `json:"model_limits_enabled"`
	ModelLimits        []string `json:"model_limits"`
	IPRestricted       bool     `json:"ip_restricted"`
	EffectiveModels    []string `json:"effective_models"`
	ConfigurationSafe  bool     `json:"configuration_safe"`
	AccessReady        bool     `json:"access_ready"`
	BlockingReasons    []string `json:"blocking_reasons"`
}

func GetUserGroupAccessAudit(c *gin.Context) {
	userID, err := strconv.Atoi(c.Param("id"))
	if err != nil || userID <= 0 {
		common.ApiErrorMsg(c, "无效的用户 ID")
		return
	}
	user, err := model.GetUserById(userID, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	usableGroupMap := service.GetUserUsableGroups(user.Group)
	usableGroups := make([]string, 0, len(usableGroupMap))
	for group := range usableGroupMap {
		usableGroups = append(usableGroups, group)
	}
	sort.Strings(usableGroups)

	abilities, err := model.GetGroupAccessAbilities(usableGroups)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokens, err := model.GetUserTokensForGroupAccessAudit(userID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokenAudits := make([]tokenGroupAccessAudit, 0, len(tokens))
	for _, token := range tokens {
		effectiveGroups := []string{user.Group}
		if token.Group == "auto" {
			effectiveGroups, _ = token.GetAutoGroups()
			if len(effectiveGroups) == 0 {
				effectiveGroups = service.GetUserAutoGroup(user.Group)
			}
		} else if token.Group != "" {
			effectiveGroups = []string{token.Group}
		}
		configurationSafe := service.IsTokenGroupAllowed(user.Group, token.Group)
		if setting.IsStrictGroupIsolationEnabled(user.Group) && (token.CrossGroupRetry || token.AutoGroups != "") {
			configurationSafe = false
		}

		effectiveGroupSet := make(map[string]struct{}, len(effectiveGroups))
		for _, group := range effectiveGroups {
			effectiveGroupSet[group] = struct{}{}
		}
		modelLimits := token.GetModelLimits()
		modelLimitSet := token.GetModelLimitsMap()
		effectiveModelSet := make(map[string]struct{})
		for _, ability := range abilities {
			if _, allowedGroup := effectiveGroupSet[ability.Group]; !allowedGroup {
				continue
			}
			if token.ModelLimitsEnabled && !modelLimitSet[ability.Model] {
				continue
			}
			effectiveModelSet[ability.Model] = struct{}{}
		}
		effectiveModels := make([]string, 0, len(effectiveModelSet))
		for modelName := range effectiveModelSet {
			effectiveModels = append(effectiveModels, modelName)
		}
		sort.Strings(effectiveModels)

		blockingReasons := make([]string, 0, 4)
		if !configurationSafe {
			blockingReasons = append(blockingReasons, "unsafe_group_configuration")
		}
		if token.Status != common.TokenStatusEnabled {
			blockingReasons = append(blockingReasons, "token_disabled")
		}
		if token.ExpiredTime != -1 && token.ExpiredTime < common.GetTimestamp() {
			blockingReasons = append(blockingReasons, "token_expired")
		}
		if !token.UnlimitedQuota && token.RemainQuota <= 0 {
			blockingReasons = append(blockingReasons, "quota_exhausted")
		}
		if len(effectiveModels) == 0 {
			blockingReasons = append(blockingReasons, "no_enabled_model")
		}
		tokenAudits = append(tokenAudits, tokenGroupAccessAudit{
			ID:                 token.Id,
			Name:               token.Name,
			Status:             token.Status,
			ExpiredTime:        token.ExpiredTime,
			RemainQuota:        token.RemainQuota,
			UnlimitedQuota:     token.UnlimitedQuota,
			ConfiguredGroup:    token.Group,
			EffectiveGroups:    effectiveGroups,
			CrossGroupRetry:    token.CrossGroupRetry,
			ModelLimitsEnabled: token.ModelLimitsEnabled,
			ModelLimits:        modelLimits,
			IPRestricted:       len(token.GetIpLimits()) > 0,
			EffectiveModels:    effectiveModels,
			ConfigurationSafe:  configurationSafe,
			AccessReady:        len(blockingReasons) == 0,
			BlockingReasons:    blockingReasons,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"user_id":          user.Id,
			"username":         user.Username,
			"user_group":       user.Group,
			"strict_isolation": setting.IsStrictGroupIsolationEnabled(user.Group),
			"usable_groups":    usableGroups,
			"tokens":           tokenAudits,
			"channel_access":   abilities,
		},
	})
}
