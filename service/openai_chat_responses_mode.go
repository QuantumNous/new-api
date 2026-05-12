package service

import (
	"github.com/QuantumNous/new-api/service/openaicompat"
	"github.com/QuantumNous/new-api/setting/model_setting"
)

func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	return openaicompat.ShouldChatCompletionsUseResponsesPolicy(policy, channelID, channelType, model)
}

func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	return openaicompat.ShouldChatCompletionsUseResponsesGlobal(channelID, channelType, model)
}

func ShouldResponsesUseChatCompletionsPolicy(policy model_setting.ResponsesToChatCompletionsPolicy, channelID int, channelType int, model string) bool {
	return openaicompat.ShouldResponsesUseChatCompletionsPolicy(policy, channelID, channelType, model)
}

func ShouldResponsesUseChatCompletionsGlobal(channelID int, channelType int, model string) bool {
	return openaicompat.ShouldResponsesUseChatCompletionsGlobal(channelID, channelType, model)
}
