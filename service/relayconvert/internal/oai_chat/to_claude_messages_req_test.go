package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToClaudeMessagesOmitsAbsentToolRequired(t *testing.T) {
	request := dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet-20241022",
		Messages: []dto.Message{
			{Role: "user", Content: "hello"},
		},
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name:        "list_mcp_resources",
					Description: "Lists resources provided by MCP servers.",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"server": map[string]any{"type": "string"},
						},
						"additionalProperties": false,
						// 无 required 键：模拟 Codex 的 list_mcp_resources 工具。
					},
				},
			},
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "read_mcp_resource",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"server": map[string]any{"type": "string"},
							"uri":    map[string]any{"type": "string"},
						},
						"required": []any{"server", "uri"},
					},
				},
			},
		},
	}

	claudeRequest, err := OpenAIChatRequestToClaudeMessages(&gin.Context{}, request)
	require.NoError(t, err)

	toolList, ok := claudeRequest.Tools.([]any)
	require.True(t, ok)
	tools, webSearchTools := dto.ProcessTools(toolList)
	require.Empty(t, webSearchTools)
	require.Len(t, tools, 2)

	// 未声明 required 的工具不应序列化出该键（旧代码会写出 "required": null）。
	assert.NotContains(t, tools[0].InputSchema, "required")
	assert.Contains(t, tools[0].InputSchema, "properties")

	// 声明了 required 的工具应原样保留。
	assert.Equal(t, []any{"server", "uri"}, tools[1].InputSchema["required"])
}