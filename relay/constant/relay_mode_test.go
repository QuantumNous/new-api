package constant

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPath2RelayModeClaudeCountTokens(t *testing.T) {
	require.Equal(t, RelayModeClaudeCountTokens, Path2RelayMode("/v1/messages/count_tokens"))
}
