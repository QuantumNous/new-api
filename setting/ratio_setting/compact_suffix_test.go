package ratio_setting

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFormatMatchingModelNamePreservesCompactSuffix(t *testing.T) {
	tests := map[string]string{
		"gemini-2.5-flash-thinking-1024":                     "gemini-2.5-flash-thinking-*",
		"gemini-2.5-flash-thinking-1024-openai-compact":      "gemini-2.5-flash-thinking-*-openai-compact",
		"gemini-2.5-flash-lite-thinking-2048-openai-compact": "gemini-2.5-flash-lite-thinking-*-openai-compact",
		"gemini-2.5-pro-thinking-4096-openai-compact":        "gemini-2.5-pro-thinking-*-openai-compact",
		"gpt-4-gizmo-customer-openai-compact":                "gpt-4-gizmo-*-openai-compact",
		"gpt-4o-gizmo-customer-openai-compact":               "gpt-4o-gizmo-*-openai-compact",
		"ordinary-model-openai-compact":                      "ordinary-model-openai-compact",
		CompactWildcardModelKey:                              CompactWildcardModelKey,
	}

	for input, expected := range tests {
		t.Run(input, func(t *testing.T) {
			require.Equal(t, expected, FormatMatchingModelName(input))
		})
	}
}
