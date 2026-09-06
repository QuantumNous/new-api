package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestInitDefaultVendorMappingPrefersOpenAIForCodexSpark(t *testing.T) {
	metaMap := make(map[string]*Model)
	vendorMap := map[int]*Vendor{
		1: {Id: 1, Name: "OpenAI"},
		2: {Id: 2, Name: "讯飞"},
		3: {Id: 3, Name: "Meta"},
	}

	initDefaultVendorMapping(metaMap, vendorMap, []AbilityWithChannel{
		{Ability: Ability{Model: "gpt-5.3-codex-spark"}},
	})

	meta, ok := metaMap["gpt-5.3-codex-spark"]
	require.True(t, ok)
	require.Equal(t, 1, meta.VendorID)
}

func TestInitDefaultVendorMappingDistinguishesMuseAndXunfeiModels(t *testing.T) {
	metaMap := make(map[string]*Model)
	vendorMap := map[int]*Vendor{
		1: {Id: 1, Name: "讯飞"},
		2: {Id: 2, Name: "Meta"},
		3: {Id: 3, Name: "腾讯"},
	}

	initDefaultVendorMapping(metaMap, vendorMap, []AbilityWithChannel{
		{Ability: Ability{Model: "muse"}},
		{Ability: Ability{Model: "muse-spark-1.2"}},
		{Ability: Ability{Model: "meta-llama-3"}},
		{Ability: Ability{Model: "spark-x"}},
		{Ability: Ability{Model: "xsparkx2"}},
		{Ability: Ability{Model: "hunyuan-t1"}},
		{Ability: Ability{Model: "hy-2"}},
	})

	require.Equal(t, 2, metaMap["muse"].VendorID)
	require.Equal(t, 2, metaMap["muse-spark-1.2"].VendorID)
	require.Equal(t, 2, metaMap["meta-llama-3"].VendorID)
	require.Equal(t, 1, metaMap["spark-x"].VendorID)
	require.Equal(t, 1, metaMap["xsparkx2"].VendorID)
	require.Equal(t, 3, metaMap["hunyuan-t1"].VendorID)
	require.Equal(t, 3, metaMap["hy-2"].VendorID)
}

func TestGetDefaultVendorIconUsesMetaIcon(t *testing.T) {
	require.Equal(t, "Meta.Color", getDefaultVendorIcon("Meta"))
}
