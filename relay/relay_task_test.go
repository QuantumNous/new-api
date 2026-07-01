package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyTaskBillingRatiosPerSecondMultipliesSeconds(t *testing.T) {
	resetTaskBillingConfig(t)
	require.NoError(t, ratio_setting.UpdateTaskBillingUnitByJSONString(`{
		"seedance-480p-fast-c13": "per_second"
	}`))

	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 390,
			OtherRatios: map[string]float64{
				"seconds": 4,
			},
		},
	}

	applyTaskBillingRatios(info, "seedance-480p-fast-c13")

	assert.Equal(t, 1560, info.PriceData.Quota)
}

func TestApplyTaskBillingRatiosPerItemKeepsBaseQuota(t *testing.T) {
	resetTaskBillingConfig(t)
	require.NoError(t, ratio_setting.UpdateTaskBillingUnitByJSONString(`{
		"seedance-720p-c37": "per_item"
	}`))

	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 390,
			OtherRatios: map[string]float64{
				"seconds": 4,
			},
		},
	}

	applyTaskBillingRatios(info, "seedance-720p-c37")

	assert.Equal(t, 390, info.PriceData.Quota)
}

func TestRecalcQuotaFromRatiosPerCallKeepsBaseQuota(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 390,
			OtherRatios: map[string]float64{
				"seconds": 4,
			},
		},
	}

	quota := recalcQuotaFromRatios(info, map[string]float64{
		"seconds": 10,
		"size":    1,
	}, true)

	assert.Equal(t, 390, quota)
}

func resetTaskBillingConfig(t *testing.T) {
	t.Helper()
	original := constant.TaskPricePatches
	constant.TaskPricePatches = nil
	require.NoError(t, ratio_setting.UpdateTaskBillingUnitByJSONString("{}"))
	t.Cleanup(func() {
		constant.TaskPricePatches = original
		require.NoError(t, ratio_setting.UpdateTaskBillingUnitByJSONString("{}"))
	})
}

func TestRecalcQuotaFromRatiosNonPerCallAppliesAdjustedRatios(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
			Quota: 156,
			OtherRatios: map[string]float64{
				"seconds": 4,
			},
		},
	}

	quota := recalcQuotaFromRatios(info, map[string]float64{
		"seconds": 10,
		"size":    1,
	}, false)

	assert.Equal(t, 390, quota)
}
