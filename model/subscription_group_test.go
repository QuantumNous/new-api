package model

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// ============================================================
// T1-T5: resolveUserGroupBySubscriptions 单元测试
// ============================================================

func TestResolveUserGroup_NoSubscription_ReturnsBaseLevel(t *testing.T) {
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "default", group)
}

func TestResolveUserGroup_SingleActiveSubscription(t *testing.T) {
	setupTestDB(t)
	userId := createTestUser(t, "vip", "default")

	now := time.Now().Unix()
	sub := &UserSubscription{
		UserId:       userId,
		PlanId:       1,
		StartTime:    now,
		EndTime:      now + 86400*7,
		Status:       "active",
		UpgradeGroup: "vip",
	}
	require.NoError(t, DB.Create(sub).Error)

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "vip", group)
}

func TestResolveUserGroup_MultipleActiveSubscriptions_LatestStartWins(t *testing.T) {
	setupTestDB(t)
	userId := createTestUser(t, "svip", "default")

	now := time.Now().Unix()
	sub1 := &UserSubscription{
		UserId:       userId,
		PlanId:       1,
		StartTime:    now - 100,
		EndTime:      now + 86400*30,
		Status:       "active",
		UpgradeGroup: "vip",
	}
	sub2 := &UserSubscription{
		UserId:       userId,
		PlanId:       2,
		StartTime:    now,
		EndTime:      now + 86400*30,
		Status:       "active",
		UpgradeGroup: "svip",
	}
	require.NoError(t, DB.Create(sub1).Error)
	require.NoError(t, DB.Create(sub2).Error)

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "svip", group)
}

func TestResolveUserGroup_ActiveSubscriptionNoUpgradeGroup(t *testing.T) {
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")

	now := time.Now().Unix()
	sub := &UserSubscription{
		UserId:       userId,
		PlanId:       1,
		StartTime:    now,
		EndTime:      now + 86400*7,
		Status:       "active",
		UpgradeGroup: "",
	}
	require.NoError(t, DB.Create(sub).Error)

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "default", group)
}

func TestResolveUserGroup_MixedUpgradeGroup(t *testing.T) {
	setupTestDB(t)
	userId := createTestUser(t, "vip", "default")

	now := time.Now().Unix()
	sub1 := &UserSubscription{
		UserId:       userId,
		PlanId:       1,
		StartTime:    now - 100,
		EndTime:      now + 86400*30,
		Status:       "active",
		UpgradeGroup: "vip",
	}
	sub2 := &UserSubscription{
		UserId:       userId,
		PlanId:       2,
		StartTime:    now,
		EndTime:      now + 86400*30,
		Status:       "active",
		UpgradeGroup: "",
	}
	require.NoError(t, DB.Create(sub1).Error)
	require.NoError(t, DB.Create(sub2).Error)

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "vip", group)
}

// ============================================================
// T6-T11: 场景集成测试
// ============================================================

// buyPlan is a test helper that creates a subscription and applies the resolved group.
func buyPlan(t *testing.T, userId int, planId int) {
	t.Helper()
	err := DB.Transaction(func(tx *gorm.DB) error {
		plan, err := GetSubscriptionPlanById(planId)
		if err != nil {
			return err
		}
		_, err = CreateUserSubscriptionFromPlanTx(tx, userId, plan, "test")
		if err != nil {
			return err
		}
		_, err = applyResolvedUserGroup(tx, userId)
		return err
	})
	require.NoError(t, err)
}

func TestScenario_ChainedSubscription_RollbackToBaseLevel(t *testing.T) {
	// 场景1：链式订阅回退到 baseLevel
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planVip := createTestPlan(t, "VIP Plan", "vip", 7)
	planSvip := createTestPlan(t, "SVIP Plan", "svip", 30)

	// Step 2: 买7天vip
	buyPlan(t, userId, planVip)
	assert.Equal(t, "vip", getUserGroup(t, userId))
	assert.Equal(t, "default", getUserBaseLevel(t, userId))

	// Step 3: vip期间买30天svip
	buyPlan(t, userId, planSvip)
	assert.Equal(t, "svip", getUserGroup(t, userId))
	assert.Equal(t, "default", getUserBaseLevel(t, userId))

	// Step 4: sub1 到期（手动标记）
	var sub1 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "vip").First(&sub1)
	now := time.Now().Unix()
	DB.Model(&sub1).Updates(map[string]interface{}{"status": "expired", "end_time": now - 1})

	// 模拟 ExpireDueSubscriptions 的分组计算
	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "svip", group) // sub2 还 active

	// Step 5: sub2 也到期
	var sub2 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "svip").First(&sub2)
	DB.Model(&sub2).Updates(map[string]interface{}{"status": "expired", "end_time": now - 1})

	group, err = resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "default", group) // 回退到 baseLevel
}

