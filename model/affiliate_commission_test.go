package model

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setDistributionTestConfig(t *testing.T, enabled bool, level1RateBps int, level2RateBps int) {
	t.Helper()
	oldDistribution := *operation_setting.GetDistributionSetting()
	oldPayment := *operation_setting.GetPaymentSetting()
	oldPrice := operation_setting.Price
	t.Cleanup(func() {
		*operation_setting.GetDistributionSetting() = oldDistribution
		*operation_setting.GetPaymentSetting() = oldPayment
		operation_setting.Price = oldPrice
	})

	distribution := operation_setting.GetDistributionSetting()
	distribution.Enabled = enabled
	distribution.Level1RateBps = level1RateBps
	distribution.Level2RateBps = level2RateBps
	distribution.CdkPurchaseDiscountBps = 0
	distribution.Currency = "CNY"
	distribution.PointsPerAmountUnit = operation_setting.DefaultDistributionPointsPerAmountUnit
	distribution.OfflineAmountPerPointMicros = operation_setting.DefaultDistributionOfflineAmountPerPointMicros

	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	operation_setting.Price = 0.2
}

func insertAffiliateTestUser(t *testing.T, id int, username string, inviterId int) {
	t.Helper()
	user := &User{
		Id:                  id,
		Username:            username,
		DisplayName:         username,
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             username + "_code",
		InviterId:           inviterId,
		DistributionEnabled: true,
	}
	require.NoError(t, DB.Create(user).Error)
}

func setAffiliateTestDistributionEnabled(t *testing.T, userId int, enabled bool) {
	t.Helper()
	require.NoError(t, DB.Model(&User{}).
		Where("id = ?", userId).
		Updates(map[string]interface{}{"distribution_enabled": enabled}).Error)
}

func saveAffiliateTestPayoutProfile(t *testing.T, userId int, account string, accountName string) {
	t.Helper()
	_, err := SaveAffiliatePayoutProfile(userId, AffiliatePayoutMethodPayPal, account, accountName)
	require.NoError(t, err)
}

func insertAffiliateTestTopUp(t *testing.T, tradeNo string, userId int, money float64) {
	t.Helper()
	topUp := &TopUp{
		UserId:          userId,
		Amount:          1000,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   "alipay",
		PaymentProvider: PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())
}

func getAffiliateTestCommissions(t *testing.T) []AffiliateCommission {
	t.Helper()
	var commissions []AffiliateCommission
	require.NoError(t, DB.Order("level asc").Find(&commissions).Error)
	return commissions
}

func prepareTwoLevelAffiliateChain(t *testing.T) {
	t.Helper()
	insertAffiliateTestUser(t, 1001, "affiliate_a", 0)
	insertAffiliateTestUser(t, 1002, "affiliate_b", 1001)
	insertAffiliateTestUser(t, 1003, "affiliate_c", 1002)
}

