package model

import (
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedSubscriptionResetPlan(t *testing.T, plan *SubscriptionPlan) {
	t.Helper()
	require.NoError(t, DB.Create(plan).Error)
}

func seedSubscriptionResetSub(t *testing.T, sub *UserSubscription) {
	t.Helper()
	require.NoError(t, DB.Create(sub).Error)
}

func getSubscriptionResetSub(t *testing.T, id int) UserSubscription {
	t.Helper()
	var sub UserSubscription
	require.NoError(t, DB.Where("id = ?", id).First(&sub).Error)
	return sub
}

func TestAdminResetUserSubscriptionsByPlanResetsAllActiveMatchesAndAdvancesTime(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9101,
		Title:            "Pro",
		PriceAmount:      10,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	otherPlan := &SubscriptionPlan{
		Id:               9102,
		Title:            "Basic",
		PriceAmount:      1,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      100,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetPlan(t, otherPlan)

	activeEnd := now + 30*24*3600
	expiredEnd := now - 1
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9201, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 300, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9202, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 500, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9203, UserId: 101, PlanId: otherPlan.Id, AmountTotal: 100, AmountUsed: 60, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9204, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 700, StartTime: now - 7200, EndTime: expiredEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now - 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9205, UserId: 102, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 800, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 120})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9206, UserId: 101, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 900, StartTime: now - 3600, EndTime: activeEnd, Status: "cancelled", LastResetTime: now - 3600, NextResetTime: now + 120})

	beforeReset := GetDBTimestamp()
	result, err := AdminResetUserSubscriptionsByPlan(101, plan.Id, true)
	afterReset := GetDBTimestamp()

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, plan.Id, result.PlanId)
	assert.Equal(t, 2, result.MatchedCount)
	assert.Equal(t, 2, result.ResetCount)
	assert.Equal(t, 1, result.UserCount)
	assert.Equal(t, []int{101}, result.AffectedUserIds)
	assert.True(t, result.AdvanceResetTime)

	for _, id := range []int{9201, 9202} {
		sub := getSubscriptionResetSub(t, id)
		assert.Zero(t, sub.AmountUsed)
		assert.GreaterOrEqual(t, sub.LastResetTime, beforeReset)
		assert.LessOrEqual(t, sub.LastResetTime, afterReset)
		assert.Equal(t, calcNextResetTime(time.Unix(sub.LastResetTime, 0), plan, sub.EndTime), sub.NextResetTime)
	}
	assert.EqualValues(t, 60, getSubscriptionResetSub(t, 9203).AmountUsed)
	assert.EqualValues(t, 700, getSubscriptionResetSub(t, 9204).AmountUsed)
	assert.EqualValues(t, 800, getSubscriptionResetSub(t, 9205).AmountUsed)
	assert.EqualValues(t, 900, getSubscriptionResetSub(t, 9206).AmountUsed)
}

func TestAdminResetUserSubscriptionsByPlanKeepsResetTimes(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9301,
		Title:            "Team",
		PriceAmount:      20,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      2000,
		QuotaResetPeriod: SubscriptionResetMonthly,
	}
	seedSubscriptionResetPlan(t, plan)

	lastReset := now - 86400
	nextReset := now + 86400
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9302, UserId: 201, PlanId: plan.Id, AmountTotal: 2000, AmountUsed: 1200, StartTime: now - 172800, EndTime: now + 30*24*3600, Status: "active", LastResetTime: lastReset, NextResetTime: nextReset})

	result, err := AdminResetUserSubscriptionsByPlan(201, plan.Id, false)

	require.NoError(t, err)
	assert.False(t, result.AdvanceResetTime)
	sub := getSubscriptionResetSub(t, 9302)
	assert.Zero(t, sub.AmountUsed)
	assert.Equal(t, lastReset, sub.LastResetTime)
	assert.Equal(t, nextReset, sub.NextResetTime)
}

func TestAdminResetUserSubscriptionsByPlanNoActiveMatchReturnsError(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:            9401,
		Title:         "Expired",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9402, UserId: 301, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 500, StartTime: now - 7200, EndTime: now - 1, Status: "active"})

	result, err := AdminResetUserSubscriptionsByPlan(301, plan.Id, true)

	require.Error(t, err)
	assert.Nil(t, result)
	assert.True(t, strings.Contains(err.Error(), "This user has no active subscription to this plan"))
}

