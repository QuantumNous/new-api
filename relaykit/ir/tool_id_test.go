package ir

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEnsureToolAssignsStablePortableIDsForParallelCalls(t *testing.T) {
	t.Parallel()
	state := NewStreamState("stream_123", "gemini-test")

	firstIndex, firstEvents := state.EnsureTool(0, "", "lookup")
	secondIndex, secondEvents := state.EnsureTool(1, "", "lookup")
	require.Len(t, firstEvents, 1)
	require.Len(t, secondEvents, 1)

	firstID, _ := state.ToolMetadata(firstIndex)
	secondID, _ := state.ToolMetadata(secondIndex)
	require.NotEmpty(t, firstID)
	require.NotEmpty(t, secondID)
	require.NotEqual(t, firstID, secondID)
	require.Regexp(t, `^[A-Za-z0-9_-]+$`, firstID)
	require.Regexp(t, `^[A-Za-z0-9_-]+$`, secondID)

	_, repeatedEvents := state.EnsureTool(0, "", "lookup")
	require.Empty(t, repeatedEvents)
	repeatedID, _ := state.ToolMetadata(firstIndex)
	require.Equal(t, firstID, repeatedID)
}

func TestCanonicalToolCallIDPreservesProviderID(t *testing.T) {
	t.Parallel()
	require.Equal(t, "toolu_provider_1", CanonicalToolCallID("scope", 0, "toolu_provider_1"))
}