func TestCompleteEpayTopUp_DistributionGlobalOffCreatesNoCommission(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, false, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-global-off", 1003, 123.45)

	completed, err := CompleteEpayTopUp("aff-global-off", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	var count int64
	require.NoError(t, DB.Model(&AffiliateCommission{}).Count(&count).Error)
	assert.EqualValues(t, 0, count)
}

func TestCompleteEpayTopUp_CreatesTwoLevelCommissions(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-two-level", 1003, 123.45)

	completed, err := CompleteEpayTopUp("aff-two-level", "wechat", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	assert.Equal(t, AffiliateCommissionLevel1, commissions[0].Level)
	assert.Equal(t, 1002, commissions[0].PromoterId)
	assert.EqualValues(t, 1000000000, commissions[0].BaseAmountMicros)
	assert.EqualValues(t, 100000000, commissions[0].CommissionAmountMicros)
	assert.EqualValues(t, calculateQuotaFromAmount(1000), commissions[0].BaseQuota)
	assert.EqualValues(t, 100, commissions[0].RewardPoints)
	assert.Equal(t, "wechat", commissions[0].PaymentMethod)
	assert.Equal(t, AffiliateCommissionLevel2, commissions[1].Level)
	assert.Equal(t, 1001, commissions[1].PromoterId)
	assert.EqualValues(t, 30000000, commissions[1].CommissionAmountMicros)
	assert.EqualValues(t, 30, commissions[1].RewardPoints)
}

func TestManualCompleteTopUp_CreatesRewardPointsFromPaymentAmount(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	topUp := &TopUp{
		UserId:          1003,
		Amount:          100,
		Money:           20,
		TradeNo:         "aff-manual-payment-amount",
		PaymentMethod:   "wxpay",
		PaymentProvider: PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	require.NoError(t, ManualCompleteTopUp("aff-manual-payment-amount", "127.0.0.1"))

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	assert.Equal(t, 1002, commissions[0].PromoterId)
	assert.EqualValues(t, calculateQuotaFromAmount(100), commissions[0].BaseQuota)
	assert.EqualValues(t, 2, commissions[0].RewardPoints)
}

func TestCompleteEpayTopUp_DisabledLevelPromoterIsSkippedIndependently(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	setAffiliateTestDistributionEnabled(t, 1002, false)
	insertAffiliateTestTopUp(t, "aff-disabled-level1", 1003, 50)

	completed, err := CompleteEpayTopUp("aff-disabled-level1", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	assert.Equal(t, AffiliateCommissionLevel2, commissions[0].Level)
	assert.Equal(t, 1001, commissions[0].PromoterId)
}

func TestCompleteEpayTopUp_BuyerDistributionDisabledStillRewardsQualifiedUplines(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	setAffiliateTestDistributionEnabled(t, 1003, false)
	insertAffiliateTestTopUp(t, "aff-buyer-disabled", 1003, 50)

	completed, err := CompleteEpayTopUp("aff-buyer-disabled", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	assert.Equal(t, 1002, commissions[0].PromoterId)
	assert.Equal(t, 1001, commissions[1].PromoterId)
}

func TestCompleteEpayTopUp_IsIdempotentForDistributionCommissions(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-idempotent", 1003, 50)

	completed, err := CompleteEpayTopUp("aff-idempotent", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)
	completed, err = CompleteEpayTopUp("aff-idempotent", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.False(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	assert.Equal(t, calculateQuotaFromAmount(1000), getUserQuotaForPaymentGuardTest(t, 1003))
}

func TestListAffiliateCommissionsIncludesBuyerUplineDetails(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-list-uplines", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-list-uplines", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	records, total, err := ListAffiliateCommissions(AffiliateCommissionQuery{TradeNo: "aff-list-uplines"}, &common.PageInfo{Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, records, 2)
	for _, record := range records {
		require.NotNil(t, record.BuyerDirectInviterId)
		require.NotNil(t, record.BuyerDirectInviterUsername)
		require.NotNil(t, record.BuyerSecondInviterId)
		require.NotNil(t, record.BuyerSecondInviterUsername)
		assert.Equal(t, 1002, *record.BuyerDirectInviterId)
		assert.Equal(t, "affiliate_b", *record.BuyerDirectInviterUsername)
		assert.Equal(t, 1001, *record.BuyerSecondInviterId)
		assert.Equal(t, "affiliate_a", *record.BuyerSecondInviterUsername)
	}

	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	insertAffiliateTestUser(t, 2001, "direct_only_a", 0)
	insertAffiliateTestUser(t, 2002, "direct_only_b", 2001)
	insertAffiliateTestTopUp(t, "aff-list-null-upline", 2002, 50)
	completed, err = CompleteEpayTopUp("aff-list-null-upline", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	records, total, err = ListAffiliateCommissions(AffiliateCommissionQuery{TradeNo: "aff-list-null-upline"}, &common.PageInfo{Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, records, 1)
	require.NotNil(t, records[0].BuyerDirectInviterId)
	assert.Equal(t, 2001, *records[0].BuyerDirectInviterId)
	assert.Nil(t, records[0].BuyerSecondInviterId)
	assert.Nil(t, records[0].BuyerSecondInviterUsername)
}

func TestAffiliatePayoutProfileSaveValidation(t *testing.T) {
	truncateTables(t)
	insertAffiliateTestUser(t, 1001, "affiliate_a", 0)

	_, err := SaveAffiliatePayoutProfile(1001, AffiliatePayoutMethodPayPal, "", "")
	require.Error(t, err)

	_, err = SaveAffiliatePayoutProfile(1001, AffiliatePayoutMethodPayPal, "not-an-email", "")
	require.Error(t, err)

	profile, err := SaveAffiliatePayoutProfile(1001, AffiliatePayoutMethodPayPal, "AgentA@Example.COM", "Agent A")
	require.NoError(t, err)
	assert.Equal(t, AffiliatePayoutMethodPayPal, profile.Method)
	assert.Equal(t, "agenta@example.com", profile.Account)
	assert.Equal(t, "Agent A", profile.AccountName)

	profile, err = SaveAffiliatePayoutProfile(1001, AffiliatePayoutMethodPayPal, "agent-a-new@example.com", "Agent A New")
	require.NoError(t, err)
	assert.Equal(t, "agent-a-new@example.com", profile.Account)
	assert.Equal(t, "Agent A New", profile.AccountName)
}

func TestOfflineCashbackAffiliateRewardPointsDoesNotRequirePayoutProfile(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-settle-no-paypal", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-settle-no-paypal", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	_, err = OfflineCashbackAffiliateRewardPoints(1002, commissions[0].RewardPoints, 1001, "offline cashback")
	require.NoError(t, err)

	var settled []AffiliateCommission
	require.NoError(t, DB.Order("level asc").Find(&settled).Error)
	require.Len(t, settled, 2)
	assert.Equal(t, AffiliateCommissionStatusSettled, settled[0].Status)
	assert.Equal(t, AffiliateCommissionSettlementTypeOfflineCashback, settled[0].SettlementType)
	assert.Equal(t, "offline cashback", settled[0].SettleRemark)
	assert.Equal(t, AffiliateCommissionStatusPending, settled[1].Status)
}

func TestOfflineCashbackAffiliateRewardPointsRequiresEnoughPendingPoints(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-settle", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-settle", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	_, err = OfflineCashbackAffiliateRewardPoints(1002, commissions[0].RewardPoints, 1001, "offline cashback")
	require.NoError(t, err)
	_, err = OfflineCashbackAffiliateRewardPoints(1002, 1, 1001, "duplicate")
	require.Error(t, err)

	var pendingCount int64
	require.NoError(t, DB.Model(&AffiliateCommission{}).Where("status = ?", AffiliateCommissionStatusPending).Count(&pendingCount).Error)
	assert.EqualValues(t, 1, pendingCount)
}

func TestRedeemAffiliateRewardPointsTransfersPendingPointsToWallet(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-redeem", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-redeem", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	redemption, err := RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id})
	require.NoError(t, err)
	assert.Equal(t, commissions[0].RewardPoints, redemption.RedeemedPoints)
	assert.Equal(t, 50000000, redemption.RedeemedQuota)
	assert.EqualValues(t, 0, redemption.CashValueMicros)
	assert.EqualValues(t, 0, redemption.PricePerWalletUnitMicros)

	user, err := GetUserById(1002, true)
	require.NoError(t, err)
	assert.Equal(t, redemption.RedeemedQuota, user.Quota)

	records, total, err := ListAffiliateCommissions(AffiliateCommissionQuery{TradeNo: "aff-redeem"}, &common.PageInfo{Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, records, 2)
	for _, record := range records {
		if record.PromoterId == 1002 {
			assert.Equal(t, AffiliateCommissionStatusSettled, record.Status)
			assert.Equal(t, AffiliateCommissionSettlementTypeWallet, record.SettlementType)
			assert.Equal(t, redemption.RedeemedQuota, record.SettledWalletQuota)
			assert.EqualValues(t, 100000000, record.SettledWalletAmountMicros)
			assert.EqualValues(t, 0, record.SettledCashValueMicros)
		} else {
			assert.Equal(t, AffiliateCommissionStatusPending, record.Status)
		}
	}
}

func TestRedeemAffiliateRewardPointsUsesCurrentTopUpPrice(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-redeem-price", 1003, 20)
	completed, err := CompleteEpayTopUp("aff-redeem-price", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	assert.Equal(t, 20, commissions[0].RewardPoints)

	redemption, err := RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id})
	require.NoError(t, err)
	assert.Equal(t, 20, redemption.RedeemedPoints)
	assert.Equal(t, 10000000, redemption.RedeemedQuota)

	operation_setting.Price = 0.1
	var settled AffiliateCommission
	require.NoError(t, DB.First(&settled, commissions[0].Id).Error)
	assert.Equal(t, 10000000, settled.SettledWalletQuota)
	assert.EqualValues(t, 0, settled.SettledPricePerWalletUnitMicros)

	insertAffiliateTestTopUp(t, "aff-redeem-price-new", 1003, 20)
	completed, err = CompleteEpayTopUp("aff-redeem-price-new", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	var pending AffiliateCommission
	require.NoError(t, DB.Where("trade_no = ?", "aff-redeem-price-new").First(&pending).Error)
	redemption, err = RedeemAffiliateRewardPoints(1002, []int{pending.Id})
	require.NoError(t, err)
	assert.Equal(t, 20, redemption.RedeemedPoints)
	assert.Equal(t, 10000000, redemption.RedeemedQuota)
	assert.EqualValues(t, 0, redemption.PricePerWalletUnitMicros)
}

func TestRedeemAffiliateRewardPointsPartiallyByPointAmount(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-redeem-partial", 1003, 20)
	completed, err := CompleteEpayTopUp("aff-redeem-partial", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	assert.Equal(t, 20, commissions[0].RewardPoints)

	quote, err := QuoteAffiliateRewardPointRedemption(1002, 10)
	require.NoError(t, err)
	assert.Equal(t, 10, quote.RedeemablePoints)
	assert.Equal(t, 5000000, quote.RedeemedQuota)
	assert.EqualValues(t, 0, quote.CashValueMicros)

	redemption, err := RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 10)
	require.NoError(t, err)
	assert.Equal(t, 10, redemption.RedeemedPoints)
	assert.Equal(t, 5000000, redemption.RedeemedQuota)

	var commission AffiliateCommission
	require.NoError(t, DB.First(&commission, commissions[0].Id).Error)
	assert.Equal(t, AffiliateCommissionStatusPending, commission.Status)
	assert.Equal(t, AffiliateCommissionSettlementTypeWallet, commission.SettlementType)
	assert.Equal(t, 10, commission.SettledPoints)
	assert.Equal(t, 10, commission.WalletRedeemedPoints)
	assert.Equal(t, 0, commission.OfflineSettledPoints)
	assert.Equal(t, 5000000, commission.SettledWalletQuota)
	assert.EqualValues(t, 0, commission.SettledCashValueMicros)

	records, total, err := ListAffiliateCommissions(AffiliateCommissionQuery{TradeNo: "aff-redeem-partial"}, &common.PageInfo{Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, records, 1)
	assert.Equal(t, 10, records[0].PendingPoints)
	assert.EqualValues(t, 0, records[0].CashValueMicros)
	assert.EqualValues(t, 5000000, records[0].WalletQuota)

	var settlements []AffiliateCommissionSettlement
	require.NoError(t, DB.Order("id asc").Find(&settlements).Error)
	require.Len(t, settlements, 1)
	assert.Equal(t, AffiliateCommissionSettlementTypeWallet, settlements[0].SettlementType)
	assert.Equal(t, 10, settlements[0].SettledPoints)
	assert.Equal(t, 5000000, settlements[0].WalletQuota)
}

func TestRedeemAffiliateRewardPointsCanFinishRecordInMultipleRedemptions(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-redeem-multiple", 1003, 20)
	completed, err := CompleteEpayTopUp("aff-redeem-multiple", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 10)
	require.NoError(t, err)
	redemption, err := RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 10)
	require.NoError(t, err)
	assert.Equal(t, 10, redemption.RedeemedPoints)
	assert.Equal(t, 5000000, redemption.RedeemedQuota)

	var commission AffiliateCommission
	require.NoError(t, DB.First(&commission, commissions[0].Id).Error)
	assert.Equal(t, AffiliateCommissionStatusSettled, commission.Status)
	assert.Equal(t, 20, commission.SettledPoints)
	assert.Equal(t, 20, commission.WalletRedeemedPoints)
	assert.Equal(t, 10000000, commission.SettledWalletQuota)

	var settlementCount int64
	require.NoError(t, DB.Model(&AffiliateCommissionSettlement{}).Where("commission_id = ?", commissions[0].Id).Count(&settlementCount).Error)
	assert.EqualValues(t, 2, settlementCount)
}

func TestRedeemAffiliateRewardPointsRejectsInvalidPointAmount(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-redeem-invalid-points", 1003, 20)
	completed, err := CompleteEpayTopUp("aff-redeem-invalid-points", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 0)
	require.Error(t, err)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, -1)
	require.Error(t, err)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 21)
	require.Error(t, err)
}

func TestRedeemAffiliateRewardPointsFixedRatePerPartialSettlement(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-redeem-partial-price", 1003, 20)
	completed, err := CompleteEpayTopUp("aff-redeem-partial-price", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 10)
	require.NoError(t, err)
	operation_setting.Price = 0.1
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 10)
	require.NoError(t, err)

	var settlements []AffiliateCommissionSettlement
	require.NoError(t, DB.Order("id asc").Find(&settlements).Error)
	require.Len(t, settlements, 2)
	assert.EqualValues(t, 0, settlements[0].PricePerWalletUnitMicros)
	assert.Equal(t, 5000000, settlements[0].WalletQuota)
	assert.EqualValues(t, 0, settlements[1].PricePerWalletUnitMicros)
	assert.Equal(t, 5000000, settlements[1].WalletQuota)
}

func TestOfflineCashbackAffiliateRewardPointsSettlesOnlyRemainingPoints(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-offline-remaining", 1003, 20)
	completed, err := CompleteEpayTopUp("aff-offline-remaining", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id}, 10)
	require.NoError(t, err)
	_, err = OfflineCashbackAffiliateRewardPoints(1002, 10, 1001, "cashback remaining")
	require.NoError(t, err)

	var commission AffiliateCommission
	require.NoError(t, DB.First(&commission, commissions[0].Id).Error)
	assert.Equal(t, AffiliateCommissionStatusSettled, commission.Status)
	assert.Equal(t, 20, commission.SettledPoints)
	assert.Equal(t, 10, commission.WalletRedeemedPoints)
	assert.Equal(t, 10, commission.OfflineSettledPoints)
	assert.EqualValues(t, 0, commission.SettledCashValueMicros)

	var cashbackSettlement AffiliateCommissionSettlement
	require.NoError(t, DB.Where("settlement_type = ?", AffiliateCommissionSettlementTypeOfflineCashback).First(&cashbackSettlement).Error)
	assert.Equal(t, 10, cashbackSettlement.SettledPoints)
	assert.EqualValues(t, 0, cashbackSettlement.CashValueMicros)
}

func TestAffiliateRewardPointSettlementIsMutuallyExclusive(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-exclusive", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-exclusive", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id})
	require.NoError(t, err)
	_, err = OfflineCashbackAffiliateRewardPoints(1002, 1, 1001, "duplicate cashback")
	require.Error(t, err)

	_, err = OfflineCashbackAffiliateRewardPoints(1001, commissions[1].RewardPoints, 1001, "cashback")
	require.NoError(t, err)
	_, err = RedeemAffiliateRewardPoints(1001, []int{commissions[1].Id})
	require.Error(t, err)
}

func TestAffiliateCommissionSummaryUsesRewardPoints(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-summary", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-summary", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	_, err = RedeemAffiliateRewardPoints(1002, []int{commissions[0].Id})
	require.NoError(t, err)
	_, err = OfflineCashbackAffiliateRewardPoints(1001, commissions[1].RewardPoints, 1001, "cashback")
	require.NoError(t, err)

	summary, err := GetAffiliateCommissionSummary(AffiliateCommissionQuery{})
	require.NoError(t, err)
	assert.EqualValues(t, commissions[0].RewardPoints, summary.WalletRedeemedPoints)
	assert.EqualValues(t, commissions[1].RewardPoints, summary.OfflineSettledPoints)
	assert.EqualValues(t, commissions[1].RewardPoints, summary.OfflineCashbackPoints)
	assert.EqualValues(t, commissions[0].RewardPoints+commissions[1].RewardPoints, summary.TotalPoints)
	assert.EqualValues(t, 0, summary.PendingPoints)
}

func TestOfflineCashbackAffiliateRewardPointsStoresPointSnapshot(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-offline-snapshot", 1003, 20)
	completed, err := CompleteEpayTopUp("aff-offline-snapshot", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 1)
	_, err = OfflineCashbackAffiliateRewardPoints(1002, commissions[0].RewardPoints, 1001, "cashback")
	require.NoError(t, err)

	var settled AffiliateCommission
	require.NoError(t, DB.First(&settled, commissions[0].Id).Error)
	assert.Equal(t, AffiliateCommissionSettlementTypeOfflineCashback, settled.SettlementType)
	assert.EqualValues(t, 0, settled.SettledCashValueMicros)
	assert.Equal(t, 0, settled.SettledWalletQuota)
	assert.EqualValues(t, 0, settled.SettledPointsPerAmountUnit)
	assert.EqualValues(t, 0, settled.SettledOfflineAmountPerPointMicros)
}

func TestMigrateLegacyAffiliateWalletRedemptionsRollsBackOldPointQuota(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Where("key = ?", legacyAffiliateWalletRedemptionRollbackMigrationKey).Delete(&Option{}).Error)
	t.Cleanup(func() {
		_ = DB.Where("key = ?", legacyAffiliateWalletRedemptionRollbackMigrationKey).Delete(&Option{}).Error
	})
	setDistributionTestConfig(t, true, 200, 0)
	insertAffiliateTestUser(t, 1001, "legacy_agent", 0)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 1001).Update("quota", 250000040).Error)
	require.NoError(t, DB.Create(&AffiliateCommission{
		Id:                     5001,
		TradeNo:                "legacy-wallet",
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  AffiliateCommissionLevel1,
		BaseAmountMicros:       20000000,
		CommissionRateBps:      200,
		CommissionAmountMicros: 400000,
		RewardPoints:           40,
		Status:                 AffiliateCommissionStatusSettled,
		SettlementType:         AffiliateCommissionSettlementTypeWallet,
		SettledAt:              common.GetTimestamp(),
		SettledBy:              1001,
		SettleRemark:           "redeemed to wallet",
	}).Error)

	require.NoError(t, migrateLegacyAffiliateWalletRedemptions())

	user, err := GetUserById(1001, true)
	require.NoError(t, err)
	assert.Equal(t, 250000000, user.Quota)

	var commission AffiliateCommission
	require.NoError(t, DB.First(&commission, 5001).Error)
	assert.Equal(t, AffiliateCommissionStatusPending, commission.Status)
	assert.Equal(t, "", commission.SettlementType)
	assert.EqualValues(t, 0, commission.SettledAt)
	assert.Equal(t, 0, commission.SettledBy)
	assert.Equal(t, "", commission.SettleRemark)

	var marker Option
	require.NoError(t, DB.Where("key = ?", legacyAffiliateWalletRedemptionRollbackMigrationKey).First(&marker).Error)
	assert.Equal(t, "done", marker.Value)
}

