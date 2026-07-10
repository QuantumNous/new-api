package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetActiveSubscriptionBindGroups_NoSubscriptions_ReturnsEmpty(t *testing.T) {
	truncateTablesForSubscription(t)

	groups, err := GetActiveSubscriptionBindGroups(99999)
	require.NoError(t, err)
	assert.Empty(t, groups)
}

func TestGetActiveSubscriptionBindGroups_ReturnsBindGroups(t *testing.T) {
	truncateTablesForSubscription(t)

	// 创建套餐
	plan1 := &SubscriptionPlan{
		Title:     "付费模型套餐",
		BindGroup: "paid_model",
		Enabled:   true,
	}
	plan2 := &SubscriptionPlan{
		Title:     "画图模型套餐",
		BindGroup: "image_model",
		Enabled:   true,
	}
	err := DB.Create(plan1).Error
	require.NoError(t, err)
	err = DB.Create(plan2).Error
	require.NoError(t, err)

	// 创建用户
	user := &User{
		Username:    "test_user_bindgroups",
		DisplayName: "Test",
		Password:    "test",
		Role:        1,
		Status:      1,
		Quota:       100000,
	}
	err = DB.Create(user).Error
	require.NoError(t, err)

	// 创建活跃订阅
	now := common.GetTimestamp()
	future := now + 86400
	sub1 := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan1.Id,
		AmountTotal: 200000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     future,
		Status:      "active",
		Source:      "order",
	}
	sub2 := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan2.Id,
		AmountTotal: 100000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     future,
		Status:      "active",
		Source:      "order",
	}
	err = DB.Create(sub1).Error
	require.NoError(t, err)
	err = DB.Create(sub2).Error
	require.NoError(t, err)

	// 查询
	groups, err := GetActiveSubscriptionBindGroups(user.Id)
	require.NoError(t, err)
	assert.Len(t, groups, 2)
	assert.Contains(t, groups, "paid_model")
	assert.Contains(t, groups, "image_model")
}

func TestGetActiveSubscriptionBindGroups_ExpiresExpiredSubscriptions(t *testing.T) {
	truncateTablesForSubscription(t)

	// 创建套餐
	plan := &SubscriptionPlan{
		Title:     "过期测试套餐",
		BindGroup: "expired_group",
		Enabled:   true,
	}
	err := DB.Create(plan).Error
	require.NoError(t, err)

	// 创建用户
	user := &User{
		Username:    "test_user_expired",
		DisplayName: "Test",
		Password:    "test",
		Role:        1,
		Status:      1,
	}
	err = DB.Create(user).Error
	require.NoError(t, err)

	// 创建已过期订阅
	now := common.GetTimestamp()
	sub := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 200000,
		AmountUsed:  0,
		StartTime:   now - 172800,
		EndTime:     now - 86400, // 已过期
		Status:      "active",
		Source:      "order",
	}
	err = DB.Create(sub).Error
	require.NoError(t, err)

	// 查询
	groups, err := GetActiveSubscriptionBindGroups(user.Id)
	require.NoError(t, err)
	assert.Empty(t, groups, "expired subscription should not return bind_group")
}

func TestGetActiveSubscriptionBindGroups_DeduplicatesGroups(t *testing.T) {
	truncateTablesForSubscription(t)

	// 创建套餐
	plan1 := &SubscriptionPlan{
		Title:     "套餐A",
		BindGroup: "paid_model",
		Enabled:   true,
	}
	plan2 := &SubscriptionPlan{
		Title:     "套餐B",
		BindGroup: "paid_model", // 相同 bind_group
		Enabled:   true,
	}
	err := DB.Create(plan1).Error
	require.NoError(t, err)
	err = DB.Create(plan2).Error
	require.NoError(t, err)

	// 创建用户
	user := &User{
		Username:    "test_user_dedup",
		DisplayName: "Test",
		Password:    "test",
		Role:        1,
		Status:      1,
	}
	err = DB.Create(user).Error
	require.NoError(t, err)

	// 创建两个活跃订阅，都绑定到 paid_model
	now := common.GetTimestamp()
	future := now + 86400
	sub1 := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan1.Id,
		AmountTotal: 200000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     future,
		Status:      "active",
		Source:      "order",
	}
	sub2 := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan2.Id,
		AmountTotal: 100000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     future,
		Status:      "active",
		Source:      "order",
	}
	err = DB.Create(sub1).Error
	require.NoError(t, err)
	err = DB.Create(sub2).Error
	require.NoError(t, err)

	// 查询
	groups, err := GetActiveSubscriptionBindGroups(user.Id)
	require.NoError(t, err)
	assert.Len(t, groups, 1, "duplicate bind_groups should be deduplicated")
	assert.Contains(t, groups, "paid_model")
}

func TestGetActiveSubscriptionBindGroups_SkipsEmptyBindGroup(t *testing.T) {
	truncateTablesForSubscription(t)

	// 创建套餐（bind_group 为空）
	plan := &SubscriptionPlan{
		Title:     "无绑定分组套餐",
		BindGroup: "",
		Enabled:   true,
	}
	err := DB.Create(plan).Error
	require.NoError(t, err)

	// 创建用户
	user := &User{
		Username:    "test_user_empty_bind",
		DisplayName: "Test",
		Password:    "test",
		Role:        1,
		Status:      1,
	}
	err = DB.Create(user).Error
	require.NoError(t, err)

	// 创建活跃订阅
	now := common.GetTimestamp()
	future := now + 86400
	sub := &UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 200000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     future,
		Status:      "active",
		Source:      "order",
	}
	err = DB.Create(sub).Error
	require.NoError(t, err)

	// 查询
	groups, err := GetActiveSubscriptionBindGroups(user.Id)
	require.NoError(t, err)
	assert.Empty(t, groups, "empty bind_group should be skipped")
}

// 辅助函数：清理订阅相关表
func truncateTablesForSubscription(t *testing.T) {
	t.Helper()
	t.Cleanup(func() {
		DB.Exec("DELETE FROM user_subscriptions")
		DB.Exec("DELETE FROM subscription_plans")
		DB.Exec("DELETE FROM users WHERE username LIKE 'test_user_%'")
	})
}
