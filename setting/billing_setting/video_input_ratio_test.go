package billing_setting

import "testing"

func TestGetVideoInputRatio(t *testing.T) {
	ensureBillingSettingMaps()
	billingSetting.VideoInputRatio["test-model"] = 0.61
	r, ok := GetVideoInputRatio("test-model")
	if !ok || r != 0.61 {
		t.Fatalf("got (%v, %v) want (0.61, true)", r, ok)
	}
	if _, ok := GetVideoInputRatio("missing"); ok {
		t.Fatal("missing model should not have ratio")
	}
	delete(billingSetting.VideoInputRatio, "test-model")
}
