package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDefaultVendorMappingUsesStablePriority(t *testing.T) {
	require.Equal(t, "OpenAI", defaultVendorName("gpt-5.3-codex-spark"))
	require.Equal(t, "讯飞", defaultVendorName("spark-max"))
	require.Empty(t, defaultVendorName("private-model"))

	const modelName = "gpt-5.3-codex-spark"
	metadata := map[string]*Model{}
	initDefaultVendorMapping(
		metadata,
		map[int]*Vendor{
			1: {Id: 1, Name: "OpenAI"},
			2: {Id: 2, Name: "讯飞"},
		},
		[]AbilityWithChannel{{Ability: Ability{Model: modelName}}},
	)

	matched := metadata[modelName]
	require.NotNil(t, matched)
	require.Equal(t, 1, matched.VendorID)
}

func TestInitDefaultVendorMappingPreservesConfiguredVendor(t *testing.T) {
	configured := &Model{
		ModelName: "mimo-v2.5",
		VendorID:  136,
		Status:    1,
		NameRule:  NameRuleExact,
	}
	metadata := map[string]*Model{configured.ModelName: configured}

	initDefaultVendorMapping(
		metadata,
		map[int]*Vendor{136: {Id: 136, Name: "Xiaomi"}},
		[]AbilityWithChannel{{Ability: Ability{Model: configured.ModelName}}},
	)

	require.Same(t, configured, metadata[configured.ModelName])
	require.Equal(t, 136, metadata[configured.ModelName].VendorID)
}
