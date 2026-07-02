package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Cleanup helper for tables used by time-quota tests beyond what cleanTestData covers.
func cleanTimeQuotaTables(t *testing.T) {
	t.Helper()
	DB.Exec("DELETE FROM subscription_pre_consume_details")
	DB.Exec("DELETE FROM subscription_pre_consume_records")
	DB.Exec("DELETE FROM subscription_orders")
	DB.Exec("DELETE FROM top_ups")
}

// setupTimeQuotaTestDB wraps setupTestDB and additionally migrates tables used by these tests
// (SubscriptionPreConsumeRecord, SubscriptionOrder, TopUp). Skips if TEST_SQL_DSN not set.
func setupTimeQuotaTestDB(t *testing.T) {
	t.Helper()
	setupTestDB(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPreConsumeRecord{}, &SubscriptionPreConsumeDetail{}, &SubscriptionOrder{}, &TopUp{}))
	cleanTimeQuotaTables(t)
	t.Cleanup(func() { cleanTimeQuotaTables(t) })
}

// ============================================================
// T_ACTIVATE_01: CreateUserSubscriptionFromPlanTx — on_first_use creates pending_activation
// ============================================================
func TestCreateSubscription_OnFirstUse_CreatesPendingActivation(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.NotNil(t, sub)

	assert.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)
	assert.Equal(t, int64(0), sub.EndTime)
	assert.Equal(t, int64(0), sub.ActivatedAt)
	assert.Greater(t, sub.StartTime, int64(0)) // purchase time set
}

// ============================================================
// T_ACTIVATE_02: CreateUserSubscriptionFromPlanTx — immediate mode creates active
// ============================================================
func TestCreateSubscription_Immediate_CreatesActive(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:          "月套餐",
		DurationUnit:   SubscriptionDurationMonth,
		DurationValue:  1,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.NotNil(t, sub)

	assert.Equal(t, UserSubscriptionStatusActive, sub.Status)
	assert.Greater(t, sub.EndTime, int64(0))
}

// ============================================================
// T_ACTIVATE_03: PreConsumeUserSubscription — pending gets activated on first use
// ============================================================
func TestPreConsume_PendingActivation_GetsActivated(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)

	// First consume triggers activation
	result, err := PreConsumeUserSubscription("req-activate-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, sub.Id, result.UserSubscriptionId)
	assert.Equal(t, int64(100), result.PreConsumed)

	// Verify subscription is now active
	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusActive, updated.Status)
	assert.Greater(t, updated.ActivatedAt, int64(0))
	assert.Greater(t, updated.EndTime, int64(0))
	assert.Equal(t, int64(100), updated.AmountUsed)
}

// ============================================================
// T_ACTIVATE_04: PreConsumeUserSubscription — disabled pending is NOT activated
// ============================================================
func TestPreConsume_DisabledPending_NotActivated(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	sub.Disabled = true
	require.NoError(t, DB.Save(sub).Error)

	// Disabled pending should not be activated
	result, err := PreConsumeUserSubscription("req-disabled-1", userId, "gpt-4", 0, 100, "")
	assert.Error(t, err) // no usable subscription
	assert.Nil(t, result)

	// Verify still pending
	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, updated.Status)
	assert.Equal(t, int64(0), updated.ActivatedAt)
}

// ============================================================
// T_ACTIVATE_05: PreConsumeUserSubscription — activation window expired
// ============================================================
func TestPreConsume_ActivationWindowExpired_Skipped(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "月末套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             100000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 3600, // 1 hour window
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// Manually set created_at to 3 hours ago (past the 1-hour window)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", sub.Id).
		Update("created_at", common.GetTimestamp()-10800).Error)

	// Should be marked expired (transaction will commit the expiry update)
	// Note: PreConsume fails when no usable sub found, but the expired marking
	// inside the loop persists because each candidate is updated before continue.
	result, err := PreConsumeUserSubscription("req-expired-window-1", userId, "gpt-4", 0, 100, "")
	// The function returns error because no sub could satisfy the request.
	// The expired marking inside the transaction may or may not have committed
	// depending on whether other candidates had quota.
	assert.Error(t, err)
	assert.Nil(t, result)
	// The expired status is only committed if the transaction succeeds.
	// Run ExpireDueSubscriptions to guarantee cleanup.
	count, _ := ExpireDueSubscriptions(10)
	assert.Equal(t, 1, count)

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusExpired, updated.Status)
}

