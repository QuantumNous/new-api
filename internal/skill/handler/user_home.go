package handler

import (
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	skillapi "github.com/QuantumNous/new-api/internal/skill/api"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillmodel "github.com/QuantumNous/new-api/internal/skill/model"
	platformmodel "github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const userHomeRailLimit = 6

type UserHomeResponse struct {
	Account             UserHomeAccountStatus    `json:"account"`
	Subscriptions       UserHomeSubscriptionInfo `json:"subscriptions"`
	Purchases           UserHomePurchaseInfo     `json:"purchases"`
	SavedSkills         []SavedSkill             `json:"saved_skills"`
	RecommendedForYou   []MarketplaceSkill       `json:"recommended_for_you"`
	NewThisWeekForYou   []MarketplaceSkill       `json:"new_this_week_for_you"`
	RecommendedCategory []string                 `json:"recommended_categories"`
	EntryPoint          enums.EntryPoint         `json:"entry_point"`
}

type UserHomeAccountStatus struct {
	BalanceQuota      int     `json:"balance_quota"`
	BalanceUSD        float64 `json:"balance_usd"`
	DisplayBalance    float64 `json:"display_balance"`
	DisplayUnit       string  `json:"display_unit"`
	UsedQuota         int     `json:"used_quota"`
	RecentTopUpsCount int64   `json:"recent_topups_count"`
	RecentTopUpsTotal float64 `json:"recent_topups_total"`
	LastTopUpAt       *int64  `json:"last_topup_at,omitempty"`
}

type UserHomeSubscriptionInfo struct {
	BillingPreference string                        `json:"billing_preference"`
	Active            []UserHomeSubscriptionSummary `json:"active"`
	All               []UserHomeSubscriptionSummary `json:"all"`
}

type UserHomeSubscriptionSummary struct {
	Subscription platformmodel.UserSubscription  `json:"subscription"`
	Plan         *platformmodel.SubscriptionPlan `json:"plan,omitempty"`
}

type UserHomePurchaseInfo struct {
	EntitledSkillIDs []string                `json:"entitled_skill_ids"`
	RecentOrders     []UserHomePurchaseOrder `json:"recent_orders"`
	SucceededCount   int64                   `json:"succeeded_count"`
}

type UserHomePurchaseOrder struct {
	OrderID      string                 `json:"order_id"`
	SkillID      string                 `json:"skill_id"`
	SkillSlug    string                 `json:"skill_slug"`
	SkillName    string                 `json:"skill_name"`
	Status       string                 `json:"status"`
	AmountUSD    float64                `json:"amount_usd"`
	Currency     string                 `json:"currency"`
	QuotaCharged int                    `json:"quota_charged"`
	Monetization enums.MonetizationType `json:"monetization_type"`
	CreatedAt    time.Time              `json:"created_at"`
	CompletedAt  *time.Time             `json:"completed_at,omitempty"`
	Entitled     bool                   `json:"entitled"`
}

// GetUserHome composes the authenticated user's wallet, subscription,
// purchase, saved, and personalized Skill recommendation status.
func GetUserHome(c *gin.Context) {
	db, ok := skillDB(c)
	if !ok {
		return
	}
	userID := c.GetInt("id")
	if userID <= 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}
	userInfo, err := marketplaceUserInfo(c, db)
	if err != nil {
		writeDBError(c, err)
		return
	}
	if userInfo.IsAnonymous || userInfo.UserID == 0 {
		skillapi.Error(c, errcodes.ErrAuthRequired, "Authentication required.", nil)
		return
	}

	account, err := loadUserHomeAccount(db, userID)
	if err != nil {
		writeDBError(c, err)
		return
	}
	subscriptions, err := loadUserHomeSubscriptions(db, userID)
	if err != nil {
		writeDBError(c, err)
		return
	}
	purchases, err := loadUserHomePurchases(db, int64(userID))
	if err != nil {
		writeDBError(c, err)
		return
	}
	saved, err := loadUserHomeSavedSkills(db, int64(userID), userHomeRailLimit)
	if err != nil {
		writeDBError(c, err)
		return
	}
	recommended, _, err := personalRecommendationSkills(db, userInfo, userHomeRailLimit)
	if err != nil {
		writeDBError(c, err)
		return
	}
	newThisWeek, categories, err := personalizedNewWeekSkills(db, userInfo, userHomeRailLimit)
	if err != nil {
		writeDBError(c, err)
		return
	}
	recommendedOut, err := marketplaceSkillsForUserHome(db, userInfo, recommended)
	if err != nil {
		writeDBError(c, err)
		return
	}
	newOut, err := marketplaceSkillsForUserHome(db, userInfo, newThisWeek)
	if err != nil {
		writeDBError(c, err)
		return
	}

	skillapi.Success(c, UserHomeResponse{
		Account:             account,
		Subscriptions:       subscriptions,
		Purchases:           purchases,
		SavedSkills:         saved,
		RecommendedForYou:   recommendedOut,
		NewThisWeekForYou:   newOut,
		RecommendedCategory: categories,
		EntryPoint:          enums.EntryPointUserHome,
	})
}

