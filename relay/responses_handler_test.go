package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

func TestShouldPassThroughResponsesRequest_BlockRunBridgeForcesConvert(t *testing.T) {
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	defer func() {
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = original
	}()

	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	if shouldPassThroughResponsesRequest(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType:        constant.APITypeBlockRun,
			ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}) {
		t.Fatalf("blockrun responses bridge must not pass through raw Responses body to chat-completions upstream")
	}
}

func TestShouldPassThroughResponsesRequest_OpenAIHonorsPassThrough(t *testing.T) {
	original := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	defer func() {
		model_setting.GetGlobalSettings().PassThroughRequestEnabled = original
	}()

	model_setting.GetGlobalSettings().PassThroughRequestEnabled = true
	if !shouldPassThroughResponsesRequest(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
		},
	}) {
		t.Fatalf("openai responses should honor global pass-through")
	}

	model_setting.GetGlobalSettings().PassThroughRequestEnabled = false
	if !shouldPassThroughResponsesRequest(&relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType:        constant.APITypeOpenAI,
			ChannelSetting: dto.ChannelSettings{PassThroughBodyEnabled: true},
		},
	}) {
		t.Fatalf("openai responses should honor channel pass-through")
	}
}
