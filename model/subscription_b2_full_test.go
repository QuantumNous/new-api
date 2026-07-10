package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// B2 Payment: complete / expire / idempotent / max purchase
// ============================================================

func TestB2_CompleteSubscriptionOrder_Immediate_CreatesActiveAndTopUp(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "B2-pay-immediate",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    50000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		WindowLimit24h: 10000,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")

	tradeNo := "B2-TRADE-" + common.GetRandomString(8)
	order := &SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           9.9,
		TradeNo:         tradeNo,
		PaymentMethod:   "alipay",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusPending,
		CreateTime:      now,
	}
	require.NoError(t, order.Insert())

	require.NoError(t, CompleteSubscriptionOrder(tradeNo, `{"ok":true}`, PaymentProviderEpay, "alipay"))

	// order success
	got := GetSubscriptionOrderByTradeNo(tradeNo)
	require.NotNil(t, got)
	assert.Equal(t, common.TopUpStatusSuccess, got.Status)

	// subscription created active
	subs, err := GetAllUserSubscriptions(userId)
	require.NoError(t, err)
	require.NotEmpty(t, subs)
	assert.Equal(t, UserSubscriptionStatusActive, subs[0].Subscription.Status)
	assert.Equal(t, plan.Id, subs[0].Subscription.PlanId)
	// windows not opened until consume
	assert.Equal(t, int64(0), subs[0].Subscription.WindowStart24h)

	// topup mirrored
	top := GetTopUpByTradeNo(tradeNo)
	require.NotNil(t, top)
	assert.Equal(t, common.TopUpStatusSuccess, top.Status)

	// idempotent second complete
	require.NoError(t, CompleteSubscriptionOrder(tradeNo, `{"ok":true}`, PaymentProviderEpay, "alipay"))
	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", userId).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestB2_CompleteSubscriptionOrder_OnFirstUse_CreatesPending(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:                   "B2-pay-pending",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             20000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		WindowLimit5h:           5000,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	tradeNo := "B2-PEND-" + common.GetRandomString(8)
	require.NoError(t, (&SubscriptionOrder{
		UserId: userId, PlanId: plan.Id, Money: 1, TradeNo: tradeNo,
		PaymentMethod: "stripe", PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusPending, CreateTime: now,
	}).Insert())

	require.NoError(t, CompleteSubscriptionOrder(tradeNo, "", PaymentProviderStripe, "card"))

	subs, err := GetAllUserSubscriptions(userId)
	require.NoError(t, err)
	require.Len(t, subs, 1)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, subs[0].Subscription.Status)
	assert.Equal(t, int64(0), subs[0].Subscription.EndTime)
	assert.Equal(t, int64(0), subs[0].Subscription.WindowStart5h)
}

func TestB2_ExpireSubscriptionOrder_Success(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := createWindowPlan(t, "B2-expire-order", SubscriptionActivationImmediate, 0, 0, 0, 0, 1000)
	userId := createTestUser(t, "default", "default")
	tradeNo := "B2-EXP-" + common.GetRandomString(8)
	require.NoError(t, (&SubscriptionOrder{
		UserId: userId, PlanId: plan.Id, Money: 1, TradeNo: tradeNo,
		PaymentMethod: "creem", PaymentProvider: PaymentProviderCreem,
		Status: common.TopUpStatusPending, CreateTime: now,
	}).Insert())

	require.NoError(t, ExpireSubscriptionOrder(tradeNo, PaymentProviderCreem))
	order := GetSubscriptionOrderByTradeNo(tradeNo)
	require.NotNil(t, order)
	assert.Equal(t, common.TopUpStatusExpired, order.Status)
	assert.Equal(t, int64(0), countUserSubscriptionsForPaymentGuardTest(t, userId))

	// expire again is no-op success
	require.NoError(t, ExpireSubscriptionOrder(tradeNo, PaymentProviderCreem))
}

func TestB2_MaxPurchasePerUser_BlocksExtra(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:              "B2-max-purchase",
		DurationUnit:       SubscriptionDurationDay,
		DurationValue:      7,
		TotalAmount:        1000,
		ActivationMode:     SubscriptionActivationImmediate,
		Enabled:            true,
		MaxPurchasePerUser: 1,
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")

	_, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	_, err = CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.ErrorIs(t, err, ErrSubscriptionPurchaseLimit)
}

// ============================================================
// B2 Redemption type 2
// ============================================================

