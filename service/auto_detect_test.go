package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractAPIFormatHonorsClientExclusive(t *testing.T) {
	cc := `{"api_format":"openai-compatible","client_exclusive":"claude_code"}`
	codex := `{"api_format":"openai-compatible","client_exclusive":"codex"}`
	plain := `{"api_format":"anthropic"}`

	require.Equal(t, "claude-cli", extractAPIFormat(&cc))
	require.Equal(t, "codex-cli", extractAPIFormat(&codex))
	require.Equal(t, "anthropic", extractAPIFormat(&plain))
	require.Equal(t, "openai-compatible", extractAPIFormat(nil))
}