func TestMigrateLegacyAffiliateWalletRedemptionsRunsOnce(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Where("key = ?", legacyAffiliateWalletRedemptionRollbackMigrationKey).Delete(&Option{}).Error)
	t.Cleanup(func() {
		_ = DB.Where("key = ?", legacyAffiliateWalletRedemptionRollbackMigrationKey).Delete(&Option{}).Error
	})
	require.NoError(t, DB.Create(&Option{
		Key:   legacyAffiliateWalletRedemptionRollbackMigrationKey,
		Value: "done",
	}).Error)
	setDistributionTestConfig(t, true, 200, 0)
	insertAffiliateTestUser(t, 1001, "legacy_agent_once", 0)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", 1001).Update("quota", 250000040).Error)
	require.NoError(t, DB.Create(&AffiliateCommission{
		Id:                     5002,
		TradeNo:                "legacy-wallet-once",
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  AffiliateCommissionLevel1,
		BaseAmountMicros:       20000000,
		CommissionRateBps:      200,
		CommissionAmountMicros: 400000,
		RewardPoints:           40,
		Status:                 AffiliateCommissionStatusSettled,
		SettlementType:         AffiliateCommissionSettlementTypeWallet,
		SettledAt:              common.GetTimestamp(),
		SettledBy:              1001,
		SettleRemark:           "redeemed to wallet",
	}).Error)

	require.NoError(t, migrateLegacyAffiliateWalletRedemptions())

	user, err := GetUserById(1001, true)
	require.NoError(t, err)
	assert.Equal(t, 250000040, user.Quota)

	var commission AffiliateCommission
	require.NoError(t, DB.First(&commission, 5002).Error)
	assert.Equal(t, AffiliateCommissionStatusSettled, commission.Status)
	assert.Equal(t, AffiliateCommissionSettlementTypeWallet, commission.SettlementType)
}

