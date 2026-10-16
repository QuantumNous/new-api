package ir

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPartitionByToolResultKeepsPlainText(t *testing.T) {
	t.Parallel()
	blocks := []Block{Text("hello")}
	groups := PartitionByToolResult(blocks)
	require.Len(t, groups, 1)
	require.Equal(t, blocks, groups[0])
}

func TestPartitionByToolResultSplitsFollowupText(t *testing.T) {
	t.Parallel()
	result := ToolResult("call_1", []Block{Text(`{"temp":18}`)})
	follow := Text("who paid the parking fee?")
	groups := PartitionByToolResult([]Block{result, follow})
	require.Len(t, groups, 2)
	require.Equal(t, BlockKindToolResult, groups[0][0].Kind)
	require.Equal(t, BlockKindText, groups[1][0].Kind)
	require.Equal(t, "who paid the parking fee?", groups[1][0].Text.Text)
}

func TestPartitionByToolResultSplitsMultipleResults(t *testing.T) {
	t.Parallel()
	groups := PartitionByToolResult([]Block{
		ToolResult("call_1", []Block{Text("a")}),
		ToolResult("call_2", []Block{Text("b")}),
		Text("next question"),
	})
	require.Len(t, groups, 3)
	require.Equal(t, "call_1", groups[0][0].ToolResult.ToolUseID)
	require.Equal(t, "call_2", groups[1][0].ToolResult.ToolUseID)
	require.Equal(t, "next question", groups[2][0].Text.Text)
}
