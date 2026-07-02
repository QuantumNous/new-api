package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ---- Shared types ----

type SubscriptionPlanDTO struct {
	Plan model.SubscriptionPlan `json:"plan"`
}

type BillingPreferenceRequest struct {
	BillingPreference string `json:"billing_preference"`
}

// ---- User APIs ----

func GetSubscriptionPlans(c *gin.Context) {
	var plans []model.SubscriptionPlan
	if err := model.DB.Where("enabled = ?", true).Order("sort_order desc, id desc").Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	result := make([]SubscriptionPlanDTO, 0, len(plans))
	for _, p := range plans {
		result = append(result, SubscriptionPlanDTO{
			Plan: p,
		})
	}
	common.ApiSuccess(c, result)
}

func GetSubscriptionSelf(c *gin.Context) {
	userId := c.GetInt("id")
	settingMap, _ := model.GetUserSetting(userId, false)
	pref := common.NormalizeBillingPreference(settingMap.BillingPreference)

	now := common.GetTimestamp()

	// Get all subscriptions (including expired) with plan info
	allSubs, err := model.GetAllUserSubscriptions(userId)
	if err != nil {
		allSubs = []model.SubscriptionSummary{}
	}

	// Get usable subscriptions (active + pending_activation) with plan info
	usableSubs, err := model.GetAllUsableUserSubscriptions(userId)
	if err != nil {
		usableSubs = []model.SubscriptionSummary{}
	}

	// Get active subscriptions for backward compatibility
	activeSubs, err := model.GetAllActiveUserSubscriptions(userId)
	if err != nil {
		activeSubs = []model.SubscriptionSummary{}
	}

	// Collect all plan IDs
	planIds := make(map[int]struct{})
	for _, s := range allSubs {
		if s.Subscription != nil {
			planIds[s.Subscription.PlanId] = struct{}{}
		}
	}

	// Load plans in batch
	planIdsSlice := make([]int, 0, len(planIds))
	for pid := range planIds {
		planIdsSlice = append(planIdsSlice, pid)
	}
	plans := make(map[int]*model.SubscriptionPlan, len(planIds))
	if len(planIdsSlice) > 0 {
		var planList []model.SubscriptionPlan
		if err := model.DB.Where("id IN ?", planIdsSlice).Find(&planList).Error; err != nil {
			common.SysError("failed to batch load subscription plans: " + err.Error())
		} else {
			for i := range planList {
				plans[planList[i].Id] = &planList[i]
			}
		}
	}

	// Enrich subscriptions with plan and progress info
	type ProgressInfo struct {
		TimeElapsedSeconds   int64   `json:"time_elapsed_seconds"`
		TimeTotalSeconds     int64   `json:"time_total_seconds"`
		TimeRemainingSeconds int64   `json:"time_remaining_seconds"`
		TimePercent          float64 `json:"time_percent"`
		QuotaUsed            int64   `json:"quota_used"`
		QuotaTotal           int64   `json:"quota_total"`
		QuotaPercent         float64 `json:"quota_percent"`
	}

	type WindowUsageInfo struct {
		Used              int64 `json:"used"`
		Limit             int64 `json:"limit"`
		Since             int64 `json:"since"`
		WindowSeconds     int64 `json:"window_seconds"`
		ResetAt           int64 `json:"reset_at"`
		ResetAfterSeconds int64 `json:"reset_after_seconds"`
	}

	type EnrichedSubscription struct {
		Subscription *model.UserSubscription    `json:"subscription"`
		Plan         *model.SubscriptionPlan    `json:"plan,omitempty"`
		Progress     *ProgressInfo              `json:"progress,omitempty"`
		WindowUsage  map[string]WindowUsageInfo `json:"window_usage,omitempty"`
	}

	buildEnriched := func(summaries []model.SubscriptionSummary) []EnrichedSubscription {
		result := make([]EnrichedSubscription, 0, len(summaries))
		for _, s := range summaries {
			if s.Subscription == nil {
				continue
			}
			enriched := EnrichedSubscription{Subscription: s.Subscription}
			if plan, ok := plans[s.Subscription.PlanId]; ok {
				enriched.Plan = plan
			}
			if s.Subscription.Status == model.UserSubscriptionStatusActive {
				progress := &ProgressInfo{}
				if s.Subscription.AmountTotal > 0 {
					progress.QuotaUsed = s.Subscription.AmountUsed
					progress.QuotaTotal = s.Subscription.AmountTotal
					if s.Subscription.AmountTotal > 0 {
						progress.QuotaPercent = float64(s.Subscription.AmountUsed) / float64(s.Subscription.AmountTotal) * 100
					}
				}
				if s.Subscription.EndTime > 0 {
					startTime := s.Subscription.StartTime
					if s.Subscription.ActivatedAt > 0 {
						startTime = s.Subscription.ActivatedAt
					}
					totalDuration := s.Subscription.EndTime - startTime
					if totalDuration > 0 {
						progress.TimeTotalSeconds = totalDuration
						elapsed := now - startTime
						if elapsed < 0 {
							elapsed = 0
						}
						progress.TimeElapsedSeconds = elapsed
						progress.TimeRemainingSeconds = totalDuration - elapsed
						if progress.TimeRemainingSeconds < 0 {
							progress.TimeRemainingSeconds = 0
						}
						progress.TimePercent = float64(elapsed) / float64(totalDuration) * 100
					}
				}
				enriched.Progress = progress

				// Compute per-window usage (with cache)
				if windowData, err := model.GetWindowUsageWithCache(s.Subscription.Id); err == nil {
					enriched.WindowUsage = make(map[string]WindowUsageInfo, len(windowData))
					for k, v := range windowData {
						enriched.WindowUsage[k] = WindowUsageInfo{Used: v.Used, Limit: v.Limit, Since: v.Since, WindowSeconds: v.WindowSeconds, ResetAt: v.ResetAt, ResetAfterSeconds: v.ResetAfterSeconds}
					}
				}
			}
			result = append(result, enriched)
		}
		return result
	}

	common.ApiSuccess(c, gin.H{
		"billing_preference":   pref,
		"subscriptions":        buildEnriched(activeSubs),
		"usable_subscriptions": buildEnriched(usableSubs),
		"all_subscriptions":    buildEnriched(allSubs),
	})
}

