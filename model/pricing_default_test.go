package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The default vendor mapping must resolve current vendor model codes, otherwise
// the pricing page and rankings show an empty vendor / Unknown.
func TestInitDefaultVendorMappingResolvesVendors(t *testing.T) {
	cases := []struct {
		model      string
		vendorName string
	}{
		{"mimo-v2.6-flash", "小米"},
		{"Xiaomi/MiMo-V2.6-Flash", "小米"},
		{"mimo-v2.6-pro-ultraspeed", "小米"},
		{"hy3", "腾讯"},
		{"hy4-preview", "腾讯"},
		{"step-5-preview", "阶跃星辰"},
		{"stepfun/step-5-preview", "阶跃星辰"},
		{"ling-3.1-flash", "蚂蚁百灵"},
		{"ling-3.0-flash-vl", "蚂蚁百灵"},
		{"jt-4.1-flash-236b-a21b", "中国移动"},
		{"nex-n2-pro", "Nex AGI"},
		{"muse-wonder-full", "Meta"},
		{"muse-spark-1.3", "Meta"},
		{"deepseek-v4.1-flash", "DeepSeek"},
	}

	metaMap := make(map[string]*Model)
	vendorMap := make(map[int]*Vendor)
	abilities := make([]AbilityWithChannel, 0, len(cases)+1)
	for _, tc := range cases {
		abilities = append(abilities, AbilityWithChannel{Ability: Ability{Model: tc.model}})
	}
	abilities = append(abilities, AbilityWithChannel{Ability: Ability{Model: "totally-unknown-model"}})

	initDefaultVendorMapping(metaMap, vendorMap, abilities)

	for _, tc := range cases {
		meta, ok := metaMap[tc.model]
		require.True(t, ok, "model %s should get default metadata", tc.model)
		vendor, ok := vendorMap[meta.VendorID]
		require.True(t, ok, "model %s should resolve to a vendor", tc.model)
		assert.Equal(t, tc.vendorName, vendor.Name, "model %s", tc.model)
	}

	// MiMo is the icon assertion that guards the LobeHub icon key spelling.
	mimo := metaMap["mimo-v2.6-flash"]
	require.NotNil(t, mimo)
	assert.Equal(t, "XiaomiMiMo", vendorMap[mimo.VendorID].Icon)

	// Unmatched models stay on the default vendor instead of a fabricated one.
	assert.Zero(t, metaMap["totally-unknown-model"].VendorID)
}

// Every vendor registered with a default display ID must have an icon entry,
// even when the icon name is empty, so lookups never fall through.
func TestDefaultVendorIconsCoverDisplayIDs(t *testing.T) {
	for name, id := range defaultVendorDisplayIDs {
		if _, ok := defaultVendorIcons[name]; !ok {
			t.Errorf("default vendor %q (id %d) has no icon mapping", name, id)
		}
	}
}