func TestB2_Redeem_Type2_CreatesSubscription(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := createWindowPlan(t, "B2-redeem-plan", SubscriptionActivationImmediate, 0, 5000, 0, 0, 20000)
	userId := createTestUser(t, "default", "default")

	key := "REDEEM-B2-" + common.GetRandomString(10)
	r := &Redemption{
		Key:                key,
		Status:             common.RedemptionCodeStatusEnabled,
		Name:               "b2-sub",
		Quota:              0,
		CreatedTime:        now,
		Type:               common.RedemptionTypeSubscription,
		SubscriptionPlanId: plan.Id,
	}
	require.NoError(t, DB.Create(r).Error)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	require.NotNil(t, result)

	subs, err := GetAllActiveUserSubscriptions(userId)
	require.NoError(t, err)
	require.NotEmpty(t, subs)
	assert.Equal(t, plan.Id, subs[0].Subscription.PlanId)
}

// ============================================================
// B2 Calendar reset schedule via EnsureUserSubscriptionPeriodFresh
// ============================================================

func TestB2_QuotaReset_Daily_AdvancesAtMidnight(t *testing.T) {
	setupTimeQuotaTestDB(t)

	loc := time.Local
	// 15:00 local today
	base := time.Date(2026, 7, 10, 15, 0, 0, 0, loc)
	withTestDBTime(t, base.Unix())

	plan := &SubscriptionPlan{
		Title:            "B2-daily-reset",
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    30,
		TotalAmount:      10000,
		ActivationMode:   SubscriptionActivationImmediate,
		Enabled:          true,
		QuotaResetPeriod: SubscriptionResetDaily,
		CreatedAt:        base.Unix(),
		UpdatedAt:        base.Unix(),
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.Greater(t, sub.NextResetTime, int64(0))

	_, err = PreConsumeUserSubscription("b2-daily-use", userId, "gpt-4", 0, 300, "")
	require.NoError(t, err)

	// Jump to after next midnight
	withTestDBTime(t, sub.NextResetTime+1)
	refreshed, err := EnsureUserSubscriptionPeriodFresh(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), refreshed.AmountUsed)
	assert.Greater(t, refreshed.NextResetTime, sub.NextResetTime)
}

func TestB2_QuotaReset_WeeklyAndMonthly_Schedule(t *testing.T) {
	// pure schedule check already in TestB1_CalcNextResetTime; add integration for weekly
	setupTimeQuotaTestDB(t)

	loc := time.Local
	// pick a Wednesday
	base := time.Date(2026, 7, 8, 10, 0, 0, 0, loc) // Wed
	withTestDBTime(t, base.Unix())

	plan := &SubscriptionPlan{
		Title:            "B2-weekly-reset",
		DurationUnit:     SubscriptionDurationDay,
		DurationValue:    60,
		TotalAmount:      10000,
		ActivationMode:   SubscriptionActivationImmediate,
		Enabled:          true,
		QuotaResetPeriod: SubscriptionResetWeekly,
		CreatedAt:        base.Unix(),
		UpdatedAt:        base.Unix(),
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b2-weekly-use", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)

	withTestDBTime(t, sub.NextResetTime+1)
	refreshed, err := EnsureUserSubscriptionPeriodFresh(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), refreshed.AmountUsed)
}

// ============================================================
// B2 Hybrid partial + wallet remainder is model-level partial API
// ============================================================

func TestB2_Partial_ThenSecondSubOrFail(t *testing.T) {
	setupTimeQuotaTestDB(t)

	planA := createWindowPlan(t, "B2-hybrid-A", SubscriptionActivationImmediate, 0, 0, 0, 0, 100)
	planB := createWindowPlan(t, "B2-hybrid-B", SubscriptionActivationImmediate, 0, 0, 0, 0, 1000)
	userId := createTestUser(t, "default", "default")
	subA, err := CreateUserSubscriptionFromPlanTx(DB, userId, planA, "order")
	require.NoError(t, err)
	subB, err := CreateUserSubscriptionFromPlanTx(DB, userId, planB, "order")
	require.NoError(t, err)
	require.NoError(t, DB.Model(subA).Update("priority", 10).Error)
	require.NoError(t, DB.Model(subB).Update("priority", 1).Error)

	// Full preconsume 150 should split 100+50
	res, err := PreConsumeUserSubscription("b2-full-split", userId, "gpt-4", 0, 150, "")
	require.NoError(t, err)
	assert.Equal(t, subA.Id, res.UserSubscriptionId)

	var a, b UserSubscription
	require.NoError(t, DB.First(&a, subA.Id).Error)
	require.NoError(t, DB.First(&b, subB.Id).Error)
	assert.Equal(t, int64(100), a.AmountUsed)
	assert.Equal(t, int64(50), b.AmountUsed)
}

