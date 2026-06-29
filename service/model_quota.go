package service

import (
	"fmt"
	"strings"

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
}

// FindMatchingModelQuotaRules finds all rules that match the given model for the user
func FindMatchingModelQuotaRules(userId int, modelName string, userGroup string, planId int) []*matchedRule {
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
					MatchMode:    model.ModelQuotaMatchModeExact, // usage is already matched, use exact to compare
					QuotaLimit:   u.QuotaLimit,
				})
			}
		}
	}

	// 2. Check plan rules (if user has an active subscription)
	if planId > 0 {
		planRules, err := model.GetModelQuotaPlanRulesByPlanId(planId)
		if err == nil {
			for _, r := range planRules {
				if matchModel(modelName, r.ModelPattern, r.MatchMode) {
					// Check if this rule is already in matched (from existing usage)
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
				// Check if this rule is already in matched
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
					})
				}
			}
		}
	}

	return matched
}

// CheckModelQuota checks if the user has enough model quota for the pre-consumption.
// Returns ModelQuotaCheckResult with Passed=true if allowed, false if denied.
//
// Parameters:
//   - userId: user ID
//   - modelName: the model being requested
//   - userGroup: the user's group name
//   - preQuota: estimated quota consumption for this request
//   - subscriptionId: active subscription ID (0 if none)
//   - periodStart: period start timestamp
//   - periodEnd: period end timestamp
func CheckModelQuota(
	userId int,
	modelName string,
	userGroup string,
	preQuota int,
	planId int,
	periodStart int64,
	periodEnd int64,
) (*ModelQuotaCheckResult, error) {
	rules := FindMatchingModelQuotaRules(userId, modelName, userGroup, planId)

	if len(rules) == 0 {
		return &ModelQuotaCheckResult{Passed: true}, nil
	}

	result := &ModelQuotaCheckResult{Passed: true}

	for _, rule := range rules {
		usage, err := getOrCreateModelQuotaUsage(userId, rule, planId, periodStart, periodEnd)
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

// getOrCreateModelQuotaUsage finds an existing active usage record, or creates a new one
func getOrCreateModelQuotaUsage(userId int, rule *matchedRule, subscriptionId int, periodStart int64, periodEnd int64) (*model.UserModelQuotaUsage, error) {
	// Try to find existing active usage
	usage, err := model.GetUserModelQuotaUsageByUserAndRule(userId, rule.RuleId, rule.RuleSource)
	if err == nil {
		return usage, nil
	}

	// Create new usage record
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
