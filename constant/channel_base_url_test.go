package constant

import "testing"

func TestGetChannelDefaultBaseURL(t *testing.T) {
	if got := GetChannelDefaultBaseURL(ChannelTypeAgnes); got != "https://apihub.agnes-ai.com" {
		t.Fatalf("Agnes default base URL = %q", got)
	}
	if got := GetChannelDefaultBaseURL(ChannelTypeTh12345ai); got != "https://sd.12345ai.net" {
		t.Fatalf("th12345ai default base URL = %q", got)
	}
	if got := GetChannelDefaultBaseURL(ChannelTypeMegabyai); got != "https://newapi.megabyai.cc" {
		t.Fatalf("megabyai default base URL = %q", got)
	}
	if got := GetChannelDefaultBaseURL(len(ChannelBaseURLs)); got != "" {
		t.Fatalf("out of range should return empty, got %q", got)
	}
	if got := GetChannelDefaultBaseURL(-1); got != "" {
		t.Fatalf("negative type should return empty, got %q", got)
	}
}
