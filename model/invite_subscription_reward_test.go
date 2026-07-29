package model

import (
	"fmt"
	"math"
	"path/filepath"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInviteSubRewardTest(t *testing.T) {
	t.Helper()
	setupInviteRewardModelTest(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &InviteSubscriptionReward{}))

	originalMode := common.InviteRewardSubscriptionMode
	originalDelay := common.InviteRewardUnlockDelaySeconds
	originalQuotaPerUnit := common.QuotaPerUnit
	t.Cleanup(func() {
		common.InviteRewardSubscriptionMode = originalMode
		common.InviteRewardUnlockDelaySeconds = originalDelay
		common.QuotaPerUnit = originalQuotaPerUnit
	})
	common.InviteRewardSubscriptionMode = true
	common.InviteRewardUnlockDelaySeconds = 7 * 24 * 3600
	common.QuotaPerUnit = 100
	common.QuotaForInviter = int(7.5 * common.QuotaPerUnit)
}

func setupInviteSubRewardConcurrentTest(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	originalMode := common.InviteRewardSubscriptionMode
	originalQuotaForInviter := common.QuotaForInviter
	originalQuotaForInviterMaxCount := common.QuotaForInviterMaxCount
	originalQuotaPerUnit := common.QuotaPerUnit

	dbPath := filepath.Join(t.TempDir(), "invite-sub-reward.db")
	db, err := gorm.Open(sqlite.Open(dbPath+"?_pragma=busy_timeout(10000)&_txlock=immediate"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(4)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	require.NoError(t, DB.AutoMigrate(&User{}, &Token{}, &TopUp{}, &Log{}, &InviteRewardEvent{}, &SubscriptionDiscountAccount{}, &SubscriptionDiscountEntry{}, &SubscriptionOrder{}, &InviteSubscriptionReward{}))

	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		common.InviteRewardSubscriptionMode = originalMode
		common.QuotaForInviter = originalQuotaForInviter
		common.QuotaForInviterMaxCount = originalQuotaForInviterMaxCount
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	common.InviteRewardSubscriptionMode = true
	common.QuotaPerUnit = 100
	common.QuotaForInviter = int(7.5 * common.QuotaPerUnit)
	common.QuotaForInviterMaxCount = 5
}

func createCompletedSubscriptionOrder(t *testing.T, userId int, money float64, tradeNo string) *SubscriptionOrder {
	t.Helper()
	order := &SubscriptionOrder{
		UserId:          userId,
		PlanId:          1,
		Money:           money,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
	}
	require.NoError(t, order.Insert())
	return order
}

func grantInviteSubRewardForTest(t *testing.T, order *SubscriptionOrder) {
	t.Helper()
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))
}

func requireInviteSubRewardLedger(t *testing.T, inviterId int, inviteeId int, expectedUSDMinor int64) SubscriptionDiscountEntry {
	t.Helper()
	account, err := GetSubscriptionDiscountAccount(inviterId)
	require.NoError(t, err)
	require.EqualValues(t, expectedUSDMinor, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)

	var entries []SubscriptionDiscountEntry
	require.NoError(t, DB.Where("user_id = ?", inviterId).Order("id asc").Find(&entries).Error)
	require.Len(t, entries, 1)
	entry := entries[0]
	require.Equal(t, SubscriptionDiscountEntryTypeGrantInviter, entry.EntryType)
	require.EqualValues(t, expectedUSDMinor, entry.AvailableDeltaUSDMinor)
	require.EqualValues(t, expectedUSDMinor, entry.AvailableAfterUSDMinor)
	require.Equal(t, "invite_subscription_reward", entry.SourceType)
	require.Equal(t, fmt.Sprintf("inviter:%d:first-paid-subscription", inviteeId), entry.SourceKey)
	require.Equal(t, fmt.Sprintf("inviter:%d:first-paid-subscription", inviteeId), entry.IdempotencyKey)
	require.Contains(t, entry.PricingSnapshot, `"quota_for_inviter"`)
	return entry
}

