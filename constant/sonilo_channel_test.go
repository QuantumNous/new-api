package constant

import "testing"

func TestSoniloChannelRegistration(t *testing.T) {
	if ChannelTypeSonilo != 109 {
		t.Fatalf("ChannelTypeSonilo = %d, want 109", ChannelTypeSonilo)
	}
	if ChannelTypeNames[ChannelTypeSonilo] != "Sonilo" {
		t.Fatalf("channel name = %q", ChannelTypeNames[ChannelTypeSonilo])
	}
	if len(ChannelBaseURLs) <= ChannelTypeSonilo || ChannelBaseURLs[ChannelTypeSonilo] != "https://api.sonilo.com" {
		t.Fatalf("base URL is not registered for Sonilo")
	}
}
