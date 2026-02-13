package gemini

import "github.com/QuantumNous/new-api/dto"

func hasGeminiUsageMetadata(meta dto.GeminiUsageMetadata) bool {
	return meta.PromptTokenCount > 0 ||
		meta.CandidatesTokenCount > 0 ||
		meta.ThoughtsTokenCount > 0 ||
		meta.TotalTokenCount > 0 ||
		meta.ToolUsePromptTokenCount > 0 ||
		meta.CachedContentTokenCount > 0 ||
		len(meta.PromptTokensDetails) > 0 ||
		len(meta.ToolUsePromptDetails) > 0
}

func buildUsageFromGeminiMetadata(meta dto.GeminiUsageMetadata, estimatedPromptTokens int) dto.Usage {
	promptTokens := meta.PromptTokenCount
	if promptTokens <= 0 {
		promptTokens = estimatedPromptTokens
	}

	completionTokens := meta.CandidatesTokenCount + meta.ThoughtsTokenCount
	if completionTokens <= 0 && meta.TotalTokenCount > 0 {
		completionTokens = meta.TotalTokenCount - meta.PromptTokenCount - meta.ToolUsePromptTokenCount
	}
	if completionTokens < 0 {
		completionTokens = 0
	}

	totalTokens := meta.TotalTokenCount
	if totalTokens <= 0 {
		totalTokens = promptTokens + completionTokens
	}

	usage := dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      totalTokens,
		InputTokens:      promptTokens,
		OutputTokens:     completionTokens,
	}

	usage.CompletionTokenDetails.ReasoningTokens = meta.ThoughtsTokenCount
	usage.PromptTokensDetails.CachedTokens = meta.CachedContentTokenCount

	for _, detail := range meta.PromptTokensDetails {
		switch detail.Modality {
		case "AUDIO":
			usage.PromptTokensDetails.AudioTokens = detail.TokenCount
		case "TEXT":
			usage.PromptTokensDetails.TextTokens = detail.TokenCount
		}
	}

	if usage.PromptTokensDetails.TextTokens == 0 && usage.PromptTokens > 0 {
		usage.PromptTokensDetails.TextTokens = usage.PromptTokens
	}

	return usage
}