func TestInviteSubRewardCreatedWithFixedInviterAmount(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")

	grantInviteSubRewardForTest(t, order)

	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, reward.Status)
	require.Equal(t, common.QuotaForInviter, reward.RewardQuota)
	require.Zero(t, reward.UnlockAt)
	require.NotZero(t, reward.GrantedAt)

	requireInviteSubRewardLedger(t, inviter.Id, invitee.Id, 750)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.Quota)
	require.Zero(t, refreshedInviter.AffQuota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
	require.Equal(t, 1, refreshedInviter.AffCount)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)
	require.Zero(t, refreshedInvitee.Quota)
}

func TestInviteSubRewardIdempotentPerInvitee(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order1 := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")
	order2 := createCompletedSubscriptionOrder(t, invitee.Id, 15, "sub-002")

	grantInviteSubRewardForTest(t, order1)
	grantInviteSubRewardForTest(t, order1)
	grantInviteSubRewardForTest(t, order2)

	var rewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.EqualValues(t, 1, rewards)

	var entries int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("idempotency_key = ?", fmt.Sprintf("inviter:%d:first-paid-subscription", invitee.Id)).Count(&entries).Error)
	require.EqualValues(t, 1, entries)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 1, refreshedInviter.AffCount)
	require.Zero(t, refreshedInviter.Quota)
}

func TestGrantInviteSubscriptionDiscountFinalizesInviteeWhenLedgerGrantAlreadyExists(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	key := inviteSubscriptionRewardIdempotencyKey(invitee.Id)
	snapshot, err := inviteSubscriptionRewardPricingSnapshot(common.QuotaForInviter, 750)
	require.NoError(t, err)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		changed, err := GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:          inviter.Id,
			USDMinor:        750,
			EntryType:       SubscriptionDiscountEntryTypeGrantInviter,
			SourceType:      "invite_subscription_reward",
			SourceKey:       key,
			IdempotencyKey:  key,
			PricingSnapshot: snapshot,
		})
		require.True(t, changed)
		return err
	}))
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-ledger-exists")

	grantInviteSubRewardForTest(t, order)

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusGranted, refreshedInvitee.InviteRewardStatus)

	var entries int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("idempotency_key = ?", key).Count(&entries).Error)
	require.EqualValues(t, 1, entries)
}

func TestGrantInviteSubscriptionDiscountRejectsPositiveQuotaThatRoundsToZero(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.QuotaPerUnit = 100_000
	common.QuotaForInviter = 1

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-rounds-zero")

	err := TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo)
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAmount)

	var rewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Zero(t, rewards)
	var entries int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", inviter.Id).Count(&entries).Error)
	require.Zero(t, entries)
	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
}

func TestGrantInviteSubscriptionDiscountRejectsPollutedExistingLedgerGrant(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	key := inviteSubscriptionRewardIdempotencyKey(invitee.Id)
	require.True(t, grantSubscriptionDiscountForTest(t, inviter.Id, 750, key))
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-polluted-ledger")

	err := TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo)
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAccountState)

	var rewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Zero(t, rewards)
	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
}

func TestGrantInviteSubscriptionDiscountRejectsExistingLedgerForWrongInviter(t *testing.T) {
	setupInviteSubRewardTest(t)

	wrongInviter := createInviteRewardUser(t, "wrong-inviter", 0)
	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	key := inviteSubscriptionRewardIdempotencyKey(invitee.Id)
	snapshot, err := inviteSubscriptionRewardPricingSnapshot(common.QuotaForInviter, 750)
	require.NoError(t, err)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		changed, err := GrantSubscriptionDiscountTx(tx, SubscriptionDiscountGrantInput{
			UserID:          wrongInviter.Id,
			USDMinor:        750,
			EntryType:       SubscriptionDiscountEntryTypeGrantInviter,
			SourceType:      "invite_subscription_reward",
			SourceKey:       key,
			IdempotencyKey:  key,
			PricingSnapshot: snapshot,
		})
		require.True(t, changed)
		return err
	}))
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-wrong-ledger")

	err = TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo)
	require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAccountState)

	var rewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Zero(t, rewards)
	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
}