func loadUserHomeAccount(db *gorm.DB, userID int) (UserHomeAccountStatus, error) {
	var user platformmodel.User
	if err := db.Select("id", "quota", "used_quota").First(&user, "id = ?", userID).Error; err != nil {
		return UserHomeAccountStatus{}, err
	}
	status := UserHomeAccountStatus{
		BalanceQuota: user.Quota,
		BalanceUSD:   float64(user.Quota) / common.QuotaPerUnit,
		UsedQuota:    user.UsedQuota,
	}
	status.DisplayBalance, status.DisplayUnit = quotaDisplayAmount(user.Quota)

	var rows []platformmodel.TopUp
	if err := db.Where("user_id = ? AND status = ?", userID, common.TopUpStatusSuccess).
		Order("complete_time DESC, id DESC").
		Limit(20).
		Find(&rows).Error; err != nil {
		return UserHomeAccountStatus{}, err
	}
	status.RecentTopUpsCount = int64(len(rows))
	for _, row := range rows {
		status.RecentTopUpsTotal += row.Money
		if row.CompleteTime > 0 && status.LastTopUpAt == nil {
			v := row.CompleteTime
			status.LastTopUpAt = &v
		}
	}
	return status, nil
}

func quotaDisplayAmount(quota int) (float64, string) {
	switch operation_setting.GetQuotaDisplayType() {
	case operation_setting.QuotaDisplayTypeCNY:
		return float64(quota) / common.QuotaPerUnit * operation_setting.USDExchangeRate, "CNY"
	case operation_setting.QuotaDisplayTypeTokens:
		return float64(quota), "tokens"
	default:
		return float64(quota) / common.QuotaPerUnit, "USD"
	}
}

func loadUserHomeSubscriptions(db *gorm.DB, userID int) (UserHomeSubscriptionInfo, error) {
	var user platformmodel.User
	if err := db.Select("id", "setting").First(&user, "id = ?", userID).Error; err != nil {
		return UserHomeSubscriptionInfo{}, err
	}
	pref := common.NormalizeBillingPreference(user.GetSetting().BillingPreference)

	var all []platformmodel.UserSubscription
	if err := db.Where("user_id = ?", userID).Order("end_time DESC, id DESC").Find(&all).Error; err != nil {
		return UserHomeSubscriptionInfo{}, err
	}
	now := common.GetTimestamp()
	active := make([]platformmodel.UserSubscription, 0, len(all))
	for _, sub := range all {
		if sub.Status == "active" && sub.EndTime > now {
			active = append(active, sub)
		}
	}
	activeSummaries, err := attachSubscriptionPlans(db, active)
	if err != nil {
		return UserHomeSubscriptionInfo{}, err
	}
	allSummaries, err := attachSubscriptionPlans(db, all)
	if err != nil {
		return UserHomeSubscriptionInfo{}, err
	}
	return UserHomeSubscriptionInfo{
		BillingPreference: pref,
		Active:            activeSummaries,
		All:               allSummaries,
	}, nil
}

func attachSubscriptionPlans(db *gorm.DB, subs []platformmodel.UserSubscription) ([]UserHomeSubscriptionSummary, error) {
	out := make([]UserHomeSubscriptionSummary, 0, len(subs))
	if len(subs) == 0 {
		return out, nil
	}
	planIDs := make([]int, 0, len(subs))
	seen := map[int]struct{}{}
	for _, sub := range subs {
		if sub.PlanId > 0 {
			if _, ok := seen[sub.PlanId]; !ok {
				seen[sub.PlanId] = struct{}{}
				planIDs = append(planIDs, sub.PlanId)
			}
		}
	}
	plansByID := map[int]platformmodel.SubscriptionPlan{}
	if len(planIDs) > 0 {
		var plans []platformmodel.SubscriptionPlan
		if err := db.Where("id IN ?", planIDs).Find(&plans).Error; err != nil {
			return nil, err
		}
		for _, plan := range plans {
			plansByID[plan.Id] = plan
		}
	}
	for _, sub := range subs {
		item := UserHomeSubscriptionSummary{Subscription: sub}
		if plan, ok := plansByID[sub.PlanId]; ok {
			planCopy := plan
			item.Plan = &planCopy
		}
		out = append(out, item)
	}
	return out, nil
}

