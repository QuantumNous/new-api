package oairesponses

import (
	"context"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert/convmeta"
	claudemessages "github.com/QuantumNous/new-api/relaykit/relayconvert/internal/claude_messages"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRC40ToolResultMediaCompatibility(t *testing.T) {
	const imageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
	const dataURL = "data:image/png;base64," + imageData

	t.Run("Responses tool batch hoists media after contiguous tool messages", func(t *testing.T) {
		input, err := kitutil.Marshal([]map[string]any{
			{"type": "function_call", "call_id": "call_image", "name": "screenshot", "arguments": "{}"},
			{"type": "function_call", "call_id": "call_text", "name": "read_file", "arguments": "{}"},
			{"type": "function_call_output", "call_id": "call_image", "output": []any{
				map[string]any{"type": "input_text", "text": "captured"},
				map[string]any{"type": "input_image", "image_url": dataURL},
			}},
			{"type": "function_call_output", "call_id": "call_text", "output": "note contents"},
			{"role": "user", "content": "describe it"},
		})
		require.NoError(t, err)

		got, err := ResponsesRequestToChatCompletionsRequest(context.Background(), &dto.OpenAIResponsesRequest{
			Model: "gpt-test",
			Input: input,
		})
		require.NoError(t, err)

		roles := make([]string, 0, len(got.Messages))
		for _, message := range got.Messages {
			roles = append(roles, message.Role)
		}
		require.Equal(t, []string{"assistant", "tool", "tool", "user", "user"}, roles)
		require.Len(t, got.Messages[0].ParseToolCalls(), 2)
		assert.Equal(t, "call_image", got.Messages[1].ToolCallId)
		assert.Equal(t, "call_text", got.Messages[2].ToolCallId)
		assert.Equal(t, "captured", got.Messages[1].StringContent())
		assert.Equal(t, "note contents", got.Messages[2].StringContent())
		parts := got.Messages[3].ParseContent()
		require.Len(t, parts, 1)
		assert.Equal(t, dto.ContentTypeImageURL, parts[0].Type)
		require.NotNil(t, parts[0].GetImageMedia())
		assert.Equal(t, dataURL, parts[0].GetImageMedia().Url)
		assert.Equal(t, "describe it", got.Messages[4].StringContent())
	})

	t.Run("Claude tool batch has the same media placement", func(t *testing.T) {
		maxTokens := uint(64)
		text := "look again"
		got, err := claudemessages.ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
			Model:     "claude-test",
			MaxTokens: &maxTokens,
			Messages: []dto.ClaudeMessage{
				{Role: "user", Content: "capture and read"},
				{Role: "assistant", Content: []dto.ClaudeMediaMessage{
					{Type: "tool_use", Id: "tool_image", Name: "screenshot", Input: map[string]any{}},
					{Type: "tool_use", Id: "tool_text", Name: "read_file", Input: map[string]any{}},
				}},
				{Role: "user", Content: []dto.ClaudeMediaMessage{
					{Type: "tool_result", ToolUseId: "tool_image", Content: []dto.ClaudeMediaMessage{
						{Type: "text", Text: rc40StringPointer("captured")},
						{Type: "image", Source: &dto.ClaudeMessageSource{Type: "base64", MediaType: "image/png", Data: imageData}},
					}},
					{Type: "tool_result", ToolUseId: "tool_text", Content: "note contents"},
					{Type: "text", Text: &text},
				}},
			},
		}, &convmeta.Values{})
		require.NoError(t, err)

		roles := make([]string, 0, len(got.Messages))
		for _, message := range got.Messages {
			roles = append(roles, message.Role)
		}
		require.Equal(t, []string{"user", "assistant", "tool", "tool", "user"}, roles)
		require.Len(t, got.Messages[1].ParseToolCalls(), 2)
		assert.Equal(t, "tool_image", got.Messages[2].ToolCallId)
		assert.Equal(t, "tool_text", got.Messages[3].ToolCallId)
		assert.Equal(t, "captured", got.Messages[2].StringContent())
		assert.Equal(t, "note contents", got.Messages[3].StringContent())
		parts := got.Messages[4].ParseContent()
		require.Len(t, parts, 2)
		assert.Equal(t, dto.ContentTypeImageURL, parts[0].Type)
		require.NotNil(t, parts[0].GetImageMedia())
		assert.Equal(t, dataURL, parts[0].GetImageMedia().Url)
		assert.Equal(t, "look again", parts[1].Text)
	})

	t.Run("unknown blocks retain historical JSON fallback", func(t *testing.T) {
		input, err := kitutil.Marshal([]map[string]any{
			{"type": "function_call", "call_id": "call_unknown", "name": "lookup", "arguments": "{}"},
			{"type": "function_call_output", "call_id": "call_unknown", "output": []any{
				map[string]any{"type": "input_text", "text": "partial"},
				map[string]any{"type": "vendor_block", "opaque": true},
			}},
		})
		require.NoError(t, err)
		responses, err := ResponsesRequestToChatCompletionsRequest(context.Background(), &dto.OpenAIResponsesRequest{
			Model: "gpt-test",
			Input: input,
		})
		require.NoError(t, err)
		require.Len(t, responses.Messages, 2)
		assert.JSONEq(t, `[{"text":"partial","type":"input_text"},{"opaque":true,"type":"vendor_block"}]`, responses.Messages[1].StringContent())

		maxTokens := uint(64)
		claude, err := claudemessages.ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
			Model:     "claude-test",
			MaxTokens: &maxTokens,
			Messages: []dto.ClaudeMessage{
				{Role: "assistant", Content: []dto.ClaudeMediaMessage{
					{Type: "tool_use", Id: "tool_unknown", Name: "lookup", Input: map[string]any{}},
				}},
				{Role: "user", Content: []dto.ClaudeMediaMessage{
					{Type: "tool_result", ToolUseId: "tool_unknown", Content: []dto.ClaudeMediaMessage{
						{Type: "text", Text: rc40StringPointer("partial")},
						{Type: "document", Data: "opaque"},
					}},
				}},
			},
		}, &convmeta.Values{})
		require.NoError(t, err)
		require.Len(t, claude.Messages, 2)
		assert.JSONEq(t, `[{"type":"text","text":"partial"},{"type":"document","data":"opaque"}]`, claude.Messages[1].StringContent())
	})

	t.Run("Responses mixed unknown blocks retain whole historical fallback", func(t *testing.T) {
		input, err := kitutil.Marshal([]map[string]any{
			{"type": "function_call", "call_id": "call_mixed", "name": "lookup", "arguments": "{}"},
			{"type": "function_call_output", "call_id": "call_mixed", "output": []any{
				map[string]any{"type": "input_text", "text": "partial"},
				map[string]any{"type": "input_image", "image_url": dataURL},
				map[string]any{"type": "vendor_block", "opaque": true},
			}},
		})
		require.NoError(t, err)
		responses, err := ResponsesRequestToChatCompletionsRequest(context.Background(), &dto.OpenAIResponsesRequest{
			Model: "gpt-test",
			Input: input,
		})
		require.NoError(t, err)
		require.Len(t, responses.Messages, 2)
		assert.JSONEq(t, `[{"text":"partial","type":"input_text"},{"image_url":"`+dataURL+`","type":"input_image"},{"opaque":true,"type":"vendor_block"}]`, responses.Messages[1].StringContent())
	})

	t.Run("Claude mixed unknown blocks retain whole historical fallback", func(t *testing.T) {
		maxTokens := uint(64)
		claude, err := claudemessages.ClaudeMessagesRequestToOpenAIChat(context.Background(), dto.ClaudeRequest{
			Model:     "claude-test",
			MaxTokens: &maxTokens,
			Messages: []dto.ClaudeMessage{
				{Role: "assistant", Content: []dto.ClaudeMediaMessage{
					{Type: "tool_use", Id: "tool_mixed", Name: "lookup", Input: map[string]any{}},
				}},
				{Role: "user", Content: []dto.ClaudeMediaMessage{
					{Type: "tool_result", ToolUseId: "tool_mixed", Content: []dto.ClaudeMediaMessage{
						{Type: "text", Text: rc40StringPointer("partial")},
						{Type: "image", Source: &dto.ClaudeMessageSource{Type: "base64", MediaType: "image/png", Data: imageData}},
						{Type: "document", Data: "opaque"},
					}},
				}},
			},
		}, &convmeta.Values{})
		require.NoError(t, err)
		require.Len(t, claude.Messages, 2)
		assert.JSONEq(t, `[{"type":"text","text":"partial"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"`+imageData+`"}},{"type":"document","data":"opaque"}]`, claude.Messages[1].StringContent())
	})
}

func rc40StringPointer(value string) *string {
	return &value
}
