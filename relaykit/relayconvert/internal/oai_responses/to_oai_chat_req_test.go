package oairesponses

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestResponsesRequestToChatCompletionsRequestInstructionsAndScalarInput(t *testing.T) {
	stream := true
	temperature := 0.0
	topP := 0.9
	maxOutputTokens := uint(128)
	parallelToolCalls := true

	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model:                "gpt-test",
		Instructions:         mustRawMessage(t, "system rules"),
		Input:                mustRawMessage(t, "hello"),
		Stream:               &stream,
		StreamOptions:        &dto.StreamOptions{IncludeUsage: true},
		MaxOutputTokens:      &maxOutputTokens,
		Temperature:          &temperature,
		TopP:                 &topP,
		User:                 mustRawMessage(t, "user-1"),
		Store:                mustRawMessage(t, false),
		Metadata:             mustRawMessage(t, map[string]any{"trace": "abc"}),
		ParallelToolCalls:    mustRawMessage(t, parallelToolCalls),
		PromptCacheKey:       mustRawMessage(t, "cache-key"),
		PromptCacheRetention: mustRawMessage(t, "24h"),
		Reasoning:            &dto.Reasoning{Effort: "medium"},
	})
	require.NoError(t, err)

	assert.Equal(t, "gpt-test", got.Model)
	require.Len(t, got.Messages, 2)
	assert.Equal(t, dto.Message{Role: "system", Content: "system rules"}, got.Messages[0])
	assert.Equal(t, dto.Message{Role: "user", Content: "hello"}, got.Messages[1])
	assert.Same(t, &stream, got.Stream)
	require.NotNil(t, got.StreamOptions)
	assert.True(t, got.StreamOptions.IncludeUsage)
	assert.Equal(t, maxOutputTokens, lo.FromPtr(got.MaxCompletionTokens))
	assert.Equal(t, 0.0, lo.FromPtr(got.Temperature))
	assert.Equal(t, 0.9, lo.FromPtr(got.TopP))
	assert.True(t, lo.FromPtr(got.ParallelTooCalls))
	assert.Equal(t, "cache-key", got.PromptCacheKey)
	assert.Equal(t, "medium", got.ReasoningEffort)
	assert.Equal(t, `"user-1"`, string(got.User))
	assert.Equal(t, `false`, string(got.Store))
	assert.Equal(t, "abc", gjson.GetBytes(got.Metadata, "trace").String())
}

func TestResponsesRequestToChatCompletionsRequestPreservesQwenThinkingBudget(t *testing.T) {
	tests := []struct {
		name   string
		budget json.RawMessage
		want   int64
	}{
		{name: "positive budget", budget: json.RawMessage(`128`), want: 128},
		{name: "zero budget", budget: json.RawMessage(`0`), want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
				Model:          "qwen-plus",
				Input:          mustRawMessage(t, "hello"),
				EnableThinking: json.RawMessage(`true`),
				ThinkingBudget: tt.budget,
			})
			require.NoError(t, err)
			assert.Equal(t, tt.budget, got.ThinkingBudget)

			encoded, err := kitutil.Marshal(got)
			require.NoError(t, err)

			assert.True(t, gjson.GetBytes(encoded, "enable_thinking").Bool())
			value := gjson.GetBytes(encoded, "thinking_budget")
			assert.True(t, value.Exists())
			assert.Equal(t, tt.want, value.Int())
		})
	}
}

func TestResponsesRequestToChatCompletionsRequestMultimodalInput(t *testing.T) {
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{
				"role": "user",
				"content": []map[string]any{
					{"type": "input_text", "text": "look"},
					{"type": "input_image", "image_url": "https://example.test/a.png", "detail": "low"},
					{"type": "input_file", "file_id": "file_1", "filename": "a.txt"},
					{"type": "input_audio", "input_audio": map[string]any{"data": "abc", "format": "wav"}},
					{"type": "input_video", "video_url": map[string]any{"url": "https://example.test/v.mp4"}},
				},
			},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 1)
	assert.Equal(t, "user", got.Messages[0].Role)
	parts := got.Messages[0].ParseContent()
	require.Len(t, parts, 5)
	assert.Equal(t, dto.ContentTypeText, parts[0].Type)
	assert.Equal(t, "look", parts[0].Text)
	assert.Equal(t, dto.ContentTypeImageURL, parts[1].Type)
	assert.Equal(t, "https://example.test/a.png", parts[1].GetImageMedia().Url)
	assert.Equal(t, dto.ContentTypeFile, parts[2].Type)
	assert.Equal(t, "file_1", parts[2].GetFile().FileId)
	assert.Equal(t, dto.ContentTypeInputAudio, parts[3].Type)
	assert.Equal(t, "wav", parts[3].GetInputAudio().Format)
	assert.Equal(t, dto.ContentTypeVideoUrl, parts[4].Type)
	assert.Equal(t, "https://example.test/v.mp4", parts[4].GetVideoUrl().Url)
}

