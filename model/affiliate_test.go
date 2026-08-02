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

func configureAffiliateTest(t *testing.T, mutate func(*operation_setting.AffiliateSetting)) int64 {
	t.Helper()
	affiliateSetting := operation_setting.GetAffiliateSetting()
	originalAffiliate := *affiliateSetting
	originalExchangeRate := operation_setting.USDExchangeRate
	t.Cleanup(func() {
		*affiliateSetting = originalAffiliate
		operation_setting.USDExchangeRate = originalExchangeRate
	})
	operation_setting.USDExchangeRate = 1
	*affiliateSetting = operation_setting.AffiliateSetting{
		Enabled:                   true,
		RegistrationRewardTrigger: operation_setting.AffiliateRegistrationTriggerFirstQualifiedTopUp,
		RewardMode:                operation_setting.AffiliateRewardModePercentage,
		CashbackFrequency:         operation_setting.AffiliateCashbackFrequencyEveryTopUp,
		RewardRateBps:             2000,
		UnlimitedReward:           true,
		MinimumTopUpCents:         2000,
		MinimumTransferQuota:      int64(common.QuotaPerUnit),
		ShowInviteeTopUps:         true,
	}
	if mutate != nil {
		mutate(affiliateSetting)
	}
	return int64(common.QuotaPerUnit)
}

func createAffiliateUsers(t *testing.T, inviteeEmail string) (*User, *User) {
	t.Helper()
	inviter := &User{Username: "affiliate-inviter", AffCode: "INVITER1", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(inviter).Error)
	invitee := &User{
		Username: "affiliate-invitee", Email: inviteeEmail, AffCode: "INVITEE1",
		InviterId: inviter.Id, Status: common.UserStatusEnabled,
	}
	require.NoError(t, DB.Create(invitee).Error)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		if err := initializeAffiliateUserWithTx(tx, inviter, 0, false); err != nil {
			return err
		}
		return initializeAffiliateUserWithTx(tx, invitee, inviter.Id, true)
	}))
	return inviter, invitee
}

func createAffiliateTopUp(t *testing.T, inviteeID int, tradeNo string, money float64, source string) *TopUp {
	t.Helper()
	now := time.Now().Unix()
	topUp := &TopUp{
		UserId: inviteeID, Amount: int64(money), Money: money, TradeNo: tradeNo,
		PaymentMethod: PaymentMethodStripe, PaymentProvider: PaymentProviderStripe,
		CompletionSource: source, Status: common.TopUpStatusSuccess,
		CreateTime: now, CompleteTime: now,
	}
	require.NoError(t, DB.Create(topUp).Error)
	return topUp
}

func TestAffiliateEveryTopUpUsesCumulativeFirstRewardThenCurrentPayment(t *testing.T) {
	truncateTables(t)
	unit := configureAffiliateTest(t, nil)
	inviter, invitee := createAffiliateUsers(t, "alice@example.com")

	first := createAffiliateTopUp(t, invitee.Id, "affiliate-first-ten", 10, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(first.Id))
	second := createAffiliateTopUp(t, invitee.Id, "affiliate-second-ten", 10, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(second.Id))
	require.NoError(t, ProcessAffiliateTopUp(second.Id))
	third := createAffiliateTopUp(t, invitee.Id, "affiliate-one-yuan", 1, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(third.Id))

	var rewards []AffiliateReward
	require.NoError(t, DB.Where("reward_type = ?", AffiliateRewardTypeCashback).Order("id asc").Find(&rewards).Error)
	require.Len(t, rewards, 2)
	assert.Equal(t, 4*unit, rewards[0].ActualQuota)
	assert.Equal(t, unit/5, rewards[1].ActualQuota)
	assert.Equal(t, int64(2000), rewards[0].CumulativePaidCents)
	assert.Equal(t, int64(100), rewards[1].PaidCents)

	var relation AffiliateReferral
	require.NoError(t, DB.Where("invitee_user_id = ?", invitee.Id).First(&relation).Error)
	assert.Equal(t, AffiliateReferralStatusQualified, relation.Status)
	assert.Equal(t, second.Id, *relation.QualifyingTopUpID)
	assert.Equal(t, 4*unit+unit/5, relation.CashbackRewardedQuota)

	var account AffiliateQuotaAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, 4*unit+unit/5, account.AvailableQuota)

	var eventCount int64
	require.NoError(t, DB.Model(&AffiliateTopUpEvent{}).Count(&eventCount).Error)
	assert.Equal(t, int64(3), eventCount)
}

