package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToClaudeMessagesOmitsEmptyTools(t *testing.T) {
	maxTokens := uint(16)
	tests := []struct {
		name      string
		request   dto.GeneralOpenAIRequest
		wantTools bool
	}{
		{
			name: "omitted tools",
			request: dto.GeneralOpenAIRequest{
				Model:     "claude-test",
				MaxTokens: &maxTokens,
				Messages:  []dto.Message{{Role: "user", Content: "hi"}},
			},
		},
		{
			name: "explicit empty tools",
			request: dto.GeneralOpenAIRequest{
				Model:     "claude-test",
				MaxTokens: &maxTokens,
				Messages:  []dto.Message{{Role: "user", Content: "hi"}},
				Tools:     []dto.ToolCallRequest{},
			},
		},
		{
			name: "function tool",
			request: dto.GeneralOpenAIRequest{
				Model:     "claude-test",
				MaxTokens: &maxTokens,
				Messages:  []dto.Message{{Role: "user", Content: "hi"}},
				Tools: []dto.ToolCallRequest{{
					Type: "function",
					Function: dto.FunctionRequest{
						Name:        "get_weather",
						Description: "Get weather by city",
						Parameters: map[string]any{
							"type":       "object",
							"properties": map[string]any{"city": map[string]any{"type": "string"}},
							"required":   []any{"city"},
						},
					},
				}},
			},
			wantTools: true,
		},
		{
			name: "web search only",
			request: dto.GeneralOpenAIRequest{
				Model:            "claude-test",
				MaxTokens:        &maxTokens,
				Messages:         []dto.Message{{Role: "user", Content: "hi"}},
				WebSearchOptions: &dto.WebSearchOptions{SearchContextSize: "low"},
			},
			wantTools: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := OpenAIChatRequestToClaudeMessages(nil, test.request)
			require.NoError(t, err)

			body, err := common.Marshal(got)
			require.NoError(t, err)

			if test.wantTools {
				assert.NotNil(t, got.Tools)
				assert.Contains(t, string(body), `"tools":`)
				return
			}
			assert.Nil(t, got.Tools)
			assert.NotContains(t, string(body), `"tools":`)
		})
	}
}

func TestOpenAIChatRequestToClaudeMessagesNormalizesToolInputSchema(t *testing.T) {
	tests := []struct {
		name       string
		parameters any
		wantSchema map[string]any
	}{
		{
			name:       "omitted parameters",
			parameters: nil,
			wantSchema: map[string]any{
				"type":       "object",
				"properties": map[string]any{},
			},
		},
		{
			name: "missing type and properties",
			parameters: map[string]any{
				"additionalProperties": false,
			},
			wantSchema: map[string]any{
				"type":                 "object",
				"properties":           map[string]any{},
				"additionalProperties": false,
			},
		},
		{
			name: "non-string type",
			parameters: map[string]any{
				"type":       123,
				"properties": map[string]any{},
			},
			wantSchema: map[string]any{
				"type":       123,
				"properties": map[string]any{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			maxTokens := uint(1024)
			got, err := OpenAIChatRequestToClaudeMessages(nil, dto.GeneralOpenAIRequest{
				Model:     "claude-test",
				MaxTokens: &maxTokens,
				Messages: []dto.Message{
					{Role: "user", Content: "Call the tool."},
				},
				Tools: []dto.ToolCallRequest{
					{
						Type: "function",
						Function: dto.FunctionRequest{
							Name:        "get_current_time",
							Description: "Get the current time",
							Parameters:  tt.parameters,
						},
					},
				},
			})

			require.NoError(t, err)
			tools, ok := got.Tools.([]any)
			require.True(t, ok)
			require.Len(t, tools, 1)
			tool, ok := tools[0].(*dto.Tool)
			require.True(t, ok)
			assert.Equal(t, "get_current_time", tool.Name)
			assert.Equal(t, tt.wantSchema, tool.InputSchema)
		})
	}
}
