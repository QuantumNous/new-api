package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Group Rules CRUD
// ---------------------------------------------------------------------------

func GetModelQuotaGroupRules(c *gin.Context) {
	groupName := c.Query("group_name")

	query := model.DB.Model(&model.ModelQuotaGroupRule{})
	if groupName != "" {
		query = query.Where("group_name = ?", groupName)
	}
	query = query.Order("sort_order ASC, id ASC")

	var total int64
	query.Count(&total)

	pageInfo := common.GetPageQuery(c)
	var items []*model.ModelQuotaGroupRule
	query.Offset(pageInfo.GetStartIdx()).Limit(pageInfo.GetPageSize()).Find(&items)

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreateModelQuotaGroupRule(c *gin.Context) {
	var rule model.ModelQuotaGroupRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		common.ApiError(c, err)
		return
	}

	// Validate
	if rule.GroupName == "" || rule.ModelPattern == "" {
		common.ApiErrorMsg(c, "group_name and model_pattern are required")
		return
	}
	if rule.MatchMode == "" {
		rule.MatchMode = model.ModelQuotaMatchModeExact
	}
	if rule.Period == "" {
		rule.Period = model.ModelQuotaPeriodTotal
	}
	if rule.QuotaLimit <= 0 {
		common.ApiErrorMsg(c, "quota_limit must be positive")
		return
	}
	// Default enabled to true for new rules
	rule.Enabled = true

	if err := model.DB.Create(&rule).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rule)
}

func UpdateModelQuotaGroupRule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}

	var updates model.ModelQuotaGroupRule
	if err := c.ShouldBindJSON(&updates); err != nil {
		common.ApiError(c, err)
		return
	}

	result := model.DB.Model(&model.ModelQuotaGroupRule{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"group_name":    updates.GroupName,
			"model_pattern": updates.ModelPattern,
			"match_mode":    updates.MatchMode,
			"period":        updates.Period,
			"quota_limit":   updates.QuotaLimit,
			"enabled":       updates.Enabled,
			"sort_order":    updates.SortOrder,
		})
	if result.Error != nil {
		common.ApiError(c, result.Error)
		return
	}
	// Sync the new quota_limit to all existing active user usage records
	if updates.QuotaLimit > 0 {
		_ = model.SyncUserModelQuotaLimitByRule(id, model.ModelQuotaRuleSourceGroup, updates.QuotaLimit)
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

func DeleteModelQuotaGroupRule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DB.Delete(&model.ModelQuotaGroupRule{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	// Cascade: delete all user usage snapshots for this rule so deleted rules
	// stop blocking users immediately
	_ = model.DeleteUserModelQuotaUsageByRule(id, model.ModelQuotaRuleSourceGroup)
	common.ApiSuccess(c, gin.H{"id": id})
}

// ---------------------------------------------------------------------------
// Plan Rules CRUD
// ---------------------------------------------------------------------------

func GetModelQuotaPlanRules(c *gin.Context) {
	planIdStr := c.Query("plan_id")
	planId, _ := strconv.Atoi(planIdStr)

	query := model.DB.Model(&model.ModelQuotaPlanRule{})
	if planId > 0 {
		query = query.Where("plan_id = ?", planId)
	}
	query = query.Order("sort_order ASC, id ASC")

	var total int64
	query.Count(&total)

	pageInfo := common.GetPageQuery(c)
	var items []*model.ModelQuotaPlanRule
	query.Offset(pageInfo.GetStartIdx()).Limit(pageInfo.GetPageSize()).Find(&items)

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func CreateModelQuotaPlanRule(c *gin.Context) {
	var rule model.ModelQuotaPlanRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		common.ApiError(c, err)
		return
	}

	if rule.PlanId == 0 || rule.ModelPattern == "" {
		common.ApiErrorMsg(c, "plan_id and model_pattern are required")
		return
	}
	if rule.MatchMode == "" {
		rule.MatchMode = model.ModelQuotaMatchModeExact
	}
	if rule.QuotaLimit <= 0 {
		common.ApiErrorMsg(c, "quota_limit must be positive")
		return
	}
	rule.Enabled = true

	if err := model.DB.Create(&rule).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, rule)
}

func UpdateModelQuotaPlanRule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}

	var updates model.ModelQuotaPlanRule
	if err := c.ShouldBindJSON(&updates); err != nil {
		common.ApiError(c, err)
		return
	}

	result := model.DB.Model(&model.ModelQuotaPlanRule{}).Where("id = ?", id).
		Updates(map[string]interface{}{
			"plan_id":       updates.PlanId,
			"model_pattern": updates.ModelPattern,
			"match_mode":    updates.MatchMode,
			"quota_limit":   updates.QuotaLimit,
			"enabled":       updates.Enabled,
			"sort_order":    updates.SortOrder,
		})
	if result.Error != nil {
		common.ApiError(c, result.Error)
		return
	}
	if updates.QuotaLimit > 0 {
		_ = model.SyncUserModelQuotaLimitByRule(id, model.ModelQuotaRuleSourcePlan, updates.QuotaLimit)
	}
	common.ApiSuccess(c, gin.H{"id": id})
}

func DeleteModelQuotaPlanRule(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}
	if err := model.DB.Delete(&model.ModelQuotaPlanRule{}, id).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	_ = model.DeleteUserModelQuotaUsageByRule(id, model.ModelQuotaRuleSourcePlan)
	common.ApiSuccess(c, gin.H{"id": id})
}

// ---------------------------------------------------------------------------
// User Usage Query & Reset
// ---------------------------------------------------------------------------

func GetUserModelQuotaUsage(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Query("user_id"))
	if userId == 0 {
		common.ApiErrorMsg(c, "user_id is required")
		return
	}

	usages, err := model.GetUserModelQuotaUsageByUserId(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	// Enrich with quota_remain and usage_percent
	type usageWithExtra struct {
		*model.UserModelQuotaUsage
		QuotaRemain  int64   `json:"quota_remain"`
		UsagePercent float64 `json:"usage_percent"`
	}

	var items []*usageWithExtra
	for _, u := range usages {
		remain := u.QuotaLimit - u.QuotaUsed
		percent := 0.0
		if u.QuotaLimit > 0 {
			percent = float64(u.QuotaUsed) / float64(u.QuotaLimit) * 100
		}
		items = append(items, &usageWithExtra{
			UserModelQuotaUsage: u,
			QuotaRemain:         remain,
			UsagePercent:        percent,
		})
	}

	common.ApiSuccess(c, gin.H{"items": items})
}

func ResetUserModelQuotaUsage(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id == 0 {
		common.ApiErrorMsg(c, "invalid id")
		return
	}

	if err := model.ResetUserModelQuotaUsage(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"id": id})
}