// ============================================================
// B2 Admin invalidate + group rollback
// ============================================================

func TestB2_AdminInvalidate_DowngradesGroup(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "B2-vip-plan",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    0,
		ActivationMode: SubscriptionActivationImmediate,
		UpgradeGroup:   "vip",
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")

	_, err := AdminBindSubscription(userId, plan.Id, "", "")
	require.NoError(t, err)
	_, err = applyResolvedUserGroup(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "vip", getUserGroup(t, userId))

	subs, err := GetAllActiveUserSubscriptions(userId)
	require.NoError(t, err)
	require.Len(t, subs, 1)

	msg, err := AdminInvalidateUserSubscription(subs[0].Subscription.Id)
	require.NoError(t, err)
	_ = msg
	assert.Equal(t, "default", getUserGroup(t, userId))
}

// ============================================================
// B2 Window cache invalidation after consume
// ============================================================

func TestB2_WindowCache_InvalidatedOnConsume(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B2-cache", SubscriptionActivationImmediate, 0, 5000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// warm cache with zeros
	u1, err := GetWindowUsageWithCache(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(0), u1["24h"].Used)

	_, err = PreConsumeUserSubscription("b2-cache-use", userId, "gpt-4", 0, 120, "")
	require.NoError(t, err)

	u2, err := GetWindowUsageWithCache(sub.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(120), u2["24h"].Used)
}

// ============================================================
// B2 Plan cache invalidate after update
// ============================================================

func TestB2_PlanCache_InvalidateAfterUpdate(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B2-plan-cache", SubscriptionActivationImmediate, 0, 1000, 0, 0, 0)
	p1, err := GetSubscriptionPlanById(plan.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(1000), p1.WindowLimit24h)

	require.NoError(t, DB.Model(plan).Update("window_limit24h", int64(2000)).Error)
	// without invalidate may still be cached; force invalidate
	InvalidateSubscriptionPlanCache(plan.Id)
	p2, err := GetSubscriptionPlanById(plan.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(2000), p2.WindowLimit24h)
}

// ============================================================
// B2 Toggle disable ownership
// ============================================================

func TestB2_UserToggle_WrongUserRejected(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B2-toggle", SubscriptionActivationImmediate, 0, 0, 0, 0, 1000)
	userA := createTestUser(t, "default", "default")
	userB := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userA, plan, "order")
	require.NoError(t, err)

	err = UserToggleSubscriptionDisabled(userB, sub.Id, true)
	assert.Error(t, err)
}

func TestB2_UserCancel_WrongUserRejected(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B2-cancel", SubscriptionActivationImmediate, 0, 0, 0, 0, 1000)
	userA := createTestUser(t, "default", "default")
	userB := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userA, plan, "order")
	require.NoError(t, err)

	_, err = UserInvalidateOwnSubscription(userB, sub.Id)
	assert.Error(t, err)
}

// ============================================================
// B2 Adjust subscription preconsume + window
// ============================================================

func TestB2_Adjust_PositiveAndNegative_UpdatesWindow(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := createWindowPlan(t, "B2-adjust", SubscriptionActivationImmediate, 5000, 20000, 0, 0, 100000)
	userId := createTestUser(t, "default", "default")
	_, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("b2-adjust-req", userId, "gpt-4", 0, 200, "")
	require.NoError(t, err)

	require.NoError(t, AdjustSubscriptionPreConsume("b2-adjust-req", userId, 100, ""))
	var mid UserSubscription
	require.NoError(t, DB.Where("user_id = ?", userId).First(&mid).Error)
	assert.Equal(t, int64(300), mid.AmountUsed)
	assert.Equal(t, int64(300), mid.WindowUsed24h)

	require.NoError(t, AdjustSubscriptionPreConsume("b2-adjust-req", userId, -150, ""))
	var end UserSubscription
	require.NoError(t, DB.First(&end, mid.Id).Error)
	assert.Equal(t, int64(150), end.AmountUsed)
	assert.Equal(t, int64(150), end.WindowUsed24h)
	assert.Equal(t, mid.WindowStart24h, end.WindowStart24h)
}
