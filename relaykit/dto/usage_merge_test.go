package dto

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMergeClaudeUsageCacheCreationReplacesWholeObject(t *testing.T) {
	t.Parallel()

	merged := mergeClaudeUsageNonZero(
		&ClaudeUsage{
			CacheCreation: &ClaudeCacheCreationUsage{Ephemeral1hInputTokens: 1000},
		},
		&ClaudeUsage{
			CacheCreation: &ClaudeCacheCreationUsage{
				Ephemeral5mInputTokens: 1000,
				Ephemeral1hInputTokens: 0,
			},
		},
	)

	require.NotNil(t, merged.CacheCreation)
	assert.Equal(t, 1000, merged.CacheCreation.Ephemeral5mInputTokens)
	assert.Equal(t, 0, merged.CacheCreation.Ephemeral1hInputTokens)
}

func TestMergeGeminiUsageMetadataCandidatesAndThoughtsReplacedAsPair(t *testing.T) {
	t.Parallel()

	merged := MergeGeminiUsageMetadataNonZero(
		&GeminiUsageMetadata{
			PromptTokenCount:   10,
			ThoughtsTokenCount: 100,
		},
		&GeminiUsageMetadata{
			PromptTokenCount:     10,
			CandidatesTokenCount: 150,
			ThoughtsTokenCount:   0,
			TotalTokenCount:      160,
		},
	)
	require.NotNil(t, merged)
	assert.Equal(t, 150, merged.CandidatesTokenCount)
	assert.Equal(t, 0, merged.ThoughtsTokenCount)

	billing := NewGeminiChatBillingUsage(merged)
	usage, ok := billing.CanonicalUsage()
	require.True(t, ok)
	assert.Equal(t, 150, usage.CompletionTokens)
}

func TestMergeUsageNonZeroKeepsPositiveValuesAndTakesMaxTotal(t *testing.T) {
	t.Parallel()

	merged := MergeUsageNonZero(
		&Usage{PromptTokens: 10, CompletionTokens: 5, TotalTokens: 15},
		&Usage{PromptTokens: 0, CompletionTokens: 0, TotalTokens: 20},
	)

	require.NotNil(t, merged)
	assert.Equal(t, 10, merged.PromptTokens)
	assert.Equal(t, 5, merged.CompletionTokens)
	assert.Equal(t, 20, merged.TotalTokens)
}
