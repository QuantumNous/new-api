package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAttachUpstreamCostConvertsBilledUnitsToCNY(t *testing.T) {
	rate := 0.495
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelOtherSettings: dto.ChannelOtherSettings{
				UpstreamCostMode:         dto.UpstreamCostModeBillingUnits,
				UpstreamCostUnit:         "CREDIT",
				UpstreamCostRateCNY:      &rate,
				UpstreamCostPriceVersion: "yunwu-2026-07",
			},
		},
	}
	quota := int(0.011682 * common.QuotaPerUnit)
	other := map[string]interface{}{
		"admin_info": map[string]interface{}{"use_channel": []int{36}},
	}

	AttachUpstreamCost(info, quota, other)

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, []int{36}, adminInfo["use_channel"])
	cost, ok := adminInfo["upstream_cost"].(*dto.UpstreamCostSnapshot)
	require.True(t, ok)
	assert.Equal(t, dto.UpstreamCostStatusSettled, cost.Status)
	assert.Equal(t, dto.UpstreamCostSourceBillingUnits, cost.Source)
	assert.Equal(t, "CREDIT", cost.NativeUnit)
	assert.Equal(t, "yunwu-2026-07", cost.PriceVersion)
	assert.True(t, cost.Estimated)
	assert.InDelta(t, 0.011682, cost.Units, 1e-12)
	assert.InDelta(t, 0.495, cost.RateCNYPerUnit, 1e-12)
	assert.InDelta(t, 0.00578259, cost.AmountCNY, 1e-12)
	assert.Equal(t, int64(5783), cost.AmountCNYMicros)
}

func TestAttachUpstreamCostMarksMissingChannelProfileUnpriced(t *testing.T) {
	other := map[string]interface{}{}

	AttachUpstreamCost(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}, 100, other)

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	cost, ok := adminInfo["upstream_cost"].(*dto.UpstreamCostSnapshot)
	require.True(t, ok)
	assert.Equal(t, dto.UpstreamCostStatusUnpriced, cost.Status)
	assert.Equal(t, "missing_channel_cost_profile", cost.Reason)
}

func TestAttachUpstreamCostExcludesCustomerGroupRatio(t *testing.T) {
	rate := 0.495
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelOtherSettings: dto.ChannelOtherSettings{
				UpstreamCostRateCNY: &rate,
			},
		},
	}
	other := map[string]interface{}{"group_ratio": 2.0}
	quota := int(0.011682 * 2 * common.QuotaPerUnit)

	AttachUpstreamCost(info, quota, other)

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	cost, ok := adminInfo["upstream_cost"].(*dto.UpstreamCostSnapshot)
	require.True(t, ok)
	assert.InDelta(t, 0.011682, cost.Units, 1e-12)
	assert.InDelta(t, 0.00578259, cost.AmountCNY, 1e-12)
}

func TestAttachUpstreamCostAutoPrefersAuthoritativeResponseCost(t *testing.T) {
	rate := 7.2
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelOtherSettings: dto.ChannelOtherSettings{
				UpstreamCostMode:    dto.UpstreamCostModeAuto,
				UpstreamCostUnit:    "USD",
				UpstreamCostRateCNY: &rate,
			},
		},
	}
	usage := &dto.Usage{Cost: "0.0125"}
	other := map[string]interface{}{"group_ratio": 9.0}

	AttachUpstreamCostWithUsage(info, usage, int(common.QuotaPerUnit), other)

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	cost, ok := adminInfo["upstream_cost"].(*dto.UpstreamCostSnapshot)
	require.True(t, ok)
	assert.Equal(t, dto.UpstreamCostStatusSettled, cost.Status)
	assert.Equal(t, dto.UpstreamCostSourceResponseCost, cost.Source)
	assert.False(t, cost.Estimated)
	assert.InDelta(t, 0.0125, cost.NativeAmount, 1e-12)
	assert.InDelta(t, 0.09, cost.AmountCNY, 1e-12)
	assert.Equal(t, int64(90_000), cost.AmountCNYMicros)
}

func TestAttachUpstreamCostResponseModeMarksMissingCostUnpriced(t *testing.T) {
	rate := 7.2
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelOtherSettings: dto.ChannelOtherSettings{
				UpstreamCostMode:    dto.UpstreamCostModeResponseCost,
				UpstreamCostUnit:    "USD",
				UpstreamCostRateCNY: &rate,
			},
		},
	}
	other := map[string]interface{}{}

	AttachUpstreamCostWithUsage(info, &dto.Usage{}, 100, other)

	adminInfo, ok := other["admin_info"].(map[string]interface{})
	require.True(t, ok)
	cost, ok := adminInfo["upstream_cost"].(*dto.UpstreamCostSnapshot)
	require.True(t, ok)
	assert.Equal(t, dto.UpstreamCostStatusUnpriced, cost.Status)
	assert.Equal(t, "missing_response_cost", cost.Reason)
	assert.Zero(t, cost.AmountCNYMicros)
}
