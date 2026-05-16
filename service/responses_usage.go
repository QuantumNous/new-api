package service

import "github.com/QuantumNous/new-api/dto"

func ApplyResponsesUsage(dst *dto.Usage, src *dto.Usage) {
	if dst == nil || src == nil {
		return
	}
	if src.InputTokens != 0 {
		dst.PromptTokens = src.InputTokens
		dst.InputTokens = src.InputTokens
	}
	if src.OutputTokens != 0 {
		dst.CompletionTokens = src.OutputTokens
		dst.OutputTokens = src.OutputTokens
	}
	if src.TotalTokens != 0 {
		dst.TotalTokens = src.TotalTokens
	}
	if src.InputTokensDetails != nil {
		inputDetails := *src.InputTokensDetails
		dst.InputTokensDetails = &inputDetails
		dst.PromptTokensDetails = inputDetails
	}
	outputDetails := src.CompletionTokenDetails
	if src.OutputTokensDetails != nil {
		outputDetails = *src.OutputTokensDetails
	}
	if !isZeroOutputTokenDetails(outputDetails) {
		dst.CompletionTokenDetails = outputDetails
	}
	dst.PromptCacheHitTokens = src.PromptCacheHitTokens
	dst.UsageSemantic = src.UsageSemantic
	dst.UsageSource = src.UsageSource
}

func isZeroOutputTokenDetails(details dto.OutputTokenDetails) bool {
	return details.TextTokens == 0 &&
		details.AudioTokens == 0 &&
		details.ImageTokens == 0 &&
		details.ReasoningTokens == 0
}
