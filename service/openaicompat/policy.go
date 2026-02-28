package openaicompat

import "github.com/QuantumNous/new-api/setting/model_setting"

// ShouldChatCompletionsUseResponsesPolicy checks whether an incoming
// /v1/chat/completions request should be converted to /v1/responses
// for the given channel and model combination, using the supplied
// policy.  Returns true when the policy is enabled, the channel
// matches, and the model name matches one of the configured patterns.
func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	if !policy.IsChannelEnabled(channelID, channelType) {
		return false
	}
	return matchAnyRegex(policy.ModelPatterns, model)
}

// ShouldChatCompletionsUseResponsesGlobal is a convenience wrapper
// around ShouldChatCompletionsUseResponsesPolicy that reads the policy
// from the global settings singleton.
func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	return ShouldChatCompletionsUseResponsesPolicy(
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy,
		channelID,
		channelType,
		model,
	)
}

// ShouldResponsesUseChatCompletionsPolicy checks whether an incoming
// /v1/responses request should be converted to /v1/chat/completions for
// the given channel and model combination, using the supplied policy.
// Returns true when the policy is enabled, the channel matches, and the
// model name matches one of the configured regex patterns.
func ShouldResponsesUseChatCompletionsPolicy(policy model_setting.ResponsesToChatCompletionsPolicy, channelID int, channelType int, model string) bool {
	if !policy.IsChannelEnabled(channelID, channelType) {
		return false
	}
	return matchAnyRegex(policy.ModelPatterns, model)
}

// ShouldResponsesUseChatCompletionsGlobal is a convenience wrapper
// around ShouldResponsesUseChatCompletionsPolicy that reads the policy
// from the global settings singleton.
func ShouldResponsesUseChatCompletionsGlobal(channelID int, channelType int, model string) bool {
	return ShouldResponsesUseChatCompletionsPolicy(
		model_setting.GetGlobalSettings().ResponsesToChatCompletionsPolicy,
		channelID,
		channelType,
		model,
	)
}
