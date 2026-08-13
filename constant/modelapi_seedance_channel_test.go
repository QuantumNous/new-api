package constant

import "testing"

func TestModelAPISeedanceChannelRegistration(t *testing.T) {
	if ChannelTypeModelAPISeedance != 111 {
		t.Fatalf("ChannelTypeModelAPISeedance = %d, want 111", ChannelTypeModelAPISeedance)
	}
	if ChannelTypeDummy <= ChannelTypeModelAPISeedance {
		t.Fatalf("ChannelTypeDummy = %d, want after ModelAPISeedance %d", ChannelTypeDummy, ChannelTypeModelAPISeedance)
	}
	if len(ChannelBaseURLs) <= ChannelTypeModelAPISeedance {
		t.Fatalf("ChannelBaseURLs length = %d, want index %d", len(ChannelBaseURLs), ChannelTypeModelAPISeedance)
	}
	if got := ChannelBaseURLs[ChannelTypeModelAPISeedance]; got != "https://api.modelapi.co" {
		t.Fatalf("ChannelBaseURLs[ChannelTypeModelAPISeedance] = %q, want %q", got, "https://api.modelapi.co")
	}
	if got := GetChannelTypeName(ChannelTypeModelAPISeedance); got != "ModelAPISeedance" {
		t.Fatalf("GetChannelTypeName(ChannelTypeModelAPISeedance) = %q, want %q", got, "ModelAPISeedance")
	}
}
