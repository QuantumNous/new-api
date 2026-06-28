package skillrelay

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/QuantumNous/new-api/internal/skill/pricing"
	"gorm.io/gorm"
)

type runtimeEntitlement struct {
	Plan      enums.RequiredPlan
	SubActive bool
}

type activeSubscriptionPlanResult struct {
	Plan         enums.RequiredPlan
	HasActiveSub bool
	HasPaidPlan  bool
}

// resolveRuntimeEntitlement loads the runner's current use-time entitlement.
// Enablement is intentionally not considered here: DR-66 checks that first, and
// DR-67 treats enablement as necessary but never sufficient.
func resolveRuntimeEntitlement(database *gorm.DB, userID int, userGroup string) (runtimeEntitlement, error) {
	groupPlan := groupToPlan(userGroup)
	active, err := activeSubscriptionPlan(database, userID)
	if err != nil {
		return runtimeEntitlement{}, err
	}
	if active.HasPaidPlan {
		return runtimeEntitlement{Plan: active.Plan, SubActive: true}, nil
	}
	if active.HasActiveSub {
		return runtimeEntitlement{Plan: groupPlan, SubActive: true}, nil
	}
	return runtimeEntitlement{
		Plan:      groupPlan,
		SubActive: groupPlan == enums.RequiredPlanFree,
	}, nil
}

func activeSubscriptionPlan(database *gorm.DB, userID int) (activeSubscriptionPlanResult, error) {
	var rows []struct {
		UpgradeGroup string
	}
	err := database.Table("user_subscriptions AS us").
		Select("sp.upgrade_group").
		Joins("JOIN subscription_plans AS sp ON sp.id = us.plan_id").
		Where("us.user_id = ? AND us.status = ? AND us.end_time > ?", userID, "active", common.GetTimestamp()).
		Scan(&rows).Error
	if err != nil {
		return activeSubscriptionPlanResult{}, err
	}
	result := activeSubscriptionPlanResult{
		Plan:         enums.RequiredPlanFree,
		HasActiveSub: len(rows) > 0,
	}
	for _, row := range rows {
		plan := groupToPlan(row.UpgradeGroup)
		if plan == enums.RequiredPlanFree {
			continue
		}
		result.HasPaidPlan = true
		if planLevel(plan) > planLevel(result.Plan) {
			result.Plan = plan
		}
	}
	return result, nil
}

func useTimeEntitlementDecision(required, userPlan enums.RequiredPlan, subActive bool) errcodes.ErrorCode {
	if !required.Valid() || !userPlan.Valid() {
		return errcodes.ErrSkillInternalError
	}
	if planLevel(userPlan) < planLevel(required) {
		return errcodes.ErrSkillPlanRequired
	}
	if required != enums.RequiredPlanFree && !subActive {
		return errcodes.ErrSkillSubscriptionInactive
	}
	return ""
}

func useTimeTierDecision(required, userPlan enums.RequiredPlan, subActive bool, monetization enums.MonetizationType, hasOneTimeEntitlement bool) errcodes.ErrorCode {
	decision := pricing.ResolveEntitlement(pricing.EntitlementInput{
		RequiredPlan:          required,
		MonetizationType:      monetization,
		UserPlan:              userPlan,
		SubscriptionActive:    subActive,
		HasOneTimeEntitlement: hasOneTimeEntitlement,
	})
	if decision.Allowed {
		return ""
	}
	return decision.Code
}

func planLevel(p enums.RequiredPlan) int {
	switch p {
	case enums.RequiredPlanFree:
		return 0
	case enums.RequiredPlanPro:
		return 1
	case enums.RequiredPlanEnterprise:
		return 2
	default:
		return -1
	}
}
