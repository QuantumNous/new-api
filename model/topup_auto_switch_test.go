package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func snapshotPaymentSettingForTopUpAutoSwitchTest() operation_setting.PaymentSetting {
	paymentSetting := operation_setting.GetPaymentSetting()
	snapshot := *paymentSetting
	snapshot.AmountOptions = append([]int(nil), paymentSetting.AmountOptions...)
	snapshot.AutoSwitchGroupRules = append([]operation_setting.PaymentAutoSwitchGroupRule(nil), paymentSetting.AutoSwitchGroupRules...)
	if paymentSetting.AmountDiscount != nil {
		snapshot.AmountDiscount = make(map[int]float64, len(paymentSetting.AmountDiscount))
		for amount, discount := range paymentSetting.AmountDiscount {
			snapshot.AmountDiscount[amount] = discount
		}
	}
	return snapshot
}

func restorePaymentSettingForTopUpAutoSwitchTest(snapshot operation_setting.PaymentSetting) {
	operation_setting.UpdatePaymentSetting(func(paymentSetting *operation_setting.PaymentSetting) {
		*paymentSetting = snapshot
		paymentSetting.AmountOptions = append([]int(nil), snapshot.AmountOptions...)
		paymentSetting.AutoSwitchGroupRules = append([]operation_setting.PaymentAutoSwitchGroupRule(nil), snapshot.AutoSwitchGroupRules...)
		if snapshot.AmountDiscount != nil {
			paymentSetting.AmountDiscount = make(map[int]float64, len(snapshot.AmountDiscount))
			for amount, discount := range snapshot.AmountDiscount {
				paymentSetting.AmountDiscount[amount] = discount
			}
		}
	})
}

func prepareTopUpAutoSwitchTest(t *testing.T) {
	t.Helper()

	initCol()
	require.NoError(t, DB.AutoMigrate(&TopUp{}, &User{}, &UserSubscription{}))
	require.NoError(t, DB.Exec("DELETE FROM user_subscriptions").Error)
	require.NoError(t, DB.Exec("DELETE FROM top_ups").Error)
	require.NoError(t, DB.Exec("DELETE FROM users").Error)

	t.Cleanup(func() {
		_ = DB.Exec("DELETE FROM user_subscriptions").Error
		_ = DB.Exec("DELETE FROM top_ups").Error
		_ = DB.Exec("DELETE FROM users").Error
	})

	originPaymentSetting := snapshotPaymentSettingForTopUpAutoSwitchTest()
	t.Cleanup(func() {
		restorePaymentSettingForTopUpAutoSwitchTest(originPaymentSetting)
	})

	operation_setting.UpdatePaymentSetting(func(paymentSetting *operation_setting.PaymentSetting) {
		paymentSetting.AutoSwitchGroupEnabled = true
		paymentSetting.AutoSwitchGroupOnlyNewTopups = false
		paymentSetting.AutoSwitchGroupEnabledFrom = 0
		paymentSetting.AutoSwitchGroupBaseGroup = "default"
		paymentSetting.AutoSwitchGroupRules = []operation_setting.PaymentAutoSwitchGroupRule{
			{ThresholdUSD: 10, Group: "vip"},
		}
	})
}

func createTopUpAutoSwitchUser(t *testing.T, username string, group string) *User {
	t.Helper()
	user := &User{
		Username: username,
		Password: "password",
		Group:    group,
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func createSuccessfulTopUpForAutoSwitchTest(t *testing.T, userId int, tradeNo string, amount int64, completeTime int64) {
	t.Helper()
	topUp := &TopUp{
		UserId:        userId,
		Amount:        amount,
		Money:         float64(amount),
		TradeNo:       tradeNo,
		PaymentMethod: PaymentProviderEpay,
		CompleteTime:  completeTime,
		Status:        common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(topUp).Error)
}

func getUserGroupForAutoSwitchTest(t *testing.T, userId int) string {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("group").First(&user, userId).Error)
	return user.Group
}

func TestApplyTopUpAutoSwitchGroupTx_SwitchesDefaultGroup(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_default", "default")
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_default", 20, 100)

	switchedGroup, err := applyTopUpAutoSwitchGroupTx(DB, user.Id)
	require.NoError(t, err)

	assert.Equal(t, "vip", switchedGroup)
	assert.Equal(t, "vip", getUserGroupForAutoSwitchTest(t, user.Id))
}

func TestApplyTopUpAutoSwitchGroupTx_DoesNotSwitchOutsideControlledChain(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_outside_chain", "enterprise")
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_outside_chain", 20, 100)

	switchedGroup, err := applyTopUpAutoSwitchGroupTx(DB, user.Id)
	require.NoError(t, err)

	assert.Empty(t, switchedGroup)
	assert.Equal(t, "enterprise", getUserGroupForAutoSwitchTest(t, user.Id))
}

func TestApplyTopUpAutoSwitchGroupTx_KeepsActiveSubscriptionPriority(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_active_sub", "vip")
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_active_sub", 20, 100)
	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:        user.Id,
		PlanId:        1,
		Status:        "active",
		StartTime:     now - 60,
		EndTime:       now + 3600,
		UpgradeGroup:  "svip",
		PrevUserGroup: "default",
	}).Error)

	switchedGroup, err := applyTopUpAutoSwitchGroupTx(DB, user.Id)
	require.NoError(t, err)

	assert.Equal(t, "svip", switchedGroup)
	assert.Equal(t, "svip", getUserGroupForAutoSwitchTest(t, user.Id))
}

