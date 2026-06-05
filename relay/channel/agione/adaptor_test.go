package agione

import (
	"testing"

	channelconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestGetRequestURLTrimsOpenAIVersionPrefix(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    channelconstant.ChannelTypeAGIone,
			ChannelBaseUrl: channelconstant.ChannelBaseURLs[channelconstant.ChannelTypeAGIone],
		},
		RequestURLPath: "/v1/chat/completions",
	}

	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://agione.pro/hyperone/xapi/api/v1/chat/completions"
	if got != want {
		t.Fatalf("GetRequestURL() = %q, want %q", got, want)
	}
}
