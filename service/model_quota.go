package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ModelQuotaCheckResult holds the result of a model quota check
type ModelQuotaCheckResult struct {
	Passed       bool
	UsageIds     []int  // usage IDs that were checked/matched
	ErrorMessage string // if not passed, the reason
}

// matchModel checks if modelName matches the pattern based on mode
func matchModel(modelName, pattern, mode string) bool {
	switch mode {
	case model.ModelQuotaMatchModeExact:
		return modelName == pattern
	case model.ModelQuotaMatchModePrefix:
		return strings.HasPrefix(modelName, pattern)
	}
	return false
}

// matchedRule is an internal struct that unifies group and plan rules
type matchedRule struct {
	RuleId       int
	RuleSource   string
	ModelPattern string
	MatchMode    string
	QuotaLimit   int64
	Period       string // for group rules: daily/weekly/monthly/total; for plan rules: "subscription"
}

// calculatePeriodBounds calculates the period start/end timestamps based on period type.
// For subscription period, it uses the subscription's start/end time.
func calculatePeriodBounds(period string, subStartTime, subEndTime int64) (int64, int64) {
	now := time.Now()

	switch period {
	case model.ModelQuotaPeriodDaily:
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		return start.Unix(), start.AddDate(0, 0, 1).Unix()

	case model.ModelQuotaPeriodWeekly:
		// Week starts on Monday
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7 // Sunday = 7
		}
		start := time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, now.Location())
		return start.Unix(), start.AddDate(0, 0, 7).Unix()

	case model.ModelQuotaPeriodMonthly:
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		return start.Unix(), start.AddDate(0, 1, 0).Unix()

	case model.ModelQuotaPeriodTotal:
		// Total limit: very long period (effectively never resets)
		return 0, time.Date(2099, 1, 1, 0, 0, 0, 0, time.UTC).Unix()

	default:
		// Default: monthly
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		return start.Unix(), start.AddDate(0, 1, 0).Unix()
	}
}

// userActivePlanInfo holds the user's active subscription info for plan rule matching
type userActivePlanInfo struct {
	PlanId         int
	SubscriptionId int
	StartTime      int64
	EndTime        int64
}

// getUserActivePlanInfo queries the user's first active subscription to get plan info.
func getUserActivePlanInfo(userId int) *userActivePlanInfo {
	subs, err := model.GetAllActiveUserSubscriptions(userId)
	if err != nil || len(subs) == 0 {
		return nil
	}
	for _, s := range subs {
		if s.Subscription == nil {
			continue
		}
		return &userActivePlanInfo{
			PlanId:         s.Subscription.PlanId,
			SubscriptionId: int(s.Subscription.Id),
			StartTime:      s.Subscription.StartTime,
			EndTime:        s.Subscription.EndTime,
		}
	}
	return nil
}

// FindMatchingModelQuotaRules finds all rules that match the given model for the user.
// It queries both plan rules (if user has active subscription) and group rules.
func FindMatchingModelQuotaRules(userId int, modelName string, userGroup string, planInfo *userActivePlanInfo) []*matchedRule {
	var matched []*matchedRule

	// 1. Check existing active usages first (they are snapshots of rules already matched)
	usages, err := model.GetActiveUserModelQuotaUsage(userId)
	if err == nil {
		for _, u := range usages {
			if matchModel(modelName, u.ModelPattern, model.ModelQuotaMatchModeExact) ||
				matchModel(modelName, u.ModelPattern, model.ModelQuotaMatchModePrefix) {
				matched = append(matched, &matchedRule{
					RuleId:       u.RuleId,
					RuleSource:   u.RuleSource,
					ModelPattern: u.ModelPattern,
					MatchMode:    model.ModelQuotaMatchModeExact, // usage is already matched
					QuotaLimit:   u.QuotaLimit,
					Period:       getPeriodForUsage(u),
				})
			}
		}
	}

	// 2. Check plan rules (if user has an active subscription)
	if planInfo != nil && planInfo.PlanId > 0 {
		planRules, err := model.GetModelQuotaPlanRulesByPlanId(planInfo.PlanId)
		if err == nil {
			for _, r := range planRules {
				if matchModel(modelName, r.ModelPattern, r.MatchMode) {
					alreadyMatched := false
					for _, m := range matched {
						if m.RuleId == r.Id && m.RuleSource == model.ModelQuotaRuleSourcePlan {
							alreadyMatched = true
							break
						}
					}
					if !alreadyMatched {
						matched = append(matched, &matchedRule{
							RuleId: r.Id, RuleSource: model.ModelQuotaRuleSourcePlan,
							ModelPattern: r.ModelPattern, MatchMode: r.MatchMode,
							QuotaLimit: r.QuotaLimit,
							Period:     "subscription",
						})
					}
				}
			}
		}
	}

	// 3. Check group rules
	groupRules, err := model.GetModelQuotaGroupRulesByGroup(userGroup)
	if err == nil {
		for _, r := range groupRules {
			if matchModel(modelName, r.ModelPattern, r.MatchMode) {
				alreadyMatched := false
				for _, m := range matched {
					if m.RuleId == r.Id && m.RuleSource == model.ModelQuotaRuleSourceGroup {
						alreadyMatched = true
						break
					}
				}
				if !alreadyMatched {
					matched = append(matched, &matchedRule{
						RuleId: r.Id, RuleSource: model.ModelQuotaRuleSourceGroup,
						ModelPattern: r.ModelPattern, MatchMode: r.MatchMode,
						QuotaLimit: r.QuotaLimit,
						Period:     r.Period,
					})
				}
			}
		}
	}

	return matched
}

