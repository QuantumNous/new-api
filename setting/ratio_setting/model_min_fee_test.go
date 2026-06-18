package ratio_setting

import "testing"

func TestModelMinFeeRoundTrip(t *testing.T) {
	if err := UpdateModelMinFeeByJSONString(`{"gpt-4o":0.05}`); err != nil {
		t.Fatalf("update: %v", err)
	}
	fee, ok := GetModelMinFee("gpt-4o")
	if !ok || fee != 0.05 {
		t.Fatalf("want 0.05/true, got %v/%v", fee, ok)
	}
	if _, ok := GetModelMinFee("does-not-exist"); ok {
		t.Fatal("unset model must return ok=false")
	}
	if GetModelMinFeeCopy()["gpt-4o"] != 0.05 {
		t.Fatal("copy mismatch")
	}
}