func TestScenario_AdminManualGroup_NotOverridden(t *testing.T) {
	// 场景2：管理员手动改分组不被回退
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planVip := createTestPlan(t, "VIP Plan", "vip", 7)

	// Step 2: 买7天vip
	buyPlan(t, userId, planVip)
	assert.Equal(t, "vip", getUserGroup(t, userId))

	// Step 3: 管理员手动改 group=vip, base_level=vip
	DB.Model(&User{}).Where("id = ?", userId).Updates(map[string]interface{}{
		"base_level": "vip",
	})

	// Step 4: sub1 到期
	var sub1 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "vip").First(&sub1)
	now := time.Now().Unix()
	DB.Model(&sub1).Updates(map[string]interface{}{"status": "expired", "end_time": now - 1})

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "vip", group) // base_level=vip，不会回退到 default
}

func TestScenario_HighThenLow_LatestStartWins(t *testing.T) {
	// 场景3：先买高级再买低级
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planSvip := createTestPlan(t, "SVIP Plan", "svip", 30)
	planVip := createTestPlan(t, "VIP Plan", "vip", 7)

	now := time.Now().Unix()

	// Step 2: 买30天svip (start_time=T1)
	buyPlan(t, userId, planSvip)
	assert.Equal(t, "svip", getUserGroup(t, userId))

	// Step 3: 买7天vip (start_time=T2, T2>T1) — 最晚开始的 wins
	// 需要确保 start_time 更晚，手动调整 sub1 的 start_time
	var sub1 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "svip").First(&sub1)
	DB.Model(&sub1).Update("start_time", now-10)

	buyPlan(t, userId, planVip)
	// resolve 应该返回 vip（最晚开始）
	assert.Equal(t, "vip", getUserGroup(t, userId))

	// Step 4: sub2(vip) 到期
	var sub2 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "vip").First(&sub2)
	DB.Model(&sub2).Updates(map[string]interface{}{"status": "expired", "end_time": now - 1})

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "svip", group) // sub1 还 active

	// Step 5: sub1(svip) 也到期
	DB.Model(&sub1).Updates(map[string]interface{}{"status": "expired", "end_time": now - 1})

	group, err = resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "default", group) // 回退到 baseLevel
}

func TestScenario_TwoRoundsDisconnected(t *testing.T) {
	// 场景9：两轮不连续订阅
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planVip := createTestPlan(t, "VIP Plan", "vip", 7)
	planSvip := createTestPlan(t, "SVIP Plan", "svip", 30)

	now := time.Now().Unix()

	// Step 2: 买7天vip
	buyPlan(t, userId, planVip)

	// Step 3: sub1 到期
	var sub1 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "vip").First(&sub1)
	DB.Model(&sub1).Updates(map[string]interface{}{"status": "expired", "end_time": now - 1})

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "default", group)

	// Step 4: 管理员改 group=pro, base_level=pro
	DB.Model(&User{}).Where("id = ?", userId).Updates(map[string]interface{}{
		"group":      "pro",
		"base_level": "pro",
	})

	// Step 5: 买30天svip
	buyPlan(t, userId, planSvip)
	assert.Equal(t, "svip", getUserGroup(t, userId))
	assert.Equal(t, "pro", getUserBaseLevel(t, userId)) // base_level 不变

	// Step 6: sub2 到期
	var sub2 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ? AND status = ?", userId, "svip", "active").First(&sub2)
	DB.Model(&sub2).Updates(map[string]interface{}{"status": "expired", "end_time": now - 1})

	group, err = resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "pro", group) // 回退到 base_level=pro
}

func TestScenario_AdminCancelSubscription(t *testing.T) {
	// 场景10：管理员取消订阅回退
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planVip := createTestPlan(t, "VIP Plan", "vip", 7)

	// 买vip
	buyPlan(t, userId, planVip)
	assert.Equal(t, "vip", getUserGroup(t, userId))

	// 管理员取消
	var sub UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "vip").First(&sub)
	now := time.Now().Unix()
	DB.Model(&sub).Updates(map[string]interface{}{"status": "cancelled", "end_time": now})

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "default", group)
}

func TestScenario_AdminCancelOne_OtherActive(t *testing.T) {
	// 场景11：管理员取消一个订阅，还有其他 active
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planVip := createTestPlan(t, "VIP Plan", "vip", 30)
	planSvip := createTestPlan(t, "SVIP Plan", "svip", 30)

	now := time.Now().Unix()

	// 买 vip (start_time 更早)
	buyPlan(t, userId, planVip)
	var sub1 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "vip").First(&sub1)
	DB.Model(&sub1).Update("start_time", now-10)

	// 买 svip (start_time 更晚)
	buyPlan(t, userId, planSvip)

	// 管理员取消 svip
	var sub2 UserSubscription
	DB.Where("user_id = ? AND upgrade_group = ?", userId, "svip").First(&sub2)
	DB.Model(&sub2).Updates(map[string]interface{}{"status": "cancelled", "end_time": now})

	group, err := resolveUserGroupBySubscriptions(DB, userId)
	require.NoError(t, err)
	assert.Equal(t, "vip", group) // sub1 还 active
}
