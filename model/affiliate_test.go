package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setAffiliateTestSettings(t *testing.T, enabled bool, percent float64, settleAfterConsumed bool, withdrawEnabled bool, complianceConfirmed bool) {
	t.Helper()
	affiliateSetting := operation_setting.GetAffiliateSetting()
	oldAffiliateSetting := *affiliateSetting
	paymentSetting := operation_setting.GetPaymentSetting()
	oldPaymentSetting := *paymentSetting

	affiliateSetting.Enabled = enabled
	affiliateSetting.RewardPercent = percent
	affiliateSetting.SettleAfterInviteeConsumed = settleAfterConsumed
	affiliateSetting.WithdrawEnabled = withdrawEnabled
	paymentSetting.ComplianceConfirmed = complianceConfirmed
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	t.Cleanup(func() {
		*affiliateSetting = oldAffiliateSetting
		*paymentSetting = oldPaymentSetting
	})
}

func createAffiliateTestUser(t *testing.T, user *User) *User {
	t.Helper()
	if user.AffCode == "" {
		user.AffCode = user.Username + "-aff"
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func createAffiliateTestTopUp(t *testing.T, userId int, tradeNo string, money float64) *TopUp {
	t.Helper()
	topUp := &TopUp{
		UserId:          userId,
		Amount:          int64(money),
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(topUp).Error)
	return topUp
}

func TestInviteCountIncrementsWithoutRegistrationReward(t *testing.T) {
	truncateTables(t)
	setAffiliateTestSettings(t, false, 0, false, false, false)

	inviter := createAffiliateTestUser(t, &User{Username: "inviter-no-reward"})

	require.NoError(t, inviteUser(inviter.Id, 0))

	var reloaded User
	require.NoError(t, DB.First(&reloaded, inviter.Id).Error)
	assert.Equal(t, 1, reloaded.AffCount)
	assert.Equal(t, 0, reloaded.AffQuota)
	assert.Equal(t, 0, reloaded.AffHistoryQuota)
}

func TestCreateAffiliateRebateFeatureOffDoesNothing(t *testing.T) {
	truncateTables(t)
	setAffiliateTestSettings(t, false, 10, false, false, true)

	inviter := createAffiliateTestUser(t, &User{Username: "inviter-off"})
	invitee := createAffiliateTestUser(t, &User{Username: "invitee-off", InviterId: inviter.Id})
	topUp := createAffiliateTestTopUp(t, invitee.Id, "trade-aff-off", 10)

	require.NoError(t, CreateAffiliateRebateForTopUp(topUp, 1000))

	var count int64
	require.NoError(t, DB.Model(&AffiliateRebate{}).Count(&count).Error)
	assert.EqualValues(t, 0, count)
}

func TestCreateAffiliateRebateAvailableImmediately(t *testing.T) {
	truncateTables(t)
	setAffiliateTestSettings(t, true, 10, false, false, true)

	inviter := createAffiliateTestUser(t, &User{Username: "inviter-available"})
	invitee := createAffiliateTestUser(t, &User{Username: "invitee-available", InviterId: inviter.Id})
	topUp := createAffiliateTestTopUp(t, invitee.Id, "trade-aff-available", 10)

	require.NoError(t, CreateAffiliateRebateForTopUp(topUp, 1000))

	var rebate AffiliateRebate
	require.NoError(t, DB.First(&rebate, "trade_no = ?", topUp.TradeNo).Error)
	assert.Equal(t, AffiliateRebateStatusAvailable, rebate.Status)
	assert.Equal(t, 100, rebate.RewardQuota)

	var reloaded User
	require.NoError(t, DB.First(&reloaded, inviter.Id).Error)
	assert.Equal(t, 100, reloaded.AffQuota)
	assert.Equal(t, 100, reloaded.AffHistoryQuota)
}

func TestPendingAffiliateRebateReleasesAfterInviteeConsumesTopUp(t *testing.T) {
	truncateTables(t)
	setAffiliateTestSettings(t, true, 10, true, false, true)

	inviter := createAffiliateTestUser(t, &User{Username: "inviter-pending"})
	invitee := createAffiliateTestUser(t, &User{Username: "invitee-pending", InviterId: inviter.Id, UsedQuota: 20})
	topUp := createAffiliateTestTopUp(t, invitee.Id, "trade-aff-pending", 10)

	require.NoError(t, CreateAffiliateRebateForTopUp(topUp, 100))

	pendingQuota, err := GetPendingAffiliateQuota(inviter.Id)
	require.NoError(t, err)
	assert.Equal(t, 10, pendingQuota)

	updateUserUsedQuotaAndRequestCount(invitee.Id, 99, 1)
	var notReleased User
	require.NoError(t, DB.First(&notReleased, inviter.Id).Error)
	assert.Equal(t, 0, notReleased.AffQuota)

	updateUserUsedQuotaAndRequestCount(invitee.Id, 1, 1)
	var released User
	require.NoError(t, DB.First(&released, inviter.Id).Error)
	assert.Equal(t, 10, released.AffQuota)
	assert.Equal(t, 10, released.AffHistoryQuota)

	var rebate AffiliateRebate
	require.NoError(t, DB.First(&rebate, "trade_no = ?", topUp.TradeNo).Error)
	assert.Equal(t, AffiliateRebateStatusAvailable, rebate.Status)
}

func TestAffiliateWithdrawalDeductsAndRejectRefunds(t *testing.T) {
	truncateTables(t)
	setAffiliateTestSettings(t, true, 10, false, true, true)

	user := createAffiliateTestUser(t, &User{Username: "withdraw-user", AffQuota: 100})

	withdrawal, err := CreateAffiliateWithdrawal(user.Id, 40, "manual", "account-id", "remark")
	require.NoError(t, err)
	assert.Equal(t, AffiliateWithdrawalStatusPending, withdrawal.Status)

	var afterCreate User
	require.NoError(t, DB.First(&afterCreate, user.Id).Error)
	assert.Equal(t, 60, afterCreate.AffQuota)

	require.NoError(t, UpdateAffiliateWithdrawalStatus(withdrawal.Id, AffiliateWithdrawalStatusRejected, "bad account", 1))
	var afterReject User
	require.NoError(t, DB.First(&afterReject, user.Id).Error)
	assert.Equal(t, 100, afterReject.AffQuota)
}
