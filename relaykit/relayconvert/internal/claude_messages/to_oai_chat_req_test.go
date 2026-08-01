package claudemessages

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeMessagesRequestToOpenAIChatPreservesThinkingBlocks(t *testing.T) {
	req := dto.ClaudeRequest{
		Model: "deepseek-r1",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "查天气"},
			{Role: "assistant", Content: []any{
				map[string]any{"type": "thinking", "thinking": "需要先定位城市，", "signature": "sig1"},
				map[string]any{"type": "thinking", "thinking": "再调用天气接口", "signature": "sig2"},
				map[string]any{"type": "tool_use", "id": "call_1", "name": "get_weather", "input": map[string]any{}},
			}},
			{Role: "user", Content: []any{
				map[string]any{"type": "tool_result", "tool_use_id": "call_1", "content": "晴"},
			}},
		},
	}

	got, err := ClaudeMessagesRequestToOpenAIChat(req, nil)
	require.NoError(t, err)

	require.Len(t, got.Messages, 3)
	assistant := got.Messages[1]
	assert.Equal(t, "assistant", assistant.Role)
	assert.Equal(t, "需要先定位城市，再调用天气接口", assistant.GetReasoningContent())
	toolCalls := assistant.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "call_1", toolCalls[0].ID)
	assert.Equal(t, "get_weather", toolCalls[0].Function.Name)
	assert.Equal(t, "tool", got.Messages[2].Role)
	assert.Equal(t, "call_1", got.Messages[2].ToolCallId)
}

func TestClaudeMessagesRequestToOpenAIChatDropsRedactedThinking(t *testing.T) {
	// redacted_thinking carries an opaque encrypted payload that cannot
	// round-trip through the chat format without mutating into an invalid plain
	// thinking block, so it is deliberately not preserved.
	req := dto.ClaudeRequest{
		Model: "deepseek-r1",
		Messages: []dto.ClaudeMessage{
			{Role: "assistant", Content: []any{
				map[string]any{"type": "redacted_thinking", "data": "opaque-blob"},
				map[string]any{"type": "tool_use", "id": "call_1", "name": "lookup", "input": map[string]any{}},
			}},
		},
	}

	got, err := ClaudeMessagesRequestToOpenAIChat(req, nil)
	require.NoError(t, err)

	require.Len(t, got.Messages, 1)
	assert.Empty(t, got.Messages[0].GetReasoningContent())
	assert.Len(t, got.Messages[0].ParseToolCalls(), 1)
}

func TestClaudeMessagesRequestToOpenAIChatKeepsThinkingOnlyAssistantMessage(t *testing.T) {
	// An assistant message carrying only thinking (no text, no tool_use) must not
	// be dropped from the converted history.
	req := dto.ClaudeRequest{
		Model: "deepseek-r1",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hi"},
			{Role: "assistant", Content: []any{
				map[string]any{"type": "thinking", "thinking": "lone thought"},
			}},
			{Role: "user", Content: "continue"},
		},
	}

	got, err := ClaudeMessagesRequestToOpenAIChat(req, nil)
	require.NoError(t, err)

	require.Len(t, got.Messages, 3)
	assert.Equal(t, "assistant", got.Messages[1].Role)
	assert.Equal(t, "lone thought", got.Messages[1].GetReasoningContent())
}

func TestClaudeMessagesRequestToOpenAIChatIgnoresThinkingOnUserTurn(t *testing.T) {
	// Thinking blocks are only valid on assistant turns; a thinking block in a
	// user turn must not leak into reasoning_content.
	req := dto.ClaudeRequest{
		Model: "deepseek-r1",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: []any{
				map[string]any{"type": "thinking", "thinking": "user-turn thought"},
				map[string]any{"type": "text", "text": "hi"},
			}},
		},
	}

	got, err := ClaudeMessagesRequestToOpenAIChat(req, nil)
	require.NoError(t, err)

	require.Len(t, got.Messages, 1)
	assert.Equal(t, "user", got.Messages[0].Role)
	assert.Empty(t, got.Messages[0].GetReasoningContent())
}
