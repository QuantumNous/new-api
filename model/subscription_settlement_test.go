package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedSubscriptionSettlement(t *testing.T, walletQuota int, total, used int64, allowOverflow bool) (User, UserSubscription) {
	t.Helper()
	user := User{Username: "subscription-settlement", Quota: walletQuota, Status: common.UserStatusEnabled}
	require.NoError(t, DB.Create(&user).Error)
	sub := UserSubscription{
		UserId:              user.Id,
		AmountTotal:         total,
		AmountUsed:          used,
		Status:              "active",
		AllowWalletOverflow: allowOverflow,
	}
	require.NoError(t, DB.Create(&sub).Error)
	return user, sub
}

func TestSettleUserSubscriptionDeltaWithinRemainingQuota(t *testing.T) {
	truncateTables(t)
	user, sub := seedSubscriptionSettlement(t, 50, 100, 40, true)

	result, err := SettleUserSubscriptionDelta(sub.Id, user.Id, 30)

	require.NoError(t, err)
	assert.EqualValues(t, 30, result.SubscriptionDelta)
	assert.Zero(t, result.WalletDelta)
	require.NoError(t, DB.First(&sub, sub.Id).Error)
	assert.EqualValues(t, 70, sub.AmountUsed)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, 50, user.Quota)
}

func TestSettleUserSubscriptionDeltaOverflowsToWallet(t *testing.T) {
	truncateTables(t)
	user, sub := seedSubscriptionSettlement(t, 20, 100, 80, true)

	result, err := SettleUserSubscriptionDelta(sub.Id, user.Id, 50)

	require.NoError(t, err)
	assert.EqualValues(t, 20, result.SubscriptionDelta)
	assert.EqualValues(t, 30, result.WalletDelta)
	require.NoError(t, DB.First(&sub, sub.Id).Error)
	assert.EqualValues(t, 100, sub.AmountUsed)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, -10, user.Quota)
}

func TestSettleUserSubscriptionDeltaRejectsOverflowWhenDisabled(t *testing.T) {
	truncateTables(t)
	user, sub := seedSubscriptionSettlement(t, 20, 100, 80, false)

	_, err := SettleUserSubscriptionDelta(sub.Id, user.Id, 50)

	require.ErrorContains(t, err, "subscription used exceeds total")
	require.NoError(t, DB.First(&sub, sub.Id).Error)
	assert.EqualValues(t, 80, sub.AmountUsed)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, 20, user.Quota)
}

func TestSettleUserSubscriptionDeltaRefundOnlyTouchesSubscription(t *testing.T) {
	truncateTables(t)
	user, sub := seedSubscriptionSettlement(t, -10, 100, 80, true)

	result, err := SettleUserSubscriptionDelta(sub.Id, user.Id, -30)

	require.NoError(t, err)
	assert.EqualValues(t, -30, result.SubscriptionDelta)
	assert.Zero(t, result.WalletDelta)
	require.NoError(t, DB.First(&sub, sub.Id).Error)
	assert.EqualValues(t, 50, sub.AmountUsed)
	require.NoError(t, DB.First(&user, user.Id).Error)
	assert.Equal(t, -10, user.Quota)
}
