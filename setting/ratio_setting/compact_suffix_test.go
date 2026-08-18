package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFormatMatchingModelNameKeepsOnlyGPTCompactSuffix(t *testing.T) {
	tests := map[string]string{
		"gemini-2.5-flash-thinking-1024":                     "gemini-2.5-flash-thinking-*",
		"gemini-2.5-flash-thinking-1024-openai-compact":      "gemini-2.5-flash-thinking-*",
		"gemini-2.5-flash-lite-thinking-2048-openai-compact": "gemini-2.5-flash-lite-thinking-*",
		"gemini-2.5-pro-thinking-4096-openai-compact":        "gemini-2.5-pro-thinking-*",
		"gpt-4-gizmo-customer-openai-compact":                "gpt-4-gizmo-*-openai-compact",
		"gpt-4o-gizmo-customer-openai-compact":               "gpt-4o-gizmo-*-openai-compact",
		"ordinary-model-openai-compact":                      "ordinary-model",
		CompactWildcardModelKey:                              CompactWildcardModelKey,
	}

	for input, expected := range tests {
		t.Run(input, func(t *testing.T) {
			require.Equal(t, expected, FormatMatchingModelName(input))
		})
	}
}

func TestCompactModelNameRule(t *testing.T) {
	require.Equal(t, "gpt-5-openai-compact", WithCompactModelSuffix("gpt-5"))
	require.Equal(t, "claude-3-5-sonnet", WithCompactModelSuffix("claude-3-5-sonnet"))
	require.True(t, IsVirtualCompactModelName("gpt-5-openai-compact"))
	require.False(t, IsVirtualCompactModelName("gpt-openai-compact"))
	require.False(t, IsVirtualCompactModelName("claude-3-5-sonnet-openai-compact"))
}
