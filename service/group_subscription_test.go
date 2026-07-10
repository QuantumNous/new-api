package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupGroupTestDB(t *testing.T) {
	t.Helper()
	setupTestDB(t)
}

func setUserUsableGroups(t *testing.T, groups map[string]string) {
	t.Helper()
	jsonBytes, err := common.Marshal(groups)
	require.NoError(t, err)
	err = setting.UpdateUserUsableGroupsByJSONString(string(jsonBytes))
	require.NoError(t, err)
}

func TestGetUserUsableGroupsWithSubscriptions_NoSubscriptions(t *testing.T) {
	setupGroupTestDB(t)
	setUserUsableGroups(t, map[string]string{
		"default":    "默认分组",
		"company_l3": "公司L3",
	})

	groups := GetUserUsableGroupsWithSubscriptions("company_l3", 99999)
	assert.Contains(t, groups, "company_l3")
	assert.NotContains(t, groups, "paid_model")
}

func TestGetUserUsableGroupsWithSubscriptions_WithActiveSubscription(t *testing.T) {
	setupGroupTestDB(t)
	setUserUsableGroups(t, map[string]string{
		"default":    "默认分组",
		"company_l3": "公司L3",
	})

	user := &model.User{
		Username:    "test_group_user",
		DisplayName: "Test",
		Password:    "x",
		Role:        1,
		Status:      1,
		AffCode:     "testaff1",
	}
	require.NoError(t, model.DB.Create(user).Error)

	plan := &model.SubscriptionPlan{
		Title:     "付费套餐",
		BindGroup: "paid_model",
		Enabled:   true,
	}
	require.NoError(t, model.DB.Create(plan).Error)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 200000,
		AmountUsed:  0,
		StartTime:   now,
		EndTime:     now + 86400,
		Status:      "active",
		Source:      "order",
	}
	require.NoError(t, model.DB.Create(sub).Error)

	groups := GetUserUsableGroupsWithSubscriptions("company_l3", user.Id)
	assert.Contains(t, groups, "company_l3")
	assert.Contains(t, groups, "paid_model")
}

func TestGetUserUsableGroupsWithSubscriptions_ExpiredSubscription(t *testing.T) {
	setupGroupTestDB(t)
	setUserUsableGroups(t, map[string]string{
		"default":    "默认分组",
		"company_l3": "公司L3",
	})

	user := &model.User{
		Username:    "test_group_expired",
		DisplayName: "Test",
		Password:    "x",
		Role:        1,
		Status:      1,
		AffCode:     "testaff2",
	}
	require.NoError(t, model.DB.Create(user).Error)

	plan := &model.SubscriptionPlan{
		Title:     "过期套餐",
		BindGroup: "paid_model",
		Enabled:   true,
	}
	require.NoError(t, model.DB.Create(plan).Error)

	now := common.GetTimestamp()
	sub := &model.UserSubscription{
		UserId:      user.Id,
		PlanId:      plan.Id,
		AmountTotal: 200000,
		AmountUsed:  0,
		StartTime:   now - 172800,
		EndTime:     now - 86400,
		Status:      "active",
		Source:      "order",
	}
	require.NoError(t, model.DB.Create(sub).Error)

	groups := GetUserUsableGroupsWithSubscriptions("company_l3", user.Id)
	assert.Contains(t, groups, "company_l3")
	assert.NotContains(t, groups, "paid_model")
}

func TestGetUserUsableGroupsWithSubscriptions_UserIdZero(t *testing.T) {
	setupGroupTestDB(t)
	setUserUsableGroups(t, map[string]string{
		"default":    "默认分组",
		"company_l3": "公司L3",
	})

	groups := GetUserUsableGroupsWithSubscriptions("company_l3", 0)
	assert.Contains(t, groups, "company_l3")
}