func TestMigrateAffiliateCommissionRewardPointsOnlyFillsMissingValues(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 200, 0)
	insertAffiliateTestUser(t, 1001, "points_agent", 0)
	insertAffiliateTestUser(t, 1002, "points_buyer", 1001)

	topUpWithPoints := &TopUp{
		UserId:          1002,
		Amount:          100,
		Money:           20,
		TradeNo:         "points-preserve",
		PaymentMethod:   "alipay",
		PaymentProvider: PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(topUpWithPoints).Error)
	topUpMissingPoints := &TopUp{
		UserId:          1002,
		Amount:          100,
		Money:           20,
		TradeNo:         "points-fill",
		PaymentMethod:   "alipay",
		PaymentProvider: PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(topUpMissingPoints).Error)

	require.NoError(t, DB.Create(&AffiliateCommission{
		TradeNo:                topUpWithPoints.TradeNo,
		TopUpId:                topUpWithPoints.Id,
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  AffiliateCommissionLevel1,
		BaseAmountMicros:       moneyToMicros(20),
		CommissionRateBps:      200,
		CommissionAmountMicros: 400000,
		BaseQuota:              0,
		RewardPoints:           40,
		Status:                 AffiliateCommissionStatusPending,
	}).Error)
	require.NoError(t, DB.Create(&AffiliateCommission{
		TradeNo:                topUpMissingPoints.TradeNo,
		TopUpId:                topUpMissingPoints.Id,
		BuyerId:                1002,
		PromoterId:             1001,
		Level:                  AffiliateCommissionLevel1,
		BaseAmountMicros:       moneyToMicros(20),
		CommissionRateBps:      200,
		CommissionAmountMicros: 400000,
		BaseQuota:              0,
		RewardPoints:           0,
		Status:                 AffiliateCommissionStatusPending,
	}).Error)

	operation_setting.GetDistributionSetting().PointsPerAmountUnit = 500
	require.NoError(t, migrateAffiliateCommissionRewardPoints())

	var preserved AffiliateCommission
	require.NoError(t, DB.Where("trade_no = ?", "points-preserve").First(&preserved).Error)
	assert.Equal(t, 40, preserved.RewardPoints)
	assert.Equal(t, calculateQuotaFromAmount(100), preserved.BaseQuota)

	var filled AffiliateCommission
	require.NoError(t, DB.Where("trade_no = ?", "points-fill").First(&filled).Error)
	assert.Equal(t, affiliateRewardPointsFromQuota(calculateQuotaFromAmount(100), 200), filled.RewardPoints)
	assert.Equal(t, calculateQuotaFromAmount(100), filled.BaseQuota)
}

