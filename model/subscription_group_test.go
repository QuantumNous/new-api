package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsSubscriptionPlanEligibleForGroup(t *testing.T) {
	tests := []struct {
		name       string
		plan       *SubscriptionPlan
		usingGroup string
		want       bool
	}{
		{name: "nil plan", plan: nil, usingGroup: "default", want: false},
		{name: "empty means unrestricted", plan: &SubscriptionPlan{QuotaUsableGroups: ""}, usingGroup: "default", want: true},
		{name: "whitespace means unrestricted", plan: &SubscriptionPlan{QuotaUsableGroups: "   "}, usingGroup: "vip", want: true},
		{name: "single match", plan: &SubscriptionPlan{QuotaUsableGroups: "default"}, usingGroup: "default", want: true},
		{name: "single no match", plan: &SubscriptionPlan{QuotaUsableGroups: "default"}, usingGroup: "vip", want: false},
		{name: "multi match", plan: &SubscriptionPlan{QuotaUsableGroups: "default,vip"}, usingGroup: "vip", want: true},
		{name: "multi no match", plan: &SubscriptionPlan{QuotaUsableGroups: "default,vip"}, usingGroup: "svip", want: false},
		{name: "entries are trimmed", plan: &SubscriptionPlan{QuotaUsableGroups: " default , vip "}, usingGroup: "default", want: true},
		{name: "empty using group not listed", plan: &SubscriptionPlan{QuotaUsableGroups: "default"}, usingGroup: "", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, IsSubscriptionPlanEligibleForGroup(tt.plan, tt.usingGroup))
		})
	}
}

func seedGroupPlan(t *testing.T, id int, groups string) *SubscriptionPlan {
	t.Helper()
	plan := &SubscriptionPlan{
		Id:                id,
		Title:             "GroupPlan",
		PriceAmount:       10,
		DurationUnit:      SubscriptionDurationMonth,
		DurationValue:     1,
		TotalAmount:       1000,
		QuotaUsableGroups: groups,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func seedGroupSub(t *testing.T, id, userId, planId int, status string, endTime int64) {
	t.Helper()
	now := common.GetTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		Id:          id,
		UserId:      userId,
		PlanId:      planId,
		AmountTotal: 1000,
		AmountUsed:  0,
		StartTime:   now - 3600,
		EndTime:     endTime,
		Status:      status,
	}).Error)
}

func TestHasActiveUserSubscriptionForGroupRejectsInvalidUser(t *testing.T) {
	ok, err := HasActiveUserSubscriptionForGroup(0, "default")
	require.Error(t, err)
	assert.False(t, ok)
}

func TestHasActiveUserSubscriptionForGroupNoSubscription(t *testing.T) {
	truncateTables(t)
	ok, err := HasActiveUserSubscriptionForGroup(8101, "default")
	require.NoError(t, err)
	assert.False(t, ok)
}

func TestHasActiveUserSubscriptionForGroupEligibility(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	activeEnd := now + 30*24*3600

	seedGroupPlan(t, 9701, "default")
	seedGroupPlan(t, 9702, "")
	seedGroupSub(t, 9711, 8201, 9701, "active", activeEnd)
	seedGroupSub(t, 9712, 8202, 9702, "active", activeEnd)

	ok, err := HasActiveUserSubscriptionForGroup(8201, "default")
	require.NoError(t, err)
	assert.True(t, ok, "restricted plan should fund its listed group")

	ok, err = HasActiveUserSubscriptionForGroup(8201, "vip")
	require.NoError(t, err)
	assert.False(t, ok, "restricted plan should not fund an unlisted group")

	ok, err = HasActiveUserSubscriptionForGroup(8202, "vip")
	require.NoError(t, err)
	assert.True(t, ok, "unrestricted plan should fund any group")
}

func TestHasActiveUserSubscriptionForGroupIgnoresInactive(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()

	seedGroupPlan(t, 9703, "default")
	seedGroupSub(t, 9713, 8301, 9703, "active", now-1)       // expired
	seedGroupSub(t, 9714, 8302, 9703, "cancelled", now+3600) // cancelled

	ok, err := HasActiveUserSubscriptionForGroup(8301, "default")
	require.NoError(t, err)
	assert.False(t, ok, "expired subscription must not count")

	ok, err = HasActiveUserSubscriptionForGroup(8302, "default")
	require.NoError(t, err)
	assert.False(t, ok, "cancelled subscription must not count")
}

func TestHasActiveUserSubscriptionForGroupAnyEligiblePlan(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	activeEnd := now + 30*24*3600

	seedGroupPlan(t, 9704, "default")
	seedGroupPlan(t, 9705, "vip")
	seedGroupSub(t, 9715, 8401, 9704, "active", activeEnd)
	seedGroupSub(t, 9716, 8401, 9705, "active", activeEnd)

	ok, err := HasActiveUserSubscriptionForGroup(8401, "vip")
	require.NoError(t, err)
	assert.True(t, ok, "any active eligible plan should satisfy the group")
}
