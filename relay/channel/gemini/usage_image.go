package gemini

import "github.com/QuantumNous/new-api/dto"

func buildUsageFromGeminiMetadata(metadata dto.GeminiUsageMetadata, fallbackPromptTokens int) dto.Usage {
	promptTokens := metadata.PromptTokenCount + metadata.ToolUsePromptTokenCount
	if promptTokens <= 0 && fallbackPromptTokens > 0 {
		promptTokens = fallbackPromptTokens
	}

	usage := dto.Usage{
		PromptTokens:     promptTokens,
		CompletionTokens: metadata.CandidatesTokenCount + metadata.ThoughtsTokenCount,
		TotalTokens:      metadata.TotalTokenCount,
	}
	usage.CompletionTokenDetails.ReasoningTokens = metadata.ThoughtsTokenCount
	usage.PromptTokensDetails.CachedTokens = metadata.CachedContentTokenCount

	for _, detail := range metadata.PromptTokensDetails {
		switch detail.Modality {
		case "AUDIO":
			usage.PromptTokensDetails.AudioTokens += detail.TokenCount
		case "IMAGE":
			usage.PromptTokensDetails.ImageTokens += detail.TokenCount
		case "TEXT":
			usage.PromptTokensDetails.TextTokens += detail.TokenCount
		}
	}
	for _, detail := range metadata.ToolUsePromptTokensDetails {
		switch detail.Modality {
		case "AUDIO":
			usage.PromptTokensDetails.AudioTokens += detail.TokenCount
		case "IMAGE":
			usage.PromptTokensDetails.ImageTokens += detail.TokenCount
		case "TEXT":
			usage.PromptTokensDetails.TextTokens += detail.TokenCount
		}
	}
	for _, detail := range metadata.CandidatesTokensDetails {
		switch detail.Modality {
		case "IMAGE":
			usage.CompletionTokenDetails.ImageTokens += detail.TokenCount
		case "AUDIO":
			usage.CompletionTokenDetails.AudioTokens += detail.TokenCount
		case "TEXT":
			usage.CompletionTokenDetails.TextTokens += detail.TokenCount
		}
	}

	if usage.TotalTokens > 0 && usage.CompletionTokens <= 0 {
		usage.CompletionTokens = usage.TotalTokens - usage.PromptTokens
	}
	if usage.PromptTokens > 0 &&
		usage.PromptTokensDetails.TextTokens == 0 &&
		usage.PromptTokensDetails.AudioTokens == 0 &&
		usage.PromptTokensDetails.ImageTokens == 0 {
		usage.PromptTokensDetails.TextTokens = usage.PromptTokens
	}

	return usage
}

func shouldEstimateGeminiStreamTextUsage(usage *dto.Usage, imageCount int) bool {
	return imageCount == 0 && (usage == nil || usage.CompletionTokens <= 0)
}
