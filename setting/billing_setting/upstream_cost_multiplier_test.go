package billing_setting

import "testing"

func TestResolveUpstreamCostMultiplier(t *testing.T) {
	ensureBillingSettingMaps()
	billingSetting.UpstreamCostMultiplier["test-model"] = 7.3
	if got := ResolveUpstreamCostMultiplier("test-model"); got != 7.3 {
		t.Fatalf("got %v want 7.3", got)
	}
	if got := ResolveUpstreamCostMultiplier("missing"); got != 1 {
		t.Fatalf("missing should default to 1, got %v", got)
	}
	delete(billingSetting.UpstreamCostMultiplier, "test-model")
}
