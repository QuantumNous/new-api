package model

import (
	"fmt"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func withInviteRebateSetting(t *testing.T, times int, percent float64) {
	t.Helper()
	current := operation_setting.GetInviteRebateSetting()
	previous := *current
	current.Times = times
	current.Percent = percent
	t.Cleanup(func() {
		*current = previous
	})
}

func withInviteRebatePaymentEnv(t *testing.T, confirmed bool, price float64) {
	t.Helper()
	payment := operation_setting.GetPaymentSetting()
	prevConfirmed := payment.ComplianceConfirmed
	prevVersion := payment.ComplianceTermsVersion
	prevPrice := operation_setting.Price
	prevStripe := setting.StripeUnitPrice
	prevWaffo := setting.WaffoUnitPrice
	prevPancake := setting.WaffoPancakeUnitPrice
	prevQuotaPerUnit := common.QuotaPerUnit

	payment.ComplianceConfirmed = confirmed
	if confirmed {
		payment.ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	} else {
		payment.ComplianceTermsVersion = ""
	}
	operation_setting.Price = price
	setting.StripeUnitPrice = price
	setting.WaffoUnitPrice = price
	setting.WaffoPancakeUnitPrice = price
	common.QuotaPerUnit = 500000

	t.Cleanup(func() {
		payment.ComplianceConfirmed = prevConfirmed
		payment.ComplianceTermsVersion = prevVersion
		operation_setting.Price = prevPrice
		setting.StripeUnitPrice = prevStripe
		setting.WaffoUnitPrice = prevWaffo
		setting.WaffoPancakeUnitPrice = prevPancake
		common.QuotaPerUnit = prevQuotaPerUnit
	})
}

func createInviteRebateUser(t *testing.T, username string, inviterId int, eligible bool, quota int) *User {
	t.Helper()
	user := &User{
		Username:             username,
		Password:             "unused-password-hash",
		Role:                 common.RoleCommonUser,
		Status:               common.UserStatusEnabled,
		Group:                "default",
		Quota:                quota,
		AffCode:              "aff-" + username,
		InviterId:            inviterId,
		InviteRebateEligible: eligible,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func insertInviteRebateTopUp(t *testing.T, userId int, tradeNo string, provider string, amount int64, money float64, status string) *TopUp {
	t.Helper()
	topUp := &TopUp{
		UserId:          userId,
		Amount:          amount,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   provider,
		PaymentProvider: provider,
		CreateTime:      time.Now().Unix(),
		Status:          status,
	}
	require.NoError(t, topUp.Insert())
	return topUp
}

func userQuota(t *testing.T, userId int) int {
	t.Helper()
	var user User
	require.NoError(t, DB.Select("quota").Where("id = ?", userId).First(&user).Error)
	return user.Quota
}

func inviteRebateCount(t *testing.T, topUpId int) int64 {
	t.Helper()
	var count int64
	require.NoError(t, DB.Model(&InviteRebate{}).Where("top_up_id = ?", topUpId).Count(&count).Error)
	return count
}

func TestCalcInviteRebateQuotaMatchesDiscountedPayment(t *testing.T) {
	withInviteRebatePaymentEnv(t, true, 1)

	// 100 face value, 9-fold discount, 15% rebate → 13.5 site units.
	topUp := &TopUp{
		PaymentProvider: PaymentProviderEpay,
		Amount:          100,
		Money:           90,
	}
	got := calcInviteRebateQuota(topUp, 15)
	want := int(13.5 * common.QuotaPerUnit)
	assert.Equal(t, want, got)
}

func TestCalcInviteRebateQuotaUsesCreemCreditedQuota(t *testing.T) {
	topUp := &TopUp{
		PaymentProvider: PaymentProviderCreem,
		Amount:          200000,
		Money:           9.99,
	}
	assert.Equal(t, 30000, calcInviteRebateQuota(topUp, 15))
}

func TestCalcInviteRebateQuotaRejectsInvalidInputs(t *testing.T) {
	withInviteRebatePaymentEnv(t, true, 1)
	assert.Equal(t, 0, calcInviteRebateQuota(nil, 15))
	assert.Equal(t, 0, calcInviteRebateQuota(&TopUp{PaymentProvider: PaymentProviderEpay, Money: 90}, 0))
	assert.Equal(t, 0, calcInviteRebateQuota(&TopUp{PaymentProvider: PaymentProviderEpay, Money: 0}, 15))
	assert.Equal(t, 0, calcInviteRebateQuota(&TopUp{PaymentProvider: PaymentProviderCreem, Amount: 0}, 15))
}

func TestBindInviterMarksNewInvitesEligible(t *testing.T) {
	user := &User{}
	user.bindInviter(42)
	assert.Equal(t, 42, user.InviterId)
	assert.True(t, user.InviteRebateEligible)

	existing := &User{InviterId: 7}
	existing.bindInviter(0)
	assert.Equal(t, 7, existing.InviterId)
	assert.True(t, existing.InviteRebateEligible)

	plain := &User{}
	plain.bindInviter(0)
	assert.Equal(t, 0, plain.InviterId)
	assert.False(t, plain.InviteRebateEligible)
}

func TestInsertPersistsInviteRebateEligibility(t *testing.T) {
	truncateTables(t)

	inviter := createInviteRebateUser(t, fmt.Sprintf("inviter-%d", time.Now().UnixNano()), 0, false, 0)
	invitee := &User{
		Username: fmt.Sprintf("invitee-%d", time.Now().UnixNano()),
		Password: "password1",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}
	require.NoError(t, invitee.Insert(inviter.Id))

	var stored User
	require.NoError(t, DB.Select("id", "inviter_id", "invite_rebate_eligible").Where("id = ?", invitee.Id).First(&stored).Error)
	assert.Equal(t, inviter.Id, stored.InviterId)
	assert.True(t, stored.InviteRebateEligible)
}

func TestInviteRebatePaysInviterFromActualPayment(t *testing.T) {
	truncateTables(t)
	withInviteRebateSetting(t, 3, 15)
	withInviteRebatePaymentEnv(t, true, 1)

	inviter := createInviteRebateUser(t, "rebate-inviter", 0, false, 0)
	invitee := createInviteRebateUser(t, "rebate-invitee", inviter.Id, true, 0)
	topUp := insertInviteRebateTopUp(t, invitee.Id, "rebate-epay-1", PaymentProviderEpay, 100, 90, common.TopUpStatusPending)

	alreadyDone, err := RechargeEpay(topUp.TradeNo, "", "")
	require.NoError(t, err)
	assert.False(t, alreadyDone)

	wantInvitee := int(100 * common.QuotaPerUnit)
	wantInviter := int(13.5 * common.QuotaPerUnit)
	assert.Equal(t, wantInvitee, userQuota(t, invitee.Id))
	assert.Equal(t, wantInviter, userQuota(t, inviter.Id))
	assert.Equal(t, int64(1), inviteRebateCount(t, topUp.Id))
}

func TestInviteRebateSkipsLegacyInvitees(t *testing.T) {
	truncateTables(t)
	withInviteRebateSetting(t, 3, 15)
	withInviteRebatePaymentEnv(t, true, 1)

	inviter := createInviteRebateUser(t, "legacy-inviter", 0, false, 0)
	invitee := createInviteRebateUser(t, "legacy-invitee", inviter.Id, false, 0)
	topUp := insertInviteRebateTopUp(t, invitee.Id, "legacy-epay-1", PaymentProviderEpay, 100, 90, common.TopUpStatusPending)

	_, err := RechargeEpay(topUp.TradeNo, "", "")
	require.NoError(t, err)

	assert.Equal(t, int(100*common.QuotaPerUnit), userQuota(t, invitee.Id))
	assert.Equal(t, 0, userQuota(t, inviter.Id))
	assert.Equal(t, int64(0), inviteRebateCount(t, topUp.Id))
}

func TestInviteRebateHonorsFirstNTopUps(t *testing.T) {
	truncateTables(t)
	withInviteRebateSetting(t, 1, 15)
	withInviteRebatePaymentEnv(t, true, 1)

	inviter := createInviteRebateUser(t, "cap-inviter", 0, false, 0)
	invitee := createInviteRebateUser(t, "cap-invitee", inviter.Id, true, 0)
	first := insertInviteRebateTopUp(t, invitee.Id, "cap-epay-1", PaymentProviderEpay, 100, 90, common.TopUpStatusPending)
	second := insertInviteRebateTopUp(t, invitee.Id, "cap-epay-2", PaymentProviderEpay, 100, 90, common.TopUpStatusPending)

	_, err := RechargeEpay(first.TradeNo, "", "")
	require.NoError(t, err)
	_, err = RechargeEpay(second.TradeNo, "", "")
	require.NoError(t, err)

	assert.Equal(t, int(13.5*common.QuotaPerUnit), userQuota(t, inviter.Id))
	assert.Equal(t, int64(1), inviteRebateCount(t, first.Id))
	assert.Equal(t, int64(0), inviteRebateCount(t, second.Id))
}

func TestInviteRebateIsIdempotentOnRetry(t *testing.T) {
	truncateTables(t)
	withInviteRebateSetting(t, 3, 15)
	withInviteRebatePaymentEnv(t, true, 1)

	inviter := createInviteRebateUser(t, "idem-inviter", 0, false, 0)
	invitee := createInviteRebateUser(t, "idem-invitee", inviter.Id, true, 0)
	topUp := insertInviteRebateTopUp(t, invitee.Id, "idem-epay-1", PaymentProviderEpay, 100, 90, common.TopUpStatusPending)

	_, err := RechargeEpay(topUp.TradeNo, "", "")
	require.NoError(t, err)
	alreadyDone, err := RechargeEpay(topUp.TradeNo, "", "")
	require.NoError(t, err)
	assert.True(t, alreadyDone)

	assert.Equal(t, int(13.5*common.QuotaPerUnit), userQuota(t, inviter.Id))
	assert.Equal(t, int64(1), inviteRebateCount(t, topUp.Id))
}

func TestInviteRebateRequiresComplianceAndSetting(t *testing.T) {
	truncateTables(t)
	withInviteRebateSetting(t, 3, 15)
	withInviteRebatePaymentEnv(t, false, 1)

	inviter := createInviteRebateUser(t, "comp-inviter", 0, false, 0)
	invitee := createInviteRebateUser(t, "comp-invitee", inviter.Id, true, 0)
	topUp := insertInviteRebateTopUp(t, invitee.Id, "comp-epay-1", PaymentProviderEpay, 100, 90, common.TopUpStatusPending)

	_, err := RechargeEpay(topUp.TradeNo, "", "")
	require.NoError(t, err)
	assert.Equal(t, 0, userQuota(t, inviter.Id))

	withInviteRebatePaymentEnv(t, true, 1)
	withInviteRebateSetting(t, 0, 15)
	applyInviteRebate(GetTopUpByTradeNo(topUp.TradeNo))
	assert.Equal(t, 0, userQuota(t, inviter.Id))
}

func TestInviteRebateIgnoresNonWalletProviders(t *testing.T) {
	truncateTables(t)
	withInviteRebateSetting(t, 3, 15)
	withInviteRebatePaymentEnv(t, true, 1)

	inviter := createInviteRebateUser(t, "sub-inviter", 0, false, 0)
	invitee := createInviteRebateUser(t, "sub-invitee", inviter.Id, true, 0)
	topUp := insertInviteRebateTopUp(t, invitee.Id, "sub-balance-1", PaymentProviderBalance, 0, 90, common.TopUpStatusSuccess)

	applyInviteRebate(topUp)
	assert.Equal(t, 0, userQuota(t, inviter.Id))
	assert.Equal(t, int64(0), inviteRebateCount(t, topUp.Id))
}
