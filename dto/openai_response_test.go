package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestUsageMarshalAndUnmarshalPreservesAnthropicExtensions(t *testing.T) {
	original := Usage{
		PromptTokens:     100,
		CompletionTokens: 20,
		TotalTokens:      120,
		UsageSemantic:    "anthropic",
		UsageSource:      "anthropic",
		PromptTokensDetails: InputTokenDetails{
			CachedTokens:         10,
			CachedCreationTokens: 15,
		},
		ClaudeCacheCreation5mTokens: 5,
		ClaudeCacheCreation1hTokens: 7,
	}

	b, err := common.Marshal(original)
	require.NoError(t, err)
	require.Contains(t, string(b), `"usage_semantic":"anthropic"`)
	require.Contains(t, string(b), `"usage_source":"anthropic"`)
	require.Contains(t, string(b), `"cached_creation_tokens":15`)

	var decoded Usage
	err = common.Unmarshal(b, &decoded)
	require.NoError(t, err)
	require.Equal(t, original.UsageSemantic, decoded.UsageSemantic)
	require.Equal(t, original.UsageSource, decoded.UsageSource)
	require.Equal(t, original.PromptTokensDetails.CachedCreationTokens, decoded.PromptTokensDetails.CachedCreationTokens)
	require.Equal(t, original.ClaudeCacheCreation5mTokens, decoded.ClaudeCacheCreation5mTokens)
	require.Equal(t, original.ClaudeCacheCreation1hTokens, decoded.ClaudeCacheCreation1hTokens)
}
