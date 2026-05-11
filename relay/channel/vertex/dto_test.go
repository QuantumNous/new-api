package vertex

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestCopyRequestPreservesClaudeWebSearchTools(t *testing.T) {
	maxUses := 2
	request := &dto.ClaudeRequest{
		Tools: []any{
			&dto.ClaudeWebSearchTool{
				Type:    "web_search_20250305",
				Name:    "web_search",
				MaxUses: maxUses,
			},
		},
	}

	vertexRequest := copyRequest(request, "vertex-2023-10-16")

	require.Equal(t, "vertex-2023-10-16", vertexRequest.AnthropicVersion)
	tools, ok := vertexRequest.Tools.([]any)
	require.True(t, ok)
	require.Len(t, tools, 1)

	webSearchTool, ok := tools[0].(*dto.ClaudeWebSearchTool)
	require.True(t, ok)
	require.Equal(t, "web_search_20250305", webSearchTool.Type)
	require.Equal(t, "web_search", webSearchTool.Name)
	require.Equal(t, maxUses, webSearchTool.MaxUses)
}