func loadUserHomePurchases(db *gorm.DB, userID int64) (UserHomePurchaseInfo, error) {
	var orders []skillmodel.SkillPurchaseOrder
	if err := db.Where("user_id = ?", userID).Order("created_at DESC").Limit(10).Find(&orders).Error; err != nil {
		return UserHomePurchaseInfo{}, err
	}
	var succeededCount int64
	if err := db.Model(&skillmodel.SkillPurchaseOrder{}).
		Where("user_id = ? AND status = ?", userID, skillmodel.SkillPurchaseStatusSucceeded).
		Count(&succeededCount).Error; err != nil {
		return UserHomePurchaseInfo{}, err
	}
	var entitlements []skillmodel.SkillEntitlement
	if err := db.Where("user_id = ? AND source = ?", userID, skillmodel.SkillEntitlementSourceOneTimePurchase).
		Order("granted_at DESC").Find(&entitlements).Error; err != nil {
		return UserHomePurchaseInfo{}, err
	}
	entitled := make(map[string]struct{}, len(entitlements))
	entitledIDs := make([]string, 0, len(entitlements))
	for _, e := range entitlements {
		if _, ok := entitled[e.SkillID]; !ok {
			entitled[e.SkillID] = struct{}{}
			entitledIDs = append(entitledIDs, e.SkillID)
		}
	}
	skillIDs := make([]string, 0, len(orders))
	for _, order := range orders {
		skillIDs = append(skillIDs, order.SkillID)
	}
	skillsByID, err := loadSkillsByID(db, skillIDs)
	if err != nil {
		return UserHomePurchaseInfo{}, err
	}
	recent := make([]UserHomePurchaseOrder, 0, len(orders))
	for _, order := range orders {
		s := skillsByID[order.SkillID]
		_, hasEntitlement := entitled[order.SkillID]
		recent = append(recent, UserHomePurchaseOrder{
			OrderID:      order.ID,
			SkillID:      order.SkillID,
			SkillSlug:    s.Slug,
			SkillName:    s.Name,
			Status:       order.Status,
			AmountUSD:    order.AmountUSD,
			Currency:     order.Currency,
			QuotaCharged: order.QuotaCharged,
			Monetization: order.Monetization,
			CreatedAt:    order.CreatedAt,
			CompletedAt:  order.CompletedAt,
			Entitled:     order.Status == skillmodel.SkillPurchaseStatusSucceeded && hasEntitlement,
		})
	}
	return UserHomePurchaseInfo{
		EntitledSkillIDs: entitledIDs,
		RecentOrders:     recent,
		SucceededCount:   succeededCount,
	}, nil
}

func loadSkillsByID(db *gorm.DB, ids []string) (map[string]skillmodel.Skill, error) {
	out := map[string]skillmodel.Skill{}
	if len(ids) == 0 {
		return out, nil
	}
	var skills []skillmodel.Skill
	if err := db.Select("id", "slug", "name").Where("id IN ?", ids).Find(&skills).Error; err != nil {
		return nil, err
	}
	for _, s := range skills {
		out[s.ID] = s
	}
	return out, nil
}

func loadUserHomeSavedSkills(db *gorm.DB, userID int64, limit int) ([]SavedSkill, error) {
	var rows []struct {
		SkillID          string
		Slug             string
		Name             string
		Category         string
		ShortDescription string
		SkillStatus      enums.SkillStatus
		RequiredPlan     enums.RequiredPlan
		SavedAt          time.Time
		LastUsedAt       *time.Time
		Enabled          bool
	}
	if err := db.Table("user_saved_skills AS uss").
		Select(`skills.id AS skill_id, skills.slug, skills.name, skills.category,
			skills.short_description, skills.status AS skill_status, skills.required_plan,
			uss.saved_at, ues.last_used_at, COALESCE(ues.enabled, false) AS enabled`).
		Joins("JOIN skills ON skills.id = uss.skill_id").
		Joins("LEFT JOIN user_enabled_skills AS ues ON ues.skill_id = uss.skill_id AND ues.user_id = uss.user_id AND ues.tenant_id = uss.tenant_id AND ues.removed_at IS NULL").
		Where("uss.user_id = ? AND uss.tenant_id = ? AND uss.saved = ?", userID, userID, true).
		Order("uss.saved_at DESC").
		Limit(limit).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := make([]SavedSkill, 0, len(rows))
	for _, row := range rows {
		out = append(out, SavedSkill{
			SkillID:          row.SkillID,
			Slug:             row.Slug,
			Name:             row.Name,
			Category:         row.Category,
			ShortDescription: row.ShortDescription,
			SkillStatus:      row.SkillStatus,
			RequiredPlan:     row.RequiredPlan,
			SavedAt:          row.SavedAt,
			LastUsedAt:       row.LastUsedAt,
			Enabled:          row.Enabled,
		})
	}
	return out, nil
}