func TestMigrateDisableExistingUserDistributionRunsOnce(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.AutoMigrate(&Option{}))
	require.NoError(t, DB.Where("key = ?", disableExistingUserDistributionMigrationKey).Delete(&Option{}).Error)
	require.NoError(t, DB.Create(&User{
		Id:                  9001,
		Username:            "legacy_agent",
		DisplayName:         "legacy_agent",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "legacy_agent_code",
		DistributionEnabled: true,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id:                  9002,
		Username:            "legacy_disabled",
		DisplayName:         "legacy_disabled",
		Status:              common.UserStatusEnabled,
		Role:                common.RoleCommonUser,
		AffCode:             "legacy_disabled_code",
		DistributionEnabled: false,
	}).Error)

	require.NoError(t, migrateDisableExistingUserDistribution())

	var users []User
	require.NoError(t, DB.Order("id asc").Find(&users).Error)
	require.Len(t, users, 2)
	assert.False(t, users[0].DistributionEnabled)
	assert.False(t, users[1].DistributionEnabled)

	require.NoError(t, DB.Model(&User{}).
		Where("id = ?", 9001).
		Updates(map[string]interface{}{"distribution_enabled": true}).Error)
	require.NoError(t, migrateDisableExistingUserDistribution())

	var user User
	require.NoError(t, DB.First(&user, 9001).Error)
	assert.True(t, user.DistributionEnabled)
}

