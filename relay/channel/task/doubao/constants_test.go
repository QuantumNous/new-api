package doubao

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// Every model advertised in ModelList is one an admin can enable on a
// DoubaoVideo (type 54) / VolcEngine (type 45) channel. Video task submission
// prices via ModelPriceHelperPerCall → per-call price, then falls back to the
// model ratio; if neither is configured, the request is rejected with
// "价格未配置 / price not configured" whenever self-use mode is off.
//
// This guards against the recurring class of bug where a new Seedance model is
// added to ModelList but forgotten in defaultModelRatio (same class as
// setting/ratio_setting/ratio_consistency_test.go).
func TestDoubaoVideoModelListHasPricing(t *testing.T) {
	ratio_setting.InitRatioSettings()

	var missing []string
	for _, name := range ModelList {
		if _, _, exist := ratio_setting.GetModelRatioOrPrice(name); !exist {
			missing = append(missing, name)
		}
	}

	if len(missing) > 0 {
		t.Fatalf("%d Seedance model(s) in ModelList have neither a model ratio nor "+
			"a per-call price (would fail with 价格未配置). Add them to "+
			"defaultModelRatio or defaultModelPrice: %v", len(missing), missing)
	}
}

// videoInputRatioMap entries must reference models that actually exist in
// ModelList — a typo'd key would silently disable the video-input discount.
func TestVideoInputRatioKeysAreInModelList(t *testing.T) {
	known := map[string]struct{}{}
	for _, name := range ModelList {
		known[name] = struct{}{}
	}
	for name := range videoInputRatioMap {
		if _, ok := known[name]; !ok {
			t.Errorf("videoInputRatioMap key %q is not in ModelList", name)
		}
	}
}
