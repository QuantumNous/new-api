package dto

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewGeminiChatBillingUsageRequiresTokenContent(t *testing.T) {
	require.Nil(t, NewGeminiChatBillingUsage(nil))
	require.Nil(t, NewGeminiChatBillingUsage(&GeminiUsageMetadata{}))

	billingUsage := NewGeminiChatBillingUsage(&GeminiUsageMetadata{PromptTokenCount: 1})
	require.NotNil(t, billingUsage)
	require.NotNil(t, billingUsage.UsageMetadata)
	assert.Equal(t, BillingUsageSourceGeminiChat, billingUsage.Source)
	assert.Equal(t, BillingUsageSemanticGemini, billingUsage.Semantic)
	assert.False(t, billingUsage.Estimated)
}

func TestNewEstimatedGeminiChatBillingUsage(t *testing.T) {
	billingUsage := NewEstimatedGeminiChatBillingUsage(&Usage{
		PromptTokens:     11,
		CompletionTokens: 7,
	})

	require.NotNil(t, billingUsage)
	require.NotNil(t, billingUsage.UsageMetadata)
	assert.True(t, billingUsage.Estimated)
	assert.Equal(t, 11, billingUsage.UsageMetadata.PromptTokenCount)
	assert.Equal(t, 7, billingUsage.UsageMetadata.CandidatesTokenCount)
	assert.Equal(t, 18, billingUsage.UsageMetadata.TotalTokenCount)
}
