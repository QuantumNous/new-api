package constant

import "testing"

func TestTechMobiVideoChannelConstants(t *testing.T) {
	if ChannelTypeTechMobiVideo != 105 {
		t.Fatalf("ChannelTypeTechMobiVideo = %d, want 105", ChannelTypeTechMobiVideo)
	}
	if ChannelTypeNames[ChannelTypeTechMobiVideo] != "TechMobiVideo" {
		t.Fatalf("ChannelTypeTechMobiVideo name = %q", ChannelTypeNames[ChannelTypeTechMobiVideo])
	}
	if len(ChannelBaseURLs) <= ChannelTypeTechMobiVideo {
		t.Fatalf("ChannelBaseURLs missing slot for ChannelTypeTechMobiVideo=%d", ChannelTypeTechMobiVideo)
	}
	if ChannelBaseURLs[ChannelTypeTechMobiVideo] != "https://api.chatgpttech.mobi" {
		t.Fatalf("base url = %q", ChannelBaseURLs[ChannelTypeTechMobiVideo])
	}
}