func TestValidateDistributionOptionUpdate(t *testing.T) {
	oldDistribution := *operation_setting.GetDistributionSetting()
	oldPayment := *operation_setting.GetPaymentSetting()
	t.Cleanup(func() {
		*operation_setting.GetDistributionSetting() = oldDistribution
		*operation_setting.GetPaymentSetting() = oldPayment
	})

	distribution := operation_setting.GetDistributionSetting()
	distribution.Enabled = false
	distribution.Level1RateBps = 6000
	distribution.Level2RateBps = 4000
	distribution.Currency = "CNY"
	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	require.Error(t, operation_setting.ValidateDistributionOptionUpdate("distribution_setting.level2_rate_bps", "5000"))
	require.Error(t, operation_setting.ValidateDistributionOptionUpdate("distribution_setting.cdk_purchase_discount_bps", "10000"))

	payment.ComplianceConfirmed = false
	distribution.Level1RateBps = 0
	distribution.Level2RateBps = 0
	require.Error(t, operation_setting.ValidateDistributionOptionUpdate("distribution_setting.enabled", "true"))
	require.Error(t, operation_setting.ValidateDistributionOptionUpdate("distribution_setting.cdk_purchase_discount_bps", "9000"))
}

func setupAffiliateCdkPricingTest(t *testing.T, discountBps int) {
	t.Helper()
	oldDistribution := *operation_setting.GetDistributionSetting()
	oldPayment := *operation_setting.GetPaymentSetting()
	oldPrice := operation_setting.Price
	t.Cleanup(func() {
		*operation_setting.GetDistributionSetting() = oldDistribution
		*operation_setting.GetPaymentSetting() = oldPayment
		operation_setting.Price = oldPrice
	})

	distribution := operation_setting.GetDistributionSetting()
	distribution.CdkPurchaseDiscountBps = discountBps
	distribution.Currency = "CNY"
	distribution.PointsPerAmountUnit = operation_setting.DefaultDistributionPointsPerAmountUnit
	distribution.OfflineAmountPerPointMicros = operation_setting.DefaultDistributionOfflineAmountPerPointMicros

	payment := operation_setting.GetPaymentSetting()
	payment.AmountOptions = []int{50, 100, 200}
	payment.AmountDiscount = map[int]float64{100: 0.9}
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	operation_setting.Price = 1
}

