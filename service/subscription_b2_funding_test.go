package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// B2 funding-source level tests (subscription vs hybrid partial).
// Full BillingSession needs gin context + RelayInfo; we cover FundingSource contracts here.

func TestB2_SubscriptionFunding_PreConsumeAndRefund(t *testing.T) {
	truncate(t)

	const userID = 9001
	seedUser(t, userID, 0)

	now := time.Now().Unix()
	plan := &model.SubscriptionPlan{
		Title: "svc-sub-fund", DurationUnit: model.SubscriptionDurationDay, DurationValue: 30,
		TotalAmount: 10000, ActivationMode: model.SubscriptionActivationImmediate,
		Enabled: true, WindowLimit24h: 5000, CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, model.DB.Create(plan).Error)
	sub, err := model.CreateUserSubscriptionFromPlanTx(model.DB, userID, plan, "order")
	require.NoError(t, err)

	fund := &SubscriptionFunding{
		requestId: "svc-sub-" + common.GetRandomString(6),
		userId:    userID,
		modelName: "gpt-4",
		group:     "",
		amount:    300,
	}
	require.NoError(t, fund.PreConsume(0))
	assert.Equal(t, sub.Id, fund.subscriptionId)
	assert.Equal(t, int64(300), fund.preConsumed)
	assert.Equal(t, BillingSourceSubscription, fund.Source())

	require.NoError(t, fund.Refund())
	assert.Equal(t, int64(0), getSubscriptionUsed(t, sub.Id))
}

func TestB2_HybridFunding_PartialSubscriptionThenWallet(t *testing.T) {
	truncate(t)

	const userID = 9002
	const walletInit = 10000
	seedUser(t, userID, walletInit)

	now := time.Now().Unix()
	plan := &model.SubscriptionPlan{
		Title: "svc-hybrid", DurationUnit: model.SubscriptionDurationDay, DurationValue: 30,
		TotalAmount: 100, ActivationMode: model.SubscriptionActivationImmediate,
		Enabled: true, CreatedAt: now, UpdatedAt: now,
	}
	require.NoError(t, model.DB.Create(plan).Error)
	_, err := model.CreateUserSubscriptionFromPlanTx(model.DB, userID, plan, "order")
	require.NoError(t, err)

	reqId := "svc-hyb-" + common.GetRandomString(6)
	hyb := &HybridFunding{
		subscription: &SubscriptionFunding{
			requestId: reqId,
			userId:    userID,
			modelName: "gpt-4",
			group:     "",
			amount:    250, // more than sub total 100
		},
		wallet: &WalletFunding{userId: userID},
	}
	require.NoError(t, hyb.PreConsume(250))
	// subscription takes 100, wallet takes 150
	assert.Equal(t, int64(100), getSubscriptionUsed(t, hyb.subscription.subscriptionId))
	assert.Equal(t, walletInit-150, getUserQuota(t, userID))

	require.NoError(t, hyb.Refund())
	assert.Equal(t, int64(0), getSubscriptionUsed(t, hyb.subscription.subscriptionId))
	assert.Equal(t, walletInit, getUserQuota(t, userID))
}

func TestB2_WalletFunding_Only(t *testing.T) {
	truncate(t)
	const userID = 9003
	seedUser(t, userID, 5000)

	w := &WalletFunding{userId: userID}
	require.NoError(t, w.PreConsume(400))
	assert.Equal(t, 4600, getUserQuota(t, userID))
	require.NoError(t, w.Refund())
	assert.Equal(t, 5000, getUserQuota(t, userID))
}
