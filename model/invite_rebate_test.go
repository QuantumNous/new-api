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
	oldAt := common.InviteTopupRebateEnabledAt
	common.InviteTopupRebateEnabled = true
	common.InviteTopupRebateRatioBp = 100
	// Feature "turned on" in the past so test top-ups (now) are eligible.
	common.InviteTopupRebateEnabledAt = common.GetTimestamp() - 3600
	t.Cleanup(func() {
		common.InviteTopupRebateEnabled = oldEnabled
		common.InviteTopupRebateRatioBp = oldRatio
		common.InviteTopupRebateEnabledAt = oldAt
	})
}

func stampTopUpNow(topUp *TopUp) *TopUp {
	now := common.GetTimestamp()
	if topUp.CreateTime <= 0 {
		topUp.CreateTime = now
	}
	if topUp.CompleteTime <= 0 {
		topUp.CompleteTime = now
	}
	return topUp
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
	var row InviteRebate
	require.NoError(t, DB.Where("topup_id = ?", topUp.Id).First(&row).Error)
	assert.Equal(t, InviteRebateStatusSkipped, row.Status)
	assert.Equal(t, 0, row.RebateQuota)
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
	var row InviteRebate
	require.NoError(t, DB.Where("topup_id = ?", topUp.Id).First(&row).Error)
	assert.Equal(t, InviteRebateStatusSkipped, row.Status)
}


func TestCalculateInviteTopupRebate_OverflowSafe(t *testing.T) {
	// Overflow guard: product exceeds int64 → 0
	assert.Equal(t, 0, CalculateInviteTopupRebate(math.MaxInt, 10000))
	// Cap path: large product at 100% is hard-capped to MaxQuota (int32)
	v := CalculateInviteTopupRebate(common.MaxQuota, 10000)
	assert.Equal(t, maxInviteTopupRebateQuota, v)
	assert.Equal(t, common.MaxQuota, maxInviteTopupRebateQuota)
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
	require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ?", topUp.Id).Count(&n).Error)
	assert.Equal(t, int64(0), n, "disabled inviter must not permanent-skip")
	var inv User
	require.NoError(t, DB.First(&inv, inviter.Id).Error)
	assert.Equal(t, 0, inv.AffQuota)

	// Re-enable inviter then grant should succeed
	require.NoError(t, DB.Model(inviter).Update("status", common.UserStatusEnabled).Error)
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
	require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ? AND status = ?", topUp.Id, InviteRebateStatusGranted).Count(&n).Error)
	assert.Equal(t, int64(1), n)
	require.NoError(t, DB.First(&inv, inviter.Id).Error)
	assert.Equal(t, 5000, inv.AffQuota)
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
	var row InviteRebate
	require.NoError(t, DB.Where("topup_id = ?", topUp.Id).First(&row).Error)
	assert.Equal(t, InviteRebateStatusSkipped, row.Status)
}


func TestBackfillMissingInviteTopupRebates(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_bf", 0, 0)
	invitee := createIRUser(t, "ir_invitee_bf", inviter.Id, 0)
	// success topup without rebate row (simulate epay grant miss)
	topUp := stampTopUpNow(&TopUp{
		UserId:          invitee.Id,
		Amount:          10,
		Money:           10,
		TradeNo:         "IR-BF-1",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
	})
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


func TestBackfillMissingInviteTopupRebates_ProgressPastNonGrantable(t *testing.T) {
	setupInviteRebateTest(t)
	// Non-grantable (no inviter) permanent-skipped via direct grant should not block later grantable.
	noAff := createIRUser(t, "ir_invitee_stuck", 0, 0)
	for i := 0; i < 3; i++ {
		topUp := &TopUp{
			UserId:          noAff.Id,
			Amount:          10,
			Money:           10,
			TradeNo:         fmt.Sprintf("IR-STUCK-%d", i),
			PaymentProvider: PaymentProviderEpay,
			Status:          common.TopUpStatusSuccess,
		}
		require.NoError(t, DB.Create(topUp).Error)
		// Live grant path permanent-skips no-inviter so ledger exists.
		require.NoError(t, GrantInviteTopupRebate(nil, topUp.UserId, int(float64(10)*common.QuotaPerUnit), topUp))
	}
	// Disabled inviter topup: no ledger (temporary); backfill must not select it (join filter).
	disInv := createIRUser(t, "ir_inviter_dis2", 0, 0)
	require.NoError(t, DB.Model(disInv).Update("status", common.UserStatusDisabled).Error)
	disInvitee := createIRUser(t, "ir_invitee_dis2", disInv.Id, 0)
	disTop := stampTopUpNow(&TopUp{
		UserId:          disInvitee.Id,
		Amount:          10,
		Money:           10,
		TradeNo:         "IR-DIS-BF",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
	})
	require.NoError(t, DB.Create(disTop).Error)

	inviter := createIRUser(t, "ir_inviter_prog", 0, 0)
	invitee := createIRUser(t, "ir_invitee_prog", inviter.Id, 0)
	good := stampTopUpNow(&TopUp{
		UserId:          invitee.Id,
		Amount:          10,
		Money:           10,
		TradeNo:         "IR-PROG-GOOD",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
	})
	require.NoError(t, DB.Create(good).Error)

	scanned, granted, err := BackfillMissingInviteTopupRebates(50)
	require.NoError(t, err)
	assert.Equal(t, 1, scanned)
	assert.Equal(t, 1, granted)

	var grantN int64
	require.NoError(t, DB.Model(&InviteRebate{}).Where("status = ? AND topup_id = ?", InviteRebateStatusGranted, good.Id).Count(&grantN).Error)
	assert.Equal(t, int64(1), grantN)

	// Disabled-inviter topup still has no ledger
	var disN int64
	require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ?", disTop.Id).Count(&disN).Error)
	assert.Equal(t, int64(0), disN)

	// Re-enable inviter → backfill grants deferred topup
	require.NoError(t, DB.Model(disInv).Update("status", common.UserStatusEnabled).Error)
	_, granted2, err := BackfillMissingInviteTopupRebates(50)
	require.NoError(t, err)
	assert.Equal(t, 1, granted2)
}

func TestCalculateInviteTopupRebate_CapsAtMaxQuota(t *testing.T) {
	assert.Equal(t, common.MaxQuota, CalculateInviteTopupRebate(common.MaxQuota, 10000))
	assert.LessOrEqual(t, maxInviteTopupRebateQuota, common.MaxQuota)
}


func TestGrantInviteTopupRebate_BeforeEnabledCutoff(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_cut", 0, 0)
	invitee := createIRUser(t, "ir_invitee_cut", inviter.Id, 0)
	// Top-up completed before feature enable stamp
	topUp := &TopUp{
		UserId:          invitee.Id,
		Amount:          10,
		TradeNo:         "IR-CUT-OLD",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      common.InviteTopupRebateEnabledAt - 100,
		CompleteTime:    common.InviteTopupRebateEnabledAt - 50,
	}
	require.NoError(t, DB.Create(topUp).Error)
	require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))

	var row InviteRebate
	require.NoError(t, DB.Where("topup_id = ?", topUp.Id).First(&row).Error)
	assert.Equal(t, InviteRebateStatusSkipped, row.Status)
	var inv User
	require.NoError(t, DB.First(&inv, inviter.Id).Error)
	assert.Equal(t, 0, inv.AffQuota)
}

