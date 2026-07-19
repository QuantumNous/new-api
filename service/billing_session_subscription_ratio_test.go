package service

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdjustQuotaToSubscriptionBaseRate(t *testing.T) {
	assert.Equal(t, 0, adjustQuotaToSubscriptionBaseRate(0, 2))
	assert.Equal(t, 100, adjustQuotaToSubscriptionBaseRate(100, 1))
	assert.Equal(t, 100, adjustQuotaToSubscriptionBaseRate(100, 0))
	assert.Equal(t, 50, adjustQuotaToSubscriptionBaseRate(100, 2))
	assert.Equal(t, 200, adjustQuotaToSubscriptionBaseRate(100, 0.5))
	// tiny positive remains positive
	assert.Equal(t, 1, adjustQuotaToSubscriptionBaseRate(1, 100))
}

func TestApplyAndRestoreSubscriptionBaseGroupRatio(t *testing.T) {
	relayInfo := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			QuotaToPreConsume: 200,
			Quota:             400,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio:        2,
				GroupSpecialRatio: 2,
				HasSpecialRatio:   true,
			},
		},
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			GroupRatio:               2,
			EstimatedQuotaAfterGroup: 200,
		},
	}

	state := applySubscriptionBaseGroupRatio(relayInfo)
	assert.Equal(t, subscriptionBillingGroupRatio, relayInfo.PriceData.GroupRatioInfo.GroupRatio)
	assert.False(t, relayInfo.PriceData.GroupRatioInfo.HasSpecialRatio)
	assert.Equal(t, 100, relayInfo.PriceData.QuotaToPreConsume)
	assert.Equal(t, 200, relayInfo.PriceData.Quota)
	require.NotNil(t, relayInfo.TieredBillingSnapshot)
	assert.Equal(t, subscriptionBillingGroupRatio, relayInfo.TieredBillingSnapshot.GroupRatio)
	assert.Equal(t, 100, relayInfo.TieredBillingSnapshot.EstimatedQuotaAfterGroup)

	restoreWalletGroupRatio(relayInfo, state)
	assert.Equal(t, 2.0, relayInfo.PriceData.GroupRatioInfo.GroupRatio)
	assert.True(t, relayInfo.PriceData.GroupRatioInfo.HasSpecialRatio)
	assert.Equal(t, 200, relayInfo.PriceData.QuotaToPreConsume)
	assert.Equal(t, 400, relayInfo.PriceData.Quota)
	assert.Equal(t, 2.0, relayInfo.TieredBillingSnapshot.GroupRatio)
	assert.Equal(t, 200, relayInfo.TieredBillingSnapshot.EstimatedQuotaAfterGroup)
}