func TestResponsesRequestToChatCompletionsRequestPreservesToolCallReasoning(t *testing.T) {
	tests := []struct {
		name          string
		input         []map[string]any
		wantContent   string
		wantReasoning string
		wantCalls     int
	}{
		{
			name: "reasoning before parallel function calls",
			input: []map[string]any{
				{
					"type": "reasoning",
					"summary": []map[string]any{
						{"type": "summary_text", "text": "Need both "},
						{"type": "summary_text", "text": "tool results."},
					},
				},
				{"type": "function_call", "call_id": "call_1", "name": "first", "arguments": `{}`},
				{"type": "function_call", "call_id": "call_2", "name": "second", "arguments": `{}`},
				{"type": "function_call_output", "call_id": "call_1", "output": "one"},
				{"type": "function_call_output", "call_id": "call_2", "output": "two"},
			},
			wantReasoning: "Need both tool results.",
			wantCalls:     2,
		},
		{
			name: "reasoning between assistant text and function call",
			input: []map[string]any{
				{
					"role":    "assistant",
					"content": []map[string]any{{"type": "output_text", "text": "Checking now."}},
				},
				{
					"type":    "reasoning",
					"content": []map[string]any{{"type": "summary_text", "text": "Need the lookup."}},
				},
				{"type": "function_call", "call_id": "call_1", "name": "lookup", "arguments": `{}`},
				{"type": "function_call_output", "call_id": "call_1", "output": "done"},
			},
			wantContent:   "Checking now.",
			wantReasoning: "Need the lookup.",
			wantCalls:     1,
		},
		{
			name: "reasoning embedded in function call",
			input: []map[string]any{
				{
					"type":              "function_call",
					"call_id":           "call_1",
					"name":              "lookup",
					"arguments":         `{}`,
					"reasoning_content": "Need the lookup.",
				},
				{"type": "function_call_output", "call_id": "call_1", "output": "done"},
			},
			wantReasoning: "Need the lookup.",
			wantCalls:     1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
				Model: "gpt-test",
				Input: mustRawMessage(t, tt.input),
			})
			require.NoError(t, err)

			require.Len(t, got.Messages, tt.wantCalls+1)
			assistant := got.Messages[0]
			assert.Equal(t, "assistant", assistant.Role)
			assert.Equal(t, tt.wantContent, assistant.StringContent())
			assert.Equal(t, tt.wantReasoning, assistant.GetReasoningContent())
			assert.Len(t, assistant.ParseToolCalls(), tt.wantCalls)
		})
	}
}

func TestResponsesRequestToChatCompletionsRequestReasoningItemNeverBecomesUserMessage(t *testing.T) {
	// Regression: a standalone reasoning item without a role previously fell into
	// the default branch and was emitted as role="user", corrupting the history.
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{"role": "user", "content": "hi"},
			{
				"type":    "reasoning",
				"summary": []map[string]any{{"type": "summary_text", "text": "thinking..."}},
			},
			{"role": "user", "content": "continue"},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 3)
	assert.Equal(t, "user", got.Messages[0].Role)
	assert.Equal(t, "assistant", got.Messages[1].Role)
	assert.Equal(t, "thinking...", got.Messages[1].GetReasoningContent())
	assert.Equal(t, "user", got.Messages[2].Role)
	assert.Equal(t, "continue", got.Messages[2].StringContent())
	for i, message := range got.Messages {
		assert.NotEqualf(t, "thinking...", message.StringContent(), "reasoning text leaked into content of message %d", i)
	}
}

func TestResponsesRequestToChatCompletionsRequestOrphanReasoningBecomesStandaloneAssistant(t *testing.T) {
	// Reasoning with no following function_call must not be dropped: it is kept as
	// a standalone assistant message (mirrors the modelbridge decode behavior).
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{"type": "reasoning", "summary": []map[string]any{{"type": "summary_text", "text": "orphan thought"}}},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 1)
	assert.Equal(t, "assistant", got.Messages[0].Role)
	assert.Equal(t, "orphan thought", got.Messages[0].GetReasoningContent())
}