// getPeriodForUsage infers the period type from a usage record's rule_source.
// For plan rules, period is "subscription". For group rules, we don't store it in usage,
// but the usage's period_end tells us when to reset.
func getPeriodForUsage(u *model.UserModelQuotaUsage) string {
	if u.RuleSource == model.ModelQuotaRuleSourcePlan {
		return "subscription"
	}
	return "group" // actual period type doesn't matter for existing usage, just need to check period_end
}

// CheckModelQuota checks if the user has enough model quota for the pre-consumption.
// Returns ModelQuotaCheckResult with Passed=true if allowed, false if denied.
//
// Parameters:
//   - userId: user ID
//   - modelName: the model being requested
//   - userGroup: the user's group name
//   - preQuota: estimated quota consumption for this request
func CheckModelQuota(
	userId int,
	modelName string,
	userGroup string,
	preQuota int,
) (*ModelQuotaCheckResult, error) {
	// Query user's active subscription for plan rules
	planInfo := getUserActivePlanInfo(userId)

	rules := FindMatchingModelQuotaRules(userId, modelName, userGroup, planInfo)

	if len(rules) == 0 {
		return &ModelQuotaCheckResult{Passed: true}, nil
	}

	result := &ModelQuotaCheckResult{Passed: true}

	for _, rule := range rules {
		// Calculate period bounds based on rule's period type
		var periodStart, periodEnd int64
		var subscriptionId int
		if rule.RuleSource == model.ModelQuotaRuleSourcePlan && planInfo != nil {
			// Plan rule: follow subscription cycle
			periodStart = planInfo.StartTime
			periodEnd = planInfo.EndTime
			if periodEnd == 0 {
				// No end time (permanent subscription): use far future
				periodEnd = time.Date(2099, 1, 1, 0, 0, 0, 0, time.UTC).Unix()
			}
			subscriptionId = planInfo.SubscriptionId
		} else {
			// Group rule: calculate based on period type
			periodStart, periodEnd = calculatePeriodBounds(rule.Period, 0, 0)
		}

		usage, err := getOrCreateModelQuotaUsage(userId, rule, subscriptionId, periodStart, periodEnd)
		if err != nil {
			common.SysError(fmt.Sprintf("failed to get/create model quota usage for user %d, rule %d: %v", userId, rule.RuleId, err))
			// On error, allow the request to proceed (fail-open for availability)
			continue
		}

		// Check Redis cache first, fallback to DB value in usage
		used, limit, cacheOk := model.CacheGetModelQuotaUsage(usage.Id)
		if !cacheOk {
			used = usage.QuotaUsed
			limit = usage.QuotaLimit
			// Populate cache
			model.CacheSetModelQuotaUsage(usage.Id, usage.QuotaUsed, usage.QuotaLimit, usage.PeriodEnd)
		}

		if used+int64(preQuota) > limit {
			result.Passed = false
			result.ErrorMessage = fmt.Sprintf("model %s quota exhausted: used %d + requested %d > limit %d",
				rule.ModelPattern, used, preQuota, limit)
			return result, nil
		}

		result.UsageIds = append(result.UsageIds, usage.Id)
	}

	return result, nil
}

// getOrCreateModelQuotaUsage finds an existing active, non-expired usage record,
// or creates a new one. If the old usage's period has ended, it marks it as expired
// and creates a fresh one with quota_used=0.
func getOrCreateModelQuotaUsage(userId int, rule *matchedRule, subscriptionId int, periodStart int64, periodEnd int64) (*model.UserModelQuotaUsage, error) {
	// Try to find existing active, non-expired usage
	usage, err := model.GetUserModelQuotaUsageByUserAndRule(userId, rule.RuleId, rule.RuleSource)
	if err == nil {
		return usage, nil
	}

	// Expire any outdated usage records for this user+rule (period ended)
	_ = model.ExpireOutdatedUserModelQuotaUsage(userId, rule.RuleId, rule.RuleSource)

	// Create new usage record with fresh quota
	newUsage := &model.UserModelQuotaUsage{
		UserId:         userId,
		RuleId:         rule.RuleId,
		RuleSource:     rule.RuleSource,
		ModelPattern:   rule.ModelPattern,
		SubscriptionId: subscriptionId,
		QuotaLimit:     rule.QuotaLimit,
		QuotaUsed:      0,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		Status:         model.ModelQuotaUsageStatusActive,
	}
	if err := model.DB.Create(newUsage).Error; err != nil {
		return nil, err
	}

	// Populate Redis cache
	model.CacheSetModelQuotaUsage(newUsage.Id, 0, newUsage.QuotaLimit, newUsage.PeriodEnd)

	return newUsage, nil
}

// RecordModelQuotaUsage updates the usage counters after a request completes
func RecordModelQuotaUsage(usageIds []int, actualQuota int) {
	for _, id := range usageIds {
		if err := model.IncreaseUserModelQuotaUsage(id, int64(actualQuota)); err != nil {
			common.SysError(fmt.Sprintf("failed to record model quota usage %d: %v", id, err))
		}
	}
}
