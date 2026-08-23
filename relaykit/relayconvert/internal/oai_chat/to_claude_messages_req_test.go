package oaichat

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenAIChatRequestToClaudeMessagesMapsEffortSuffixForAnyModel(t *testing.T) {
	maxTokens := uint(1024)
	got, err := OpenAIChatRequestToClaudeMessages(context.Background(), nil, dto.GeneralOpenAIRequest{
		Model:     "claude-sonnet-4-5-high",
		MaxTokens: &maxTokens,
		Messages:  []dto.Message{{Role: "user", Content: "hi"}},
	})
	require.NoError(t, err)
	assert.Equal(t, "claude-sonnet-4-5", got.Model)
	require.NotNil(t, got.Thinking)
	assert.Equal(t, "adaptive", got.Thinking.Type)
	assert.JSONEq(t, `{"effort":"high"}`, string(got.OutputConfig))
}

func TestOpenAIChatRequestToClaudeMessagesUsesThinkingLevel(t *testing.T) {
	maxTokens := uint(1024)
	got, err := OpenAIChatRequestToClaudeMessages(context.Background(), nil, dto.GeneralOpenAIRequest{
		Model:           "claude-opus-4-6",
		MaxTokens:       &maxTokens,
		ReasoningEffort: "xhigh",
		Messages:        []dto.Message{{Role: "user", Content: "hi"}},
	})
	require.NoError(t, err)
	require.NotNil(t, got.Thinking)
	assert.Equal(t, "adaptive", got.Thinking.Type)
	assert.Nil(t, got.Thinking.BudgetTokens)
	assert.JSONEq(t, `{"effort":"max"}`, string(got.OutputConfig))
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
			got, err := OpenAIChatRequestToClaudeMessages(context.Background(), nil, dto.GeneralOpenAIRequest{
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
