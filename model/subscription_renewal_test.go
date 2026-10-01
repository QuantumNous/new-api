package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedRenewalPlan(t *testing.T, id int, resetPeriod string) *SubscriptionPlan {
	t.Helper()
	plan := &SubscriptionPlan{
		Id:               id,
		Title:            "Renewal Pro",
		PriceAmount:      299,
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		TotalAmount:      1000,
		QuotaResetPeriod: resetPeriod,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

// 未到期时续同一个套餐：新订阅必须从旧订阅到期那一刻接着算，而不是从今天重新起算。
func TestCreateUserSubscriptionContinuesFromSamePlanActiveSubscription(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := seedRenewalPlan(t, 9301, SubscriptionResetNever)
	oldEnd := now + 3*24*3600
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9401, UserId: 301, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 700,
		StartTime: now - 27*24*3600, EndTime: oldEnd, Status: "active", Source: "admin",
	}).Error)

	sub, err := CreateUserSubscriptionFromPlanTx(DB, 301, plan, "admin")
	require.NoError(t, err)

	assert.Equal(t, oldEnd, sub.StartTime, "新订阅应从旧订阅到期时刻开始")
	expectedEnd, err := calcPlanEndTime(time.Unix(oldEnd, 0), plan)
	require.NoError(t, err)
	assert.Equal(t, expectedEnd, sub.EndTime, "新订阅有效期应在接续起点上加一个周期")
}

// 多段未到期订阅时，接到最晚的那一段之后排队。
func TestCreateUserSubscriptionContinuesFromLatestEndTime(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := seedRenewalPlan(t, 9302, SubscriptionResetNever)
	latestEnd := now + 40*24*3600
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9402, UserId: 302, PlanId: plan.Id, AmountTotal: 1000,
		StartTime: now - 3600, EndTime: now + 10*24*3600, Status: "active", Source: "admin",
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9403, UserId: 302, PlanId: plan.Id, AmountTotal: 1000,
		StartTime: now + 10*24*3600, EndTime: latestEnd, Status: "active", Source: "admin",
	}).Error)

	sub, err := CreateUserSubscriptionFromPlanTx(DB, 302, plan, "admin")
	require.NoError(t, err)
	assert.Equal(t, latestEnd, sub.StartTime)
}

// 不同套餐并存（月卡未到期时买日卡），仍然立刻生效。
func TestCreateUserSubscriptionDoesNotContinueAcrossPlans(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := seedRenewalPlan(t, 9303, SubscriptionResetNever)
	otherPlan := seedRenewalPlan(t, 9304, SubscriptionResetNever)
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9404, UserId: 303, PlanId: otherPlan.Id, AmountTotal: 1000,
		StartTime: now - 3600, EndTime: now + 20*24*3600, Status: "active", Source: "admin",
	}).Error)

	sub, err := CreateUserSubscriptionFromPlanTx(DB, 303, plan, "admin")
	require.NoError(t, err)
	assert.InDelta(t, now, sub.StartTime, 5, "不同套餐不接续，应立刻生效")
}

// 已过期 / 已作废的同套餐订阅不参与接续。
func TestCreateUserSubscriptionIgnoresEndedSubscriptions(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := seedRenewalPlan(t, 9305, SubscriptionResetNever)
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9405, UserId: 304, PlanId: plan.Id, AmountTotal: 1000,
		StartTime: now - 40*24*3600, EndTime: now - 24*3600, Status: "expired", Source: "admin",
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9406, UserId: 304, PlanId: plan.Id, AmountTotal: 1000,
		StartTime: now - 10*24*3600, EndTime: now + 5*24*3600, Status: "cancelled", Source: "admin",
	}).Error)

	sub, err := CreateUserSubscriptionFromPlanTx(DB, 304, plan, "admin")
	require.NoError(t, err)
	assert.InDelta(t, now, sub.StartTime, 5)
}

// 接续时的额度重置基线要跟着接续起点走，不能停留在购买时刻。
func TestCreateUserSubscriptionResetBaselineFollowsContinuationStart(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := seedRenewalPlan(t, 9306, SubscriptionResetDaily)
	oldEnd := now + 3*24*3600
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9407, UserId: 305, PlanId: plan.Id, AmountTotal: 1000,
		StartTime: now - 27*24*3600, EndTime: oldEnd, Status: "active", Source: "admin",
	}).Error)

	sub, err := CreateUserSubscriptionFromPlanTx(DB, 305, plan, "admin")
	require.NoError(t, err)
	assert.Equal(t, oldEnd, sub.LastResetTime)
	assert.Equal(t, calcNextResetTime(time.Unix(oldEnd, 0), plan, sub.EndTime), sub.NextResetTime)
}

// 还没到生效时间的订阅，额度不能被提前动用。
func TestPreConsumeSkipsNotYetStartedSubscription(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := seedRenewalPlan(t, 9307, SubscriptionResetNever)
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9408, UserId: 306, PlanId: plan.Id, AmountTotal: 1000, AmountUsed: 950,
		StartTime: now - 27*24*3600, EndTime: now + 3*24*3600, Status: "active", Source: "admin",
	}).Error)
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9409, UserId: 306, PlanId: plan.Id, AmountTotal: 1000,
		StartTime: now + 3*24*3600, EndTime: now + 33*24*3600, Status: "active", Source: "admin",
	}).Error)

	_, err := PreConsumeUserSubscription("req-renewal-1", 306, "gpt-test", 0, 200)
	require.Error(t, err, "当前生效订阅额度不足时不应动用未生效订阅的额度")

	res, err := PreConsumeUserSubscription("req-renewal-2", 306, "gpt-test", 0, 50)
	require.NoError(t, err)
	assert.Equal(t, 9408, res.UserSubscriptionId)
}

// 只有未生效订阅时，等同于当前没有可用订阅（否则计费会卡在订阅路径上不回落钱包）。
func TestActiveSubscriptionChecksIgnoreNotYetStarted(t *testing.T) {
	truncateTables(t)

	now := GetDBTimestamp()
	plan := seedRenewalPlan(t, 9308, SubscriptionResetNever)
	disallowOverflow := false
	plan.AllowWalletOverflow = &disallowOverflow
	require.NoError(t, DB.Create(&UserSubscription{
		Id: 9410, UserId: 307, PlanId: plan.Id, AmountTotal: 1000,
		StartTime: now + 3*24*3600, EndTime: now + 33*24*3600, Status: "active", Source: "admin",
		AllowWalletOverflow: false,
	}).Error)

	has, err := HasActiveUserSubscription(307)
	require.NoError(t, err)
	assert.False(t, has, "未生效订阅不应被当作当前可用订阅")

	allowOverflow, err := UserActiveSubscriptionsAllowWalletOverflow(307)
	require.NoError(t, err)
	assert.True(t, allowOverflow, "未生效订阅不应阻止钱包回退")
}