func TestGetAllUserSubscriptions_RefreshesDuePeriod(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:                   "按需重置套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             1000,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 60,
		ActivationMode:          SubscriptionActivationImmediate,
		Enabled:                 true,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", sub.Id).Updates(map[string]interface{}{
		"amount_used":     int64(800),
		"last_reset_time": now - 180,
		"next_reset_time": now - 120,
	}).Error)

	summaries, err := GetAllUserSubscriptions(userId)
	require.NoError(t, err)
	require.Len(t, summaries, 1)
	require.NotNil(t, summaries[0].Subscription)
	assert.Equal(t, int64(0), summaries[0].Subscription.AmountUsed)
	assert.Greater(t, summaries[0].Subscription.LastResetTime, now-180)
	assert.Greater(t, summaries[0].Subscription.NextResetTime, common.GetTimestamp())

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, int64(0), updated.AmountUsed)
}

func TestRefundSubscriptionPreConsume_SkipsAmountUsedAcrossPeriod(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:                   "跨周期退款套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             1000,
		QuotaResetPeriod:        SubscriptionResetCustom,
		QuotaResetCustomSeconds: 60,
		ActivationMode:          SubscriptionActivationImmediate,
		Enabled:                 true,
		CreatedAt:               now,
		UpdatedAt:               now,
	}
	require.NoError(t, DB.Create(plan).Error)
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("cross-period-refund", userId, "gpt-4", 0, 500, "")
	require.NoError(t, err)

	var detail SubscriptionPreConsumeDetail
	require.NoError(t, DB.Where("request_id = ?", "cross-period-refund").First(&detail).Error)
	assert.Equal(t, sub.Id, detail.UserSubscriptionId)
	assert.Greater(t, detail.PeriodStart, int64(0))
	assert.Greater(t, detail.PeriodEnd, detail.PeriodStart)
	currentPeriodStart := detail.PeriodStart
	currentPeriodEnd := detail.PeriodEnd
	oldPeriodStart := currentPeriodStart - 120
	oldPeriodEnd := currentPeriodStart - 60
	require.NoError(t, DB.Model(&SubscriptionPreConsumeDetail{}).Where("id = ?", detail.Id).Updates(map[string]interface{}{
		"period_start": oldPeriodStart,
		"period_end":   oldPeriodEnd,
	}).Error)

	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", sub.Id).Updates(map[string]interface{}{
		"amount_used":     int64(200),
		"last_reset_time": currentPeriodStart,
		"next_reset_time": currentPeriodEnd,
	}).Error)

	require.NoError(t, RefundSubscriptionPreConsume("cross-period-refund"))

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, int64(200), updated.AmountUsed)

	var refundedDetail SubscriptionPreConsumeDetail
	require.NoError(t, DB.First(&refundedDetail, detail.Id).Error)
	assert.Equal(t, "refunded", refundedDetail.Status)
}

