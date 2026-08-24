package constant

import "testing"

func TestBytePlusChannelConstants(t *testing.T) {
	if ChannelTypeBytePlus != 107 {
		t.Fatalf("ChannelTypeBytePlus = %d, want 107", ChannelTypeBytePlus)
	}
	if ChannelTypeNames[ChannelTypeBytePlus] != "BytePlus" {
		t.Fatalf("ChannelTypeBytePlus name = %q", ChannelTypeNames[ChannelTypeBytePlus])
	}
	if len(ChannelBaseURLs) <= ChannelTypeBytePlus {
		t.Fatalf("ChannelBaseURLs missing slot for ChannelTypeBytePlus=%d", ChannelTypeBytePlus)
	}
	if ChannelBaseURLs[ChannelTypeBytePlus] != "https://ark.ap-southeast.bytepluses.com" {
		t.Fatalf("base url = %q", ChannelBaseURLs[ChannelTypeBytePlus])
	}
}