func TestAffiliateFixedRewardHonorsPerReferralCap(t *testing.T) {
	truncateTables(t)
	unit := configureAffiliateTest(t, func(setting *operation_setting.AffiliateSetting) {
		setting.RewardMode = operation_setting.AffiliateRewardModeFixed
		setting.FixedRewardQuota = 5 * int64(common.QuotaPerUnit)
		setting.UnlimitedReward = false
		setting.MaximumRewardQuota = 8 * int64(common.QuotaPerUnit)
	})
	inviter, invitee := createAffiliateUsers(t, "")

	for index, money := range []float64{20, 1, 1} {
		topUp := createAffiliateTopUp(t, invitee.Id, "affiliate-fixed-"+string(rune('a'+index)), money, TopUpCompletionSourceOnlineWallet)
		require.NoError(t, ProcessAffiliateTopUp(topUp.Id))
	}

	var rewards []AffiliateReward
	require.NoError(t, DB.Where("reward_type = ?", AffiliateRewardTypeCashback).Order("id asc").Find(&rewards).Error)
	require.Len(t, rewards, 2)
	assert.Equal(t, 5*unit, rewards[0].ActualQuota)
	assert.Equal(t, 3*unit, rewards[1].ActualQuota)
	var eventCount int64
	require.NoError(t, DB.Model(&AffiliateTopUpEvent{}).Count(&eventCount).Error)
	assert.Equal(t, int64(3), eventCount)

	var account AffiliateQuotaAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, 8*unit, account.AvailableQuota)
}

func TestAffiliateRegistrationRewardsFreezeReleaseAndTransfer(t *testing.T) {
	truncateTables(t)
	unit := configureAffiliateTest(t, func(setting *operation_setting.AffiliateSetting) {
		setting.RegistrationRewardTrigger = operation_setting.AffiliateRegistrationTriggerRegistrationSuccess
		setting.InviterRewardQuota = 2 * int64(common.QuotaPerUnit)
		setting.InviteeRewardQuota = int64(common.QuotaPerUnit)
		setting.HoldSeconds = 60
	})
	inviter, invitee := createAffiliateUsers(t, "")

	var account AffiliateQuotaAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, 2*unit, account.PendingQuota)
	assert.Zero(t, account.AvailableQuota)
	var refreshedInvitee User
	require.NoError(t, DB.Select("quota").Where("id = ?", invitee.Id).First(&refreshedInvitee).Error)
	assert.Equal(t, int(unit), refreshedInvitee.Quota)

	released, err := ReleaseDueAffiliateRewards(time.Now().Unix()+120, 100)
	require.NoError(t, err)
	assert.Equal(t, 1, released)
	firstTransfer, err := CreateAffiliateBalanceTransfer(inviter.Id, unit, "transfer-1")
	require.NoError(t, err)
	duplicate, err := CreateAffiliateBalanceTransfer(inviter.Id, unit, "transfer-1")
	require.NoError(t, err)
	assert.Equal(t, firstTransfer.ID, duplicate.ID)

	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Equal(t, unit, account.AvailableQuota)
	assert.Equal(t, unit, account.TransferredQuota)
	var refreshedInviter User
	require.NoError(t, DB.Select("quota").Where("id = ?", inviter.Id).First(&refreshedInviter).Error)
	assert.Equal(t, int(unit), refreshedInviter.Quota)
}