func TestResponsesRequestToChatCompletionsRequestMergesConsecutiveAssistantReasoning(t *testing.T) {
	// An assistant message with inline reasoning followed by a standalone
	// reasoning item and a function_call: both reasoning parts land on the single
	// assistant message carrying the tool call (inline first, then pending).
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{"role": "assistant", "content": "先做第一步", "reasoning_content": "推理A"},
			{"type": "reasoning", "summary": []map[string]any{{"type": "summary_text", "text": "推理B"}}},
			{"type": "function_call", "call_id": "c1", "name": "f", "arguments": `{}`},
			{"type": "function_call_output", "call_id": "c1", "output": "ok"},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 2)
	assert.Equal(t, "推理A推理B", got.Messages[0].GetReasoningContent())
	assert.Len(t, got.Messages[0].ParseToolCalls(), 1)
}

func TestResponsesRequestToChatCompletionsRequestReasoningBeforeToolOutput(t *testing.T) {
	// Reasoning immediately before a function_call_output (no function_call):
	// it becomes a standalone assistant message placed before the tool message.
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{"type": "reasoning", "summary": []map[string]any{{"type": "summary_text", "text": "孤立推理"}}},
			{"type": "function_call_output", "call_id": "c1", "output": "ok"},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 2)
	assert.Equal(t, "assistant", got.Messages[0].Role)
	assert.Equal(t, "孤立推理", got.Messages[0].GetReasoningContent())
	assert.Equal(t, "tool", got.Messages[1].Role)
}

func TestResponsesRequestToChatCompletionsRequestPendingReasoningPrecedesInline(t *testing.T) {
	// A standalone reasoning item precedes an assistant message carrying an
	// inline reasoning_content key: the merged reasoning must keep wire order
	// (pending first, inline second).
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{"type": "reasoning", "summary": []map[string]any{{"type": "summary_text", "text": "B"}}},
			{"role": "assistant", "content": "hi", "reasoning_content": "A"},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 1)
	assert.Equal(t, "BA", got.Messages[0].GetReasoningContent())
}

func TestResponsesRequestToChatCompletionsRequestReasoningStaysInOwnTurn(t *testing.T) {
	// After a tool output message, the next function_call starts a new assistant
	// message, so each turn keeps its own reasoning:
	// [assistant(r1, f1), tool, assistant(r2, f2), tool].
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{"type": "reasoning", "summary": []map[string]any{{"type": "summary_text", "text": "回合1推理"}}},
			{"type": "function_call", "call_id": "c1", "name": "f1", "arguments": `{}`},
			{"type": "function_call_output", "call_id": "c1", "output": "r1"},
			{"type": "reasoning", "summary": []map[string]any{{"type": "summary_text", "text": "回合2推理"}}},
			{"type": "function_call", "call_id": "c2", "name": "f2", "arguments": `{}`},
			{"type": "function_call_output", "call_id": "c2", "output": "r2"},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 4)
	assert.Equal(t, "assistant", got.Messages[0].Role)
	assert.Equal(t, "回合1推理", got.Messages[0].GetReasoningContent())
	assert.Len(t, got.Messages[0].ParseToolCalls(), 1)
	assert.Equal(t, "tool", got.Messages[1].Role)
	assert.Equal(t, "assistant", got.Messages[2].Role)
	assert.Equal(t, "回合2推理", got.Messages[2].GetReasoningContent())
	assert.Len(t, got.Messages[2].ParseToolCalls(), 1)
	assert.Equal(t, "tool", got.Messages[3].Role)
}

func TestResponsesRequestToChatCompletionsRequestAssistantTextAndFunctionCallCoexist(t *testing.T) {
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{
				"role": "assistant",
				"content": []map[string]any{
					{"type": "output_text", "text": "I will call."},
				},
			},
			{
				"type":      "function_call",
				"call_id":   "call_1",
				"name":      "lookup",
				"arguments": map[string]any{"q": "x"},
			},
			{
				"type":    "function_call_output",
				"call_id": "call_1",
				"output":  map[string]any{"ok": true},
			},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 2)
	assert.Equal(t, "assistant", got.Messages[0].Role)
	assert.Equal(t, "I will call.", got.Messages[0].StringContent())
	toolCalls := got.Messages[0].ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "call_1", toolCalls[0].ID)
	assert.Equal(t, "function", toolCalls[0].Type)
	assert.Equal(t, "lookup", toolCalls[0].Function.Name)
	assert.JSONEq(t, `{"q":"x"}`, toolCalls[0].Function.Arguments)
	assert.Equal(t, "tool", got.Messages[1].Role)
	assert.Equal(t, "call_1", got.Messages[1].ToolCallId)
	assert.JSONEq(t, `{"ok":true}`, got.Messages[1].StringContent())
}

