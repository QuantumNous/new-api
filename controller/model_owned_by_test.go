package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestChannelOwnerNameUsesAdaptorChannelName(t *testing.T) {
	tests := []struct {
		name        string
		channelType int
		expected    string
	}{
		{
			name:        "openai",
			channelType: constant.ChannelTypeOpenAI,
			expected:    "openai",
		},
		{
			name:        "codex",
			channelType: constant.ChannelTypeCodex,
			expected:    "codex",
		},
		{
			name:        "openrouter",
			channelType: constant.ChannelTypeOpenRouter,
			expected:    "openrouter",
		},
		{
			name:        "azure fallback",
			channelType: constant.ChannelTypeAzure,
			expected:    "azure",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, channelOwnerName(tt.channelType))
		})
	}
}

func TestBuildOpenAIModelOverridesOwnedBy(t *testing.T) {
	modelItem := buildOpenAIModel("gpt-5.4", map[string]string{"gpt-5.4": "openai"})
	require.Equal(t, "gpt-5.4", modelItem.Id)
	require.Equal(t, "openai", modelItem.OwnedBy)
}

func TestBuildOpenAIModelFallsBackToCustomForUnknownModels(t *testing.T) {
	modelItem := buildOpenAIModel("custom-test-model", nil)
	require.Equal(t, "custom-test-model", modelItem.Id)
	require.Equal(t, "custom", modelItem.OwnedBy)
}