func TestAffiliateQuotaAccountMigratesLegacyBalancesOnce(t *testing.T) {
	truncateTables(t)
	unit := configureAffiliateTest(t, nil)
	user := &User{
		Username: "affiliate-legacy", AffCode: "LEGACY01", Status: common.UserStatusEnabled,
		AffQuota: int(2 * unit), AffHistoryQuota: int(5 * unit),
	}
	require.NoError(t, DB.Create(user).Error)

	account, err := GetAffiliateQuotaAccount(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 2*unit, account.AvailableQuota)
	assert.Equal(t, 3*unit, account.TransferredQuota)
	assert.Equal(t, 5*unit, account.LifetimeEarnedQuota)
	var ledger AffiliateQuotaLedger
	require.NoError(t, DB.Where("entry_type = ?", AffiliateLedgerTypeLegacyMigration).First(&ledger).Error)
	assert.Equal(t, 5*unit, ledger.AmountQuota)
	assert.Equal(t, 2*unit, ledger.AvailableDeltaQuota)
	assert.Equal(t, 3*unit, ledger.TransferredDeltaQuota)

	account, err = GetAffiliateQuotaAccount(user.Id)
	require.NoError(t, err)
	assert.Equal(t, 2*unit, account.AvailableQuota)
	assert.Equal(t, 3*unit, account.TransferredQuota)
	assert.Equal(t, 5*unit, account.LifetimeEarnedQuota)

	var refreshed User
	require.NoError(t, DB.Select("aff_quota", "aff_history").Where("id = ?", user.Id).First(&refreshed).Error)
	assert.Zero(t, refreshed.AffQuota)
	assert.Equal(t, int(5*unit), refreshed.AffHistoryQuota)
}

func TestAffiliateProfilesGenerateDistinctInvitationCodes(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, nil)
	first := &User{Username: "affiliate-code-one", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(first).Error)
	require.NoError(t, EnsureAffiliateProfile(first.Id))

	second := &User{Username: "affiliate-code-two", Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(second).Error)
	require.NoError(t, EnsureAffiliateProfile(second.Id))
	require.NoError(t, DB.Select("aff_code").Where("id = ?", first.Id).First(first).Error)
	require.NoError(t, DB.Select("aff_code").Where("id = ?", second.Id).First(second).Error)
	assert.NotEmpty(t, first.AffCode)
	assert.NotEmpty(t, second.AffCode)
	assert.NotEqual(t, first.AffCode, second.AffCode)
}

func TestAffiliateOverrideAffectsExistingReferralFutureTopUps(t *testing.T) {
	truncateTables(t)
	unit := configureAffiliateTest(t, func(setting *operation_setting.AffiliateSetting) {
		setting.RewardRateBps = 1000
		setting.MinimumTopUpCents = 0
	})
	inviter, invitee := createAffiliateUsers(t, "")
	first := createAffiliateTopUp(t, invitee.Id, "affiliate-global-rate", 10, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(first.Id))

	rate := int64(5000)
	_, err := SaveAffiliateUserOverride(inviter.Id, inviter.Id, AffiliateUserOverride{
		RewardRateBps: &rate,
		ChangeReason:  "partner agreement",
	})
	require.NoError(t, err)
	second := createAffiliateTopUp(t, invitee.Id, "affiliate-override-rate", 10, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(second.Id))

	var rewards []AffiliateReward
	require.NoError(t, DB.Where("reward_type = ?", AffiliateRewardTypeCashback).Order("id asc").Find(&rewards).Error)
	require.Len(t, rewards, 2)
	assert.Equal(t, unit, rewards[0].ActualQuota)
	assert.Equal(t, 5*unit, rewards[1].ActualQuota)
	assert.NotEqual(t, rewards[0].RuleVersionID, rewards[1].RuleVersionID)
}

func TestAffiliateOverrideRequiresChangeReason(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, nil)
	inviter, _ := createAffiliateUsers(t, "")
	rate := int64(1500)

	_, err := SaveAffiliateUserOverride(inviter.Id, inviter.Id, AffiliateUserOverride{
		RewardRateBps: &rate,
		ChangeReason:  "   ",
	})
	assert.ErrorIs(t, err, ErrAffiliateRuleInvalid)
}

func TestAffiliateAdminCompletedTopUpIsExcluded(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, nil)
	_, invitee := createAffiliateUsers(t, "")
	topUp := createAffiliateTopUp(t, invitee.Id, "affiliate-admin-topup", 100, TopUpCompletionSourceAdmin)
	require.NoError(t, ProcessAffiliateTopUp(topUp.Id))

	var count int64
	require.NoError(t, DB.Model(&AffiliateTopUpEvent{}).Count(&count).Error)
	assert.Zero(t, count)
	require.NoError(t, DB.Model(&AffiliateReward{}).Where("reward_type = ?", AffiliateRewardTypeCashback).Count(&count).Error)
	assert.Zero(t, count)
}

