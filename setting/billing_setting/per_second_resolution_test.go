package billing_setting

import "testing"

func TestNormalizeResolutionTier(t *testing.T) {
	t.Parallel()
	cases := []struct {
		in   string
		want string
	}{
		{"", ResolutionTierOther},
		{"720p", ResolutionTier720p},
		{"720P", ResolutionTier720p},
		{"1080", ResolutionTier1080p},
		{"4K", ResolutionTier4K},
		{"2160p", ResolutionTier4K},
		{"1280x720", ResolutionTier720p},
		{"1280*720", ResolutionTier720p},
		{"1920×1080", ResolutionTier1080p},
		{"3840x2160", ResolutionTier4K},
		{"720x1280", ResolutionTier720p},
		{"weird", ResolutionTierOther},
	}
	for _, tc := range cases {
		if got := NormalizeResolutionTier(tc.in); got != tc.want {
			t.Fatalf("NormalizeResolutionTier(%q)=%q want %q", tc.in, got, tc.want)
		}
	}
}

func TestResolvePerSecondPrice(t *testing.T) {
	t.Parallel()
	prices := PerSecondResolutionPrice{
		ResolutionTier480p:  0.3,
		ResolutionTier720p:  0.6,
		ResolutionTier1080p: 1.2,
		ResolutionTier4K:    2.4,
		ResolutionTierOther: 3.0,
	}
	p, tier := ResolvePerSecondPrice(prices, "720p", 0.1)
	if p != 0.6 || tier != ResolutionTier720p {
		t.Fatalf("got price=%v tier=%s", p, tier)
	}
	p, tier = ResolvePerSecondPrice(prices, "360p", 0.1)
	if p != 3.0 || tier != ResolutionTierOther {
		t.Fatalf("fallback other: got price=%v tier=%s", p, tier)
	}
	// missing 4k tier → other
	partial := PerSecondResolutionPrice{
		ResolutionTier480p:  0.3,
		ResolutionTierOther: 3.0,
	}
	p, tier = ResolvePerSecondPrice(partial, "4k", 0.1)
	if p != 3.0 || tier != ResolutionTierOther {
		t.Fatalf("missing tier should use other: got price=%v tier=%s", p, tier)
	}
}

func TestGetPerSecondResolutionPriceRequiresOther(t *testing.T) {
	ensureBillingSettingMaps()
	ensurePerSecondResolutionPriceMap()
	billingSetting.PerSecondResolutionPrice["m1"] = PerSecondResolutionPrice{
		ResolutionTier480p: 0.3,
		// no other
	}
	if _, ok := GetPerSecondResolutionPrice("m1"); ok {
		t.Fatal("should reject table without other")
	}
	billingSetting.PerSecondResolutionPrice["m1"] = PerSecondResolutionPrice{
		ResolutionTier480p:  0.3,
		ResolutionTierOther: 3.0,
	}
	if _, ok := GetPerSecondResolutionPrice("m1"); !ok {
		t.Fatal("should accept table with other")
	}
	delete(billingSetting.PerSecondResolutionPrice, "m1")
}
