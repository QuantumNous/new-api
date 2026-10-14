package service

import "testing"

// Log-only models (no enabled channel) must still resolve a vendor through the
// default rules instead of rendering "Unknown" on the leaderboard.
func TestModelMetaFallsBackToDefaultVendorRules(t *testing.T) {
	cases := []struct {
		model      string
		vendorName string
		vendorIcon string
	}{
		{"qwen3.5:2b", "阿里巴巴", "Qwen.Color"},
		{"glm-5.3-flash", "智谱", "Zhipu.Color"},
		{"mimo-v2.5", "小米", "XiaomiMiMo"},
		{"totally-unknown-model", "Unknown", ""},
	}
	for _, tc := range cases {
		meta := modelMeta(tc.model, map[string]rankingModelMeta{})
		if meta.vendor != tc.vendorName {
			t.Errorf("model %s vendor = %q, want %q", tc.model, meta.vendor, tc.vendorName)
		}
		if meta.vendorIcon != tc.vendorIcon {
			t.Errorf("model %s icon = %q, want %q", tc.model, meta.vendorIcon, tc.vendorIcon)
		}
	}
}

// A catalog entry (enabled channel) must keep winning over the fallback rules.
func TestModelMetaPrefersCatalogEntry(t *testing.T) {
	meta := modelMeta("qwen3.5:2b", map[string]rankingModelMeta{
		"qwen3.5:2b": {vendor: "Custom Vendor", vendorIcon: "CustomIcon"},
	})
	if meta.vendor != "Custom Vendor" || meta.vendorIcon != "CustomIcon" {
		t.Fatalf("catalog entry should win, got %q/%q", meta.vendor, meta.vendorIcon)
	}
}
