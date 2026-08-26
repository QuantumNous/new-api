package xai

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func TestGetRequestURLClaudeClientUsesChatCompletions(t *testing.T) {
	t.Parallel()
	info := &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatClaude,
		RelayMode:      relayconstant.RelayModeUnknown,
		RequestURLPath: "/v1/messages",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeXai,
			ApiType:        constant.APITypeXai,
			ChannelBaseUrl: "https://api.x.ai",
		},
	}
	info.BuildTextPlan("")
	got, err := (&Adaptor{}).GetRequestURL(info)
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://api.x.ai/v1/chat/completions" {
		t.Fatalf("got %s", got)
	}
}

func TestGetRequestURLResponsesClientKeepsResponses(t *testing.T) {
	t.Parallel()
	info := &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatOpenAIResponses,
		RelayMode:      relayconstant.RelayModeResponses,
		RequestURLPath: "/v1/responses",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeXai,
			ApiType:        constant.APITypeXai,
			ChannelBaseUrl: "https://api.x.ai",
		},
	}
	info.BuildTextPlan("")
	got, err := (&Adaptor{}).GetRequestURL(info)
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://api.x.ai/v1/responses" {
		t.Fatalf("got %s", got)
	}
}
