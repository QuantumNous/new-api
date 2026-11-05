package common

import (
	"github.com/QuantumNous/new-api/internal/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

//func GetPromptTokens(textRequest dto.GeneralOpenAIRequest, relayMode int) (int, error) {
//	switch relayMode {
//	case constant.RelayModeChatCompletions:
//		return CountTokenMessages(textRequest.Messages, textRequest.Model)
//	case constant.RelayModeCompletions:
//		return CountTokenInput(textRequest.Prompt, textRequest.Model), nil
//	case constant.RelayModeModerations:
//		return CountTokenInput(textRequest.Input, textRequest.Model), nil
//	}
//	return 0, errors.New("unknown relay mode")
//}

// ResponseText2Usage accepts any per-request value store so every relay
// caller shares one implementation.
func ResponseText2Usage(c interface{ Set(key string, value any) }, responseText string, modeName string, promptTokens int) *dto.Usage {
	c.Set(string(constant.ContextKeyLocalCountTokens), true)
	usage := &dto.Usage{}
	usage.PromptTokens = promptTokens
	usage.CompletionTokens = EstimateTokenByModel(modeName, responseText)
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	return usage
}

func ValidUsage(usage *dto.Usage) bool {
	return usage != nil && (usage.PromptTokens != 0 || usage.CompletionTokens != 0)
}