func TestInviteSubscriptionRewardQuotaRejectsNonFiniteQuotaPerUnit(t *testing.T) {
	for _, quotaPerUnit := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		t.Run(fmt.Sprintf("%v", quotaPerUnit), func(t *testing.T) {
			setupInviteSubRewardTest(t)
			common.QuotaPerUnit = quotaPerUnit

			inviter := createInviteRewardUser(t, "inviter", 0)
			invitee := createInviteRewardUser(t, "invitee", inviter.Id)
			order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-non-finite")

			err := TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo)
			require.ErrorIs(t, err, ErrSubscriptionDiscountInvalidAmount)

			var entries int64
			require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", inviter.Id).Count(&entries).Error)
			require.Zero(t, entries)
		})
	}
}

func TestInviteSubRewardZeroConfiguredAmountFinalizesWithoutLedger(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.QuotaForInviter = 0

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-zero")

	grantInviteSubRewardForTest(t, order)

	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, reward.Status)
	require.Zero(t, reward.RewardQuota)
	require.Zero(t, reward.UnlockAt)

	var entries int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", inviter.Id).Count(&entries).Error)
	require.Zero(t, entries)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.AffCount)
}

func TestInviteSubRewardUnlimitedInviterCapAllowsAllRewards(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.QuotaForInviterMaxCount = 0

	inviter := createInviteRewardUser(t, "inviter", 0)
	for i := 1; i <= 3; i++ {
		invitee := createInviteRewardUser(t, fmt.Sprintf("invitee%d", i), inviter.Id)
		order := createCompletedSubscriptionOrder(t, invitee.Id, 5, fmt.Sprintf("sub-unlimited-%d", i))
		grantInviteSubRewardForTest(t, order)
	}

	var granted, blocked int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusGranted).Count(&granted).Error)
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusBlocked).Count(&blocked).Error)
	require.EqualValues(t, 3, granted)
	require.Zero(t, blocked)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 3, refreshedInviter.AffCount)
	account, err := GetSubscriptionDiscountAccount(inviter.Id)
	require.NoError(t, err)
	require.EqualValues(t, 2250, account.AvailableUSDMinor)
}

func TestInviteSubRewardBlockedWhenInviterLimitReached(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.QuotaForInviterMaxCount = 2

	inviter := createInviteRewardUser(t, "inviter", 0)
	for i := 1; i <= 3; i++ {
		invitee := createInviteRewardUser(t, fmt.Sprintf("invitee%d", i), inviter.Id)
		order := createCompletedSubscriptionOrder(t, invitee.Id, 5, fmt.Sprintf("sub-%03d", i))
		grantInviteSubRewardForTest(t, order)
	}

	var granted, blocked int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusGranted).Count(&granted).Error)
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusBlocked).Count(&blocked).Error)
	require.EqualValues(t, 2, granted)
	require.EqualValues(t, 1, blocked)

	var blockedReward InviteSubscriptionReward
	require.NoError(t, DB.First(&blockedReward, "status = ?", InviteSubRewardStatusBlocked).Error)
	require.Equal(t, InviteSubRewardReasonLimitReached, blockedReward.Reason)
	require.Zero(t, blockedReward.RewardQuota)
	require.Zero(t, blockedReward.UnlockAt)

	var entries int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", inviter.Id).Count(&entries).Error)
	require.EqualValues(t, 2, entries)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 2, refreshedInviter.AffCount)
}

