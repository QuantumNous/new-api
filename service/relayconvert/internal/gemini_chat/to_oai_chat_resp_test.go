package geminichat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
)

func TestUsageFromGeminiMetadataReconcilesMissingText(t *testing.T) {
	usage := UsageFromGeminiMetadata(&dto.GeminiUsageMetadata{
		PromptTokenCount: 10, CandidatesTokenCount: 10, ThoughtsTokenCount: 2,
		PromptTokensDetails:     []dto.GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 4}},
		CandidatesTokensDetails: []dto.GeminiPromptTokensDetails{{Modality: "IMAGE", TokenCount: 3}},
	}, 0)
	assert.Equal(t, 6, usage.PromptTokensDetails.TextTokens)
	assert.Equal(t, 7, usage.CompletionTokenDetails.TextTokens)
	assert.Equal(t, 22, usage.TotalTokens)
}

func TestUsageFromGeminiMetadataReconcilesCompletionFallback(t *testing.T) {
	usage := UsageFromGeminiMetadata(&dto.GeminiUsageMetadata{
		PromptTokenCount: 10, TotalTokenCount: 16,
	}, 0)
	assert.Equal(t, 6, usage.CompletionTokens)
	assert.Equal(t, 6, usage.CompletionTokenDetails.TextTokens)
}

func TestUsageFromGeminiMetadataClampsNegativeCompletionFallback(t *testing.T) {
	usage := UsageFromGeminiMetadata(&dto.GeminiUsageMetadata{PromptTokenCount: 10, TotalTokenCount: 5}, 0)
	assert.Zero(t, usage.CompletionTokens)
}