func TestQuoteAffiliateCdkOrderRequiresConfiguredDiscount(t *testing.T) {
	truncateTables(t)
	setupAffiliateCdkPricingTest(t, 0)
	insertAffiliateTestUser(t, 9101, "cdk_agent", 0)

	_, err := QuoteAffiliateCdkOrder(9101, 100, 2)
	require.Error(t, err)
	require.Contains(t, err.Error(), "管理员未配置代理 CDK 采购折扣")
}

func TestQuoteAffiliateCdkOrderAppliesDiscountOnWalletPayAmount(t *testing.T) {
	truncateTables(t)
	setupAffiliateCdkPricingTest(t, 8000)
	insertAffiliateTestUser(t, 9101, "cdk_agent", 0)

	quote, err := QuoteAffiliateCdkOrder(9101, 100, 2)
	require.NoError(t, err)
	assert.EqualValues(t, 100, quote.Amount)
	assert.Equal(t, 2, quote.Quantity)
	assert.EqualValues(t, 200, quote.TotalAmount)
	assert.Equal(t, calculateQuotaFromAmount(100), quote.CodeQuota)
	assert.Equal(t, calculateQuotaFromAmount(100)*2, quote.TotalQuota)
	assert.Equal(t, 90.0, quote.UnitWalletPayAmount)
	assert.Equal(t, 72.0, quote.UnitPayAmount)
	assert.Equal(t, 180.0, quote.WalletPayAmount)
	assert.Equal(t, 144.0, quote.PayAmount)
	assert.True(t, quote.PayAmount < quote.WalletPayAmount)
	assert.Equal(t, 8000, quote.CdkPurchaseDiscountBps)
}

func TestQuoteAffiliateCdkOrderPricesEachCodeBeforeQuantity(t *testing.T) {
	truncateTables(t)
	setupAffiliateCdkPricingTest(t, 9000)
	payment := operation_setting.GetPaymentSetting()
	payment.AmountOptions = []int{50, 500}
	payment.AmountDiscount = map[int]float64{499: 0.95}
	operation_setting.Price = 0.2
	insertAffiliateTestUser(t, 9101, "cdk_agent", 0)

	quoteOne, err := QuoteAffiliateCdkOrder(9101, 50, 1)
	require.NoError(t, err)
	assert.Equal(t, 10.0, quoteOne.UnitWalletPayAmount)
	assert.Equal(t, 9.0, quoteOne.UnitPayAmount)
	assert.Equal(t, 10.0, quoteOne.WalletPayAmount)
	assert.Equal(t, 9.0, quoteOne.PayAmount)

	quoteBulk, err := QuoteAffiliateCdkOrder(9101, 50, 20)
	require.NoError(t, err)
	assert.EqualValues(t, 1000, quoteBulk.TotalAmount)
	assert.Equal(t, 10.0, quoteBulk.UnitWalletPayAmount)
	assert.Equal(t, 9.0, quoteBulk.UnitPayAmount)
	assert.Equal(t, 200.0, quoteBulk.WalletPayAmount)
	assert.Equal(t, 180.0, quoteBulk.PayAmount)
	assert.NotEqual(t, 171.0, quoteBulk.PayAmount)

	quoteLargeCode, err := QuoteAffiliateCdkOrder(9101, 500, 1)
	require.NoError(t, err)
	assert.Equal(t, 95.0, quoteLargeCode.UnitWalletPayAmount)
	assert.Equal(t, 85.5, quoteLargeCode.UnitPayAmount)
	assert.Equal(t, 95.0, quoteLargeCode.WalletPayAmount)
	assert.Equal(t, 85.5, quoteLargeCode.PayAmount)
}

func TestQuoteAffiliateCdkOrderRequiresWalletAmountOption(t *testing.T) {
	truncateTables(t)
	setupAffiliateCdkPricingTest(t, 8000)
	insertAffiliateTestUser(t, 9101, "cdk_agent", 0)

	_, err := QuoteAffiliateCdkOrder(9101, 150, 1)
	require.Error(t, err)
	require.Contains(t, err.Error(), "CDK 面额必须来自钱包金额选项")
}

func TestCompleteAffiliateCdkOrderCreatesCodesIdempotentlyAndRedeemable(t *testing.T) {
	truncateTables(t)
	setupAffiliateCdkPricingTest(t, 8000)
	insertAffiliateTestUser(t, 9101, "cdk_agent", 0)
	insertAffiliateTestUser(t, 9102, "cdk_buyer", 0)
	order, quote, err := BuildAffiliateCdkOrder(9101, 100, 2, "cdk-order-success", "alipay")
	require.NoError(t, err)
	require.NoError(t, order.Insert())
	require.Equal(t, 144.0, quote.PayAmount)

	require.NoError(t, CompleteAffiliateCdkOrder("cdk-order-success", `{"ok":true}`, PaymentProviderEpay, "wechat"))
	require.NoError(t, CompleteAffiliateCdkOrder("cdk-order-success", `{"ok":true}`, PaymentProviderEpay, "wechat"))

	var codes []Redemption
	require.NoError(t, DB.Where("source_type = ? AND source_order_id = ?", AffiliateCdkSourceType, order.Id).Order("id asc").Find(&codes).Error)
	require.Len(t, codes, 2)
	for _, code := range codes {
		assert.Equal(t, 9101, code.UserId)
		assert.Equal(t, common.RedemptionCodeStatusEnabled, code.Status)
		assert.Equal(t, calculateQuotaFromAmount(100), code.Quota)
		assert.Equal(t, AffiliateCdkSourceType, code.SourceType)
		assert.Equal(t, order.Id, code.SourceOrderId)
	}

	quota, err := Redeem(codes[0].Key, 9102)
	require.NoError(t, err)
	assert.Equal(t, calculateQuotaFromAmount(100), quota)
	var buyer User
	require.NoError(t, DB.First(&buyer, 9102).Error)
	assert.Equal(t, calculateQuotaFromAmount(100), buyer.Quota)
}