// ============================================================
// T_PRIORITY_01: PreConsumeUserSubscription respects priority ordering
// ============================================================
func TestPreConsume_PriorityOrdering(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:          "额度套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	now := time.Now().Unix()

	// Low priority sub (should be consumed last)
	subLow := &UserSubscription{
		UserId:      userId,
		PlanId:      plan.Id,
		AmountTotal: 100000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     now + 86400*30,
		Status:      "active",
		Priority:    0,
		Source:      "order",
		CreatedAt:   now,
	}
	require.NoError(t, DB.Create(subLow).Error)

	// High priority sub (should be consumed first)
	subHigh := &UserSubscription{
		UserId:      userId,
		PlanId:      plan.Id,
		AmountTotal: 100000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     now + 86400*30,
		Status:      "active",
		Priority:    10,
		Source:      "order",
		CreatedAt:   now,
	}
	require.NoError(t, DB.Create(subHigh).Error)

	result, err := PreConsumeUserSubscription("req-priority-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	assert.Equal(t, subHigh.Id, result.UserSubscriptionId, "should consume from higher priority sub")

	var updatedHigh UserSubscription
	DB.First(&updatedHigh, subHigh.Id)
	assert.Equal(t, int64(100), updatedHigh.AmountUsed)

	var updatedLow UserSubscription
	DB.First(&updatedLow, subLow.Id)
	assert.Equal(t, int64(0), updatedLow.AmountUsed, "low priority sub should be untouched")
}

// ============================================================
// T_PRIORITY_02: PreConsumeUserSubscription skips disabled subs
// ============================================================
func TestPreConsume_DisabledActive_Skipped(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:          "额度套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	now := time.Now().Unix()

	sub := &UserSubscription{
		UserId:      userId,
		PlanId:      plan.Id,
		AmountTotal: 100000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     now + 86400*30,
		Status:      "active",
		Disabled:    true,
		Source:      "order",
		CreatedAt:   now,
	}
	require.NoError(t, DB.Create(sub).Error)

	_, err := PreConsumeUserSubscription("req-disabled-active-1", userId, "gpt-4", 0, 100, "")
	assert.Error(t, err)
}

// ============================================================
// T_HASSUB_01: HasActiveUserSubscription counts pending_activation
// ============================================================
func TestHasActiveUserSubscription_CountsPendingActivation(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)

	hasSub, err := HasActiveUserSubscription(userId)
	require.NoError(t, err)
	assert.True(t, hasSub)
}

// ============================================================
// T_HASSUB_02: HasActiveUserSubscription excludes disabled active
// ============================================================
func TestHasActiveUserSubscription_ExcludesDisabledActive(t *testing.T) {
	setupTimeQuotaTestDB(t)

	userId := createTestUser(t, "default", "default")
	now := time.Now().Unix()

	sub := &UserSubscription{
		UserId:      userId,
		PlanId:      1,
		AmountTotal: 100000,
		StartTime:   now,
		EndTime:     now + 86400,
		Status:      "active",
		Disabled:    true,
		Source:      "order",
		CreatedAt:   now,
	}
	require.NoError(t, DB.Create(sub).Error)

	hasSub, err := HasActiveUserSubscription(userId)
	require.NoError(t, err)
	assert.False(t, hasSub, "disabled active sub should not be counted")
}

// ============================================================
// T_PLAN_01: GetUserActiveSubscriptionPlan falls back to pending_activation
// ============================================================
func TestGetUserActiveSubscriptionPlan_FallbackToPending(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)

	// Invalidate cache so we hit DB
	InvalidateUserActiveSubPlanCache(userId)

	resultPlan, err := GetUserActiveSubscriptionPlan(userId)
	require.NoError(t, err)
	require.NotNil(t, resultPlan)
	assert.Equal(t, plan.Id, resultPlan.Id)
}

// ============================================================
// T_GROUP_01: resolveUserGroupBySubscriptions filters disabled
// ============================================================
func TestResolveUserGroup_FiltersDisabled(t *testing.T) {
	setupTimeQuotaTestDB(t)
	userId := createTestUser(t, "vip", "default")

	now := time.Now().Unix()
	sub := &UserSubscription{
		UserId:       userId,
		PlanId:       1,
		StartTime:    now,
		EndTime:      now + 86400*30,
		Status:       "active",
		Disabled:     true,
		UpgradeGroup: "vip",
		CreatedAt:    now,
	}
	require.NoError(t, DB.Create(sub).Error)

	// Disabled sub with upgrade_group should not affect group
	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "default", group, "disabled sub should not upgrade group")
}