func personalizedNewWeekSkills(db *gorm.DB, user marketplaceUserContext, limit int) ([]skillmodel.Skill, []string, error) {
	categoryRank, categories, err := userCategoryAffinity(db, user)
	if err != nil {
		return nil, nil, err
	}
	weekStart := time.Now().UTC().AddDate(0, 0, -7)
	query := listMarketplaceSkillsPublicQuery(db).
		Where("status = ?", enums.SkillStatusPublished).
		Where("published_at IS NOT NULL AND published_at >= ?", weekStart)
	if len(categories) > 0 {
		query = query.Where("category IN ?", categories)
	}
	enabledIDs, err := userEnabledSkillIDs(db, user.UserID)
	if err != nil {
		return nil, nil, err
	}
	if len(enabledIDs) > 0 {
		query = query.Where("id NOT IN ?", enabledIDs)
	}
	query = applyRecommendationVisibility(query, user)

	var skills []skillmodel.Skill
	if err := query.Order("published_at DESC, created_at DESC").Limit(skillapi.MaxLimit).Find(&skills).Error; err != nil {
		return nil, nil, err
	}
	if len(categoryRank) > 0 {
		sort.SliceStable(skills, func(i, j int) bool {
			leftRank := categoryRank[skills[i].Category]
			rightRank := categoryRank[skills[j].Category]
			if leftRank != rightRank {
				return leftRank < rightRank
			}
			return recommendationSkillLess(skills[i], skills[j])
		})
	}
	if len(skills) > limit {
		skills = skills[:limit]
	}
	return skills, categories, nil
}

func userCategoryAffinity(db *gorm.DB, user marketplaceUserContext) (map[string]int, []string, error) {
	var categoryRows []categoryAffinityRow
	if err := db.Table("user_enabled_skills AS ues").
		Select("skills.category AS category, COUNT(*) AS downloads").
		Joins("JOIN skills ON skills.id = ues.skill_id").
		Where("ues.user_id = ? AND ues.tenant_id = ? AND ues.enabled = ? AND ues.removed_at IS NULL", user.UserID, user.UserID, true).
		Group("skills.category").
		Order("downloads DESC, MAX(COALESCE(ues.last_used_at, ues.enabled_at)) DESC, category ASC").
		Scan(&categoryRows).Error; err != nil {
		return nil, nil, err
	}
	categoryRank := make(map[string]int, len(categoryRows))
	categories := make([]string, 0, len(categoryRows))
	for i, row := range categoryRows {
		category := strings.TrimSpace(row.Category)
		if category == "" {
			continue
		}
		categoryRank[category] = i
		categories = append(categories, category)
	}
	return categoryRank, categories, nil
}

func marketplaceSkillsForUserHome(db *gorm.DB, user marketplaceUserContext, skills []skillmodel.Skill) ([]MarketplaceSkill, error) {
	enabledBySkillID, err := marketplaceEnablementBySkillID(db, user, skills)
	if err != nil {
		return nil, err
	}
	savedBySkillID, err := marketplaceSavedBySkillID(db, user, skills)
	if err != nil {
		return nil, err
	}
	entitlementBySkillID, err := marketplaceOneTimeEntitlementBySkillID(db, user, skills)
	if err != nil {
		return nil, err
	}
	socialProof, err := loadMarketplaceSocialProof(db, skills)
	if err != nil {
		return nil, err
	}
	out := make([]MarketplaceSkill, 0, len(skills))
	for _, s := range skills {
		out = append(out, marketplaceSkillFromModel(s, user, enabledBySkillID[s.ID], savedBySkillID[s.ID], entitlementBySkillID[s.ID], socialProof[s.ID]))
	}
	return out, nil
}
