package constant

import "testing"

func TestCopilotChannelRegistration(t *testing.T) {
	if ChannelTypeCopilot != 112 {
		t.Fatalf("ChannelTypeCopilot = %d, want 112", ChannelTypeCopilot)
	}
	if ChannelTypeDummy <= ChannelTypeCopilot {
		t.Fatalf("ChannelTypeDummy = %d, want after Copilot", ChannelTypeDummy)
	}
	if got := ChannelBaseURLs[ChannelTypeCopilot]; got != "https://api.githubcopilot.com" {
		t.Fatalf("Copilot base URL = %q", got)
	}
	if got := GetChannelTypeName(ChannelTypeCopilot); got != "Copilot" {
		t.Fatalf("Copilot channel name = %q", got)
	}
}
