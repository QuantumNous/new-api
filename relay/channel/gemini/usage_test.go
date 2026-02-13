package gemini

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestBuildUsageFromGeminiMetadata_ExcludesToolUseFromCompletion(t *testing.T) {
	meta := dto.GeminiUsageMetadata{
		PromptTokenCount:        151,
		CandidatesTokenCount:    1089,
		ThoughtsTokenCount:      1120,
		TotalTokenCount:         20689,
		ToolUsePromptTokenCount: 18329,
		CachedContentTokenCount: 17,
		PromptTokensDetails: []dto.GeminiPromptTokensDetails{
			{Modality: "TEXT", TokenCount: 151},
		},
		ToolUsePromptDetails: []dto.GeminiPromptTokensDetails{
			{Modality: "TEXT", TokenCount: 18329},
		},
	}

	usage := buildUsageFromGeminiMetadata(meta, 0)

	require.Equal(t, 18480, usage.PromptTokens)
	require.Equal(t, 2209, usage.CompletionTokens)
	require.Equal(t, 20689, usage.TotalTokens)
	require.Equal(t, 1120, usage.CompletionTokenDetails.ReasoningTokens)
	require.Equal(t, 17, usage.PromptTokensDetails.CachedTokens)
	require.Equal(t, 18480, usage.PromptTokensDetails.TextTokens)
}

func TestBuildUsageFromGeminiMetadata_FallsBackToTotalPromptAndToolUse(t *testing.T) {
	meta := dto.GeminiUsageMetadata{
		PromptTokenCount:        100,
		TotalTokenCount:         1000,
		ToolUsePromptTokenCount: 700,
	}

	usage := buildUsageFromGeminiMetadata(meta, 0)

	require.Equal(t, 800, usage.PromptTokens)
	require.Equal(t, 200, usage.CompletionTokens)
	require.Equal(t, 1000, usage.TotalTokens)
}

func TestBuildUsageFromGeminiMetadata_NegativeCompletionClampedToZero(t *testing.T) {
	meta := dto.GeminiUsageMetadata{
		PromptTokenCount:        300,
		TotalTokenCount:         200,
		ToolUsePromptTokenCount: 50,
	}

	usage := buildUsageFromGeminiMetadata(meta, 0)

	require.Equal(t, 350, usage.PromptTokens)
	require.Equal(t, 0, usage.CompletionTokens)
	require.Equal(t, 200, usage.TotalTokens)
}

func TestBuildUsageFromGeminiMetadata_UsesEstimatedPromptWhenMissing(t *testing.T) {
	meta := dto.GeminiUsageMetadata{
		CandidatesTokenCount: 20,
	}

	usage := buildUsageFromGeminiMetadata(meta, 123)

	require.Equal(t, 123, usage.PromptTokens)
	require.Equal(t, 20, usage.CompletionTokens)
	require.Equal(t, 143, usage.TotalTokens)
}
