package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCalcTaskQuotaWithRatiosUsesMappedSecondsPrice(t *testing.T) {
	original := ratio_setting.ModelPriceBySeconds2JSONString()
	originalQuotaPerUnit := common.QuotaPerUnit
	defer func() {
		_ = ratio_setting.UpdateModelPriceBySecondsByJSONString(original)
		common.QuotaPerUnit = originalQuotaPerUnit
	}()

	common.QuotaPerUnit = 500
	require.NoError(t, ratio_setting.UpdateModelPriceBySecondsByJSONString(`{
		"grok-imagine-1.0-video": {
			"12": 0.2
		}
	}`))

	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-imagine-1.0-video",
		PriceData: types.PriceData{
			BaseQuota: 100,
			Quota:     100,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 1,
			},
		},
	}

	quota, ratios := calcTaskQuotaWithRatios(nil, info, map[string]float64{
		"seconds": 12,
		"size":    1.666667,
	})

	assert.Equal(t, int(0.2*common.QuotaPerUnit), quota)
	assert.Equal(t, 1.0, ratios["seconds"])
	_, hasSize := ratios["size"]
	assert.False(t, hasSize)
	assert.Equal(t, 0.2, info.PriceData.ModelPrice)
}

func TestCalcTaskQuotaWithRatiosUsesGroupMappedSecondsPriceWithoutGroupRatio(t *testing.T) {
	original := ratio_setting.GroupModelPriceBySeconds2JSONString()
	originalQuotaPerUnit := common.QuotaPerUnit
	defer func() {
		_ = ratio_setting.UpdateGroupModelPriceBySecondsByJSONString(original)
		common.QuotaPerUnit = originalQuotaPerUnit
	}()

	common.QuotaPerUnit = 500
	require.NoError(t, ratio_setting.UpdateGroupModelPriceBySecondsByJSONString(`{
		"vip": {
			"grok-imagine-1.0-video": {
				"8": 0.07
			}
		}
	}`))

	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-imagine-1.0-video",
		UsingGroup:      "default",
		UserGroup:       "vip",
		PriceData: types.PriceData{
			BaseQuota: 100,
			Quota:     100,
			GroupRatioInfo: types.GroupRatioInfo{
				GroupRatio: 0.5,
			},
		},
	}

	quota, ratios := calcTaskQuotaWithRatios(nil, info, map[string]float64{
		"seconds": 8,
		"size":    1.666667,
	})

	assert.Equal(t, int(0.07*common.QuotaPerUnit), quota)
	assert.Equal(t, 1.0, ratios["seconds"])
	_, hasSize := ratios["size"]
	assert.False(t, hasSize)
	assert.Equal(t, 0.07, info.PriceData.ModelPrice)
	assert.True(t, info.PriceData.GroupPriceOverride)
	assert.Equal(t, "vip", info.PriceData.GroupPriceOverrideGroup)
}

func TestCalcTaskQuotaWithRatiosFallsBackToLinearSeconds(t *testing.T) {
	original := ratio_setting.ModelPriceBySeconds2JSONString()
	defer func() {
		_ = ratio_setting.UpdateModelPriceBySecondsByJSONString(original)
	}()

	require.NoError(t, ratio_setting.UpdateModelPriceBySecondsByJSONString(`{}`))

	info := &relaycommon.RelayInfo{
		OriginModelName: "grok-imagine-1.0-video",
		PriceData: types.PriceData{
			BaseQuota: 100,
			Quota:     100,
		},
	}

	quota, ratios := calcTaskQuotaWithRatios(nil, info, map[string]float64{
		"seconds": 12,
		"size":    1.5,
	})

	assert.Equal(t, 1200, quota)
	assert.Equal(t, 12.0, ratios["seconds"])
	_, hasSize := ratios["size"]
	assert.False(t, hasSize)
}
