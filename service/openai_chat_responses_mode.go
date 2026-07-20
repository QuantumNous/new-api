package service

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service/relayconvert"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	return relayconvert.ShouldChatCompletionsUseResponsesPolicy(policy, channelID, channelType, model)
}

func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	return relayconvert.ShouldChatCompletionsUseResponsesGlobal(channelID, channelType, model)
}

func ShouldChatCompletionsUseResponsesForRelay(info *relaycommon.RelayInfo, passThroughGlobal bool) bool {
	if info == nil {
		return false
	}
	if info.ChannelType == constant.ChannelTypeAwsOpenAI && common.IsBedrockOpenAIResponsesModel(info.UpstreamModelName) {
		return true
	}
	if passThroughGlobal || info.ChannelSetting.PassThroughBodyEnabled {
		return false
	}
	return ShouldChatCompletionsUseResponsesGlobal(info.ChannelId, info.ChannelType, info.OriginModelName)
}
