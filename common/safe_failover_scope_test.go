package common

import "testing"

func TestIsScopedGPTTestSafeFailoverFailsClosed(t *testing.T) {
	oldEnabled, oldGroup, oldToken := SafeFailoverGPTTestEnabled, SafeFailoverGPTTestGroup, SafeFailoverGPTTestTokenID
	defer func() {
		SafeFailoverGPTTestEnabled, SafeFailoverGPTTestGroup, SafeFailoverGPTTestTokenID = oldEnabled, oldGroup, oldToken
	}()
	SafeFailoverGPTTestEnabled, SafeFailoverGPTTestGroup, SafeFailoverGPTTestTokenID = true, "gpt-failover-iso-20260812", 42
	for _, tc := range []struct {
		model, group string
		token        int
		want         bool
	}{
		{"gpt-5.5", "gpt-failover-iso-20260812", 42, true},
		{"gpt-5.5", "gpt-failover-iso-20260812", 41, false},
		{"gpt-5.5", "default", 42, false},
		{"gpt-5.4", "gpt-failover-iso-20260812", 42, false},
	} {
		if got := IsScopedGPTTestSafeFailover(tc.model, tc.group, tc.token); got != tc.want {
			t.Fatalf("scope(%q,%q,%d)=%t want %t", tc.model, tc.group, tc.token, got, tc.want)
		}
	}
}
