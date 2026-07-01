package ratio_setting

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTaskBillingUnitExplicitConfigOverridesTaskPricePatch(t *testing.T) {
	original := constant.TaskPricePatches
	t.Cleanup(func() {
		constant.TaskPricePatches = original
		require.NoError(t, UpdateTaskBillingUnitByJSONString("{}"))
	})

	constant.TaskPricePatches = []string{"seedance-480p-fast-c13"}
	require.NoError(t, UpdateTaskBillingUnitByJSONString(`{
		"seedance-480p-fast-c13": "per_second",
		"seedance-720p-c37": "per_item"
	}`))

	assert.False(t, IsTaskPerItemBilling("seedance-480p-fast-c13"))
	assert.True(t, IsTaskPerSecondBilling("seedance-480p-fast-c13"))
	assert.True(t, IsTaskPerItemBilling("seedance-720p-c37"))
	assert.False(t, IsTaskPerSecondBilling("seedance-720p-c37"))
}

func TestTaskBillingUnitFallsBackToTaskPricePatch(t *testing.T) {
	original := constant.TaskPricePatches
	t.Cleanup(func() {
		constant.TaskPricePatches = original
		require.NoError(t, UpdateTaskBillingUnitByJSONString("{}"))
	})

	constant.TaskPricePatches = []string{"seedance-720p-c37"}
	require.NoError(t, UpdateTaskBillingUnitByJSONString("{}"))

	assert.True(t, IsTaskPerItemBilling("seedance-720p-c37"))
	assert.False(t, IsTaskPerSecondBilling("seedance-720p-c37"))
}

func TestTaskBillingUnitFallsBackToSeedancePerSecond(t *testing.T) {
	original := constant.TaskPricePatches
	t.Cleanup(func() {
		constant.TaskPricePatches = original
		require.NoError(t, UpdateTaskBillingUnitByJSONString("{}"))
	})

	constant.TaskPricePatches = []string{"seedance-720p-c37"}
	require.NoError(t, UpdateTaskBillingUnitByJSONString("{}"))

	assert.False(t, IsTaskPerItemBilling("seedance-480p-fast-c13"))
	assert.True(t, IsTaskPerSecondBilling("seedance-480p-fast-c13"))
}
