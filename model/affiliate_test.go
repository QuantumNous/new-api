package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func configureAffiliateTest(t *testing.T, holdSeconds int64) {
	t.Helper()
	affiliateSetting := operation_setting.GetAffiliateSetting()
	originalAffiliate := *affiliateSetting
	paymentSetting := operation_setting.GetPaymentSetting()
	originalPayment := *paymentSetting
	t.Cleanup(func() {
		*affiliateSetting = originalAffiliate
		*paymentSetting = originalPayment
	})
	affiliateSetting.Enabled = true
	affiliateSetting.Currency = "USD"
	affiliateSetting.RewardMicros = 5_000_000
	affiliateSetting.MinimumTopUpMicros = 10_000_000
	affiliateSetting.HoldSeconds = holdSeconds
	affiliateSetting.MinimumWithdrawalMicros = 1_000_000
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func createAffiliateUsers(t *testing.T) (*User, *User) {
	t.Helper()
	inviter := &User{Username: "affiliate-inviter", AffCode: "INVITER1", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(inviter).Error)
	invitee := &User{Username: "affiliate-invitee", AffCode: "INVITEE1", InviterId: inviter.Id, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(invitee).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		if err := initializeAffiliateUserWithTx(tx, inviter, 0, false); err != nil {
			return err
		}
		return initializeAffiliateUserWithTx(tx, invitee, inviter.Id, true)
	}))
	return inviter, invitee
}

func TestAffiliateTopUpCreatesOneCommissionAndReleasesIt(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, 60)
	inviter, invitee := createAffiliateUsers(t)
	topUp := &TopUp{
		UserId: invitee.Id, Amount: 20, Money: 20, TradeNo: "affiliate-topup-1",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, CreateTime: time.Now().Unix(), CompleteTime: time.Now().Unix(),
	}
	require.NoError(t, DB.Create(topUp).Error)

	require.NoError(t, ProcessAffiliateTopUp(topUp.Id))
	require.NoError(t, ProcessAffiliateTopUp(topUp.Id))

	var commissionCount int64
	require.NoError(t, DB.Model(&AffiliateCommission{}).Where("top_up_id = ?", topUp.Id).Count(&commissionCount).Error)
	assert.Equal(t, int64(1), commissionCount)
	var account AffiliateAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, int64(5_000_000), account.PendingMicros)
	assert.Zero(t, account.AvailableMicros)

	released, err := ReleaseDueAffiliateCommissions(time.Now().Unix()+120, 100)
	require.NoError(t, err)
	assert.Equal(t, 1, released)
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Zero(t, account.PendingMicros)
	assert.Equal(t, int64(5_000_000), account.AvailableMicros)
	assert.Equal(t, int64(5_000_000), account.LifetimeEarnedMicros)
}

func TestAffiliateWithdrawalPreservesExactBalances(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, 0)
	user := &User{Username: "withdrawal-user", AffCode: "WITHDRAW1", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(user).Error)
	require.NoError(t, EnsureAffiliateProfile(user.Id))
	require.NoError(t, DB.Model(&AffiliateAccount{}).Where("user_id = ?", user.Id).Updates(map[string]interface{}{
		"available_micros":       int64(10_000_000),
		"lifetime_earned_micros": int64(10_000_000),
	}).Error)

	first, err := CreateAffiliateWithdrawal(user.Id, 6_000_000, "bank", "encrypted", "request-1")
	require.NoError(t, err)
	duplicate, err := CreateAffiliateWithdrawal(user.Id, 6_000_000, "bank", "encrypted", "request-1")
	require.NoError(t, err)
	assert.Equal(t, first.ID, duplicate.ID)

	var account AffiliateAccount
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&account).Error)
	assert.Equal(t, int64(4_000_000), account.AvailableMicros)
	assert.Equal(t, int64(6_000_000), account.FrozenMicros)

	_, err = ApproveAffiliateWithdrawal(first.ID, 99, "verified")
	require.NoError(t, err)
	_, err = MarkAffiliateWithdrawalPaid(first.ID, 99, "bank-transfer-1")
	require.NoError(t, err)
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&account).Error)
	assert.Equal(t, int64(4_000_000), account.AvailableMicros)
	assert.Zero(t, account.FrozenMicros)
	assert.Equal(t, int64(6_000_000), account.WithdrawnMicros)

	second, err := CreateAffiliateWithdrawal(user.Id, 3_000_000, "bank", "encrypted", "request-2")
	require.NoError(t, err)
	_, err = RejectAffiliateWithdrawal(second.ID, 99, "account mismatch")
	require.NoError(t, err)
	require.NoError(t, DB.Where("user_id = ?", user.Id).First(&account).Error)
	assert.Equal(t, int64(4_000_000), account.AvailableMicros)
	assert.Zero(t, account.FrozenMicros)
	assert.Equal(t, int64(6_000_000), account.WithdrawnMicros)
}

func TestAffiliateStatementReconcilesLedgerBalances(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, 0)
	inviter, invitee := createAffiliateUsers(t)
	now := time.Now().Unix()
	topUp := &TopUp{
		UserId: invitee.Id, Amount: 20, Money: 20, TradeNo: "affiliate-topup-statement",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, CreateTime: now, CompleteTime: now,
	}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, ProcessAffiliateTopUp(topUp.Id))

	generated, err := GenerateAffiliateStatements(now-1, now+2)
	require.NoError(t, err)
	assert.Equal(t, 1, generated)
	statements, total, err := GetUserAffiliateStatements(inviter.Id, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, statements, 1)
	assert.Zero(t, statements[0].OpeningAvailableMicros)
	assert.Equal(t, int64(5_000_000), statements[0].EarnedMicros)
	assert.Equal(t, int64(5_000_000), statements[0].ClosingAvailableMicros)
	detail, err := GetUserAffiliateStatementDetail(inviter.Id, statements[0].ID)
	require.NoError(t, err)
	require.Len(t, detail.Items, 1)
	assert.Equal(t, int64(5_000_000), detail.Items[0].AmountMicros)
}