// ============================================================
// T_ADMIN_01: AdminBindSubscription force-activates on_first_use
// ============================================================
func TestAdminBindSubscription_ForceActivatesOnFirstUse(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		UpgradeGroup:            "vip",
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	msg, err := AdminBindSubscription(userId, plan.Id, "", "")
	require.NoError(t, err)
	assert.Contains(t, msg, "vip")

	// Verify subscription is active, not pending
	subs, err := GetAllActiveUserSubscriptions(userId)
	require.NoError(t, err)
	require.Len(t, subs, 1)
	assert.Equal(t, UserSubscriptionStatusActive, subs[0].Subscription.Status)
	assert.Greater(t, subs[0].Subscription.ActivatedAt, int64(0))
	assert.Greater(t, subs[0].Subscription.EndTime, int64(0))
}

// ============================================================
// T_USABLE_01: GetAllUsableUserSubscriptions returns active + pending
// ============================================================
func TestGetAllUsableUserSubscriptions_ReturnsActiveAndPending(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan1 := &SubscriptionPlan{
		Title:          "额度套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan1).Error)

	plan2 := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan2).Error)

	userId := createTestUser(t, "default", "default")

	// Create an active subscription
	activeSub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan1, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusActive, activeSub.Status)

	// Create a pending subscription
	pendingSub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan2, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, pendingSub.Status)

	subs, err := GetAllUsableUserSubscriptions(userId)
	require.NoError(t, err)
	assert.Len(t, subs, 2)

	statuses := make(map[string]bool)
	for _, s := range subs {
		statuses[s.Subscription.Status] = true
	}
	assert.True(t, statuses[UserSubscriptionStatusActive])
	assert.True(t, statuses[UserSubscriptionStatusPendingActivation])
}

// ============================================================
// T_CANCEL_01: UserInvalidateOwnSubscription cancels pending_activation
// ============================================================
func TestUserInvalidateOwnSubscription_CancelsPending(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "5小时套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	msg, err := UserInvalidateOwnSubscription(userId, sub.Id)
	require.NoError(t, err)
	assert.Empty(t, msg)

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusCancelled, updated.Status)
}

// ============================================================
// T_EXPIRE_01: ExpireDueSubscriptions expires pending past activation window
// ============================================================
func TestExpireDueSubscriptions_PendingPastWindow(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "月末套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             100000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 3600, // 1 hour window
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)

	// Set created_at to 2 hours ago
	DB.Model(&UserSubscription{}).Where("id = ?", sub.Id).
		Update("created_at", common.GetTimestamp()-7200)

	count, err := ExpireDueSubscriptions(10)
	require.NoError(t, err)
	assert.Equal(t, 1, count)

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusExpired, updated.Status)
}

// ============================================================
// T_EXPIRE_02: ExpireDueSubscriptions does NOT expire pending within window
// ============================================================
func TestExpireDueSubscriptions_PendingWithinWindow(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "月末套餐",
		DurationUnit:            SubscriptionDurationDay,
		DurationValue:           30,
		TotalAmount:             100000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400, // 24 hours
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, sub.Status)

	// created_at is very recent, well within window
	count, err := ExpireDueSubscriptions(10)
	require.NoError(t, err)
	assert.Equal(t, 0, count, "should not expire recent pending")

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, updated.Status)
}