func TestResponsesRequestToChatCompletionsRequestOnlyFunctionCallCreatesAssistant(t *testing.T) {
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{
				"type":      "function_call",
				"call_id":   "call_1",
				"name":      "lookup",
				"arguments": `{"q":"x"}`,
			},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 1)
	assert.Equal(t, "assistant", got.Messages[0].Role)
	assert.Nil(t, got.Messages[0].Content)
	toolCalls := got.Messages[0].ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, `{"q":"x"}`, toolCalls[0].Function.Arguments)
}

func TestResponsesRequestToChatCompletionsRequestToolsToolChoiceAndTextFormat(t *testing.T) {
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, "hello"),
		Tools: mustRawMessage(t, []map[string]any{
			{
				"type":        "function",
				"name":        "lookup",
				"description": "Lookup data",
				"parameters": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"q": map[string]any{"type": "string"},
					},
				},
			},
		}),
		ToolChoice: mustRawMessage(t, map[string]any{
			"type": "function",
			"name": "lookup",
		}),
		Text: mustRawMessage(t, map[string]any{
			"format": map[string]any{
				"type":   "json_schema",
				"name":   "answer",
				"schema": map[string]any{"type": "object"},
				"strict": true,
			},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Tools, 1)
	assert.Equal(t, "function", got.Tools[0].Type)
	assert.Equal(t, "lookup", got.Tools[0].Function.Name)
	assert.Equal(t, "Lookup data", got.Tools[0].Function.Description)
	assert.Equal(t, "object", got.Tools[0].Function.Parameters.(map[string]any)["type"])
	assert.Equal(t, map[string]any{
		"type": "function",
		"function": map[string]any{
			"name": "lookup",
		},
	}, got.ToolChoice)
	require.NotNil(t, got.ResponseFormat)
	assert.Equal(t, "json_schema", got.ResponseFormat.Type)
	assert.Equal(t, "answer", gjson.GetBytes(got.ResponseFormat.JsonSchema, "name").String())
	assert.True(t, gjson.GetBytes(got.ResponseFormat.JsonSchema, "strict").Bool())
}

func TestResponsesRequestToChatCompletionsRequestCustomToolCallPreservesRawShape(t *testing.T) {
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model: "gpt-test",
		Input: mustRawMessage(t, []map[string]any{
			{
				"type":    "custom_tool_call",
				"call_id": "call_custom",
				"name":    "apply_patch",
				"input":   "patch body",
			},
		}),
	})
	require.NoError(t, err)

	require.Len(t, got.Messages, 1)
	toolCalls := got.Messages[0].ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, dto.CustomType, toolCalls[0].Type)
	assert.Equal(t, "call_custom", toolCalls[0].ID)
	assert.Equal(t, "apply_patch", toolCalls[0].Function.Name)
	assert.Equal(t, "patch body", toolCalls[0].Function.Arguments)
	assert.Equal(t, "custom_tool_call", gjson.GetBytes(toolCalls[0].Custom, "type").String())
	assert.Equal(t, "patch body", gjson.GetBytes(toolCalls[0].Custom, "input").String())
}

func TestResponsesRequestToChatCompletionsRequestRejectsStatefulFields(t *testing.T) {
	tests := []struct {
		name string
		req  *dto.OpenAIResponsesRequest
		want string
	}{
		{
			name: "conversation",
			req:  &dto.OpenAIResponsesRequest{Model: "gpt-test", Conversation: mustRawMessage(t, "conv_1")},
			want: "conversation",
		},
		{
			name: "previous response",
			req:  &dto.OpenAIResponsesRequest{Model: "gpt-test", PreviousResponseID: "resp_1"},
			want: "previous_response_id",
		},
		{
			name: "prompt",
			req:  &dto.OpenAIResponsesRequest{Model: "gpt-test", Prompt: mustRawMessage(t, map[string]any{"id": "pmpt_1"})},
			want: "prompt",
		},
		{
			name: "context management",
			req:  &dto.OpenAIResponsesRequest{Model: "gpt-test", ContextManagement: mustRawMessage(t, map[string]any{"type": "auto"})},
			want: "context_management",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ResponsesRequestToChatCompletionsRequest(tt.req)
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.want)
			assert.Contains(t, err.Error(), "stateful fields")
		})
	}
}

func mustRawMessage(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := kitutil.Marshal(value)
	require.NoError(t, err)
	return raw
}