func TestBackfillMissingInviteTopupRebates_IgnoresHistorical(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_hist", 0, 0)
	invitee := createIRUser(t, "ir_invitee_hist", inviter.Id, 0)

	oldTop := &TopUp{
		UserId:          invitee.Id,
		Amount:          10,
		Money:           10,
		TradeNo:         "IR-HIST-OLD",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      common.InviteTopupRebateEnabledAt - 200,
		CompleteTime:    common.InviteTopupRebateEnabledAt - 100,
	}
	require.NoError(t, DB.Create(oldTop).Error)

	newTop := &TopUp{
		UserId:          invitee.Id,
		Amount:          10,
		Money:           10,
		TradeNo:         "IR-HIST-NEW",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      common.InviteTopupRebateEnabledAt + 10,
		CompleteTime:    common.InviteTopupRebateEnabledAt + 20,
	}
	require.NoError(t, DB.Create(newTop).Error)

	scanned, granted, err := BackfillMissingInviteTopupRebates(50)
	require.NoError(t, err)
	assert.Equal(t, 1, scanned)
	assert.Equal(t, 1, granted)

	var oldN int64
	require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ?", oldTop.Id).Count(&oldN).Error)
	assert.Equal(t, int64(0), oldN, "historical top-up must not get ledger from backfill")

	var grantN int64
	require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ? AND status = ?", newTop.Id, InviteRebateStatusGranted).Count(&grantN).Error)
	assert.Equal(t, int64(1), grantN)
}


func TestGrantInviteTopupRebate_RejectsNonSuccessStatus(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_pend", 0, 0)
	invitee := createIRUser(t, "ir_invitee_pend", inviter.Id, 0)

	for i, st := range []string{common.TopUpStatusPending, common.TopUpStatusFailed, common.TopUpStatusExpired} {
		topUp := stampTopUpNow(&TopUp{
			UserId:          invitee.Id,
			Amount:          10,
			TradeNo:         fmt.Sprintf("IR-BADST-%d", i),
			PaymentProvider: PaymentProviderEpay,
			Status:          st,
		})
		require.NoError(t, DB.Create(topUp).Error)
		require.NoError(t, GrantInviteTopupRebate(nil, invitee.Id, 500000, topUp))
		var n int64
		require.NoError(t, DB.Model(&InviteRebate{}).Where("topup_id = ?", topUp.Id).Count(&n).Error)
		assert.Equal(t, int64(0), n, "status=%s must not rebate", st)
	}
	var inv User
	require.NoError(t, DB.First(&inv, inviter.Id).Error)
	assert.Equal(t, 0, inv.AffQuota)
}

func TestBackfillMissingInviteTopupRebates_IgnoresPending(t *testing.T) {
	setupInviteRebateTest(t)
	inviter := createIRUser(t, "ir_inviter_pendbf", 0, 0)
	invitee := createIRUser(t, "ir_invitee_pendbf", inviter.Id, 0)
	pending := stampTopUpNow(&TopUp{
		UserId:          invitee.Id,
		Amount:          10,
		Money:           10,
		TradeNo:         "IR-PEND-BF",
		PaymentProvider: PaymentProviderEpay,
		Status:          common.TopUpStatusPending,
	})
	require.NoError(t, DB.Create(pending).Error)

	scanned, granted, err := BackfillMissingInviteTopupRebates(50)
	require.NoError(t, err)
	assert.Equal(t, 0, scanned)
	assert.Equal(t, 0, granted)
	var n int64
	require.NoError(t, DB.Model(&InviteRebate{}).Count(&n).Error)
	assert.Equal(t, int64(0), n)
}