func UpdateSubscriptionPreference(c *gin.Context) {
	userId := c.GetInt("id")
	var req BillingPreferenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	pref := common.NormalizeBillingPreference(req.BillingPreference)

	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	current := user.GetSetting()
	current.BillingPreference = pref
	user.SetSetting(current)
	if err := user.Update(false); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"billing_preference": pref})
}

type SubscriptionPriorityRequest struct {
	SubscriptionIds []int `json:"subscription_ids"`
}

// UpdateSubscriptionPriority updates subscription priority ordering.
// The request body contains subscription_ids in priority order (first = highest).
func UpdateSubscriptionPriority(c *gin.Context) {
	userId := c.GetInt("id")
	var req SubscriptionPriorityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if len(req.SubscriptionIds) == 0 {
		common.ApiSuccess(c, nil)
		return
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		for i, subId := range req.SubscriptionIds {
			priority := len(req.SubscriptionIds) - i
			if err := tx.Model(&model.UserSubscription{}).
				Where("id = ? AND user_id = ?", subId, userId).
				Update("priority", priority).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateUserActiveSubPlanCache(userId)
	common.ApiSuccess(c, nil)
}

type ToggleSubscriptionRequest struct {
	Disabled *bool `json:"disabled"`
}

// ToggleSubscriptionDisabled enables or disables a subscription for billing.
func ToggleSubscriptionDisabled(c *gin.Context) {
	userId := c.GetInt("id")
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	var req ToggleSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Disabled == nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.UserToggleSubscriptionDisabled(userId, subId, *req.Disabled); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"disabled": *req.Disabled})
}

