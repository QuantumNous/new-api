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
	t.Cleanup(func() {
		*operation_setting.GetDistributionSetting() = oldDistribution
		*operation_setting.GetPaymentSetting() = oldPayment
	})

	distribution := operation_setting.GetDistributionSetting()
	distribution.Enabled = enabled
	distribution.Level1RateBps = level1RateBps
	distribution.Level2RateBps = level2RateBps
	distribution.Currency = "CNY"

	payment := operation_setting.GetPaymentSetting()
	payment.ComplianceConfirmed = true
	payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
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
	require.NoError(t, DB.Model(&User{}).Where("id = ?", userId).Update("distribution_enabled", enabled).Error)
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
		Amount:          10,
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
	assert.EqualValues(t, 123450000, commissions[0].BaseAmountMicros)
	assert.EqualValues(t, 12345000, commissions[0].CommissionAmountMicros)
	assert.Equal(t, "wechat", commissions[0].PaymentMethod)
	assert.Equal(t, AffiliateCommissionLevel2, commissions[1].Level)
	assert.Equal(t, 1001, commissions[1].PromoterId)
	assert.EqualValues(t, 3703500, commissions[1].CommissionAmountMicros)
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
	assert.Equal(t, calculateQuotaFromAmount(10), getUserQuotaForPaymentGuardTest(t, 1003))
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

func TestSettleAffiliateCommissionsRequiresPayPalPayoutProfile(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	insertAffiliateTestTopUp(t, "aff-settle-no-paypal", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-settle-no-paypal", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	err = SettleAffiliateCommissions([]int{commissions[0].Id, commissions[1].Id}, 1001, "offline paid")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "未填写 PayPal 收款账号")

	var pendingCount int64
	require.NoError(t, DB.Model(&AffiliateCommission{}).Where("status = ?", AffiliateCommissionStatusPending).Count(&pendingCount).Error)
	assert.EqualValues(t, 2, pendingCount)
}

func TestSettleAffiliateCommissionsRequiresAllPending(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	saveAffiliateTestPayoutProfile(t, 1001, "agent-a@example.com", "Agent A")
	saveAffiliateTestPayoutProfile(t, 1002, "agent-b@example.com", "Agent B")
	insertAffiliateTestTopUp(t, "aff-settle", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-settle", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	require.NoError(t, SettleAffiliateCommissions([]int{commissions[0].Id}, 1001, "offline paid"))
	require.Error(t, SettleAffiliateCommissions([]int{commissions[0].Id, commissions[1].Id}, 1001, "duplicate"))

	var pendingCount int64
	require.NoError(t, DB.Model(&AffiliateCommission{}).Where("status = ?", AffiliateCommissionStatusPending).Count(&pendingCount).Error)
	assert.EqualValues(t, 1, pendingCount)
}

func TestSettleAffiliateCommissionsSnapshotsPayPalPayoutProfile(t *testing.T) {
	truncateTables(t)
	setDistributionTestConfig(t, true, 1000, 300)
	prepareTwoLevelAffiliateChain(t)
	saveAffiliateTestPayoutProfile(t, 1001, "agent-a@example.com", "Agent A")
	saveAffiliateTestPayoutProfile(t, 1002, "agent-b@example.com", "Agent B")
	insertAffiliateTestTopUp(t, "aff-settle-snapshot", 1003, 50)
	completed, err := CompleteEpayTopUp("aff-settle-snapshot", "alipay", "127.0.0.1")
	require.NoError(t, err)
	require.True(t, completed)

	commissions := getAffiliateTestCommissions(t)
	require.Len(t, commissions, 2)
	require.NoError(t, SettleAffiliateCommissions([]int{commissions[0].Id, commissions[1].Id}, 1001, "offline paid"))

	saveAffiliateTestPayoutProfile(t, 1002, "agent-b-new@example.com", "Agent B New")

	var settled []AffiliateCommission
	require.NoError(t, DB.Order("level asc").Find(&settled).Error)
	require.Len(t, settled, 2)
	assert.Equal(t, AffiliateCommissionStatusSettled, settled[0].Status)
	assert.Equal(t, AffiliatePayoutMethodPayPal, settled[0].SettledPayoutMethod)
	assert.Equal(t, "agent-b@example.com", settled[0].SettledPayoutAccount)
	assert.Equal(t, "Agent B", settled[0].SettledPayoutAccountName)
	assert.Equal(t, "agent-a@example.com", settled[1].SettledPayoutAccount)

	records, total, err := ListAffiliateCommissions(AffiliateCommissionQuery{TradeNo: "aff-settle-snapshot"}, &common.PageInfo{Page: 1, PageSize: 20})
	require.NoError(t, err)
	require.EqualValues(t, 2, total)
	require.Len(t, records, 2)
	for _, record := range records {
		if record.PromoterId == 1002 {
			assert.Equal(t, "agent-b-new@example.com", record.PromoterPayoutAccount)
			assert.Equal(t, "agent-b@example.com", record.SettledPayoutAccount)
		}
	}
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

	payment.ComplianceConfirmed = false
	distribution.Level1RateBps = 0
	distribution.Level2RateBps = 0
	require.Error(t, operation_setting.ValidateDistributionOptionUpdate("distribution_setting.enabled", "true"))
}
