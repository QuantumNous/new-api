package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupGroupTestDB sets up test DB and creates two plans with different allowed_groups.
// Returns (userId, planA_id, planB_id, cleanupFunc).
func setupGroupTestDB(t *testing.T) (int, int, int, func()) {
	t.Helper()
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()

	// Plan A: supports groups default, vip
	planA := &SubscriptionPlan{
		Title:          "Plan-A",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    10000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		AllowedGroups:  "default,vip",
		WindowLimit5h:  1000,
		WindowLimit7d:  5000,
		WindowLimit30d: 10000,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(planA).Error)

	// Plan B: supports groups vip, svip
	planB := &SubscriptionPlan{
		Title:          "Plan-B",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    10000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		AllowedGroups:  "vip,svip",
		WindowLimit5h:  1000,
		WindowLimit7d:  5000,
		WindowLimit30d: 10000,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(planB).Error)

	userId := createTestUser(t, "default", "default")

	cleanup := func() {
		cleanTimeQuotaTables(t)
	}
	return userId, planA.Id, planB.Id, cleanup
}

// createActiveSub creates an active subscription for the given plan with specified priority.
func createActiveSub(t *testing.T, userId, planId, priority int) *UserSubscription {
	t.Helper()
	now := time.Now().Unix()
	sub := &UserSubscription{
		UserId:      userId,
		PlanId:      planId,
		AmountTotal: 10000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     now + 86400*30,
		Status:      "active",
		Priority:    priority,
		Source:      "test",
		CreatedAt:   now,
	}
	require.NoError(t, DB.Create(sub).Error)
	return sub
}

// ============================================================
// Case 1: 两个套餐均生效，请求分组 vip → 命中 A（priority 高）
// ============================================================
func TestGroupRestriction_Case1_BothActive_RequestVip_HitsA(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	subA := createActiveSub(t, userId, planAId, 2) // higher priority
	createActiveSub(t, userId, planBId, 1)

	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case1-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "vip",
	)
	require.NoError(t, err)
	assert.Equal(t, subA.Id, result.UserSubscriptionId,
		"Case 1: should hit Plan-A (higher priority, vip in allowed_groups)")
}

// ============================================================
// Case 5: 两个套餐均生效，请求分组 default → 命中 A，B 被跳过
// ============================================================
func TestGroupRestriction_Case5_BothActive_RequestDefault_HitsA(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	subA := createActiveSub(t, userId, planAId, 2)
	createActiveSub(t, userId, planBId, 1)

	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case5-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "default",
	)
	require.NoError(t, err)
	assert.Equal(t, subA.Id, result.UserSubscriptionId,
		"Case 5: should hit Plan-A (default not in Plan-B allowed_groups)")
}

func TestPreConsumeUserSubscriptionPartial_ConsumesRemainingQuota(t *testing.T) {
	userId, planAId, _, cleanup := setupGroupTestDB(t)
	defer cleanup()

	sub := createActiveSub(t, userId, planAId, 1)
	sub.AmountUsed = 9500
	require.NoError(t, DB.Save(sub).Error)

	result, err := PreConsumeUserSubscriptionPartial(
		fmt.Sprintf("partial-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 1000, "default",
	)
	require.NoError(t, err)
	assert.Equal(t, sub.Id, result.UserSubscriptionId)
	assert.Equal(t, int64(500), result.PreConsumed)

	var refreshed UserSubscription
	require.NoError(t, DB.Where("id = ?", sub.Id).First(&refreshed).Error)
	assert.Equal(t, int64(10000), refreshed.AmountUsed)
}

// ============================================================
// Case 6: 两个套餐均生效，请求分组 svip → 命中 B，A 被跳过
// ============================================================
func TestGroupRestriction_Case6_BothActive_RequestSvip_HitsB(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	createActiveSub(t, userId, planAId, 2) // higher priority but svip not allowed
	subB := createActiveSub(t, userId, planBId, 1)

	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case6-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "svip",
	)
	require.NoError(t, err)
	assert.Equal(t, subB.Id, result.UserSubscriptionId,
		"Case 6: should hit Plan-B (svip not in Plan-A allowed_groups)")
}