func TestExpireDueSubscriptions_FallsBackToTopUpGroupAfterSubscriptionEnds(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_expire_to_topup", "svip")
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_expire_to_topup", 20, 100)
	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:        user.Id,
		PlanId:        1,
		Status:        "active",
		StartTime:     now - 3600,
		EndTime:       now - 1,
		UpgradeGroup:  "svip",
		PrevUserGroup: "default",
	}).Error)

	expiredCount, err := ExpireDueSubscriptions(10)
	require.NoError(t, err)

	assert.Equal(t, 1, expiredCount)
	assert.Equal(t, "vip", getUserGroupForAutoSwitchTest(t, user.Id))
}

func TestExpireDueSubscriptions_DoesNotOverwriteManualGroupChange(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_manual_group", "enterprise")
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_manual_group", 20, 100)
	now := GetDBTimestamp()
	require.NoError(t, DB.Create(&UserSubscription{
		UserId:        user.Id,
		PlanId:        1,
		Status:        "active",
		StartTime:     now - 3600,
		EndTime:       now - 1,
		UpgradeGroup:  "svip",
		PrevUserGroup: "default",
	}).Error)

	expiredCount, err := ExpireDueSubscriptions(10)
	require.NoError(t, err)

	assert.Equal(t, 1, expiredCount)
	assert.Equal(t, "enterprise", getUserGroupForAutoSwitchTest(t, user.Id))
}

func TestAdminDeleteUserSubscription_ExcludesDeletedSubscriptionWhenResolvingFallback(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_delete_sub", "svip")
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_delete_sub", 20, 100)
	now := GetDBTimestamp()
	sub := &UserSubscription{
		UserId:        user.Id,
		PlanId:        1,
		Status:        "active",
		StartTime:     now - 60,
		EndTime:       now + 3600,
		UpgradeGroup:  "svip",
		PrevUserGroup: "default",
	}
	require.NoError(t, DB.Create(sub).Error)

	_, err := AdminDeleteUserSubscription(sub.Id)
	require.NoError(t, err)

	assert.Equal(t, "vip", getUserGroupForAutoSwitchTest(t, user.Id))

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("id = ?", sub.Id).Count(&count).Error)
	assert.Zero(t, count)
}

func TestGetUserSuccessfulTopupTotalUSDTx_OnlyNewTopupsUsesEnabledFromCutoff(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	operation_setting.UpdatePaymentSetting(func(paymentSetting *operation_setting.PaymentSetting) {
		paymentSetting.AutoSwitchGroupOnlyNewTopups = true
		paymentSetting.AutoSwitchGroupEnabledFrom = 150
	})
	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_only_new", "default")
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_only_new_old", 100, 149)
	createSuccessfulTopUpForAutoSwitchTest(t, user.Id, "topup_auto_switch_only_new_new", 1, 150)

	totalUSD, err := GetUserSuccessfulTopupTotalUSDTx(DB, user.Id)
	require.NoError(t, err)

	assert.Equal(t, 1.0, totalUSD)
}

func TestGetUserSuccessfulTopupTotalUSDTx_CountsStripeMoneyWhenAmountIsZero(t *testing.T) {
	prepareTopUpAutoSwitchTest(t)

	user := createTopUpAutoSwitchUser(t, "topup_auto_switch_stripe_money", "default")
	require.NoError(t, DB.Create(&TopUp{
		UserId:        user.Id,
		Amount:        0,
		Money:         9.99,
		TradeNo:       "topup_auto_switch_stripe_money",
		PaymentMethod: PaymentMethodStripe,
		CompleteTime:  100,
		Status:        common.TopUpStatusSuccess,
	}).Error)

	totalUSD, err := GetUserSuccessfulTopupTotalUSDTx(DB, user.Id)
	require.NoError(t, err)

	assert.Equal(t, 9.99, totalUSD)
}

func TestMatchPaymentAutoSwitchGroupRule_UsesHighestEligibleThreshold(t *testing.T) {
	rules := []operation_setting.PaymentAutoSwitchGroupRule{
		{ThresholdUSD: 50, Group: "svip"},
		{ThresholdUSD: 10, Group: "vip"},
		{ThresholdUSD: 20, Group: "pro"},
	}

	assert.Equal(t, "svip", matchPaymentAutoSwitchGroupRule(80, rules))
	assert.Equal(t, "pro", matchPaymentAutoSwitchGroupRule(20, rules))
	assert.Empty(t, matchPaymentAutoSwitchGroupRule(5, rules))
}

func TestNormalizeTopUpValueUSD(t *testing.T) {
	require.Greater(t, common.QuotaPerUnit, 0.0)

	assert.Equal(t, 10.0, NormalizeTopUpValueUSD(&TopUp{Amount: 10, Money: 99, PaymentMethod: PaymentProviderEpay}))
	assert.Equal(t, 9.99, NormalizeTopUpValueUSD(&TopUp{Amount: 999999, Money: 9.99, PaymentMethod: PaymentMethodStripe}))
	assert.Equal(t, 12.0, NormalizeTopUpValueUSD(&TopUp{Amount: int64(common.QuotaPerUnit * 12), Money: 1, PaymentMethod: PaymentMethodCreem}))
}
