package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// TestModelRatioConversion locks the conversion factor between DeepRouter's
// internal model_ratio units and smart-router's per-1M-USD schema. Numbers
// come from authoritative comments in setting/ratio_setting/model_ratio.go.
//
// If this test breaks, it means either:
//   - upstream changed the meaning of model_ratio (audit setting/ratio_setting/),
//   - or someone changed modelRatioToPerMillionUSD without updating these
//     ground-truth values.
//
// Smart-router's cost-constraint filters depend on this conversion being
// correct; an off-by-500× bug silently invalidates every cost-based decision.
func TestModelRatioConversion(t *testing.T) {
	cases := []struct {
		ratio   float64
		want1M  float64
		comment string
	}{
		{1.0, 2.0, "$0.002/1k = $2/1M"},
		{1.25, 2.5, "gpt-4o → $2.5/1M"},
		{2.5, 5.0, "chatgpt-4o-latest → $5/1M"},
		{5.0, 10.0, "gpt-4-1106-preview → $10/1M"},
		{15.0, 30.0, "gpt-4 → $30/1M"},
		{0.075, 0.15, "haiku-class → $0.15/1M"},
	}
	for _, tc := range cases {
		got := tc.ratio * modelRatioToPerMillionUSD
		if math.Abs(got-tc.want1M) > 0.0001 {
			t.Errorf("ratio %g (%s): got $%g/1M want $%g/1M", tc.ratio, tc.comment, got, tc.want1M)
		}
	}
}

// TestGetModelRatio_KnownDefaults verifies that defaults shipped in
// setting/ratio_setting/model_ratio.go match the inline comments. Stops
// silent drift if upstream changes a ratio without updating the comment.
func TestGetModelRatio_KnownDefaults(t *testing.T) {
	cases := []struct {
		model        string
		wantPer1MUSD float64
		comment      string
	}{
		{"gpt-4o", 2.5, "$2.5/1M"},
		{"gpt-4", 30.0, "$30/1M"},
	}
	defaults := ratio_setting.GetDefaultModelRatioMap()
	for _, tc := range cases {
		ratio, ok := defaults[tc.model]
		if !ok {
			t.Errorf("upstream removed %s from defaultModelRatio", tc.model)
			continue
		}
		got := ratio * modelRatioToPerMillionUSD
		if math.Abs(got-tc.wantPer1MUSD) > 0.0001 {
			t.Errorf("%s: ratio %g → $%g/1M, expected $%g/1M (%s)",
				tc.model, ratio, got, tc.wantPer1MUSD, tc.comment)
		}
	}
}
