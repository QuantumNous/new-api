package openaicompat

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	// Bedrock OpenAI models (e.g. GPT-5.5) only support the Responses API on the
	// bedrock-mantle endpoint, not Chat Completions. Always route this channel
	// type's chat/completions traffic through the Responses API, regardless of
	// the global policy toggle.
	if channelType == constant.ChannelTypeBedrockOpenAI {
		return true
	}
	if !policy.IsChannelEnabled(channelID, channelType) {
		return false
	}
	return matchAnyRegex(policy.ModelPatterns, model)
}

func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	return ShouldChatCompletionsUseResponsesPolicy(
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy,
		channelID,
		channelType,
		model,
	)
}
