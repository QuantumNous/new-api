package oaichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func claudeContentBlocks(t *testing.T, message dto.ClaudeMessage) []dto.ClaudeMediaMessage {
	t.Helper()
	blocks, ok := message.Content.([]dto.ClaudeMediaMessage)
	require.Truef(t, ok, "expected media blocks, got %T", message.Content)
	return blocks
}

func assistantMsgWithToolCall(reasoning string) dto.Message {
	msg := dto.Message{Role: "assistant"}
	if reasoning != "" {
		msg.ReasoningContent = lo.ToPtr(reasoning)
	}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   "call_1",
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      "get_weather",
				Arguments: `{"city":"beijing"}`,
			},
		},
	})
	return msg
}

func TestOpenAIChatRequestToClaudeMessagesPreservesAssistantReasoning(t *testing.T) {
	reasoning := "需要先定位城市，再调用天气接口"

	t.Run("reasoning with tool calls preserved on earlier turn", func(t *testing.T) {
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "查天气"},
				assistantMsgWithToolCall(reasoning),
				{Role: "tool", ToolCallId: "call_1", Content: "晴"},
				{Role: "assistant", Content: "已查到结果"},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 4)

		blocks := claudeContentBlocks(t, got.Messages[1])
		require.Len(t, blocks, 2)
		assert.Equal(t, "thinking", blocks[0].Type)
		require.NotNil(t, blocks[0].Thinking)
		assert.Equal(t, reasoning, *blocks[0].Thinking)
		assert.Empty(t, blocks[0].Signature)
		assert.Equal(t, "tool_use", blocks[1].Type)
		assert.Equal(t, "call_1", blocks[1].Id)

		toolResult := claudeContentBlocks(t, got.Messages[2])
		require.Len(t, toolResult, 1)
		assert.Equal(t, "tool_result", toolResult[0].Type)
		assert.Equal(t, "已查到结果", got.Messages[3].Content)
	})

	t.Run("reasoning withheld on latest assistant tool-call turn", func(t *testing.T) {
		// The reasoning-bearing assistant message is the LATEST assistant turn:
		// Anthropic signature-verifies thinking blocks there during tool-use
		// continuation, so the converter keeps the pre-fix accepted shape
		// (text placeholder + tool_use, no thinking block).
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "查天气"},
				assistantMsgWithToolCall(reasoning),
				{Role: "tool", ToolCallId: "call_1", Content: "晴"},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 3)

		blocks := claudeContentBlocks(t, got.Messages[1])
		require.Len(t, blocks, 2)
		assert.Equal(t, "text", blocks[0].Type)
		assert.Equal(t, "...", blocks[0].GetText())
		assert.Equal(t, "tool_use", blocks[1].Type)
		assert.Equal(t, "call_1", blocks[1].Id)
	})

	t.Run("reasoning with text content on earlier turn", func(t *testing.T) {
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", Content: "已查到结果", ReasoningContent: lo.ToPtr(reasoning)},
				{Role: "user", Content: "thanks"},
				{Role: "assistant", Content: "不客气"},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 4)

		blocks := claudeContentBlocks(t, got.Messages[1])
		require.Len(t, blocks, 2)
		assert.Equal(t, "thinking", blocks[0].Type)
		require.NotNil(t, blocks[0].Thinking)
		assert.Equal(t, reasoning, *blocks[0].Thinking)
		assert.Equal(t, "text", blocks[1].Type)
		assert.Equal(t, "已查到结果", blocks[1].GetText())
	})

	t.Run("reasoning with text content on latest turn falls back to plain text", func(t *testing.T) {
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", Content: "已查到结果", ReasoningContent: lo.ToPtr(reasoning)},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 2)
		assert.Equal(t, "已查到结果", got.Messages[1].Content)
	})

	t.Run("reasoning only earlier turn skips placeholder text", func(t *testing.T) {
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)},
				{Role: "user", Content: "continue"},
				{Role: "assistant", Content: "done"},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 4)

		blocks := claudeContentBlocks(t, got.Messages[1])
		require.Len(t, blocks, 1)
		assert.Equal(t, "thinking", blocks[0].Type)
		require.NotNil(t, blocks[0].Thinking)
		assert.Equal(t, reasoning, *blocks[0].Thinking)
	})

	t.Run("reasoning only latest turn keeps placeholder", func(t *testing.T) {
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 2)
		assert.Equal(t, "...", got.Messages[1].Content)
	})

	t.Run("reasoning only first turn keeps thinking after synthetic user injection", func(t *testing.T) {
		// The conversation does not start with a user turn, so a synthetic user
		// "..." message is injected first; the first assistant turn is not the
		// latest one, so its reasoning is still emitted as a thinking block.
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)},
				{Role: "user", Content: "go on"},
				{Role: "assistant", Content: "done"},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 4)
		assert.Equal(t, "user", got.Messages[0].Role)

		blocks := claudeContentBlocks(t, got.Messages[1])
		require.Len(t, blocks, 1)
		assert.Equal(t, "thinking", blocks[0].Type)
		require.NotNil(t, blocks[0].Thinking)
		assert.Equal(t, reasoning, *blocks[0].Thinking)
	})

	t.Run("nil content reasoning assistant merges with following assistant", func(t *testing.T) {
		// A reasoning-only assistant turn followed by another assistant turn must
		// not produce consecutive same-role messages (Claude requires alternating
		// roles); the turns merge and the reasoning is kept as a thinking block.
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)},
				{Role: "assistant", Content: "hello"},
				{Role: "user", Content: "continue"},
				{Role: "assistant", Content: "done"},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 4)
		for i := 1; i < len(got.Messages); i++ {
			assert.NotEqualf(t, got.Messages[i-1].Role, got.Messages[i].Role, "consecutive same-role messages at %d/%d", i-1, i)
		}

		blocks := claudeContentBlocks(t, got.Messages[1])
		require.NotEmpty(t, blocks)
		assert.Equal(t, "thinking", blocks[0].Type)
		require.NotNil(t, blocks[0].Thinking)
		assert.Equal(t, reasoning, *blocks[0].Thinking)
	})

	t.Run("consecutive assistant turns merge reasoning on earlier turn", func(t *testing.T) {
		// Claude requires alternating roles, so consecutive assistant messages
		// merge; the earlier turn's reasoning must be merged too, not dropped.
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", Content: "t1", ReasoningContent: lo.ToPtr("R1")},
				{Role: "assistant", Content: "t2", ReasoningContent: lo.ToPtr("R2")},
				{Role: "user", Content: "go on"},
				{Role: "assistant", Content: "done"},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 4)

		blocks := claudeContentBlocks(t, got.Messages[1])
		require.Len(t, blocks, 2)
		assert.Equal(t, "thinking", blocks[0].Type)
		require.NotNil(t, blocks[0].Thinking)
		assert.Equal(t, "R1R2", *blocks[0].Thinking)
		assert.Equal(t, "text", blocks[1].Type)
		assert.Equal(t, "t1 t2", blocks[1].GetText())
	})

	t.Run("merged latest assistant turn keeps placeholder shape", func(t *testing.T) {
		// The merged message represents the latest assistant turn, so no
		// unsigned thinking block is emitted even though reasoning was merged.
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi"},
				{Role: "assistant", Content: "t1", ReasoningContent: lo.ToPtr("R1")},
				{Role: "assistant", Content: "t2", ReasoningContent: lo.ToPtr("R2")},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 2)
		assert.Equal(t, "t1 t2", got.Messages[1].Content)
	})

	t.Run("user message reasoning is not emitted", func(t *testing.T) {
		got, err := OpenAIChatRequestToClaudeMessages(nil, nil, dto.GeneralOpenAIRequest{
			Model:     "claude-test",
			MaxTokens: lo.ToPtr(uint(1024)),
			Messages: []dto.Message{
				{Role: "user", Content: "hi", ReasoningContent: lo.ToPtr(reasoning)},
			},
		})
		require.NoError(t, err)
		require.Len(t, got.Messages, 1)
		assert.Equal(t, "hi", got.Messages[0].Content)
	})
}
