package deepseek

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func TestGetRequestURLResponsesClientUsesChatCompletions(t *testing.T) {
	t.Parallel()
	info := &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatOpenAIResponses,
		RelayMode:      relayconstant.RelayModeResponses,
		RequestURLPath: "/v1/responses",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeDeepSeek,
			ApiType:        constant.APITypeDeepSeek,
			ChannelBaseUrl: "https://api.deepseek.com",
		},
	}
	info.BuildTextPlan(false)
	got, err := (&Adaptor{}).GetRequestURL(info)
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://api.deepseek.com/v1/chat/completions" {
		t.Fatalf("got %s", got)
	}
	if info.RelayMode != relayconstant.RelayModeResponses {
		t.Fatalf("RelayMode rewritten: %d", info.RelayMode)
	}
}