func TestListAffiliateCdkCodesShowsOnlyGeneratedOwnCodes(t *testing.T) {
	truncateTables(t)
	setupAffiliateCdkPricingTest(t, 8000)
	insertAffiliateTestUser(t, 9101, "cdk_agent", 0)
	insertAffiliateTestUser(t, 9102, "other_agent", 0)

	pendingOrder, _, err := BuildAffiliateCdkOrder(9101, 50, 1, "cdk-order-pending", "alipay")
	require.NoError(t, err)
	require.NoError(t, pendingOrder.Insert())

	successOrder, _, err := BuildAffiliateCdkOrder(9101, 100, 2, "cdk-order-codes", "alipay")
	require.NoError(t, err)
	require.NoError(t, successOrder.Insert())
	require.NoError(t, CompleteAffiliateCdkOrder("cdk-order-codes", `{"ok":true}`, PaymentProviderEpay, "wechat"))
	var generatedCodes []Redemption
	require.NoError(t, DB.Where("source_type = ? AND source_order_id = ?", AffiliateCdkSourceType, successOrder.Id).Order("id asc").Find(&generatedCodes).Error)
	require.Len(t, generatedCodes, 2)
	_, err = Redeem(generatedCodes[0].Key, 9102)
	require.NoError(t, err)

	otherOrder, _, err := BuildAffiliateCdkOrder(9102, 100, 1, "cdk-order-other", "alipay")
	require.NoError(t, err)
	require.NoError(t, otherOrder.Insert())
	require.NoError(t, CompleteAffiliateCdkOrder("cdk-order-other", `{"ok":true}`, PaymentProviderEpay, "alipay"))

	codes, total, err := ListAffiliateCdkCodes(AffiliateCdkCodeQuery{UserId: 9101}, &common.PageInfo{Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, codes, 2)
	for _, code := range codes {
		assert.Equal(t, 9101, code.UserId)
		assert.Equal(t, AffiliateCdkSourceType, code.SourceType)
		assert.Equal(t, successOrder.Id, code.SourceOrderId)
		assert.EqualValues(t, 100, code.CodeAmount)
		assert.Equal(t, 2, code.OrderQuantity)
		assert.Equal(t, 144.0, code.PayAmount)
		assert.Equal(t, 72.0, code.UnitPayAmount)
		assert.Equal(t, "wechat", code.PaymentMethod)
		assert.Greater(t, code.OrderCompleteTime, int64(0))
	}

	availableCodes, availableTotal, err := ListAffiliateCdkCodes(AffiliateCdkCodeQuery{UserId: 9101, Status: common.RedemptionCodeStatusEnabled}, &common.PageInfo{Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.EqualValues(t, 1, availableTotal)
	require.Len(t, availableCodes, 1)
	assert.Equal(t, common.RedemptionCodeStatusEnabled, availableCodes[0].Status)

	usedCodes, usedTotal, err := ListAffiliateCdkCodes(AffiliateCdkCodeQuery{UserId: 9101, Status: common.RedemptionCodeStatusUsed}, &common.PageInfo{Page: 1, PageSize: 10})
	require.NoError(t, err)
	require.EqualValues(t, 1, usedTotal)
	require.Len(t, usedCodes, 1)
	assert.Equal(t, common.RedemptionCodeStatusUsed, usedCodes[0].Status)
	assert.Equal(t, 9102, usedCodes[0].UsedUserId)
	assert.Equal(t, "other_agent", usedCodes[0].UsedUsername)
	assert.Greater(t, usedCodes[0].RedeemedTime, int64(0))

	firstPageCodes, firstPageTotal, err := ListAffiliateCdkCodes(AffiliateCdkCodeQuery{UserId: 9101}, &common.PageInfo{Page: 1, PageSize: 1})
	require.NoError(t, err)
	require.EqualValues(t, 2, firstPageTotal)
	require.Len(t, firstPageCodes, 1)
}

func TestCompleteAffiliateCdkOrderRejectsPaymentProviderMismatch(t *testing.T) {
	truncateTables(t)
	setupAffiliateCdkPricingTest(t, 8000)
	insertAffiliateTestUser(t, 9101, "cdk_agent", 0)
	order, _, err := BuildAffiliateCdkOrder(9101, 100, 1, "cdk-provider-mismatch", "alipay")
	require.NoError(t, err)
	require.NoError(t, order.Insert())

	require.ErrorIs(t, CompleteAffiliateCdkOrder("cdk-provider-mismatch", "", PaymentProviderStripe, ""), ErrPaymentMethodMismatch)
	var count int64
	require.NoError(t, DB.Model(&Redemption{}).Where("source_order_id = ?", order.Id).Count(&count).Error)
	assert.EqualValues(t, 0, count)
}
