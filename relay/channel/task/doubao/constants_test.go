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

// Seedance 2.5 generates up to 30s per segment — 6x the ~5s clip length the
// flat per-call prices in defaultModelPrice were measured against. It must
// therefore bill by token ratio, which only happens when the model has a model
// ratio and NO per-call price: GetModelPrice is consulted first
// (ModelPriceHelperPerCall), and a per-call charge is never re-settled against
// actual usage (settleTaskBillingOnComplete skips PerCallBilling tasks).
//
// So "someone helpfully added Seedance 2.5 to defaultModelPrice" is a silent
// revenue leak on every long generation, not a visible failure. Hence this test.
func TestSeedance25IsRatioBilledNotPerCall(t *testing.T) {
	ratio_setting.InitRatioSettings()

	const model = "doubao-seedance-2-5-260628"

	if price, usePrice := ratio_setting.GetModelPrice(model, false); usePrice {
		t.Errorf("%s has a per-call price (%v) — it must be priced by token ratio "+
			"because it supports 30s segments; remove it from defaultModelPrice", model, price)
	}
	ratio, found, _ := ratio_setting.GetModelRatio(model)
	if !found {
		t.Fatalf("%s has no model ratio — token-based settlement needs one", model)
	}
	// $10.85 per 1M tokens ÷ ($0.002 per 1K) = 5.425
	if ratio != 5.425 {
		t.Errorf("%s model ratio = %v, want 5.425 ($10.85/1M no-video-input rate)", model, ratio)
	}
	// The discount for requests that include video input is applied on top as an
	// OtherRatio, so the ratio above must be the higher no-video figure.
	got, ok := GetVideoInputRatio(model)
	if !ok {
		t.Fatalf("%s missing from videoInputRatioMap — video-input requests would "+
			"be billed at the higher no-video rate", model)
	}
	if want := 6.51 / 10.85; got != want {
		t.Errorf("%s video-input ratio = %v, want %v ($6.51 vs $10.85 per 1M)", model, got, want)
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