// ============================================================
// Case 7: 两个套餐均生效，请求分组不存在 → 无可用订阅
// ============================================================
func TestGroupRestriction_Case7_BothActive_RequestNonexistent_Fails(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	createActiveSub(t, userId, planAId, 2)
	createActiveSub(t, userId, planBId, 1)

	_, err := PreConsumeUserSubscription(
		fmt.Sprintf("case7-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "nonexistent",
	)
	assert.Error(t, err, "Case 7: should fail (no subscription allows 'nonexistent')")
}

// ============================================================
// Case 2: 仅 A 生效，请求分组 vip → 命中 A
// ============================================================
func TestGroupRestriction_Case2_OnlyAActive_RequestVip_HitsA(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	subA := createActiveSub(t, userId, planAId, 2)
	// B is disabled
	subB := createActiveSub(t, userId, planBId, 1)
	require.NoError(t, DB.Model(subB).Update("disabled", true).Error)

	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case2-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "vip",
	)
	require.NoError(t, err)
	assert.Equal(t, subA.Id, result.UserSubscriptionId,
		"Case 2: should hit Plan-A (B is disabled)")
}

// ============================================================
// Case 3: 仅 B 生效，请求分组 vip → 命中 B
// ============================================================
func TestGroupRestriction_Case3_OnlyBActive_RequestVip_HitsB(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	// A is disabled
	subA := createActiveSub(t, userId, planAId, 2)
	require.NoError(t, DB.Model(subA).Update("disabled", true).Error)

	subB := createActiveSub(t, userId, planBId, 1)

	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case3-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "vip",
	)
	require.NoError(t, err)
	assert.Equal(t, subB.Id, result.UserSubscriptionId,
		"Case 3: should hit Plan-B (A is disabled)")
}

// ============================================================
// Case 4: 两个套餐均失效 → 无可用订阅
// ============================================================
func TestGroupRestriction_Case4_BothDisabled_RequestVip_Fails(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	subA := createActiveSub(t, userId, planAId, 2)
	require.NoError(t, DB.Model(subA).Update("disabled", true).Error)
	subB := createActiveSub(t, userId, planBId, 1)
	require.NoError(t, DB.Model(subB).Update("disabled", true).Error)

	_, err := PreConsumeUserSubscription(
		fmt.Sprintf("case4-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "vip",
	)
	assert.Error(t, err, "Case 4: should fail (both disabled)")
}

// ============================================================
// Case 8: 5小时窗口额度仅剩部分 → 先扣剩余额度，再拆到下一个订阅
// ============================================================
func TestGroupRestriction_Case8_5hWindowExhausted_Skips(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	subA := createActiveSub(t, userId, planAId, 2)
	subB := createActiveSub(t, userId, planBId, 1)

	// Consume 900 in 5h window for subA (fixed-period counters on subscription).
	now := time.Now().Unix()
	require.NoError(t, DB.Model(subA).Updates(map[string]interface{}{
		"window_start_5h": now - 3600,
		"window_used_5h":  int64(900),
	}).Error)

	// Try to consume 200 more → A should consume remaining 100, B consumes 100.
	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case8-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 200, "vip",
	)
	require.NoError(t, err)
	assert.Equal(t, subA.Id, result.UserSubscriptionId,
		"Case 8: should consume remaining A window quota first")

	var updatedA, updatedB UserSubscription
	require.NoError(t, DB.First(&updatedA, subA.Id).Error)
	require.NoError(t, DB.First(&updatedB, subB.Id).Error)
	assert.Equal(t, int64(100), updatedA.AmountUsed)
	assert.Equal(t, int64(100), updatedB.AmountUsed)
	assert.Equal(t, int64(1000), updatedA.WindowUsed5h)
}