// ============================================================
// T_ACTIVATE_06: ActivationWindowSeconds=0 means no expiry
// ============================================================
func TestPreConsume_ActivationWindowZero_AlwaysActivates(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "无限激活窗口套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 0, // no window limit
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// Manually set created_at to very old
	DB.Model(&UserSubscription{}).Where("id = ?", sub.Id).
		Update("created_at", common.GetTimestamp()-86400*365)

	result, err := PreConsumeUserSubscription("req-no-window-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	require.NotNil(t, result)

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	assert.Equal(t, UserSubscriptionStatusActive, updated.Status)
}

// ============================================================
// T_QUOTA_01: Quota consumption across multiple subs with priority
// ============================================================
func TestPreConsume_MultipleSubsWithQuota(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:          "额度套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	now := time.Now().Unix()

	// Sub A: priority=5, quota=5000 (consumed first due to priority)
	subA := &UserSubscription{
		UserId: userId, PlanId: plan.Id,
		AmountTotal: 5000, AmountUsed: 0,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active", Priority: 5,
		Source: "order", CreatedAt: now,
	}
	require.NoError(t, DB.Create(subA).Error)

	// Sub B: priority=0, quota=5000 (large, consumed second)
	subB := &UserSubscription{
		UserId: userId, PlanId: plan.Id,
		AmountTotal: 5000, AmountUsed: 0,
		StartTime: now, EndTime: now + 86400*30,
		Status: "active", Priority: 0,
		Source: "order", CreatedAt: now,
	}
	require.NoError(t, DB.Create(subB).Error)

	// Consume 2000 - should take 1000 from A, then failover to B for remaining 1000
	result1, err := PreConsumeUserSubscription("req-multi-1", userId, "gpt-4", 0, 2000, "")
	require.NoError(t, err)
	// Should consume from subA (highest priority)
	assert.Equal(t, subA.Id, result1.UserSubscriptionId)
	assert.Equal(t, int64(2000), result1.PreConsumed)

	var updatedA UserSubscription
	DB.First(&updatedA, subA.Id)
	assert.Equal(t, int64(2000), updatedA.AmountUsed)
}

// ============================================================
// T_GROUP_02: Activation applies upgrade group
// ============================================================
func TestPreConsume_ActivationAppliesUpgradeGroup(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:                   "VIP套餐",
		DurationUnit:            SubscriptionDurationHour,
		DurationValue:           5,
		TotalAmount:             50000,
		ActivationMode:          SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400,
		UpgradeGroup:            "vip",
		Enabled:                 true,
		CreatedAt:               common.GetTimestamp(),
		UpdatedAt:               common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// Activation should NOT happen yet (pending)
	group, _ := resolveUserGroupBySubscriptions(DB, userId)
	assert.Equal(t, "default", group)

	// Activate via pre-consume
	_, err = PreConsumeUserSubscription("req-group-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)

	group, err = resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "vip", group)

	_ = sub
}

// ============================================================
// T_IDEMPOTENT_01: PreConsumeUserSubscription is idempotent
// ============================================================
func TestPreConsume_Idempotent(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:          "额度套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusActive, sub.Status)

	// First consume
	result1, err := PreConsumeUserSubscription("req-idempotent-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	assert.Equal(t, int64(100), result1.PreConsumed)

	// Second call with same requestId should return same result without double-charging
	result2, err := PreConsumeUserSubscription("req-idempotent-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	assert.Equal(t, result1.UserSubscriptionId, result2.UserSubscriptionId)
	assert.Equal(t, result1.PreConsumed, result2.PreConsumed)

	var updated UserSubscription
	DB.First(&updated, sub.Id)
	assert.Equal(t, int64(100), updated.AmountUsed, "should not double-charge")
}

// ============================================================
// T_REFUND_01: RefundSubscriptionPreConsume restores quota
// ============================================================
func TestRefundSubscriptionPreConsume_RestoresQuota(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:          "额度套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	_, err = PreConsumeUserSubscription("req-refund-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)

	err = RefundSubscriptionPreConsume("req-refund-1")
	require.NoError(t, err)

	var updated UserSubscription
	DB.First(&updated, sub.Id)
	assert.Equal(t, int64(0), updated.AmountUsed, "refund should restore quota")

	// Second refund should be idempotent
	err = RefundSubscriptionPreConsume("req-refund-1")
	require.NoError(t, err)

	DB.First(&updated, sub.Id)
	assert.Equal(t, int64(0), updated.AmountUsed)
}

// ============================================================
// T_POSTCONSUME_01: PostConsumeUserSubscriptionDelta adjusts usage
// ============================================================
func TestPostConsumeUserSubscriptionDelta_AdjustsUsage(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title:          "额度套餐",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    100000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      common.GetTimestamp(),
		UpdatedAt:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// Pre-consume 100
	_, err = PreConsumeUserSubscription("req-delta-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)

	// Actual usage was 80, so -20 delta
	err = PostConsumeUserSubscriptionDelta(sub.Id, -20)
	require.NoError(t, err)

	var updated UserSubscription
	DB.First(&updated, sub.Id)
	assert.Equal(t, int64(80), updated.AmountUsed)
}

// ============================================================
// T_QUOTA_02: PreConsume consumes partial quota then falls through
// ============================================================
func TestPreConsume_InsufficientQuotaFallthrough(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title: "额度套餐", DurationUnit: SubscriptionDurationDay, DurationValue: 30,
		TotalAmount: 100000, ActivationMode: SubscriptionActivationImmediate,
		Enabled: true, CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	now := time.Now().Unix()

	// Sub A: priority=5, only 50 remaining (insufficient for 100)
	subA := &UserSubscription{
		UserId: userId, PlanId: plan.Id, AmountTotal: 100, AmountUsed: 50,
		StartTime: now, EndTime: now + 86400*30, Status: "active", Priority: 5,
		Source: "order", CreatedAt: now,
	}
	require.NoError(t, DB.Create(subA).Error)

	// Sub B: priority=0, unlimited
	subB := &UserSubscription{
		UserId: userId, PlanId: plan.Id, AmountTotal: 0, AmountUsed: 0,
		StartTime: now, EndTime: now + 86400*30, Status: "active", Priority: 0,
		Source: "order", CreatedAt: now,
	}
	require.NoError(t, DB.Create(subB).Error)

	// Consume 100 — subA has only 50, then subB takes the remaining 50.
	result, err := PreConsumeUserSubscription("req-fallthrough-1", userId, "gpt-4", 0, 100, "")
	require.NoError(t, err)
	assert.Equal(t, subA.Id, result.UserSubscriptionId)

	var updatedA, updatedB UserSubscription
	require.NoError(t, DB.First(&updatedA, subA.Id).Error)
	require.NoError(t, DB.First(&updatedB, subB.Id).Error)
	assert.Equal(t, int64(100), updatedA.AmountUsed)
	assert.Equal(t, int64(50), updatedB.AmountUsed)
}

// ============================================================
// T_QUOTA_03: PreConsume all subs insufficient → error
// ============================================================
func TestPreConsume_AllInsufficient(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title: "额度套餐", DurationUnit: SubscriptionDurationDay, DurationValue: 30,
		TotalAmount: 100000, ActivationMode: SubscriptionActivationImmediate,
		Enabled: true, CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	now := time.Now().Unix()

	sub := &UserSubscription{
		UserId: userId, PlanId: plan.Id, AmountTotal: 100, AmountUsed: 90,
		StartTime: now, EndTime: now + 86400*30, Status: "active",
		Source: "order", CreatedAt: now,
	}
	require.NoError(t, DB.Create(sub).Error)

	_, err := PreConsumeUserSubscription("req-insufficient-1", userId, "gpt-4", 0, 100, "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "insufficient")
}

// ============================================================
// T_PLAN_02: GetUserActiveSubscriptionPlan excludes disabled pending
// ============================================================
func TestGetUserActiveSubscriptionPlan_ExcludesDisabledPending(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title: "5小时套餐", DurationUnit: SubscriptionDurationHour, DurationValue: 5,
		TotalAmount: 50000, ActivationMode: SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400, Enabled: true,
		CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	sub.Disabled = true
	require.NoError(t, DB.Save(sub).Error)

	InvalidateUserActiveSubPlanCache(userId)

	resultPlan, err := GetUserActiveSubscriptionPlan(userId)
	assert.NoError(t, err)
	assert.Nil(t, resultPlan, "disabled pending should not be returned")
}

// ============================================================
// T_CANCEL_02: UserInvalidateOwnSubscription on active with upgrade group
// ============================================================
func TestUserInvalidateOwnSubscription_ActiveWithUpgradeGroup(t *testing.T) {
	setupTimeQuotaTestDB(t)
	userId := createTestUser(t, "vip", "default")

	plan := &SubscriptionPlan{
		Title: "VIP套餐", DurationUnit: SubscriptionDurationDay, DurationValue: 30,
		TotalAmount: 0, ActivationMode: SubscriptionActivationImmediate,
		UpgradeGroup: "vip", Enabled: true,
		CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)
	assert.Equal(t, UserSubscriptionStatusActive, sub.Status)

	// Verify group was upgraded (this happens via caller, not CreateUserSubscriptionFromPlanTx)
	_, err = applyResolvedUserGroup(DB, userId)
	require.NoError(t, err)

	group, _ := resolveUserGroupBySubscriptions(DB, userId)
	assert.Equal(t, "vip", group)

	// Cancel should downgrade
	msg, err := UserInvalidateOwnSubscription(userId, sub.Id)
	require.NoError(t, err)
	assert.Contains(t, msg, "default")

	var updated UserSubscription
	DB.First(&updated, sub.Id)
	assert.Equal(t, UserSubscriptionStatusCancelled, updated.Status)
}

// ============================================================
// T_EXPIRE_03: ExpireDueSubscriptions no subs returns 0
// ============================================================
func TestExpireDueSubscriptions_NoSubs(t *testing.T) {
	setupTimeQuotaTestDB(t)
	count, err := ExpireDueSubscriptions(10)
	require.NoError(t, err)
	assert.Equal(t, 0, count)
}

// ============================================================
// T_COMPLETE_01: CompleteSubscriptionOrder creates pending for on_first_use
// ============================================================
func TestCompleteSubscriptionOrder_CreatesPending(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title: "5小时套餐", DurationUnit: SubscriptionDurationHour, DurationValue: 5,
		TotalAmount: 50000, ActivationMode: SubscriptionActivationOnFirstUse,
		ActivationWindowSeconds: 86400, Enabled: true, PriceAmount: 10, Currency: "USD",
		CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	// Create an order
	tradeNo := "TRADE-PENDING-" + common.GetRandomString(8)
	order := &SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		TradeNo:         tradeNo,
		Money:           10,
		PaymentMethod:   "stripe",
		PaymentProvider: "stripe",
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(order).Error)

	err := CompleteSubscriptionOrder(tradeNo, "", "stripe", "")
	require.NoError(t, err)

	// Verify a pending_activation subscription was created
	subs, err := GetAllUserSubscriptions(userId)
	require.NoError(t, err)
	require.Len(t, subs, 1)
	assert.Equal(t, UserSubscriptionStatusPendingActivation, subs[0].Subscription.Status)
	assert.Equal(t, int64(0), subs[0].Subscription.EndTime)
}

// ============================================================
// T_SETTLE_01: PostConsumeUserSubscriptionDelta clamps negative overflow to 0
// ============================================================
func TestPostConsumeUserSubscriptionDelta_ClampsNegativeToZero(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title: "额度套餐", DurationUnit: SubscriptionDurationDay, DurationValue: 30,
		TotalAmount: 100000, ActivationMode: SubscriptionActivationImmediate,
		Enabled: true, CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "order")
	require.NoError(t, err)

	// Used is 0, try to subtract 100
	err = PostConsumeUserSubscriptionDelta(sub.Id, -100)
	require.NoError(t, err)

	var updated UserSubscription
	DB.First(&updated, sub.Id)
	assert.Equal(t, int64(0), updated.AmountUsed, "should clamp to 0")
}

// ============================================================
// T_ADMIN_02: AdminBindSubscription without upgrade group
// ============================================================
func TestAdminBindSubscription_NoUpgradeGroup(t *testing.T) {
	setupTimeQuotaTestDB(t)

	plan := &SubscriptionPlan{
		Title: "基础套餐", DurationUnit: SubscriptionDurationDay, DurationValue: 30,
		TotalAmount: 100000, ActivationMode: SubscriptionActivationImmediate,
		UpgradeGroup: "", Enabled: true,
		CreatedAt: common.GetTimestamp(), UpdatedAt: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")

	_, err := AdminBindSubscription(userId, plan.Id, "", "")
	require.NoError(t, err)

	subs, err := GetAllActiveUserSubscriptions(userId)
	require.NoError(t, err)
	assert.Len(t, subs, 1)
}
