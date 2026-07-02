package constant

import "testing"

func TestJimengReverseProxyChannelTypesAreSeparate(t *testing.T) {
	if ChannelTypeJimengProxy == ChannelTypeJimengZhizinan {
		t.Fatal("iptag and zhizinan reverse proxies must use distinct channel types")
	}
	if ChannelTypeNames[ChannelTypeJimengProxy] != "JimengProxy" {
		t.Fatalf("ChannelTypeJimengProxy name = %q", ChannelTypeNames[ChannelTypeJimengProxy])
	}
	if ChannelTypeNames[ChannelTypeJimengZhizinan] != "JimengZhizinan" {
		t.Fatalf("ChannelTypeJimengZhizinan name = %q", ChannelTypeNames[ChannelTypeJimengZhizinan])
	}
	if len(ChannelBaseURLs) <= ChannelTypeJimengZhizinan {
		t.Fatalf("ChannelBaseURLs missing slot for ChannelTypeJimengZhizinan=%d", ChannelTypeJimengZhizinan)
	}
}
