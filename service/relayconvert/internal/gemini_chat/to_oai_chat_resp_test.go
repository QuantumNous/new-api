package geminichat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestUsageFromGeminiMetadataReconcilesMissingText(t *testing.T) {
	usage := UsageFromGeminiMetadata(&dto.GeminiUsageMetadata{
		PromptTokenCount: 10, CandidatesTokenCount: 10, ThoughtsTokenCount: 2,
		PromptTokensDetails:     []dto.GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 4}},
		CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 3}},
	}, 0)
	require.Equal(t, 6, usage.PromptTokensDetails.TextTokens)
	require.Equal(t, 7, usage.CompletionTokenDetails.TextTokens)
	require.Equal(t, 22, usage.TotalTokens)
}

func TestUsageFromGeminiMetadataReconcilesCompletionFallback(t *testing.T) {
	usage := UsageFromGeminiMetadata(&dto.GeminiUsageMetadata{
		PromptTokenCount: 10, TotalTokenCount: 16,
	}, 0)
	require.Equal(t, 6, usage.CompletionTokens)
	require.Equal(t, 6, usage.CompletionTokenDetails.TextTokens)
}

func TestUsageFromGeminiMetadataClampsNegativeCompletionFallback(t *testing.T) {
	usage := UsageFromGeminiMetadata(&dto.GeminiUsageMetadata{PromptTokenCount: 10, TotalTokenCount: 5}, 0)
	require.Zero(t, usage.CompletionTokens)
}
