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

	quota, ratios := calcTaskQuotaWithRatios(info, map[string]float64{
		"seconds": 12,
		"size":    1.666667,
	})

	assert.Equal(t, int(0.2*common.QuotaPerUnit*1.666667), quota)
	assert.Equal(t, 1.0, ratios["seconds"])
	assert.Equal(t, 1.666667, ratios["size"])
	assert.Equal(t, 0.2, info.PriceData.ModelPrice)
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

	quota, ratios := calcTaskQuotaWithRatios(info, map[string]float64{
		"seconds": 12,
		"size":    1.5,
	})

	assert.Equal(t, 1800, quota)
	assert.Equal(t, 12.0, ratios["seconds"])
	assert.Equal(t, 1.5, ratios["size"])
}
