package geminichat

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func functionCallPart(name string) dto.GeminiPart {
	return dto.GeminiPart{
		FunctionCall: &dto.FunctionCall{
			FunctionName: name,
			Arguments:    map[string]any{},
		},
	}
}

func functionResponsePart(name string) dto.GeminiPart {
	return dto.GeminiPart{
		FunctionResponse: &dto.GeminiFunctionResponse{
			Name:     name,
			Response: map[string]any{"ok": true},
		},
	}
}

func assistantToolCallIDs(t *testing.T, messages []dto.Message) []string {
	t.Helper()
	for i := range messages {
		if messages[i].Role == "assistant" {
			calls := messages[i].ParseToolCalls()
			ids := make([]string, 0, len(calls))
			for _, call := range calls {
				ids = append(ids, call.ID)
			}
			return ids
		}
	}
	t.Fatal("assistant message with tool calls not found")
	return nil
}

func toolMessageIDs(messages []dto.Message) []string {
	ids := make([]string, 0)
	for _, message := range messages {
		if message.Role == "tool" {
			ids = append(ids, message.ToolCallId)
		}
	}
	return ids
}

func TestGeminiGenerateContentRequestToOpenAIChatPairsToolCallIDs(t *testing.T) {
	t.Run("single call pairs across contents", func(t *testing.T) {
		got, err := GeminiGenerateContentRequestToOpenAIChat(&dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "model", Parts: []dto.GeminiPart{functionCallPart("get_weather")}},
				{Role: "user", Parts: []dto.GeminiPart{functionResponsePart("get_weather")}},
			},
		}, nil)
		require.NoError(t, err)

		callIDs := assistantToolCallIDs(t, got.Messages)
		toolIDs := toolMessageIDs(got.Messages)
		require.Equal(t, callIDs, toolIDs, "tool message ids must match assistant tool call ids")
		assert.Equal(t, []string{"call_1"}, callIDs)
	})

	t.Run("parallel calls pair by function name", func(t *testing.T) {
		got, err := GeminiGenerateContentRequestToOpenAIChat(&dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "model", Parts: []dto.GeminiPart{
					functionCallPart("first"),
					functionCallPart("second"),
				}},
				{Role: "user", Parts: []dto.GeminiPart{
					functionResponsePart("second"),
					functionResponsePart("first"),
				}},
			},
		}, nil)
		require.NoError(t, err)

		callIDs := assistantToolCallIDs(t, got.Messages)
		require.Equal(t, []string{"call_1", "call_2"}, callIDs)
		// Responses arrive out of order; pairing is by name, so 'second' gets
		// call_2 and 'first' gets call_1.
		assert.Equal(t, []string{"call_2", "call_1"}, toolMessageIDs(got.Messages))
	})

	t.Run("same function called twice pairs FIFO", func(t *testing.T) {
		got, err := GeminiGenerateContentRequestToOpenAIChat(&dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "model", Parts: []dto.GeminiPart{
					functionCallPart("dup"),
					functionCallPart("dup"),
				}},
				{Role: "user", Parts: []dto.GeminiPart{
					functionResponsePart("dup"),
					functionResponsePart("dup"),
				}},
			},
		}, nil)
		require.NoError(t, err)

		callIDs := assistantToolCallIDs(t, got.Messages)
		require.Equal(t, []string{"call_1", "call_2"}, callIDs)
		assert.Equal(t, []string{"call_1", "call_2"}, toolMessageIDs(got.Messages))
	})

	t.Run("unmatched response gets a non-colliding fallback id", func(t *testing.T) {
		got, err := GeminiGenerateContentRequestToOpenAIChat(&dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "model", Parts: []dto.GeminiPart{functionCallPart("known")}},
				{Role: "user", Parts: []dto.GeminiPart{
					functionResponsePart("known"),
					functionResponsePart("unknown"),
				}},
			},
		}, nil)
		require.NoError(t, err)

		callIDs := assistantToolCallIDs(t, got.Messages)
		toolIDs := toolMessageIDs(got.Messages)
		require.Equal(t, []string{"call_1"}, callIDs)
		require.Len(t, toolIDs, 2)
		assert.Equal(t, "call_1", toolIDs[0])
		assert.NotEmpty(t, toolIDs[1])
		assert.NotContains(t, callIDs, toolIDs[1])
		assert.NotEqual(t, toolIDs[0], toolIDs[1])
	})

	t.Run("tool message follows its assistant message within one content", func(t *testing.T) {
		// Pathological shape: functionCall and functionResponse share a single
		// content. The tool message must still be emitted after the assistant
		// message carrying the matching tool_call.
		got, err := GeminiGenerateContentRequestToOpenAIChat(&dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "model", Parts: []dto.GeminiPart{
					functionCallPart("a"),
					functionResponsePart("a"),
				}},
			},
		}, nil)
		require.NoError(t, err)
		require.Len(t, got.Messages, 2)

		assert.Equal(t, "assistant", got.Messages[0].Role)
		assert.Equal(t, "tool", got.Messages[1].Role)
		callIDs := got.Messages[0].ParseToolCalls()
		require.Len(t, callIDs, 1)
		assert.Equal(t, callIDs[0].ID, got.Messages[1].ToolCallId)
	})

	t.Run("text and function response keep source order", func(t *testing.T) {
		got, err := GeminiGenerateContentRequestToOpenAIChat(&dto.GeminiChatRequest{
			Contents: []dto.GeminiChatContent{
				{Role: "model", Parts: []dto.GeminiPart{functionCallPart("a")}},
				{Role: "user", Parts: []dto.GeminiPart{
					{Text: "结果在这里"},
					functionResponsePart("a"),
				}},
			},
		}, nil)
		require.NoError(t, err)
		require.Len(t, got.Messages, 3)

		assert.Equal(t, "assistant", got.Messages[0].Role)
		assert.Equal(t, "user", got.Messages[1].Role)
		assert.Equal(t, "结果在这里", got.Messages[1].StringContent())
		assert.Equal(t, "tool", got.Messages[2].Role)
	})
}
