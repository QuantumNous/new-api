package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStrictGroupSubscriptionAccountsStayIsolated(t *testing.T) {
	truncate(t)
	require.NoError(t, model.DB.AutoMigrate(&model.SubscriptionPlan{}, &model.SubscriptionPreConsumeRecord{}))
	require.NoError(t, model.DB.Exec("DELETE FROM subscription_pre_consume_records").Error)
	require.NoError(t, model.DB.Exec("DELETE FROM subscription_plans").Error)

	originalStrictGroups := setting.StrictGroupIsolationGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(`["a-residential","b-residential"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"a-residential":"A Residential","b-residential":"B Residential"}`))
	t.Cleanup(func() {
		require.NoError(t, setting.UpdateStrictGroupIsolationGroupsByJsonString(originalStrictGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, model.DB.Exec("DELETE FROM subscription_pre_consume_records").Error)
		require.NoError(t, model.DB.Exec("DELETE FROM subscription_plans").Error)
	})

	quotaPerDollar := int64(common.QuotaPerUnit)
	allowWalletOverflow := false
	plans := []model.SubscriptionPlan{
		{
			Title:               "Local daily 50 USD",
			DurationUnit:        model.SubscriptionDurationYear,
			DurationValue:       1,
			Enabled:             true,
			TotalAmount:         50 * quotaPerDollar,
			QuotaResetPeriod:    model.SubscriptionResetDaily,
			AllowWalletOverflow: &allowWalletOverflow,
		},
		{
			Title:               "Local daily 200 USD",
			DurationUnit:        model.SubscriptionDurationYear,
			DurationValue:       1,
			Enabled:             true,
			TotalAmount:         200 * quotaPerDollar,
			QuotaResetPeriod:    model.SubscriptionResetDaily,
			AllowWalletOverflow: &allowWalletOverflow,
		},
	}
	for index := range plans {
		require.NoError(t, model.DB.Create(&plans[index]).Error)
		model.InvalidateSubscriptionPlanCache(plans[index].Id)
		planID := plans[index].Id
		t.Cleanup(func() { model.InvalidateSubscriptionPlanCache(planID) })
	}

	walletQuota := int(5 * common.QuotaPerUnit)
	users := []model.User{
		{Id: 9801, Username: "local-sub-a", Password: "unused-test-password", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "a-residential", Quota: walletQuota, AffCode: "local-sub-a-aff"},
		{Id: 9802, Username: "local-sub-b", Password: "unused-test-password", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Group: "b-residential", Quota: walletQuota, AffCode: "local-sub-b-aff"},
	}
	for index := range users {
		require.NoError(t, model.DB.Create(&users[index]).Error)
	}

	tokenQuota := int(10 * common.QuotaPerUnit)
	tokens := []model.Token{
		{Id: 9811, UserId: users[0].Id, Key: "local-sub-a-key", Name: "local-sub-a", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: tokenQuota, Group: users[0].Group},
		{Id: 9812, UserId: users[1].Id, Key: "local-sub-b-key", Name: "local-sub-b", Status: common.TokenStatusEnabled, ExpiredTime: -1, RemainQuota: tokenQuota, Group: users[1].Group},
	}
	for index := range tokens {
		require.NoError(t, model.DB.Create(&tokens[index]).Error)
	}

	now := time.Now()
	subscriptions := []model.UserSubscription{
		{
			Id: 9821, UserId: users[0].Id, PlanId: plans[0].Id,
			AmountTotal: plans[0].TotalAmount, AmountUsed: quotaPerDollar,
			StartTime: now.Add(-48 * time.Hour).Unix(), EndTime: now.AddDate(1, 0, 0).Unix(), Status: "active", Source: "test",
			LastResetTime: now.Add(-48 * time.Hour).Unix(), NextResetTime: now.Add(-time.Second).Unix(), AllowWalletOverflow: false,
		},
		{
			Id: 9822, UserId: users[1].Id, PlanId: plans[1].Id,
			AmountTotal: plans[1].TotalAmount,
			StartTime:   now.Add(-time.Hour).Unix(), EndTime: now.AddDate(1, 0, 0).Unix(), Status: "active", Source: "test",
			LastResetTime: now.Add(-time.Hour).Unix(), NextResetTime: now.Add(23 * time.Hour).Unix(), AllowWalletOverflow: false,
		},
	}
	for index := range subscriptions {
		require.NoError(t, model.DB.Create(&subscriptions[index]).Error)
	}

	assert.Equal(t, map[string]string{"a-residential": "A Residential"}, GetUserUsableGroups(users[0].Group))
	assert.Equal(t, map[string]string{"b-residential": "B Residential"}, GetUserUsableGroups(users[1].Group))
	assert.True(t, IsTokenGroupAllowed(users[0].Group, tokens[0].Group))
	assert.False(t, IsTokenGroupAllowed(users[0].Group, tokens[1].Group))
	assert.True(t, IsTokenGroupAllowed(users[1].Group, tokens[1].Group))
	assert.False(t, IsTokenGroupAllowed(users[1].Group, tokens[0].Group))

	gin.SetMode(gin.TestMode)
	ctxA, _ := gin.CreateTestContext(httptest.NewRecorder())
	infoA := &relaycommon.RelayInfo{
		TokenId: tokens[0].Id, TokenKey: tokens[0].Key, TokenGroup: tokens[0].Group,
		UserId: users[0].Id, UserGroup: users[0].Group, UsingGroup: users[0].Group,
		RequestId: "local-sub-request-a", OriginModelName: "gpt-local-test",
		UserSetting: dto.UserSetting{BillingPreference: "subscription_only"},
	}
	require.Nil(t, PreConsumeBilling(ctxA, 10_000, infoA))
	assert.Equal(t, BillingSourceSubscription, infoA.BillingSource)
	assert.Equal(t, subscriptions[0].Id, infoA.SubscriptionId)
	require.NoError(t, SettleBilling(ctxA, infoA, 8_000))

	var subA model.UserSubscription
	var tokenA model.Token
	require.NoError(t, model.DB.First(&subA, subscriptions[0].Id).Error)
	require.NoError(t, model.DB.First(&tokenA, tokens[0].Id).Error)
	assert.EqualValues(t, 8_000, subA.AmountUsed, "the expired daily usage must reset before charging the new request")
	assert.Equal(t, tokenQuota-8_000, tokenA.RemainQuota)
	assert.Equal(t, walletQuota, currentUserQuota(t, users[0].Id))

	ctxB, _ := gin.CreateTestContext(httptest.NewRecorder())
	infoB := &relaycommon.RelayInfo{
		TokenId: tokens[1].Id, TokenKey: tokens[1].Key, TokenGroup: tokens[1].Group,
		UserId: users[1].Id, UserGroup: users[1].Group, UsingGroup: users[1].Group,
		RequestId: "local-sub-request-b", OriginModelName: "gpt-local-test",
		UserSetting: dto.UserSetting{BillingPreference: "subscription_only"},
	}
	require.Nil(t, PreConsumeBilling(ctxB, 20_000, infoB))
	assert.Equal(t, BillingSourceSubscription, infoB.BillingSource)
	assert.Equal(t, subscriptions[1].Id, infoB.SubscriptionId)
	require.NoError(t, SettleBilling(ctxB, infoB, 25_000))

	var subBAfter model.UserSubscription
	var subAAfter model.UserSubscription
	var tokenB model.Token
	require.NoError(t, model.DB.First(&subBAfter, subscriptions[1].Id).Error)
	require.NoError(t, model.DB.First(&subAAfter, subscriptions[0].Id).Error)
	require.NoError(t, model.DB.First(&tokenB, tokens[1].Id).Error)
	assert.EqualValues(t, 25_000, subBAfter.AmountUsed)
	assert.EqualValues(t, 8_000, subAAfter.AmountUsed, "account B must not consume account A's subscription")
	assert.Equal(t, tokenQuota-25_000, tokenB.RemainQuota)
	assert.Equal(t, walletQuota, currentUserQuota(t, users[1].Id))
}

func currentUserQuota(t *testing.T, userID int) int {
	t.Helper()
	quota, err := model.GetUserQuota(userID, false)
	require.NoError(t, err)
	return quota
}
