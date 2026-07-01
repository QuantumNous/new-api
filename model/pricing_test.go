package model

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
)

func TestFixedPriceQuotaTypeSeedanceUsesTaskPricePatch(t *testing.T) {
	original := constant.TaskPricePatches
	t.Cleanup(func() {
		constant.TaskPricePatches = original
	})

	constant.TaskPricePatches = []string{"seedance-720p-c37"}
	requireNoError(t, ratio_setting.UpdateTaskBillingUnitByJSONString("{}"))

	assert.Equal(t, 1, fixedPriceQuotaType("seedance-720p-c37", "video,seedance,??"))
	assert.Equal(t, 2, fixedPriceQuotaType("seedance-480p-fast-c13", "video,seedance,??"))
}

func TestFixedPriceQuotaTypeTaskBillingUnitOverridesPatch(t *testing.T) {
	original := constant.TaskPricePatches
	t.Cleanup(func() {
		constant.TaskPricePatches = original
		requireNoError(t, ratio_setting.UpdateTaskBillingUnitByJSONString("{}"))
	})

	constant.TaskPricePatches = []string{"seedance-480p-fast-c13"}
	requireNoError(t, ratio_setting.UpdateTaskBillingUnitByJSONString(`{
		"seedance-480p-fast-c13": "per_second",
		"seedance-720p-c37": "per_item"
	}`))

	assert.Equal(t, 2, fixedPriceQuotaType("seedance-480p-fast-c13", "video"))
	assert.Equal(t, 1, fixedPriceQuotaType("seedance-720p-c37", "video,按秒"))
}

func TestFixedPriceQuotaTypeTagsStillSupportPerSecond(t *testing.T) {
	assert.Equal(t, 2, fixedPriceQuotaType("custom-video-model", "video,按秒"))
	assert.Equal(t, 1, fixedPriceQuotaType("custom-video-model", "video"))
}

func requireNoError(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