// ============================================================
// Case 12: 窗口限制=0 表示不限
// ============================================================
func TestGroupRestriction_Case12_WindowLimitZero_NoRestriction(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()

	// Plan with window_limit_5h=0 (unlimited)
	plan := &SubscriptionPlan{
		Title:          "Unlimited-5h",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    10000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		WindowLimit5h:  0, // unlimited
		WindowLimit7d:  0,
		WindowLimit30d: 0,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub := createActiveSub(t, userId, plan.Id, 1)

	// Fill up a lot of consumption
	consumeNow := time.Now().Unix()
	for i := 0; i < 50; i++ {
		require.NoError(t, DB.Create(&SubscriptionPreConsumeRecord{
			RequestId:          fmt.Sprintf("case12-fill-%d", i),
			UserId:             userId,
			UserSubscriptionId: sub.Id,
			PreConsumed:        100,
			Status:             "consumed",
			CreatedAt:          consumeNow - 3600,
			UpdatedAt:          consumeNow - 3600,
		}).Error)
	}

	// Should still succeed (window_limit_5h=0 means no limit)
	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case12-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "",
	)
	require.NoError(t, err)
	assert.NotNil(t, result, "Case 12: should succeed (window limit=0 means unlimited)")
}

// ============================================================
// Case 31: 空 allowed_groups 表示允许所有分组
// ============================================================
func TestGroupRestriction_Case31_EmptyAllowedGroups_AllowsAll(t *testing.T) {
	setupTimeQuotaTestDB(t)

	now := common.GetTimestamp()

	// Plan with empty allowed_groups
	plan := &SubscriptionPlan{
		Title:          "No-Group-Restriction",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    10000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		AllowedGroups:  "", // empty = allow all
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	require.NoError(t, DB.Create(plan).Error)

	userId := createTestUser(t, "default", "default")
	sub := createActiveSub(t, userId, plan.Id, 1)

	// Request with any group should succeed
	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case31-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "any_group",
	)
	require.NoError(t, err)
	assert.Equal(t, sub.Id, result.UserSubscriptionId,
		"Case 31: empty allowed_groups should allow any group")
}

// ============================================================
// Case 15: disabled 套餐被跳过
// ============================================================
func TestGroupRestriction_Case15_DisabledSkipped(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	// A is disabled, B is active
	subA := createActiveSub(t, userId, planAId, 2)
	require.NoError(t, DB.Model(subA).Update("disabled", true).Error)
	subB := createActiveSub(t, userId, planBId, 1)

	result, err := PreConsumeUserSubscription(
		fmt.Sprintf("case15-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "vip",
	)
	require.NoError(t, err)
	assert.Equal(t, subB.Id, result.UserSubscriptionId,
		"Case 15: disabled A should be skipped, hit B")
}

// ============================================================
// Case 32: 拖拽调整优先级后消费顺序改变
// ============================================================
func TestGroupRestriction_Case32_PriorityChange_AffectsConsumption(t *testing.T) {
	userId, planAId, planBId, cleanup := setupGroupTestDB(t)
	defer cleanup()

	// Initially A priority=2 (higher), B priority=1
	subA := createActiveSub(t, userId, planAId, 2)
	subB := createActiveSub(t, userId, planBId, 1)

	// First request: should hit A
	result1, err := PreConsumeUserSubscription(
		fmt.Sprintf("case32-first-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "vip",
	)
	require.NoError(t, err)
	assert.Equal(t, subA.Id, result1.UserSubscriptionId, "First: should hit A")

	// Change priority: B becomes higher
	require.NoError(t, DB.Model(subA).Update("priority", 1).Error)
	require.NoError(t, DB.Model(subB).Update("priority", 2).Error)

	// Invalidate cache
	InvalidateUserActiveSubPlanCache(userId)

	// Second request: should hit B now
	result2, err := PreConsumeUserSubscription(
		fmt.Sprintf("case32-second-%d", time.Now().UnixNano()),
		userId, "gpt-4", 0, 100, "vip",
	)
	require.NoError(t, err)
	assert.Equal(t, subB.Id, result2.UserSubscriptionId, "After priority change: should hit B")
}
