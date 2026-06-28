package pricing

import (
	"errors"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"gorm.io/gorm"
)

const (
	OneTimeSkillPriceUSD         = 2.00
	PlusMonthlyPriceUSD          = 19.90
	PlusUpgradeCreditMetadataKey = "one_time_credit_toward_plus_usd"
)

type EntitlementInput struct {
	RequiredPlan          enums.RequiredPlan
	MonetizationType      enums.MonetizationType
	UserPlan              enums.RequiredPlan
	SubscriptionActive    bool
	HasOneTimeEntitlement bool
}

type EntitlementDecision struct {
	Allowed bool
	Code    errcodes.ErrorCode
}

func ResolveEntitlement(input EntitlementInput) EntitlementDecision {
	if input.MonetizationType == "" {
		input.MonetizationType = enums.MonetizationTypePlanIncluded
	}
	if !input.RequiredPlan.Valid() || !input.UserPlan.Valid() || !input.MonetizationType.Valid() {
		return EntitlementDecision{Code: errcodes.ErrSkillInternalError}
	}

	if input.MonetizationType == enums.MonetizationTypeOneTime && input.HasOneTimeEntitlement {
		return EntitlementDecision{Allowed: true}
	}

	if !planSatisfied(input.RequiredPlan, input.UserPlan) {
		return EntitlementDecision{Code: errcodes.ErrSkillPlanRequired}
	}
	if input.RequiredPlan != enums.RequiredPlanFree && !input.SubscriptionActive {
		return EntitlementDecision{Code: errcodes.ErrSkillSubscriptionInactive}
	}

	switch input.MonetizationType {
	case enums.MonetizationTypeFree, enums.MonetizationTypePlanIncluded, enums.MonetizationTypeTokenMarkup:
		return EntitlementDecision{Allowed: true}
	case enums.MonetizationTypeOneTime:
		if activePlus(input.UserPlan, input.SubscriptionActive) {
			return EntitlementDecision{Allowed: true}
		}
		return EntitlementDecision{Code: errcodes.ErrSkillPlanRequired}
	case enums.MonetizationTypePlusExclusive:
		if !planSatisfied(enums.RequiredPlanPro, input.UserPlan) {
			return EntitlementDecision{Code: errcodes.ErrSkillPlanRequired}
		}
		if !input.SubscriptionActive {
			return EntitlementDecision{Code: errcodes.ErrSkillSubscriptionInactive}
		}
		return EntitlementDecision{Allowed: true}
	default:
		return EntitlementDecision{Code: errcodes.ErrSkillInternalError}
	}
}

func activePlus(plan enums.RequiredPlan, subscriptionActive bool) bool {
	return subscriptionActive && planLevel(plan) >= planLevel(enums.RequiredPlanPro)
}

func planSatisfied(required, user enums.RequiredPlan) bool {
	return planLevel(user) >= planLevel(required)
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

type OneTimeEntitlementCounter interface {
	CountOneTimeEntitlements(db *gorm.DB, userID int64) (int64, error)
}

func PlusUpgradeCreditUSD(db *gorm.DB, counter OneTimeEntitlementCounter, userID int64, enabled bool) (float64, error) {
	if !enabled || userID <= 0 {
		return 0, nil
	}
	if db == nil {
		return 0, errors.New("db is nil")
	}
	if counter == nil {
		return 0, errors.New("one-time entitlement counter is nil")
	}
	count, err := counter.CountOneTimeEntitlements(db, userID)
	if err != nil {
		return 0, err
	}
	if count <= 0 {
		return 0, nil
	}
	return OneTimeSkillPriceUSD, nil
}
