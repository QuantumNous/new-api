package openaicompat

import "github.com/QuantumNous/new-api/setting/model_setting"

func ShouldChatCompletionsUseResponsesPolicy(policy model_setting.ChatCompletionsToResponsesPolicy, channelID int, channelType int, model string) bool {
	_ = policy
	_ = channelID
	_ = channelType
	_ = model

	// Automatic Chat Completions -> Responses rerouting is intentionally disabled.
	// Public API endpoints must preserve their original protocol semantics instead
	// of silently switching to another upstream protocol and wrapping the result
	// back into a different response shape.
	return false
}

func ShouldChatCompletionsUseResponsesGlobal(channelID int, channelType int, model string) bool {
	return ShouldChatCompletionsUseResponsesPolicy(
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy,
		channelID,
		channelType,
		model,
	)
}