func TestAffiliateInviteeTopUpsMasksEmailAndHonorsVisibilityOverride(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, func(setting *operation_setting.AffiliateSetting) {
		setting.MinimumTopUpCents = 0
	})
	inviter, invitee := createAffiliateUsers(t, "alice@example.com")
	topUp := createAffiliateTopUp(t, invitee.Id, "affiliate-visible-topup", 10, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(topUp.Id))

	items, total, err := GetAffiliateInviteeTopUps(inviter.Id, "", "", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, "a***e@example.com", items[0].MaskedEmail)
	assert.Equal(t, int64(1000), items[0].PaidCents)

	items, total, err = GetAffiliateInviteeTopUps(inviter.Id, "", "a***e@example.com", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)

	items, total, err = GetAffiliateInviteeTopUps(inviter.Id, "", "alice@example.com", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, "a***e@example.com", items[0].MaskedEmail)

	items, total, err = GetAffiliateInviteeTopUps(inviter.Id, "", "ALICE", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, "a***e@example.com", items[0].MaskedEmail)

	visible := false
	_, err = SaveAffiliateUserOverride(inviter.Id, inviter.Id, AffiliateUserOverride{
		ShowInviteeTopUps: &visible,
		ChangeReason:      "privacy request",
	})
	require.NoError(t, err)
	_, _, err = GetAffiliateInviteeTopUps(inviter.Id, "", "", 0, 0, 0, 10)
	assert.ErrorIs(t, err, ErrAffiliateTopUpsHidden)
}

func TestAffiliateInviteeTopUpsSearchesRechargeTimeAndSorts(t *testing.T) {
	truncateTables(t)
	configureAffiliateTest(t, func(setting *operation_setting.AffiliateSetting) {
		setting.MinimumTopUpCents = 0
	})
	inviter, invitee := createAffiliateUsers(t, "timeline@example.com")
	first := createAffiliateTopUp(t, invitee.Id, "affiliate-timeline-first", 10, TopUpCompletionSourceOnlineWallet)
	first.CompleteTime = time.Date(2026, time.August, 1, 9, 30, 0, 0, time.Local).Unix()
	require.NoError(t, DB.Model(first).Update("complete_time", first.CompleteTime).Error)
	require.NoError(t, ProcessAffiliateTopUp(first.Id))
	second := createAffiliateTopUp(t, invitee.Id, "affiliate-timeline-second", 20, TopUpCompletionSourceOnlineWallet)
	second.CompleteTime = time.Date(2026, time.August, 2, 14, 20, 0, 0, time.Local).Unix()
	require.NoError(t, DB.Model(second).Update("complete_time", second.CompleteTime).Error)
	require.NoError(t, ProcessAffiliateTopUp(second.Id))

	items, total, err := GetAffiliateInviteeTopUpsSorted(inviter.Id, "", "2026-08-02", "recharge_time_desc", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, second.Id, items[0].TopUpID)

	items, total, err = GetAffiliateInviteeTopUpsSorted(inviter.Id, "", "2026-08-02 14:20", "recharge_time_desc", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, second.Id, items[0].TopUpID)

	items, total, err = GetAffiliateInviteeTopUpsSorted(inviter.Id, "", "", "recharge_time_asc", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, items, 2)
	assert.Equal(t, first.Id, items[0].TopUpID)
	assert.Equal(t, second.Id, items[1].TopUpID)
}

