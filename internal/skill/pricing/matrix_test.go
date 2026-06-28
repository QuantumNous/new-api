package pricing

import (
	"testing"

	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	"github.com/stretchr/testify/assert"
)

func TestResolveEntitlement_DR99TierMatrix(t *testing.T) {
	tests := []struct {
		name    string
		input   EntitlementInput
		allowed bool
		code    errcodes.ErrorCode
	}{
		{
			name: "basic can use free skill",
			input: EntitlementInput{
				RequiredPlan:       enums.RequiredPlanFree,
				MonetizationType:   enums.MonetizationTypeFree,
				UserPlan:           enums.RequiredPlanFree,
				SubscriptionActive: true,
			},
			allowed: true,
		},
		{
			name: "basic without purchase is locked on one-time skill",
			input: EntitlementInput{
				RequiredPlan:       enums.RequiredPlanFree,
				MonetizationType:   enums.MonetizationTypeOneTime,
				UserPlan:           enums.RequiredPlanFree,
				SubscriptionActive: true,
			},
			code: errcodes.ErrSkillPlanRequired,
		},
		{
			name: "basic one-time owner can use one-time skill",
			input: EntitlementInput{
				RequiredPlan:          enums.RequiredPlanFree,
				MonetizationType:      enums.MonetizationTypeOneTime,
				UserPlan:              enums.RequiredPlanFree,
				SubscriptionActive:    true,
				HasOneTimeEntitlement: true,
			},
			allowed: true,
		},
		{
			name: "active plus can use one-time skill without purchase",
			input: EntitlementInput{
				RequiredPlan:       enums.RequiredPlanFree,
				MonetizationType:   enums.MonetizationTypeOneTime,
				UserPlan:           enums.RequiredPlanPro,
				SubscriptionActive: true,
			},
			allowed: true,
		},
		{
			name: "active plus can use plus-exclusive skill",
			input: EntitlementInput{
				RequiredPlan:       enums.RequiredPlanPro,
				MonetizationType:   enums.MonetizationTypePlusExclusive,
				UserPlan:           enums.RequiredPlanPro,
				SubscriptionActive: true,
			},
			allowed: true,
		},
		{
			name: "expired plus loses plus-exclusive skill",
			input: EntitlementInput{
				RequiredPlan:       enums.RequiredPlanPro,
				MonetizationType:   enums.MonetizationTypePlusExclusive,
				UserPlan:           enums.RequiredPlanPro,
				SubscriptionActive: false,
			},
			code: errcodes.ErrSkillSubscriptionInactive,
		},
		{
			name: "expired plus keeps one-time owned skill",
			input: EntitlementInput{
				RequiredPlan:          enums.RequiredPlanFree,
				MonetizationType:      enums.MonetizationTypeOneTime,
				UserPlan:              enums.RequiredPlanPro,
				SubscriptionActive:    false,
				HasOneTimeEntitlement: true,
			},
			allowed: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveEntitlement(tt.input)
			assert.Equal(t, tt.allowed, got.Allowed)
			assert.Equal(t, tt.code, got.Code)
		})
	}
}
