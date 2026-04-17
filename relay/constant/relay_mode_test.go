package constant

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPath2RelayModeDetectsCompletionsWithoutV1Prefix(t *testing.T) {
	require.Equal(t, RelayModeCompletions, Path2RelayMode("/completions"))
	require.Equal(t, RelayModeCompletions, Path2RelayMode("/proxy/completions"))
}

func TestPath2RelayModeKeepsChatCompletionsPrecedence(t *testing.T) {
	require.Equal(t, RelayModeChatCompletions, Path2RelayMode("/chat/completions"))
	require.Equal(t, RelayModeChatCompletions, Path2RelayMode("/proxy/chat/completions"))
	require.Equal(t, RelayModeChatCompletions, Path2RelayMode("/v1/chat/completions"))
}
