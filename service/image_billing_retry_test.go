package service

import (
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

func TestPrepareImageBillingForSelectedGroupReservationAndSettlement(t *testing.T) {
	for _, tc := range []struct {
		name  string
		ratio float64
		quota int
	}{
		{"higher", 2, 100000}, {"lower", .5, 25000}, {"free", 0, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			billing := &recordingBillingSettler{preConsumedQuota: 50000}
			info := &relaycommon.RelayInfo{Billing: billing, FinalPreConsumedQuota: 50000, PriceData: hosttypes.PriceData{
				UsePrice: true, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: tc.ratio},
				ImageBilling: &hosttypes.ImageBillingDetail{BasePrice: .1, Multiplier: 1, Count: 1, GroupRatio: 1, QuotaPerUnit: 500000},
			}}
			ctx, _ := gin.CreateTestContext(nil)
			require.Nil(t, PrepareImageBillingForSelectedGroup(ctx, info))
			assert.Equal(t, max(50000, tc.quota), info.FinalPreConsumedQuota)
			assert.False(t, info.PriceData.FreeModel)
			summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{PromptTokens: 1})
			assert.Equal(t, tc.quota, summary.Quota)
		})
	}
}

func TestPrepareImageBillingForSelectedGroupStartsPaidSession(t *testing.T) {
	truncate(t)
	const userID = 701
	seedUser(t, userID, 500000)
	info := &relaycommon.RelayInfo{UserId: userID, IsPlayground: true, ForcePreConsume: true,
		UserSetting: dto.UserSetting{BillingPreference: "wallet_only"}, PriceData: hosttypes.PriceData{
			FreeModel: true, UsePrice: true, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 2},
			ImageBilling: &hosttypes.ImageBillingDetail{BasePrice: .1, Multiplier: 1, Count: 1, GroupRatio: 0, QuotaPerUnit: 500000},
		}}
	ctx, _ := gin.CreateTestContext(nil)
	require.Nil(t, PrepareImageBillingForSelectedGroup(ctx, info))
	require.NotNil(t, info.Billing)
	assert.False(t, info.PriceData.FreeModel)
	assert.Equal(t, 100000, info.FinalPreConsumedQuota)
	quota, err := model.GetUserQuota(userID, false)
	require.NoError(t, err)
	assert.Equal(t, 400000, quota)
	summary := calculateTextQuotaSummary(ctx, info, &dto.Usage{PromptTokens: 1})
	assert.Equal(t, 100000, summary.Quota)
	require.NoError(t, info.Billing.Settle(summary.Quota))
	quota, err = model.GetUserQuota(userID, false)
	require.NoError(t, err)
	assert.Equal(t, 400000, quota)
}

func TestPrepareImageBillingRejectsOversizedReservation(t *testing.T) {
	billing := &recordingBillingSettler{preConsumedQuota: 50000}
	info := &relaycommon.RelayInfo{Billing: billing, PriceData: hosttypes.PriceData{
		GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 1e20},
		ImageBilling:   &hosttypes.ImageBillingDetail{BasePrice: .1, Multiplier: 1, Count: 1, GroupRatio: 1, QuotaPerUnit: 500000},
	}}
	require.NotNil(t, PrepareImageBillingForSelectedGroup(nil, info))
	assert.Empty(t, billing.reserveTargets)
}

func TestPrepareImageBillingRejectsUnaffordablePaidRetry(t *testing.T) {
	truncate(t)
	const userID = 702
	seedUser(t, userID, 50000)
	info := &relaycommon.RelayInfo{UserId: userID, IsPlayground: true, ForcePreConsume: true,
		UserSetting: dto.UserSetting{BillingPreference: "wallet_only"}, PriceData: hosttypes.PriceData{
			FreeModel: true, UsePrice: true, GroupRatioInfo: hosttypes.GroupRatioInfo{GroupRatio: 2},
			ImageBilling: &hosttypes.ImageBillingDetail{BasePrice: .1, Multiplier: 1, Count: 1, GroupRatio: 0, QuotaPerUnit: 500000},
		}}
	ctx, _ := gin.CreateTestContext(nil)
	require.NotNil(t, PrepareImageBillingForSelectedGroup(ctx, info))
	assert.Nil(t, info.Billing)
	quota, err := model.GetUserQuota(userID, false)
	require.NoError(t, err)
	assert.Equal(t, 50000, quota)
}
