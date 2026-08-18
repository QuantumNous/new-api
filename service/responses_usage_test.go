package service

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyResponsesUsageCopiesTokenDetails(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		InputTokens:  11,
		OutputTokens: 7,
		TotalTokens:  18,
		InputTokensDetails: &dto.InputTokenDetails{
			CachedTokens:         3,
			CachedCreationTokens: 2,
			CacheWriteTokens:     8,
			TextTokens:           6,
			AudioTokens:          4,
			ImageTokens:          5,
		},
		OutputTokensDetails: &dto.OutputTokenDetails{
			TextTokens:      1,
			AudioTokens:     2,
			ImageTokens:     3,
			ReasoningTokens: 4,
		},
		PromptCacheHitTokens: 3,
		UsageSemantic:        "openai",
		UsageSource:          "upstream",
	}

	ApplyResponsesUsage(dst, src)

	assert.Equal(t, 11, dst.PromptTokens)
	assert.Equal(t, 7, dst.CompletionTokens)
	assert.Equal(t, 18, dst.TotalTokens)
	require.NotNil(t, dst.InputTokensDetails)
	assert.NotSame(t, src.InputTokensDetails, dst.InputTokensDetails)
	assert.Equal(t, *src.InputTokensDetails, dst.PromptTokensDetails)
	assert.Equal(t, *src.OutputTokensDetails, dst.CompletionTokenDetails)
	require.NotNil(t, dst.OutputTokensDetails)
	assert.NotSame(t, src.OutputTokensDetails, dst.OutputTokensDetails)
	assert.Equal(t, *src.OutputTokensDetails, *dst.OutputTokensDetails)
	assert.Equal(t, "openai", dst.UsageSemantic)
	assert.Equal(t, "upstream", dst.UsageSource)
}

func TestApplyResponsesUsagePreservesExistingMetadataWhenSourceOmitsIt(t *testing.T) {
	dst := &dto.Usage{
		PromptCacheHitTokens: 5,
		UsageSemantic:        "openai",
		UsageSource:          "upstream",
	}

	ApplyResponsesUsage(dst, &dto.Usage{TotalTokens: 9})

	assert.Equal(t, 5, dst.PromptCacheHitTokens)
	assert.Equal(t, "openai", dst.UsageSemantic)
	assert.Equal(t, "upstream", dst.UsageSource)
}

func TestApplyResponsesUsageFallsBackToCompletionTokenDetails(t *testing.T) {
	dst := &dto.Usage{}
	src := &dto.Usage{
		CompletionTokenDetails: dto.OutputTokenDetails{
			ReasoningTokens: 9,
		},
	}

	ApplyResponsesUsage(dst, src)

	assert.Equal(t, 9, dst.CompletionTokenDetails.ReasoningTokens)
	require.NotNil(t, dst.OutputTokensDetails)
	assert.Equal(t, 9, dst.OutputTokensDetails.ReasoningTokens)
}