func TestInviteSubRewardDisabledModeNoOp(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.InviteRewardSubscriptionMode = false

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")

	grantInviteSubRewardForTest(t, order)

	var count int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestInviteSubRewardUnlockerDoesNotGrantLegacyPendingRows(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.InviteRewardSubscriptionMode = false

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	reward := InviteSubscriptionReward{
		InviteeId:   invitee.Id,
		InviterId:   inviter.Id,
		TradeNo:     "legacy-pending",
		RewardQuota: 500,
		Status:      InviteSubRewardStatusPending,
		UnlockAt:    common.GetTimestamp() - 1,
	}
	require.NoError(t, DB.Create(&reward).Error)

	granted, err := UnlockDueInviteSubscriptionRewards(10)

	require.NoError(t, err)
	require.Zero(t, granted)

	var refreshedReward InviteSubscriptionReward
	require.NoError(t, DB.First(&refreshedReward, reward.Id).Error)
	require.Equal(t, InviteSubRewardStatusPending, refreshedReward.Status)
	require.Zero(t, refreshedReward.GrantedAt)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.Quota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
}

func TestInviteSubRewardRevokeDoesNotClawBackGrantedRows(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.InviteRewardSubscriptionMode = false

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	require.NoError(t, DB.Model(&User{}).Where("id = ?", inviter.Id).Updates(map[string]any{
		"quota":       1000,
		"aff_history": 500,
	}).Error)
	reward := InviteSubscriptionReward{
		InviteeId:   invitee.Id,
		InviterId:   inviter.Id,
		TradeNo:     "legacy-granted",
		RewardQuota: 500,
		Status:      InviteSubRewardStatusGranted,
		GrantedAt:   common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(&reward).Error)

	revoked, err := RevokeInviteSubscriptionRewardByTradeNo("legacy-granted", "refunded")

	require.NoError(t, err)
	require.False(t, revoked)

	var refreshedReward InviteSubscriptionReward
	require.NoError(t, DB.First(&refreshedReward, reward.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, refreshedReward.Status)
	require.Zero(t, refreshedReward.RevokedAt)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 1000, refreshedInviter.Quota)
	require.Equal(t, 500, refreshedInviter.AffHistoryQuota)
}

func TestInviteSubRewardNoInviterNoOp(t *testing.T) {
	setupInviteSubRewardTest(t)

	user := createInviteRewardUser(t, "solo", 0)
	order := createCompletedSubscriptionOrder(t, user.Id, 5, "sub-001")

	grantInviteSubRewardForTest(t, order)

	var count int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestInviteSubRewardMissingInviterNoOp(t *testing.T) {
	setupInviteSubRewardTest(t)

	invitee := createInviteRewardUser(t, "invitee", 99999)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-missing-inviter")

	grantInviteSubRewardForTest(t, order)

	var count int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestInviteSubRewardNonSuccessOrderNoOp(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-pending")
	require.NoError(t, DB.Model(order).Update("status", common.TopUpStatusPending).Error)

	grantInviteSubRewardForTest(t, order)

	var count int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestReconcileMissedInviteSubscriptionRewardsAllHistoryBoundedOrder(t *testing.T) {
	setupInviteSubRewardTest(t)

	firstInviter := createInviteRewardUser(t, "first-inviter", 0)
	secondInviter := createInviteRewardUser(t, "second-inviter", 0)
	firstInvitee := createInviteRewardUser(t, "first", firstInviter.Id)
	secondInvitee := createInviteRewardUser(t, "second", secondInviter.Id)
	firstOrder := createCompletedSubscriptionOrder(t, firstInvitee.Id, 5, "sub-reconcile-oldest")
	secondOrder := createCompletedSubscriptionOrder(t, secondInvitee.Id, 5, "sub-reconcile-newer")
	require.NoError(t, DB.Model(firstOrder).Updates(map[string]any{
		"complete_time": int64(100),
	}).Error)
	require.NoError(t, DB.Model(secondOrder).Updates(map[string]any{
		"complete_time": int64(200),
	}).Error)

	granted, err := ReconcileMissedInviteSubscriptionRewards(0, 1)

	require.NoError(t, err)
	require.Equal(t, 1, granted)
	var firstReward InviteSubscriptionReward
	require.NoError(t, DB.First(&firstReward, "invitee_id = ?", firstInvitee.Id).Error)
	require.Equal(t, "sub-reconcile-oldest", firstReward.TradeNo)
	var secondRewardCount int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", secondInvitee.Id).Count(&secondRewardCount).Error)
	require.Zero(t, secondRewardCount)

	granted, err = ReconcileMissedInviteSubscriptionRewards(0, 10)
	require.NoError(t, err)
	require.Equal(t, 1, granted)
	var totalRewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Count(&totalRewards).Error)
	require.EqualValues(t, 2, totalRewards)

	granted, err = ReconcileMissedInviteSubscriptionRewards(0, 10)
	require.NoError(t, err)
	require.Zero(t, granted)
	requireInviteSubRewardLedger(t, firstInviter.Id, firstInvitee.Id, 750)
	requireInviteSubRewardLedger(t, secondInviter.Id, secondInvitee.Id, 750)
}

func TestInviteSubRewardConcurrentOrdersForSameInviteeGrantOnce(t *testing.T) {
	setupInviteSubRewardConcurrentTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order1 := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-concurrent-1")
	order2 := createCompletedSubscriptionOrder(t, invitee.Id, 10, "sub-concurrent-2")

	runInviteSubRewardConcurrentGrants(t, []*SubscriptionOrder{order1, order2})

	var rewards, entries int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", inviter.Id).Count(&entries).Error)
	require.EqualValues(t, 1, rewards)
	require.EqualValues(t, 1, entries)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 1, refreshedInviter.AffCount)
}

func TestInviteSubRewardConcurrentInviteesRespectPositiveCap(t *testing.T) {
	setupInviteSubRewardConcurrentTest(t)
	common.QuotaForInviterMaxCount = 1

	inviter := createInviteRewardUser(t, "inviter", 0)
	orders := make([]*SubscriptionOrder, 0, 2)
	for i := 1; i <= 2; i++ {
		invitee := createInviteRewardUser(t, fmt.Sprintf("invitee%d", i), inviter.Id)
		orders = append(orders, createCompletedSubscriptionOrder(t, invitee.Id, 5, fmt.Sprintf("sub-cap-concurrent-%d", i)))
	}

	runInviteSubRewardConcurrentGrants(t, orders)

	var granted, blocked, entries int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusGranted).Count(&granted).Error)
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusBlocked).Count(&blocked).Error)
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("user_id = ?", inviter.Id).Count(&entries).Error)
	require.EqualValues(t, 1, granted)
	require.EqualValues(t, 1, blocked)
	require.EqualValues(t, 1, entries)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 1, refreshedInviter.AffCount)
}

