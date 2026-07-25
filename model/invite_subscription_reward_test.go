package model

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func setupInviteSubRewardTest(t *testing.T) {
	t.Helper()
	setupInviteRewardModelTest(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionOrder{}, &InviteSubscriptionReward{}))

	originalMode := common.InviteRewardSubscriptionMode
	originalDelay := common.InviteRewardUnlockDelaySeconds
	t.Cleanup(func() {
		common.InviteRewardSubscriptionMode = originalMode
		common.InviteRewardUnlockDelaySeconds = originalDelay
	})
	common.InviteRewardSubscriptionMode = true
	common.InviteRewardUnlockDelaySeconds = 7 * 24 * 3600
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

func TestInviteSubRewardCreatedWithFixedInviterAmount(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")

	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))

	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusPending, reward.Status)
	require.Equal(t, common.QuotaForInviter, reward.RewardQuota)
	require.Greater(t, reward.UnlockAt, common.GetTimestamp()+6*24*3600)

	// no quota granted yet — reward is locked
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.Quota)
	require.Equal(t, 1, refreshedInviter.AffCount)

	// invitee conversion marked complete
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

	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order1.TradeNo))
	// webhook retry on the same order
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order1.TradeNo))
	// second subscription must not create a second reward
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order2.TradeNo))

	var count int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&count).Error)
	require.EqualValues(t, 1, count)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 1, refreshedInviter.AffCount)
}

func TestInviteSubRewardDisabledModeNoOp(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.InviteRewardSubscriptionMode = false

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")

	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))

	var count int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestInviteSubRewardNoInviterNoOp(t *testing.T) {
	setupInviteSubRewardTest(t)

	user := createInviteRewardUser(t, "solo", 0)
	order := createCompletedSubscriptionOrder(t, user.Id, 5, "sub-001")

	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))

	var count int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestInviteSubRewardBlockedWhenInviterLimitReached(t *testing.T) {
	setupInviteSubRewardTest(t)
	common.QuotaForInviterMaxCount = 2

	inviter := createInviteRewardUser(t, "inviter", 0)
	for i := 1; i <= 3; i++ {
		invitee := createInviteRewardUser(t, fmt.Sprintf("invitee%d", i), inviter.Id)
		order := createCompletedSubscriptionOrder(t, invitee.Id, 5, fmt.Sprintf("sub-%03d", i))
		require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))
	}

	var pending, blocked int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusPending).Count(&pending).Error)
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("status = ?", InviteSubRewardStatusBlocked).Count(&blocked).Error)
	require.EqualValues(t, 2, pending)
	require.EqualValues(t, 1, blocked)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, 2, refreshedInviter.AffCount)
}

func TestInviteSubRewardUnlockGrantsQuotaOnce(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 15, "sub-001")
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))

	// not due yet
	granted, err := UnlockDueInviteSubscriptionRewards(100)
	require.NoError(t, err)
	require.Zero(t, granted)

	// force due
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).
		Where("invitee_id = ?", invitee.Id).
		Update("unlock_at", common.GetTimestamp()-1).Error)

	granted, err = UnlockDueInviteSubscriptionRewards(100)
	require.NoError(t, err)
	require.Equal(t, 1, granted)

	// second run is a no-op
	granted, err = UnlockDueInviteSubscriptionRewards(100)
	require.NoError(t, err)
	require.Zero(t, granted)

	expectedQuota := common.QuotaForInviter
	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Equal(t, expectedQuota, refreshedInviter.Quota)
	require.Equal(t, expectedQuota, refreshedInviter.AffHistoryQuota)

	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, reward.Status)
	require.NotZero(t, reward.GrantedAt)
}

func TestInviteSubRewardRevokePendingCancelsWithoutDeduction(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))

	revoked, err := RevokeInviteSubscriptionRewardByTradeNo(order.TradeNo, InviteSubRewardReasonRefunded)
	require.NoError(t, err)
	require.True(t, revoked)

	// idempotent
	revoked, err = RevokeInviteSubscriptionRewardByTradeNo(order.TradeNo, InviteSubRewardReasonRefunded)
	require.NoError(t, err)
	require.False(t, revoked)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.Quota)

	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusRevoked, reward.Status)
	require.Equal(t, InviteSubRewardReasonRefunded, reward.Reason)

	// revoked reward must not unlock later
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).
		Where("invitee_id = ?", invitee.Id).
		Update("unlock_at", common.GetTimestamp()-1).Error)
	granted, err := UnlockDueInviteSubscriptionRewards(100)
	require.NoError(t, err)
	require.Zero(t, granted)
}

func TestInviteSubRewardRevokeGrantedDeductsQuota(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 15, "sub-001")
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).
		Where("invitee_id = ?", invitee.Id).
		Update("unlock_at", common.GetTimestamp()-1).Error)
	granted, err := UnlockDueInviteSubscriptionRewards(100)
	require.NoError(t, err)
	require.Equal(t, 1, granted)

	revoked, err := RevokeInviteSubscriptionRewardByTradeNo(order.TradeNo, InviteSubRewardReasonDisputed)
	require.NoError(t, err)
	require.True(t, revoked)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.Quota)
	require.Zero(t, refreshedInviter.AffHistoryQuota)
}

func TestTopUpTriggerSkippedInSubscriptionMode(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	topUp := createSuccessfulInviteRewardTopUp(t, invitee.Id, "topup-001")

	require.NoError(t, TryGrantInviteRewardAfterTopUpSucceeded(invitee.Id, topUp.Id))

	// no legacy grant, invitee stays pending for the subscription trigger
	var refreshedInvitee User
	require.NoError(t, DB.First(&refreshedInvitee, invitee.Id).Error)
	require.Equal(t, InviteRewardStatusPending, refreshedInvitee.InviteRewardStatus)
	require.Zero(t, refreshedInvitee.Quota)

	var refreshedInviter User
	require.NoError(t, DB.First(&refreshedInviter, inviter.Id).Error)
	require.Zero(t, refreshedInviter.Quota)
	require.Zero(t, refreshedInviter.AffCount)

	// subscription payment afterwards still creates the v2 reward
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))
	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusPending, reward.Status)
}

func TestInvitationPageOverlaysSubscriptionReward(t *testing.T) {
	setupInviteSubRewardTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := createCompletedSubscriptionOrder(t, invitee.Id, 5, "sub-001")
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))

	page, err := GetInvitationPage(inviter.Id, 0, 10)
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
	record := page.Items[0]
	require.Equal(t, InvitationRecordStatusLocked, record.Status)
	require.Equal(t, common.QuotaForInviter, record.RewardQuota)
	require.NotZero(t, record.UnlockAt)

	locked, err := SumLockedInviteSubscriptionRewardQuota(inviter.Id)
	require.NoError(t, err)
	require.EqualValues(t, int64(common.QuotaForInviter), locked)
}
