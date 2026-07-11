package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 套餐未配置可用分组时不限制；配置后仅列表内分组可用（逗号分隔，容忍空格）。
func TestPlanIsQuotaUsableForGroup(t *testing.T) {
	plan := &SubscriptionPlan{}
	assert.True(t, plan.IsQuotaUsableForGroup("default"))

	plan.QuotaUsableGroups = "vip"
	assert.True(t, plan.IsQuotaUsableForGroup("vip"))
	assert.False(t, plan.IsQuotaUsableForGroup("default"))

	plan.QuotaUsableGroups = "vip, svip"
	assert.True(t, plan.IsQuotaUsableForGroup("vip"))
	assert.True(t, plan.IsQuotaUsableForGroup("svip"))
	assert.False(t, plan.IsQuotaUsableForGroup("default"))
}

func TestPreConsumeUserSubscriptionRespectsQuotaUsableGroups(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	plan := &SubscriptionPlan{
		Id:                9301,
		Title:             "Team",
		DurationUnit:      SubscriptionDurationMonth,
		DurationValue:     1,
		TotalAmount:       1000,
		QuotaResetPeriod:  SubscriptionResetNever,
		QuotaUsableGroups: "vip",
	}
	seedSubscriptionResetPlan(t, plan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9401, UserId: 201, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 0, StartTime: now - 3600, EndTime: now + 3600, Status: "active"})

	// 请求分组不在套餐可用分组内 → 不得消耗订阅额度
	_, err := PreConsumeUserSubscription("req-sub-group-1", 201, "gpt-test", "default", 0, 100)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "subscription quota insufficient")
	sub := getSubscriptionResetSub(t, 9401)
	assert.Zero(t, sub.AmountUsed)

	// 分组匹配 → 正常消耗
	res, err := PreConsumeUserSubscription("req-sub-group-2", 201, "gpt-test", "vip", 0, 100)
	require.NoError(t, err)
	assert.Equal(t, 9401, res.UserSubscriptionId)
	assert.Equal(t, int64(100), res.AmountUsedAfter)
}

func TestPreConsumeUserSubscriptionPrefersUsableSubscription(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()
	restricted := &SubscriptionPlan{Id: 9302, Title: "Team", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000, QuotaResetPeriod: SubscriptionResetNever, QuotaUsableGroups: "vip"}
	open := &SubscriptionPlan{Id: 9303, Title: "Open", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000, QuotaResetPeriod: SubscriptionResetNever}
	seedSubscriptionResetPlan(t, restricted)
	seedSubscriptionResetPlan(t, open)
	// 受限订阅 end_time 更早，正常排序下会被优先选中
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9402, UserId: 202, PlanId: restricted.Id, AmountTotal: 1000, StartTime: now - 3600, EndTime: now + 3600, Status: "active"})
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9403, UserId: 202, PlanId: open.Id, AmountTotal: 1000, StartTime: now - 3600, EndTime: now + 7200, Status: "active"})

	// default 分组 → 跳过受限订阅，从不受限订阅扣
	res, err := PreConsumeUserSubscription("req-sub-group-3", 202, "gpt-test", "default", 0, 100)
	require.NoError(t, err)
	assert.Equal(t, 9403, res.UserSubscriptionId)

	// vip 分组 → 受限订阅（end_time 更早）优先
	res2, err := PreConsumeUserSubscription("req-sub-group-4", 202, "gpt-test", "vip", 0, 100)
	require.NoError(t, err)
	assert.Equal(t, 9402, res2.UserSubscriptionId)
}

func TestUserHasUsableSubscriptionForGroup(t *testing.T) {
	truncateTables(t)
	now := GetDBTimestamp()

	// 无订阅
	ok, err := UserHasUsableSubscriptionForGroup(203, "default")
	require.NoError(t, err)
	assert.False(t, ok)

	restricted := &SubscriptionPlan{Id: 9304, Title: "Team", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000, QuotaResetPeriod: SubscriptionResetNever, QuotaUsableGroups: "vip"}
	seedSubscriptionResetPlan(t, restricted)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9404, UserId: 203, PlanId: restricted.Id, AmountTotal: 1000, StartTime: now - 3600, EndTime: now + 3600, Status: "active"})

	ok, err = UserHasUsableSubscriptionForGroup(203, "vip")
	require.NoError(t, err)
	assert.True(t, ok)

	ok, err = UserHasUsableSubscriptionForGroup(203, "default")
	require.NoError(t, err)
	assert.False(t, ok)

	// 追加一个不受限订阅 → 任何分组都可用
	openPlan := &SubscriptionPlan{Id: 9305, Title: "Open", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, TotalAmount: 1000, QuotaResetPeriod: SubscriptionResetNever}
	seedSubscriptionResetPlan(t, openPlan)
	seedSubscriptionResetSub(t, &UserSubscription{Id: 9405, UserId: 203, PlanId: openPlan.Id, AmountTotal: 1000, StartTime: now - 3600, EndTime: now + 3600, Status: "active"})

	ok, err = UserHasUsableSubscriptionForGroup(203, "default")
	require.NoError(t, err)
	assert.True(t, ok)
}