func UserCancelSubscription(c *gin.Context) {
	userId := c.GetInt("id")
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	msg, err := model.UserInvalidateOwnSubscription(userId, subId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}

func UserDeleteSubscription(c *gin.Context) {
	userId := c.GetInt("id")
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	if err := model.UserDeleteOwnSubscription(userId, subId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---- Admin APIs ----

func AdminListSubscriptionPlans(c *gin.Context) {
	var plans []model.SubscriptionPlan
	if err := model.DB.Order("sort_order desc, id desc").Find(&plans).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	result := make([]SubscriptionPlanDTO, 0, len(plans))
	for _, p := range plans {
		result = append(result, SubscriptionPlanDTO{
			Plan: p,
		})
	}
	common.ApiSuccess(c, result)
}

type AdminUpsertSubscriptionPlanRequest struct {
	Plan model.SubscriptionPlan `json:"plan"`
}

func validateAdminSubscriptionPlan(plan *model.SubscriptionPlan) string {
	if plan == nil {
		return "参数错误"
	}
	switch plan.DurationUnit {
	case model.SubscriptionDurationYear, model.SubscriptionDurationMonth, model.SubscriptionDurationDay, model.SubscriptionDurationHour:
		if plan.DurationValue <= 0 {
			plan.DurationValue = 1
		}
	case model.SubscriptionDurationCustom:
		if plan.CustomSeconds <= 0 {
			return "自定义套餐时长需大于0秒"
		}
	default:
		return "无效的套餐时长单位"
	}
	if plan.WindowLimit5h < 0 || plan.WindowLimit24h < 0 || plan.WindowLimit7d < 0 || plan.WindowLimit30d < 0 {
		return "窗口额度不能为负数"
	}
	return ""
}

func AdminCreateSubscriptionPlan(c *gin.Context) {
	var req AdminUpsertSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	req.Plan.Id = 0
	if strings.TrimSpace(req.Plan.Title) == "" {
		common.ApiErrorMsg(c, "套餐标题不能为空")
		return
	}
	if req.Plan.PriceAmount < 0 {
		common.ApiErrorMsg(c, "价格不能为负数")
		return
	}
	if req.Plan.PriceAmount > 9999 {
		common.ApiErrorMsg(c, "价格不能超过9999")
		return
	}
	if req.Plan.Currency == "" {
		req.Plan.Currency = "USD"
	}
	req.Plan.Currency = "USD"
	if req.Plan.DurationUnit == "" {
		req.Plan.DurationUnit = model.SubscriptionDurationMonth
	}
	if msg := validateAdminSubscriptionPlan(&req.Plan); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	if req.Plan.MaxPurchasePerUser < 0 {
		common.ApiErrorMsg(c, "购买上限不能为负数")
		return
	}
	if req.Plan.TotalAmount < 0 {
		common.ApiErrorMsg(c, "总额度不能为负数")
		return
	}
	req.Plan.UpgradeGroup = strings.TrimSpace(req.Plan.UpgradeGroup)
	if req.Plan.UpgradeGroup != "" {
		if _, ok := ratio_setting.GetGroupRatioCopy()[req.Plan.UpgradeGroup]; !ok {
			common.ApiErrorMsg(c, "升级分组不存在")
			return
		}
	}
	req.Plan.AllowedGroups = strings.TrimSpace(req.Plan.AllowedGroups)
	if req.Plan.AllowedGroups != "" {
		// Validate allowed groups
		allowedGroupsList := strings.Split(req.Plan.AllowedGroups, ",")
		groupRatios := ratio_setting.GetGroupRatioCopy()
		for _, g := range allowedGroupsList {
			trimmed := strings.TrimSpace(g)
			if trimmed != "" {
				if _, ok := groupRatios[trimmed]; !ok {
					common.ApiErrorMsg(c, "允许的分组不存在: "+trimmed)
					return
				}
			}
		}
	}
	req.Plan.QuotaResetPeriod = model.NormalizeResetPeriod(req.Plan.QuotaResetPeriod)
	if req.Plan.QuotaResetPeriod == model.SubscriptionResetCustom && req.Plan.QuotaResetCustomSeconds <= 0 {
		common.ApiErrorMsg(c, "自定义重置周期需大于0秒")
		return
	}
	// Normalize activation mode
	if req.Plan.ActivationMode != model.SubscriptionActivationOnFirstUse {
		req.Plan.ActivationMode = model.SubscriptionActivationImmediate
	}
	if req.Plan.ActivationWindowSeconds < 0 {
		req.Plan.ActivationWindowSeconds = 0
	}
	err := model.DB.Create(&req.Plan).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateSubscriptionPlanCache(req.Plan.Id)
	common.ApiSuccess(c, req.Plan)
}

func AdminUpdateSubscriptionPlan(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	var req AdminUpsertSubscriptionPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if strings.TrimSpace(req.Plan.Title) == "" {
		common.ApiErrorMsg(c, "套餐标题不能为空")
		return
	}
	if req.Plan.PriceAmount < 0 {
		common.ApiErrorMsg(c, "价格不能为负数")
		return
	}
	if req.Plan.PriceAmount > 9999 {
		common.ApiErrorMsg(c, "价格不能超过9999")
		return
	}
	req.Plan.Id = id
	if req.Plan.Currency == "" {
		req.Plan.Currency = "USD"
	}
	req.Plan.Currency = "USD"
	if req.Plan.DurationUnit == "" {
		req.Plan.DurationUnit = model.SubscriptionDurationMonth
	}
	if msg := validateAdminSubscriptionPlan(&req.Plan); msg != "" {
		common.ApiErrorMsg(c, msg)
		return
	}
	if req.Plan.MaxPurchasePerUser < 0 {
		common.ApiErrorMsg(c, "购买上限不能为负数")
		return
	}
	if req.Plan.TotalAmount < 0 {
		common.ApiErrorMsg(c, "总额度不能为负数")
		return
	}
	req.Plan.UpgradeGroup = strings.TrimSpace(req.Plan.UpgradeGroup)
	if req.Plan.UpgradeGroup != "" {
		if _, ok := ratio_setting.GetGroupRatioCopy()[req.Plan.UpgradeGroup]; !ok {
			common.ApiErrorMsg(c, "升级分组不存在")
			return
		}
	}
	req.Plan.AllowedGroups = strings.TrimSpace(req.Plan.AllowedGroups)
	if req.Plan.AllowedGroups != "" {
		// Validate allowed groups
		allowedGroupsList := strings.Split(req.Plan.AllowedGroups, ",")
		groupRatios := ratio_setting.GetGroupRatioCopy()
		for _, g := range allowedGroupsList {
			trimmed := strings.TrimSpace(g)
			if trimmed != "" {
				if _, ok := groupRatios[trimmed]; !ok {
					common.ApiErrorMsg(c, "允许的分组不存在: "+trimmed)
					return
				}
			}
		}
	}
	req.Plan.QuotaResetPeriod = model.NormalizeResetPeriod(req.Plan.QuotaResetPeriod)
	if req.Plan.QuotaResetPeriod == model.SubscriptionResetCustom && req.Plan.QuotaResetCustomSeconds <= 0 {
		common.ApiErrorMsg(c, "自定义重置周期需大于0秒")
		return
	}
	// Normalize activation mode
	if req.Plan.ActivationMode != model.SubscriptionActivationOnFirstUse {
		req.Plan.ActivationMode = model.SubscriptionActivationImmediate
	}
	if req.Plan.ActivationWindowSeconds < 0 {
		req.Plan.ActivationWindowSeconds = 0
	}

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		// update plan (allow zero values updates with map)
		updateMap := map[string]interface{}{
			"title":                      req.Plan.Title,
			"subtitle":                   req.Plan.Subtitle,
			"price_amount":               req.Plan.PriceAmount,
			"currency":                   req.Plan.Currency,
			"duration_unit":              req.Plan.DurationUnit,
			"duration_value":             req.Plan.DurationValue,
			"custom_seconds":             req.Plan.CustomSeconds,
			"enabled":                    req.Plan.Enabled,
			"sort_order":                 req.Plan.SortOrder,
			"stripe_price_id":            req.Plan.StripePriceId,
			"creem_product_id":           req.Plan.CreemProductId,
			"max_purchase_per_user":      req.Plan.MaxPurchasePerUser,
			"total_amount":               req.Plan.TotalAmount,
			"upgrade_group":              req.Plan.UpgradeGroup,
			"allowed_groups":             req.Plan.AllowedGroups,
			"quota_reset_period":         req.Plan.QuotaResetPeriod,
			"quota_reset_custom_seconds": req.Plan.QuotaResetCustomSeconds,
			"activation_mode":            req.Plan.ActivationMode,
			"activation_window_seconds":  req.Plan.ActivationWindowSeconds,
			"window_limit5h":             req.Plan.WindowLimit5h,
			"window_limit24h":            req.Plan.WindowLimit24h,
			"window_limit7d":             req.Plan.WindowLimit7d,
			"window_limit30d":            req.Plan.WindowLimit30d,
			"is_recommended":             req.Plan.IsRecommended,
			"tags":                       req.Plan.Tags,
			"updated_at":                 common.GetTimestamp(),
		}
		if err := tx.Model(&model.SubscriptionPlan{}).Where("id = ?", id).Updates(updateMap).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateSubscriptionPlanCache(id)
	common.ApiSuccess(c, nil)
}

type AdminUpdateSubscriptionPlanStatusRequest struct {
	Enabled *bool `json:"enabled"`
}

func AdminUpdateSubscriptionPlanStatus(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if id <= 0 {
		common.ApiErrorMsg(c, "无效的ID")
		return
	}
	var req AdminUpdateSubscriptionPlanStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Enabled == nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if err := model.DB.Model(&model.SubscriptionPlan{}).Where("id = ?", id).Update("enabled", *req.Enabled).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	model.InvalidateSubscriptionPlanCache(id)
	common.ApiSuccess(c, nil)
}

type AdminBindSubscriptionRequest struct {
	UserId int `json:"user_id"`
	PlanId int `json:"plan_id"`
}

func AdminBindSubscription(c *gin.Context) {
	var req AdminBindSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.UserId <= 0 || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	msg, err := model.AdminBindSubscription(req.UserId, req.PlanId, "", "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}

// ---- Admin: user subscription management ----

func AdminListUserSubscriptions(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("id"))
	if userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}
	subs, err := model.GetAllUserSubscriptions(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, subs)
}

type AdminCreateUserSubscriptionRequest struct {
	PlanId int `json:"plan_id"`
}

// AdminCreateUserSubscription creates a new user subscription from a plan (no payment).
func AdminCreateUserSubscription(c *gin.Context) {
	userId, _ := strconv.Atoi(c.Param("id"))
	if userId <= 0 {
		common.ApiErrorMsg(c, "无效的用户ID")
		return
	}
	var req AdminCreateUserSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	msg, err := model.AdminBindSubscription(userId, req.PlanId, "", "")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminInvalidateUserSubscription cancels a user subscription immediately.
func AdminInvalidateUserSubscription(c *gin.Context) {
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	msg, err := model.AdminInvalidateUserSubscription(subId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminDeleteUserSubscription hard-deletes a user subscription.
func AdminDeleteUserSubscription(c *gin.Context) {
	subId, _ := strconv.Atoi(c.Param("id"))
	if subId <= 0 {
		common.ApiErrorMsg(c, "无效的订阅ID")
		return
	}
	msg, err := model.AdminDeleteUserSubscription(subId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if msg != "" {
		common.ApiSuccess(c, gin.H{"message": msg})
		return
	}
	common.ApiSuccess(c, nil)
}
