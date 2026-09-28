package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildUserGroupRatiosUsesUserOverride(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"hidden":2}`))

	setting := dto.UserSetting{GroupRatioOverrides: map[string]float64{"hidden": 0.5}}

	ratios := buildUserGroupRatios("default", setting)

	assert.Equal(t, 1.0, ratios["default"])
	assert.Equal(t, 0.5, ratios["hidden"])
}

func TestFilterPricingByUsableGroupsKeepsAllAndUsableGroups(t *testing.T) {
	originalRatios := ratio_setting.GroupRatio2JSONString()
	t.Cleanup(func() {
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalRatios))
	})
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"visible":1,"hidden":2}`))

	pricing := []model.Pricing{
		{ModelName: "all-model", EnableGroup: []string{"all"}},
		{ModelName: "visible-model", EnableGroup: []string{"visible"}},
		{ModelName: "mixed-model", EnableGroup: []string{"visible", "hidden"}},
		{ModelName: "hidden-model", EnableGroup: []string{"hidden"}},
	}

	filtered := filterPricingByUsableGroups(pricing, map[string]string{"visible": "Visible"})

	require.Len(t, filtered, 3)
	assert.Equal(t, "all-model", filtered[0].ModelName)
	assert.Equal(t, []string{"visible"}, filtered[0].EnableGroup)
	assert.Equal(t, "visible-model", filtered[1].ModelName)
	assert.Equal(t, []string{"visible"}, filtered[1].EnableGroup)
	assert.Equal(t, "mixed-model", filtered[2].ModelName)
	assert.Equal(t, []string{"visible"}, filtered[2].EnableGroup)
}
