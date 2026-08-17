package constant

import "testing"

func TestGrokSubscriptionChannelRegistration(t *testing.T) {
	if ChannelTypeGrokSubscription != 113 {
		t.Fatalf("ChannelTypeGrokSubscription = %d, want 113", ChannelTypeGrokSubscription)
	}
	if ChannelTypeDummy != 114 {
		t.Fatalf("ChannelTypeDummy = %d, want 114 (shifted after Grok took over 113)", ChannelTypeDummy)
	}
	if ChannelTypeDummy <= ChannelTypeGrokSubscription {
		t.Fatalf("ChannelTypeDummy = %d must stay after ChannelTypeGrokSubscription", ChannelTypeDummy)
	}
	if got := GetChannelTypeName(ChannelTypeGrokSubscription); got != "GrokSubscription" {
		t.Fatalf("GrokSubscription channel name = %q, want GrokSubscription", got)
	}
	if len(ChannelBaseURLs) <= ChannelTypeGrokSubscription {
		t.Fatalf("ChannelBaseURLs missing index for GrokSubscription")
	}
	if got := ChannelBaseURLs[ChannelTypeGrokSubscription]; got != "" {
		t.Fatalf("ChannelBaseURLs[113] = %q, want \"\" (host fixed in adaptor)", got)
	}
}

func TestGrokSubscriptionAPIType(t *testing.T) {
	if APITypeGrokSubscription != 38 {
		t.Fatalf("APITypeGrokSubscription = %d, want 38 (took over Dummy)", APITypeGrokSubscription)
	}
	if APITypeDummy != 39 {
		t.Fatalf("APITypeDummy = %d, want 39 (shifted after Grok)", APITypeDummy)
	}
	if APITypeGrokSubscription != APITypeCopilot+1 {
		t.Fatalf("APITypeGrokSubscription must be immediately after APITypeCopilot")
	}
}
