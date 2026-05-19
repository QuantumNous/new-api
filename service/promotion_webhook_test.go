package service

import "testing"

func TestGeneratePartnershipEventSignature(t *testing.T) {
	body := []byte(`{"event_id":"evt_test","payload":{"x":1}}`)
	got := generatePartnershipEventSignature("1716000000", "local-partnership-event-secret", body)
	want := "abd660d45319f582f8991521b5509f9a585c4240f2643695f05ed6b72243dcba"
	if got != want {
		t.Fatalf("unexpected signature: got %s want %s", got, want)
	}
}
