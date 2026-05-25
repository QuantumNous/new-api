package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withInviteTopupRebateTestSettings(t *testing.T, ratio float64, validDays int) {
	t.Helper()

	oldEnabled := common.InviteTopupRebateEnabled
	oldRatio := common.InviteTopupRebateRatio
	oldValidDays := common.InviteTopupRebateValidDays
	paymentSetting := operation_setting.GetPaymentSetting()
	oldPaymentSetting := *paymentSetting

	common.InviteTopupRebateEnabled = true
	common.InviteTopupRebateRatio = ratio
	common.InviteTopupRebateValidDays = validDays
	paymentSetting.ComplianceConfirmed = true
	paymentSetting.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	t.Cleanup(func() {
		common.InviteTopupRebateEnabled = oldEnabled
		common.InviteTopupRebateRatio = oldRatio
		common.InviteTopupRebateValidDays = oldValidDays
		*paymentSetting = oldPaymentSetting
	})
}

func withQuotaPerUnitForInviteRebateTest(t *testing.T, quotaPerUnit float64) {
	t.Helper()

	oldQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = quotaPerUnit
	t.Cleanup(func() {
		common.QuotaPerUnit = oldQuotaPerUnit
	})
}

func getUserAffQuotaForInviteRebateTest(t *testing.T, userId int) (int, int) {
	t.Helper()

	var user User
	require.NoError(t, DB.Select("aff_quota", "aff_history").Where("id = ?", userId).First(&user).Error)
	return user.AffQuota, user.AffHistoryQuota
}

func TestRechargeWaffo_AppliesInviteTopupRebateOnce(t *testing.T) {
	truncateTables(t)
	withInviteTopupRebateTestSettings(t, 15, 30)
	withQuotaPerUnitForInviteRebateTest(t, 500)

	now := common.GetTimestamp()
	require.NoError(t, DB.Create(&User{
		Id:        501,
		Username:  "rebate_inviter",
		AffCode:   "rebate_inviter_code",
		Status:    common.UserStatusEnabled,
		CreatedAt: now - 24*60*60,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id:        502,
		Username:  "rebate_invited",
		AffCode:   "rebate_invited_code",
		Status:    common.UserStatusEnabled,
		InviterId: 501,
		CreatedAt: now - 24*60*60,
	}).Error)
	require.NoError(t, (&TopUp{
		UserId:          502,
		Amount:          2,
		Money:           2,
		TradeNo:         "waffo-invite-rebate",
		PaymentMethod:   PaymentMethodWaffo,
		PaymentProvider: PaymentProviderWaffo,
		Status:          common.TopUpStatusPending,
		CreateTime:      now,
	}).Insert())

	require.NoError(t, RechargeWaffo("waffo-invite-rebate", "127.0.0.1"))
	assert.Equal(t, 1000, getUserQuotaForPaymentGuardTest(t, 502))
	affQuota, affHistory := getUserAffQuotaForInviteRebateTest(t, 501)
	assert.Equal(t, 150, affQuota)
	assert.Equal(t, 150, affHistory)

	require.NoError(t, RechargeWaffo("waffo-invite-rebate", "127.0.0.1"))
	assert.Equal(t, 1000, getUserQuotaForPaymentGuardTest(t, 502))
	affQuota, affHistory = getUserAffQuotaForInviteRebateTest(t, 501)
	assert.Equal(t, 150, affQuota)
	assert.Equal(t, 150, affHistory)
}

func TestApplyInviteTopupRebate_SkipsAfterValidDays(t *testing.T) {
	truncateTables(t)
	withInviteTopupRebateTestSettings(t, 15, 30)

	now := common.GetTimestamp()
	require.NoError(t, DB.Create(&User{
		Id:        601,
		Username:  "expired_rebate_inviter",
		AffCode:   "expired_rebate_inviter_code",
		Status:    common.UserStatusEnabled,
		CreatedAt: now - 40*24*60*60,
	}).Error)
	require.NoError(t, DB.Create(&User{
		Id:        602,
		Username:  "expired_rebate_invited",
		AffCode:   "expired_rebate_invited_code",
		Status:    common.UserStatusEnabled,
		InviterId: 601,
		CreatedAt: now - 40*24*60*60,
	}).Error)

	result, err := ApplyInviteTopupRebate(602, 1000, now)
	require.NoError(t, err)
	assert.Nil(t, result)
	affQuota, affHistory := getUserAffQuotaForInviteRebateTest(t, 601)
	assert.Zero(t, affQuota)
	assert.Zero(t, affHistory)
}
