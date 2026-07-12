package model

import (
	"fmt"
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupInviteRebateTest(t *testing.T) {
	t.Helper()
	require.NotNil(t, DB, "package TestMain must initialize DB")
	require.NoError(t, DB.AutoMigrate(&User{}, &TopUp{}, &InviteRebate{}))
	require.NoError(t, DB.Where("1 = 1").Delete(&InviteRebate{}).Error)
	require.NoError(t, DB.Where("username LIKE ?", "ir_%").Delete(&User{}).Error)
	require.NoError(t, DB.Where("trade_no LIKE ?", "IR-%").Delete(&TopUp{}).Error)

	oldEnabled := common.InviteTopupRebateEnabled
	oldRatio := common.InviteTopupRebateRatioBp
	common.InviteTopupRebateEnabled = true
	common.InviteTopupRebateRatioBp = 100
	t.Cleanup(func() {
		common.InviteTopupRebateEnabled = oldEnabled
		common.InviteTopupRebateRatioBp = oldRatio
	})
}

func createIRUser(t *testing.T, username string, inviterId int, affQuota int) *User {
	t.Helper()
	// aff_code is unique; empty string collides across users in SQLite
	sum := 0
	for _, c := range username {
		sum = sum*31 + int(c)
	}
	u := &User{
		Username:        username,
		Status:          common.UserStatusEnabled,
		InviterId:       inviterId,
		AffQuota:        affQuota,
		AffHistoryQuota: affQuota,
		AffCode:         fmt.Sprintf("x%07d", sum&0x7ffffff),
	}
	require.NoError(t, DB.Create(u).Error)
	return u
}

func TestCalculateInviteTopupRebate(t *testing.T) {
	assert.Equal(t, 0, CalculateInviteTopupRebate(0, 100))
	assert.Equal(t, 0, CalculateInviteTopupRebate(50, 100)) // 50*100/10000 = 0
	assert.Equal(t, 5, CalculateInviteTopupRebate(500, 100))
	// 500000 * 100 / 10000 = 5000 (1%)
	assert.Equal(t, 5000, CalculateInviteTopupRebate(500000, 100))
	assert.Equal(t, 0, CalculateInviteTopupRebate(500000, 0))
	assert.Equal(t, 0, CalculateInviteTopupRebate(-1, 100))
}

func TestGrantInviteTopupRebate_DisabledNoOp(t *testing.T) {
	setupInviteRebateTest(t)
	common.InviteTopupRebateEnabled = false

	inviter := createIRUser(t, "ir_inviter_off", 0, 0)
	invitee := createIRUser(t, "ir_invitee_off", inviter.Id, 0)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, Money: 10, TradeNo: "IR-OFF-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)

	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}

func TestGrantInviteTopupRebate_NoInviter(t *testing.T) {
	setupInviteRebateTest(t)
	invitee := createIRUser(t, "ir_invitee_none", 0, 0)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, TradeNo: "IR-NONE-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}

func TestGrantInviteTopupRebate_SuccessAndIdempotent(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_ok", 0, 0)
	invitee := createIRUser(t, "ir_invitee_ok", inviter.Id, 0)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, TradeNo: "IR-OK-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)

	// 500000 * 1% = 5000
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp)) // retry

	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ?", topUp.Id).Count(&n).Error)
	assert.Equal(t, int64(1), n)

	var got User
	require.NoError(t, DB.First(&got, inviter.Id).Error)
	assert.Equal(t, 5000, got.AffQuota)
	assert.Equal(t, 5000, got.AffHistoryQuota)
}


func TestGrantInviteTopupRebate_MissingInviter(t *testing.T) {
	setupInviteRebateTest(t)
	// invitee points at non-existent inviter
	invitee := createIRUser(t, "ir_invitee_ghost", 999999, 0)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, TradeNo: "IR-GHOST-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}


func TestCalculateInviteTopupRebate_OverflowSafe(t *testing.T) {
	// Overflow guard: product exceeds int64 → 0
	assert.Equal(t, 0, CalculateInviteTopupRebate(math.MaxInt, 10000))
	// Cap path: large but non-overflowing topup at 100% is hard-capped
	v := CalculateInviteTopupRebate(maxInviteTopupRebateQuota*2, 10000)
	assert.Equal(t, maxInviteTopupRebateQuota, v)
	// Normal path still works
	assert.Equal(t, 5000, CalculateInviteTopupRebate(500000, 100))
}

func TestGrantInviteTopupRebate_DisabledInviter(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_dis", 0, 0)
	require.NoError(t, DB.Model(inviter).Update("status", common.UserStatusDisabled).Error)
	invitee := createIRUser(t, "ir_invitee_dis", inviter.Id, 0)
	topUp := &TopUp{UserId: invitee.Id, Amount: 10, TradeNo: "IR-DIS-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}

func TestGrantInviteTopupRebate_UserIdMismatch(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_mm", 0, 0)
	invitee := createIRUser(t, "ir_invitee_mm", inviter.Id, 0)
	other := createIRUser(t, "ir_other_mm", 0, 0)
	topUp := &TopUp{UserId: other.Id, Amount: 10, TradeNo: "IR-MM-1", Status: common.TopUpStatusSuccess}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}


func TestBackfillMissingInviteTopupRebates(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_bf", 0, 0)
	invitee := createIRUser(t, "ir_invitee_bf", inviter.Id, 0)
	// success topup without rebate row (simulate epay grant miss)
	topUp := &TopUp{
		UserId:          invitee.Id,
		Amount:          10,
		Money:           10,
		TradeNo:         "IR-BF-1",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, DB.Create(topUp).Error)

	scanned, granted, err := BackfillMissingInviteTopupRebates(50)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, scanned, 1)
	assert.Equal(t, 1, granted)

	// second run idempotent
	_, granted2, err := BackfillMissingInviteTopupRebates(50)
	require.NoError(t, err)
	assert.Equal(t, 0, granted2)

	var inv User
	require.NoError(t, DB.First(&inv, inviter.Id).Error)
	// Amount 10 * QuotaPerUnit * 1% 
	expect := CalculateInviteTopupRebate(int(float64(10)*common.QuotaPerUnit), 100)
	assert.Equal(t, expect, inv.AffQuota)
}

func TestTransferAffQuota_DisabledUser(t *testing.T) {
	setupInviteRebateTest(t)
	u := createIRUser(t, "ir_transfer_dis", 0, 0)
	require.NoError(t, DB.Model(u).Updates(map[string]interface{}{
		"status":    common.UserStatusDisabled,
		"aff_quota": int(common.QuotaPerUnit) * 2,
	}).Error)
	require.NoError(t, DB.First(u, u.Id).Error)
	err := u.TransferAffQuotaToQuota(int(common.QuotaPerUnit))
	require.Error(t, err)
}
