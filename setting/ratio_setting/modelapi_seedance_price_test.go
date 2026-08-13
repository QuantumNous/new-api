package ratio_setting

import "testing"

func TestModelAPISeedanceDefaultPrice(t *testing.T) {
	const model = "doubao-seedance-2-5-260628"

	got := GetDefaultModelPriceMap()[model]
	if got != 0.14 {
		t.Fatalf("default model price for %s = %v, want 0.14", model, got)
	}
}