func TestAdminResetPlanSubscriptionsResetsAllActiveUsers(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:               9501,
		Title:            "Business",
		PriceAmount:      30,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      3000,
		QuotaResetPeriod: SubscriptionResetNever,
	}
	seedSubscriptionResetPlan(t, plan)

	activeEnd := now + 30*24*3600
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9502, UserId: 401, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1000, StartTime: now - 3600, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9503, UserId: 401, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1100, StartTime: now - 3500, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9504, UserId: 402, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1200, StartTime: now - 3400, EndTime: activeEnd, Status: "active", LastResetTime: now - 3600, NextResetTime: now + 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9505, UserId: 403, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1300, StartTime: now - 7200, EndTime: now - 1, Status: "active", LastResetTime: now - 3600, NextResetTime: now - 10})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9506, UserId: 404, PlanId: plan.Id, AmountTotal: 3000, AmountUsed: 1400, StartTime: now - 3600, EndTime: activeEnd, Status: "cancelled", LastResetTime: now - 3600, NextResetTime: now + 10})

	result, err := AdminResetPlanSubscriptions(plan.Id, true)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, 3, result.MatchedCount)
	assert.Equal(t, 3, result.ResetCount)
	assert.Equal(t, 2, result.UserCount)
	assert.Equal(t, []int{401, 402}, result.AffectedUserIds)
	for _, id := range []int{9502, 9503, 9504} {
		sub := getSubscriptionResetSub(t, id)
		assert.Zero(t, sub.AmountUsed)
		assert.Zero(t, sub.LastResetTime)
		assert.Zero(t, sub.NextResetTime)
	}
	assert.EqualValues(t, 1300, getSubscriptionResetSub(t, 9505).AmountUsed)
	assert.EqualValues(t, 1400, getSubscriptionResetSub(t, 9506).AmountUsed)
}

func TestAdminResetPlanSubscriptionsNoMatchSucceeds(t *testing.T) {
	truncateTables(t)

	plan := &SubscriptionPlan{
		Id:            9601,
		Title:         "Empty",
		PriceAmount:   10,
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		TotalAmount:   1000,
	}
	seedSubscriptionResetPlan(t, plan)

	result, err := AdminResetPlanSubscriptions(plan.Id, true)

	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Zero(t, result.MatchedCount)
	assert.Zero(t, result.ResetCount)
	assert.Zero(t, result.UserCount)
	assert.Empty(t, result.AffectedUserIds)
}

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
	InvalidateSubscriptionPlanCache(plan.Id)
	t.Cleanup(func() { InvalidateSubscriptionPlanCache(plan.Id) })
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

func TestUserActiveSubscriptionsAllowWalletOverflowIsGroupAware(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	activeEnd := now + 30*24*3600

	seedGroupPlan(t, 9801, "default")
	seedGroupPlan(t, 9802, "vip")
	// 两个订阅都禁止钱包回退，但分别只对 default / vip 生效。
	require.NoError(t, DB.Create(&UserSubscription{Id: 9811, UserId: 8501, PlanId: 9801, AmountTotal: 1000, StartTime: now - 3600, EndTime: activeEnd, Status: "active", AllowWalletOverflow: false}).Error)
	require.NoError(t, DB.Create(&UserSubscription{Id: 9812, UserId: 8501, PlanId: 9802, AmountTotal: 1000, StartTime: now - 3600, EndTime: activeEnd, Status: "active", AllowWalletOverflow: false}).Error)
	// 该用户只有一个 vip 专属的严格订阅。
	require.NoError(t, DB.Create(&UserSubscription{Id: 9813, UserId: 8502, PlanId: 9802, AmountTotal: 1000, StartTime: now - 3600, EndTime: activeEnd, Status: "active", AllowWalletOverflow: false}).Error)

	allowed, err := UserActiveSubscriptionsAllowWalletOverflow(8501, "default")
	require.NoError(t, err)
	assert.False(t, allowed, "eligible strict subscription must block wallet overflow")

	allowed, err = UserActiveSubscriptionsAllowWalletOverflow(8501, "svip")
	require.NoError(t, err)
	assert.True(t, allowed, "subscriptions restricted to other groups must not block wallet overflow")

	allowed, err = UserActiveSubscriptionsAllowWalletOverflow(8502, "default")
	require.NoError(t, err)
	assert.True(t, allowed, "a vip-only strict subscription must not block default-group wallet overflow")

	allowed, err = UserActiveSubscriptionsAllowWalletOverflow(8502, "vip")
	require.NoError(t, err)
	assert.False(t, allowed)

	_, err = UserActiveSubscriptionsAllowWalletOverflow(0, "default")
	require.Error(t, err)
}

