package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ============================================================
// T12-T17: 兑换码测试
// ============================================================

func boolPtr(b bool) *bool { return &b }

func TestRedeem_Type1_UpgradeGroup_PermanentUpgrade(t *testing.T) {
	// T12: type=1 + upgrade_group 非空 → 永久升级
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")

	key := common.GetUUID()
	redemption := &Redemption{
		UserId:               1,
		Key:                  key,
		Status:               common.RedemptionCodeStatusEnabled,
		Name:                 "test",
		Quota:                100000,
		CreatedTime:          common.GetTimestamp(),
		Type:                 common.RedemptionTypeQuota,
		UpgradeGroup:         "vip",
		UpgradeGroupRollback: boolPtr(true), // type=1 时应被忽略
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "vip", getUserGroup(t, userId))
	assert.Equal(t, "vip", getUserBaseLevel(t, userId)) // 永久升级，base_level 也更新
}

func TestRedeem_Type2_UpgradeGroup_RollbackTrue(t *testing.T) {
	// T13: type=2 + upgrade_group + rollback=true → 到期回退
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planId := createTestPlan(t, "Basic Plan", "", 7) // plan 自身无 upgrade_group

	key := common.GetUUID()
	redemption := &Redemption{
		UserId:               1,
		Key:                  key,
		Status:               common.RedemptionCodeStatusEnabled,
		Name:                 "test",
		Quota:                0,
		CreatedTime:          common.GetTimestamp(),
		Type:                 common.RedemptionTypeSubscription,
		SubscriptionPlanId:   planId,
		UpgradeGroup:         "svip",
		UpgradeGroupRollback: boolPtr(true),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "svip", getUserGroup(t, userId))
	assert.Equal(t, "default", getUserBaseLevel(t, userId)) // base_level 不变

	// 验证订阅记录的 upgrade_group 是兑换码的值
	var sub UserSubscription
	err = DB.Where("user_id = ? AND status = ?", userId, "active").First(&sub).Error
	require.NoError(t, err)
	assert.Equal(t, "svip", sub.UpgradeGroup)
}

func TestRedeem_Type2_UpgradeGroup_RollbackFalse(t *testing.T) {
	// T14: type=2 + upgrade_group + rollback=false → 永久升级
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planId := createTestPlan(t, "Basic Plan", "", 7)

	key := common.GetUUID()
	redemption := &Redemption{
		UserId:               1,
		Key:                  key,
		Status:               common.RedemptionCodeStatusEnabled,
		Name:                 "test",
		Quota:                0,
		CreatedTime:          common.GetTimestamp(),
		Type:                 common.RedemptionTypeSubscription,
		SubscriptionPlanId:   planId,
		UpgradeGroup:         "svip",
		UpgradeGroupRollback: boolPtr(false),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "svip", getUserGroup(t, userId))
	assert.Equal(t, "svip", getUserBaseLevel(t, userId)) // 永久升级，base_level 也更新
}

func TestRedeem_Type3_UpgradeGroup_RollbackTrue(t *testing.T) {
	// T15: type=3 + upgrade_group + rollback=true → 到期回退
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planId := createTestPlan(t, "Basic Plan", "", 7)

	key := common.GetUUID()
	redemption := &Redemption{
		UserId:               1,
		Key:                  key,
		Status:               common.RedemptionCodeStatusEnabled,
		Name:                 "test",
		Quota:                100000,
		CreatedTime:          common.GetTimestamp(),
		Type:                 common.RedemptionTypeCombo,
		SubscriptionPlanId:   planId,
		UpgradeGroup:         "vip",
		UpgradeGroupRollback: boolPtr(true),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "vip", getUserGroup(t, userId))
	assert.Equal(t, "default", getUserBaseLevel(t, userId)) // base_level 不变

	// 验证余额增加
	var user User
	DB.Where("id = ?", userId).First(&user)
	assert.Equal(t, 100000, user.Quota)
}

func TestRedeem_Type3_UpgradeGroup_RollbackFalse(t *testing.T) {
	// T16: type=3 + upgrade_group + rollback=false → 永久升级
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planId := createTestPlan(t, "Basic Plan", "", 7)

	key := common.GetUUID()
	redemption := &Redemption{
		UserId:               1,
		Key:                  key,
		Status:               common.RedemptionCodeStatusEnabled,
		Name:                 "test",
		Quota:                100000,
		CreatedTime:          common.GetTimestamp(),
		Type:                 common.RedemptionTypeCombo,
		SubscriptionPlanId:   planId,
		UpgradeGroup:         "vip",
		UpgradeGroupRollback: boolPtr(false),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "vip", getUserGroup(t, userId))
	assert.Equal(t, "vip", getUserBaseLevel(t, userId)) // 永久升级
}

func TestRedeem_Type2_NoUpgradeGroup_PlanUpgradeGroupEffective(t *testing.T) {
	// T17: type=2 + upgrade_group 为空 → plan 自身 upgrade_group 生效
	setupTestDB(t)
	userId := createTestUser(t, "default", "default")
	planId := createTestPlan(t, "VIP Plan", "vip", 7) // plan 自身有 upgrade_group

	key := common.GetUUID()
	redemption := &Redemption{
		UserId:               1,
		Key:                  key,
		Status:               common.RedemptionCodeStatusEnabled,
		Name:                 "test",
		Quota:                0,
		CreatedTime:          common.GetTimestamp(),
		Type:                 common.RedemptionTypeSubscription,
		SubscriptionPlanId:   planId,
		UpgradeGroup:         "",
		UpgradeGroupRollback: boolPtr(true),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(key, userId)
	require.NoError(t, err)
	require.NotNil(t, result)

	assert.Equal(t, "vip", getUserGroup(t, userId))
	assert.Equal(t, "default", getUserBaseLevel(t, userId)) // plan 的升级走订阅回退
}