func TestAffiliateRewardBalanceTransferMovesOnlySelectedReward(t *testing.T) {
	truncateTables(t)
	unit := configureAffiliateTest(t, func(setting *operation_setting.AffiliateSetting) {
		setting.MinimumTopUpCents = 0
		setting.RewardMode = operation_setting.AffiliateRewardModeFixed
		setting.FixedRewardQuota = 2 * int64(common.QuotaPerUnit)
	})
	inviter, invitee := createAffiliateUsers(t, "transfer-row@example.com")
	first := createAffiliateTopUp(t, invitee.Id, "affiliate-row-first", 10, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(first.Id))
	second := createAffiliateTopUp(t, invitee.Id, "affiliate-row-second", 10, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(second.Id))

	var rewards []AffiliateReward
	require.NoError(t, DB.Where("reward_type = ?", AffiliateRewardTypeCashback).Order("id asc").Find(&rewards).Error)
	require.Len(t, rewards, 2)
	transfer, err := CreateAffiliateRewardBalanceTransfer(inviter.Id, rewards[0].ID, "row-transfer-1")
	require.NoError(t, err)
	assert.Equal(t, 2*unit, transfer.AmountQuota)

	var firstReward, secondReward AffiliateReward
	require.NoError(t, DB.First(&firstReward, rewards[0].ID).Error)
	require.NoError(t, DB.First(&secondReward, rewards[1].ID).Error)
	assert.Equal(t, AffiliateRewardStatusTransferred, firstReward.Status)
	assert.Equal(t, AffiliateRewardStatusAvailable, secondReward.Status)
	assert.Equal(t, 2*unit, firstReward.TransferredQuota)
	assert.Zero(t, secondReward.TransferredQuota)

	_, err = CreateAffiliateRewardBalanceTransfer(inviter.Id, rewards[0].ID, "row-transfer-again")
	assert.ErrorIs(t, err, ErrAffiliateBalance)
}

func TestAffiliateAdjustmentLeavesTransferredAmountForManualHandling(t *testing.T) {
	truncateTables(t)
	unit := configureAffiliateTest(t, func(setting *operation_setting.AffiliateSetting) {
		setting.RewardMode = operation_setting.AffiliateRewardModeFixed
		setting.FixedRewardQuota = 5 * int64(common.QuotaPerUnit)
		setting.MinimumTopUpCents = 0
	})
	inviter, invitee := createAffiliateUsers(t, "adjusted@example.com")
	topUp := createAffiliateTopUp(t, invitee.Id, "affiliate-adjustment", 1, TopUpCompletionSourceOnlineWallet)
	require.NoError(t, ProcessAffiliateTopUp(topUp.Id))
	_, err := CreateAffiliateBalanceTransfer(inviter.Id, 3*unit, "transfer-before-adjustment")
	require.NoError(t, err)

	var reward AffiliateReward
	require.NoError(t, DB.Where("reward_type = ?", AffiliateRewardTypeCashback).First(&reward).Error)
	adjustment, err := AdjustAffiliateReward(reward.ID, inviter.Id, 5*unit, "refunded payment", "refund-adjustment-1")
	require.NoError(t, err)
	assert.Equal(t, 2*unit, adjustment.AppliedQuota)
	assert.Equal(t, 3*unit, adjustment.PendingManualQuota)
	assert.Equal(t, AffiliateAdjustmentStatusManualRequired, adjustment.Status)

	repeated, err := AdjustAffiliateReward(reward.ID, inviter.Id, 5*unit, "refunded payment", "refund-adjustment-1")
	require.NoError(t, err)
	assert.Equal(t, adjustment.ID, repeated.ID)

	var inviterReward AffiliateReward
	require.NoError(t, DB.Where("reward_type = ?", AffiliateRewardTypeInviter).First(&inviterReward).Error)
	_, err = AdjustAffiliateReward(inviterReward.ID, inviter.Id, unit, "invalid reward type", "refund-adjustment-2")
	assert.ErrorIs(t, err, ErrAffiliateAmountInvalid)

	items, total, err := GetAffiliateAdminRewards("affiliate-invitee", "", 0, 0, 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	assert.Equal(t, reward.ID, items[0].ID)
	assert.Equal(t, 2*unit, items[0].AdjustedQuota)
	assert.Equal(t, "a***d@example.com", items[0].InviteeEmail)

	var account AffiliateQuotaAccount
	require.NoError(t, DB.Where("user_id = ?", inviter.Id).First(&account).Error)
	assert.Zero(t, account.AvailableQuota)
	assert.Equal(t, 3*unit, account.TransferredQuota)
}
