package setting

import "testing"

func TestDefaultUserUsableGroupsAreEnglish(t *testing.T) {
	groups := GetUserUsableGroupsCopy()

	if groups["default"] != "Default" {
		t.Fatalf("expected default group description to be Default, got %q", groups["default"])
	}
	if groups["vip"] != "VIP" {
		t.Fatalf("expected vip group description to be VIP, got %q", groups["vip"])
	}
}
