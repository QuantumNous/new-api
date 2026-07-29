package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFilterPricingByUsableGroupsTrimsEnableGroups(t *testing.T) {
	pricing := []model.Pricing{
		{ModelName: "model-mixed", EnableGroup: []string{"default", "internal"}},
		{ModelName: "model-internal-only", EnableGroup: []string{"internal"}},
		{ModelName: "model-all", EnableGroup: []string{"all", "internal"}},
	}
	usableGroup := map[string]string{"default": "default group"}

	filtered := filterPricingByUsableGroups(pricing, usableGroup)

	require.Len(t, filtered, 2)

	assert.Equal(t, "model-mixed", filtered[0].ModelName)
	assert.Equal(t, []string{"default"}, filtered[0].EnableGroup,
		"groups outside the user's usable groups must not be exposed")

	assert.Equal(t, "model-all", filtered[1].ModelName)
	assert.Equal(t, []string{"all", "internal"}, filtered[1].EnableGroup,
		"entries enabled for all groups keep their original group list")

	assert.Equal(t, []string{"default", "internal"}, pricing[0].EnableGroup,
		"the shared pricing cache must stay untouched")
}

func TestFilterPricingByUsableGroupsEmptyInputs(t *testing.T) {
	pricing := []model.Pricing{
		{ModelName: "model-a", EnableGroup: []string{"default"}},
	}

	assert.Empty(t, filterPricingByUsableGroups(pricing, map[string]string{}))
	assert.Empty(t, filterPricingByUsableGroups(nil, map[string]string{"default": ""}))
}