func runInviteSubRewardConcurrentGrants(t *testing.T, orders []*SubscriptionOrder) {
	t.Helper()
	start := make(chan struct{})
	results := make(chan error, len(orders))
	var wg sync.WaitGroup
	for _, order := range orders {
		order := order
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			results <- TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo)
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	for err := range results {
		require.NoError(t, err)
	}
}

func TestTopUpTriggerSkippedInSubscriptionMode(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	topUp := createSuccessfulInviteRewardTopUp(t, invitee.Id, "topup-001")

	require.NoError(t, TryGrantInviteRewardAfterTopUpSucceeded(invitee.Id, topUp.Id))

	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
	require.Zero(t, refreshedInvitee.Quota)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.Quota)
	require.Zero(t, refreshedInviter.AffCount)

	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")
	grantInviteSubRewardForTest(t, order)
	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, reward.Status)
}

func TestInvitationPageOverlaysSubscriptionReward(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")
	grantInviteSubRewardForTest(t, order)

	page, err := GetInvitationPage(inviter.Id, 0, 10)
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	record := page.Items[0]
	require.Equal(t, InviteRewardStatusGranted, record.Status)
	require.Equal(t, common.QuotaForInviter, record.RewardQuota)
	require.Zero(t, record.UnlockAt)

	locked, err := SumLockedInviteSubscriptionRewardQuota(inviter.Id)
	require.NoError(t, err)
	require.Zero(t, locked)
}
