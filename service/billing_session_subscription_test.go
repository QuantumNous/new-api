package service

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBillingSessionSettleSplitsSubscriptionOverflowAndWallet(t *testing.T) {
	truncate(t)
	user := model.User{Id: 801, Username: "subscription-overflow", Quota: 20, Status: common.UserStatusEnabled}
	require.NoError(t, model.DB.Create(&user).Error)
	sub := model.UserSubscription{
		Id:                  802,
		UserId:              user.Id,
		AmountTotal:         100,
		AmountUsed:          80,
		Status:              "active",
		StartTime:           time.Now().Add(-time.Hour).Unix(),
		EndTime:             time.Now().Add(time.Hour).Unix(),
		AllowWalletOverflow: true,
	}
	require.NoError(t, model.DB.Create(&sub).Error)

	relayInfo := &relaycommon.RelayInfo{
		UserId:                                user.Id,
		IsPlayground:                          true,
		BillingSource:                         BillingSourceSubscription,
		SubscriptionId:                        sub.Id,
		SubscriptionPreConsumed:               20,
		SubscriptionAmountTotal:               100,
		SubscriptionAmountUsedAfterPreConsume: 80,
	}
	session := &BillingSession{
		relayInfo:        relayInfo,
		funding:          &SubscriptionFunding{userId: user.Id, subscriptionId: sub.Id, preConsumed: 20},
		preConsumedQuota: 20,
	}

	require.NoError(t, session.Settle(70))
	assert.EqualValues(t, 20, relayInfo.SubscriptionPostDelta)
	assert.EqualValues(t, 30, relayInfo.WalletQuotaDeducted)

	other := map[string]interface{}{}
	appendBillingInfo(relayInfo, other)
	assert.EqualValues(t, 40, other["subscription_consumed"])
	assert.EqualValues(t, 30, other["wallet_quota_deducted"])
	assert.EqualValues(t, 100, other["subscription_used"])
	assert.EqualValues(t, 0, other["subscription_remain"])

	require.NoError(t, model.DB.First(&sub, sub.Id).Error)
	assert.EqualValues(t, 100, sub.AmountUsed)
	require.NoError(t, model.DB.First(&user, user.Id).Error)
	assert.Equal(t, -10, user.Quota)
}
