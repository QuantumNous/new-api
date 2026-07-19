package model

import "testing"

func TestIsSubscriptionPlanEligibleForGroup(t *testing.T) {
	tests := []struct {
		name       string
		plan       *SubscriptionPlan
		usingGroup string
		want       bool
	}{
		{name: "nil plan", plan: nil, usingGroup: "Draw", want: false},
		{name: "legacy plan", plan: &SubscriptionPlan{}, usingGroup: "Draw", want: true},
		{name: "restricted matching group", plan: &SubscriptionPlan{BillingGroupOnly: true, UpgradeGroup: "Draw"}, usingGroup: "Draw", want: true},
		{name: "restricted different group", plan: &SubscriptionPlan{BillingGroupOnly: true, UpgradeGroup: "Draw"}, usingGroup: "default", want: false},
		{name: "restricted empty upgrade group", plan: &SubscriptionPlan{BillingGroupOnly: true}, usingGroup: "Draw", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsSubscriptionPlanEligibleForGroup(tt.plan, tt.usingGroup); got != tt.want {
				t.Fatalf("IsSubscriptionPlanEligibleForGroup() = %t, want %t", got, tt.want)
			}
		})
	}
}