func TestIsUserSubscriptionEligibleForGroup(t *testing.T) {
	truncateTables(t)
	now := common.GetTimestamp()
	activeEnd := now + 30*24*3600

	seedGroupPlan(t, 9803, "default")
	seedGroupSub(t, 9814, 8601, 9803, "active", activeEnd)

	eligible, err := IsUserSubscriptionEligibleForGroup(9814, "default")
	require.NoError(t, err)
	assert.True(t, eligible)

	eligible, err = IsUserSubscriptionEligibleForGroup(9814, "vip")
	require.NoError(t, err)
	assert.False(t, eligible)

	_, err = IsUserSubscriptionEligibleForGroup(999999, "default")
	require.Error(t, err)
}

func TestPreConsumeUserSubscriptionGroupFilter(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM subscription_pre_consume_records") })
	now := common.GetTimestamp()
	activeEnd := now + 30*24*3600

	seedGroupPlan(t, 9804, "default")
	seedGroupSub(t, 9815, 8701, 9804, "active", activeEnd)

	for _, group := range []string{"vip", ""} {
		_, err := PreConsumeUserSubscription("group-filter-"+group, 8701, "m", 0, 100, group)
		require.Error(t, err, "restricted plan must not fund group %q", group)
		assert.Contains(t, err.Error(), "subscription quota insufficient")
	}
	var used int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", 9815).Select("amount_used").Scan(&used).Error)
	assert.Zero(t, used, "ineligible attempts must not consume quota")

	result, err := PreConsumeUserSubscription("group-filter-default", 8701, "m", 0, 100, "default")
	require.NoError(t, err)
	assert.EqualValues(t, 100, result.PreConsumed)
	assert.EqualValues(t, 100, result.AmountUsedAfter)

	replay, err := PreConsumeUserSubscription("group-filter-default", 8701, "m", 0, 100, "default")
	require.NoError(t, err, "same requestId must stay idempotent")
	assert.EqualValues(t, 100, replay.AmountUsedAfter)
}

func TestPreConsumeUserSubscriptionReplayGroupGuard(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM subscription_pre_consume_records") })
	now := common.GetTimestamp()
	activeEnd := now + 30*24*3600

	seedGroupPlan(t, 9806, "default")
	seedGroupSub(t, 9817, 8901, 9806, "active", activeEnd)

	_, err := PreConsumeUserSubscription("group-replay-1", 8901, "m", 0, 100, "default")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("group-replay-1", 8901, "m", 0, 100, "vip")
	require.Error(t, err, "replay must not hand a restricted reservation to another group")
	assert.Contains(t, err.Error(), "not eligible for group")

	var sub UserSubscription
	require.NoError(t, DB.First(&sub, 9817).Error)
	assert.EqualValues(t, 100, sub.AmountUsed, "rejected replay must leave the reservation untouched")
	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", "group-replay-1").First(&record).Error)
	assert.EqualValues(t, 100, record.PreConsumed)
	assert.NotEqual(t, "refunded", record.Status)

	replay, err := PreConsumeUserSubscription("group-replay-1", 8901, "m", 0, 100, "default")
	require.NoError(t, err, "eligible replay must stay idempotent")
	assert.EqualValues(t, 100, replay.AmountUsedAfter)
}

func TestRefundSubscriptionPreConsumeIsIdempotent(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}))
	t.Cleanup(func() { DB.Exec("DELETE FROM subscription_pre_consume_records") })
	now := common.GetTimestamp()
	activeEnd := now + 30*24*3600

	seedGroupPlan(t, 9805, "")
	seedGroupSub(t, 9816, 8801, 9805, "active", activeEnd)

	_, err := PreConsumeUserSubscription("group-refund-1", 8801, "m", 0, 100, "default")
	require.NoError(t, err)
	require.NoError(t, RefundSubscriptionPreConsume("group-refund-1"))
	require.NoError(t, RefundSubscriptionPreConsume("group-refund-1"), "repeated refund must not credit twice")

	var sub UserSubscription
	require.NoError(t, DB.First(&sub, 9816).Error)
	assert.Zero(t, sub.AmountUsed)
	var record SubscriptionPreConsumeRecord
	require.NoError(t, DB.Where("request_id = ?", "group-refund-1").First(&record).Error)
	assert.Equal(t, "refunded", record.Status)

	_, err = PreConsumeUserSubscription("group-refund-1", 8801, "m", 0, 100, "default")
	require.Error(t, err, "a refunded requestId must not be reused")
}
