package constant

import "testing"

func TestMiniMaxH3ChannelConstants(t *testing.T) {
	if ChannelTypeMiniMaxH3 != 110 {
		t.Fatalf("ChannelTypeMiniMaxH3 = %d, want 110", ChannelTypeMiniMaxH3)
	}
	if got := ChannelBaseURLs[ChannelTypeMiniMaxH3]; got != "https://api.minimax.io" {
		t.Fatalf("ChannelBaseURLs[ChannelTypeMiniMaxH3] = %q, want %q", got, "https://api.minimax.io")
	}
	if got := ChannelTypeNames[ChannelTypeMiniMaxH3]; got != "MiniMaxH3" {
		t.Fatalf("ChannelTypeNames[ChannelTypeMiniMaxH3] = %q, want %q", got, "MiniMaxH3")
	}
}
