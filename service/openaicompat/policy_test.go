package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/require"
)

func TestShouldChatCompletionsUseResponsesPolicyDisabled(t *testing.T) {
	policy := model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		AllChannels:   true,
		ModelPatterns: []string{"^gpt-5.*$"},
	}

	require.False(t, ShouldChatCompletionsUseResponsesPolicy(policy, 1, 1, "gpt-5"))
}

func TestShouldChatCompletionsUseResponsesGlobalDisabled(t *testing.T) {
	original := model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy
	t.Cleanup(func() {
		model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy = original
	})

	model_setting.GetGlobalSettings().ChatCompletionsToResponsesPolicy = model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		AllChannels:   true,
		ModelPatterns: []string{"^gpt-4o.*$"},
	}

	require.False(t, ShouldChatCompletionsUseResponsesGlobal(12, 34, "gpt-4o"))
}
