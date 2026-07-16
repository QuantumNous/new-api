package service

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func geminiBilling(metadata *dto.GeminiUsageMetadata) *dto.Usage {
	return usageFromGeminiBillingUsage(&dto.BillingUsage{Source: dto.BillingUsageSourceGeminiChat, GeminiUsageMetadata: metadata})
}

func TestUsageFromGeminiBillingUsageReconcilesPromptImageRemainder(t *testing.T) {
	usage := geminiBilling(&dto.GeminiUsageMetadata{
		PromptTokenCount:    10,
		PromptTokensDetails: []dto.GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 4}},
	})
	require.Equal(t, 6, usage.PromptTokensDetails.TextTokens)
}

func TestUsageFromGeminiBillingUsageReconcilesCompletionDetails(t *testing.T) {
	usage := geminiBilling(&dto.GeminiUsageMetadata{
		PromptTokenCount: 1, CandidatesTokenCount: 10, ThoughtsTokenCount: 2,
		CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 3}},
	})
	require.Equal(t, 7, usage.CompletionTokenDetails.TextTokens)
}

func TestUsageFromGeminiBillingUsageReconcilesCompletionFallback(t *testing.T) {
	usage := geminiBilling(&dto.GeminiUsageMetadata{PromptTokenCount: 10, TotalTokenCount: 16})
	require.Equal(t, 6, usage.CompletionTokens)
	require.Equal(t, 6, usage.CompletionTokenDetails.TextTokens)
}

func TestUsageFromGeminiBillingUsageClampsNegativeCompletionFallback(t *testing.T) {
	usage := geminiBilling(&dto.GeminiUsageMetadata{PromptTokenCount: 10, TotalTokenCount: 5})
	require.Zero(t, usage.CompletionTokens)
}
