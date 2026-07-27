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
	affiliateSetting.RewardRateBps = 2500
	affiliateSetting.RewardMicros = 25_000_000
	affiliateSetting.MinimumTopUpMicros = 20_000_000
	affiliateSetting.HoldSeconds = holdSeconds
	affiliateSetting.MinimumWithdrawalMicros = 1_000_000
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
}

func TestCalculateAffiliateRewardMicros(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		paidMicros int64
		expected   int64
	}{
		{name: "below minimum", paidMicros: 19_000_000, expected: 0},
		{name: "twenty yuan", paidMicros: 20_000_000, expected: 5_000_000},
		{name: "forty yuan", paidMicros: 40_000_000, expected: 10_000_000},
		{name: "eighty yuan", paidMicros: 80_000_000, expected: 20_000_000},
		{name: "one hundred yuan", paidMicros: 100_000_000, expected: 25_000_000},
		{name: "capped above one hundred", paidMicros: 120_000_000, expected: 25_000_000},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			actual := calculateAffiliateRewardMicros(test.paidMicros, 20_000_000, 2500, 25_000_000)
			assert.Equal(t, test.expected, actual)
		})
	}
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
	var relation ReferralRelation
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
	assert.Equal(t, ReferralStatusQualified, relation.Status)
	assert.Equal(t, int64(5_000_000), relation.RewardMicros)
	summary, err := GetAffiliateSummary(inviter.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(1), summary.QualifiedCount)
}

func TestAffiliateTopUpConfirmsReferralOnlyAfterQualifyingPayment(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, 0)
	inviter, invitee := createAffiliateUsers(t)
	now := time.Now().Unix()
	belowMinimum := &TopUp{
		UserId: invitee.Id, Amount: 19, Money: 19, TradeNo: "affiliate-topup-below-minimum",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, CreateTime: now, CompleteTime: now,
	}
	require.NoError(t, DB.Create(belowMinimum).Error)
	require.NoError(t, ProcessAffiliateTopUp(belowMinimum.Id))

	var relation ReferralRelation
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
	assert.Equal(t, ReferralStatusBound, relation.Status)
	var commissionCount int64
	require.NoError(t, DB.Model(&AffiliateCommission{}).Count(&commissionCount).Error)
	assert.Zero(t, commissionCount)

	qualifying := &TopUp{
		UserId: invitee.Id, Amount: 40, Money: 40, TradeNo: "affiliate-topup-qualifying",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, CreateTime: now + 1, CompleteTime: now + 1,
	}
	require.NoError(t, DB.Create(qualifying).Error)
	require.NoError(t, ProcessAffiliateTopUp(qualifying.Id))
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
	assert.Equal(t, ReferralStatusQualified, relation.Status)
	assert.Equal(t, int64(14_750_000), relation.RewardMicros)
	var account AffiliateAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, int64(14_750_000), account.AvailableMicros)
	summary, err := GetAffiliateSummary(inviter.Id)
	require.NoError(t, err)
	assert.Equal(t, int64(1), summary.QualifiedCount)
}

func TestAffiliateTopUpAccumulatesSuccessfulPayments(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, 0)
	inviter, invitee := createAffiliateUsers(t)
	now := time.Now().Unix()
	firstTopUp := &TopUp{
		UserId: invitee.Id, Amount: 10, Money: 10, TradeNo: "affiliate-topup-first-ten",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, CreateTime: now, CompleteTime: now,
	}
	require.NoError(t, DB.Create(firstTopUp).Error)
	require.NoError(t, ProcessAffiliateTopUp(firstTopUp.Id))

	var relation ReferralRelation
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
	assert.Equal(t, ReferralStatusBound, relation.Status)
	failedTopUp := &TopUp{
		UserId: invitee.Id, Amount: 10, Money: 10, TradeNo: "affiliate-topup-failed-ten",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusFailed, CreateTime: now + 1, CompleteTime: now + 1,
	}
	require.NoError(t, DB.Create(failedTopUp).Error)

	secondTopUp := &TopUp{
		UserId: invitee.Id, Amount: 10, Money: 10, TradeNo: "affiliate-topup-second-ten",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, CreateTime: now + 2, CompleteTime: now + 2,
	}
	require.NoError(t, DB.Create(secondTopUp).Error)
	require.NoError(t, ProcessAffiliateTopUp(secondTopUp.Id))

	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
	assert.Equal(t, ReferralStatusQualified, relation.Status)
	require.NotNil(t, relation.QualifyingTopUpID)
	assert.Equal(t, secondTopUp.Id, *relation.QualifyingTopUpID)
	assert.Equal(t, int64(5_000_000), relation.RewardMicros)
	var account AffiliateAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, int64(5_000_000), account.AvailableMicros)
}

func TestAffiliateTopUpCountsAmountsAtAndAboveMinimum(t *testing.T) {
	tests := []struct {
		name           string
		money          float64
		expectedReward int64
	}{
		{name: "exactly minimum", money: 20, expectedReward: 5_000_000},
		{name: "above minimum", money: 21, expectedReward: 5_250_000},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			truncateTables(t)
			configureAffiliateTest(t, 0)
			inviter, invitee := createAffiliateUsers(t)
			now := time.Now().Unix()
			topUp := &TopUp{
				UserId: invitee.Id, Amount: int64(test.money), Money: test.money, TradeNo: "affiliate-topup-" + test.name,
				PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
				Status: common.TopUpStatusSuccess, CreateTime: now, CompleteTime: now,
			}
			require.NoError(t, DB.Create(topUp).Error)
			require.NoError(t, ProcessAffiliateTopUp(topUp.Id))

			var relation ReferralRelation
			require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
			assert.Equal(t, ReferralStatusQualified, relation.Status)
			assert.Equal(t, test.expectedReward, relation.RewardMicros)
			var account AffiliateAccount
			require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
			assert.Equal(t, test.expectedReward, account.AvailableMicros)
		})
	}
}

func TestAffiliateTopUpPreservesLegacyFixedReward(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, 0)
	inviter, invitee := createAffiliateUsers(t)
	require.NoError(t, DB.Model(&ReferralRelation{}).
		Where("invitee_user_id = ?", invitee.Id).
		Updates(map[string]interface{}{
			"reward_rate_bps":       int64(0),
			"reward_micros":         int64(5_000_000),
			"minimum_top_up_micros": int64(10_000_000),
		}).Error)
	now := time.Now().Unix()
	topUp := &TopUp{
		UserId: invitee.Id, Amount: 10, Money: 10, TradeNo: "affiliate-topup-legacy-fixed",
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		Status: common.TopUpStatusSuccess, CreateTime: now, CompleteTime: now,
	}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, ProcessAffiliateTopUp(topUp.Id))

	var relation ReferralRelation
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
	assert.Equal(t, ReferralStatusQualified, relation.Status)
	assert.Zero(t, relation.RewardRateBps)
	assert.Equal(t, int64(5_000_000), relation.RewardMicros)
	var account AffiliateAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, int64(5_000_000), account.AvailableMicros)
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
