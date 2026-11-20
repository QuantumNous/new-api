package oaichat

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/MoeForge/moego/ojson"
	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestChatCompletionsRequestToResponsesRequestInstructionsAndTools(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		N:     lo.ToPtr(1),
		Messages: []dto.Message{
			{Role: "system", Content: "system rules"},
			{Role: "developer", Content: "developer rules"},
			{Role: "user", Content: []any{
				map[string]any{"type": "text", "text": "look"},
				map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.test/a.png"}},
			}},
			assistantMessageWithTool("partial text", "call_1", "lookup", `{"q":"x"}`),
			{Role: "tool", ToolCallId: "call_1", Content: "tool result"},
		},
	}

	got, err := ChatCompletionsRequestToResponsesRequest(context.Background(), req)
	require.NoError(t, err)

	assert.Equal(t, "gpt-test", got.Model)
	assert.Equal(t, `"system rules\n\ndeveloper rules"`, string(got.Instructions))
	assert.Equal(t, "input_image", ojson.GetBytes(got.Input, "0.content.1.type").String())
	assert.Equal(t, "function_call", ojson.GetBytes(got.Input, "2.type").String())
	assert.Equal(t, "call_1", ojson.GetBytes(got.Input, "2.call_id").String())
	assert.Equal(t, "function_call_output", ojson.GetBytes(got.Input, "3.type").String())
}

func TestChatCompletionsRequestToResponsesRequestImageDetail(t *testing.T) {
	tests := []struct {
		name     string
		imageURL any
		want     string
	}{
		{name: "object without detail defaults to auto", imageURL: map[string]any{"url": "https://example.test/a.png"}, want: "auto"},
		{name: "low detail is preserved", imageURL: map[string]any{"url": "https://example.test/a.png", "detail": "low"}, want: "low"},
		{name: "high detail is preserved", imageURL: map[string]any{"url": "https://example.test/a.png", "detail": "high"}, want: "high"},
		{name: "auto detail is preserved", imageURL: map[string]any{"url": "https://example.test/a.png", "detail": "auto"}, want: "auto"},
		{name: "original detail is preserved", imageURL: map[string]any{"url": "https://example.test/a.png", "detail": "original"}, want: "original"},
		{name: "unknown detail falls back to auto", imageURL: map[string]any{"url": "https://example.test/a.png", "detail": "bogus"}, want: "auto"},
		{name: "plain string url defaults to auto", imageURL: "https://example.test/a.png", want: "auto"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ChatCompletionsRequestToResponsesRequest(context.Background(), &dto.GeneralOpenAIRequest{
				Model: "gpt-test",
				Messages: []dto.Message{{Role: "user", Content: []any{
					map[string]any{"type": "image_url", "image_url": tt.imageURL},
				}}},
			})
			require.NoError(t, err)

			assert.Equal(t, "input_image", ojson.GetBytes(got.Input, "0.content.0.type").String())
			assert.Equal(t, tt.want, ojson.GetBytes(got.Input, "0.content.0.detail").String())
		})
	}
}

func TestChatCompletionsRequestToResponsesRequestPreservesPromptCacheKey(t *testing.T) {
	t.Run("present", func(t *testing.T) {
		key := "session-\"quoted\"\\path\n世界"
		got, err := ChatCompletionsRequestToResponsesRequest(context.Background(), &dto.GeneralOpenAIRequest{
			Model:          "gpt-test",
			Messages:       []dto.Message{{Role: "user", Content: "hello"}},
			PromptCacheKey: key,
		})
		require.NoError(t, err)

		keyRaw, err := kitutil.Marshal(key)
		require.NoError(t, err)
		assert.Equal(t, keyRaw, []byte(got.PromptCacheKey))

		encoded, err := kitutil.Marshal(got)
		require.NoError(t, err)
		assert.Equal(t, key, ojson.GetBytes(encoded, "prompt_cache_key").String())
	})

	t.Run("absent", func(t *testing.T) {
		got, err := ChatCompletionsRequestToResponsesRequest(context.Background(), &dto.GeneralOpenAIRequest{
			Model:    "gpt-test",
			Messages: []dto.Message{{Role: "user", Content: "hello"}},
		})
		require.NoError(t, err)

		encoded, err := kitutil.Marshal(got)
		require.NoError(t, err)
		assert.False(t, ojson.GetBytes(encoded, "prompt_cache_key").Exists())
	})
}

func TestChatCompletionsRequestToResponsesRequestCacheControls(t *testing.T) {
	for _, tc := range []struct {
		name, options, retention, wantOptions, wantError string
	}{
		{name: "shared options", options: `{"mode":"implicit","ttl":"30m"}`, wantOptions: `{"mode":"implicit","ttl":"30m"}`},
		{name: "legacy retention stays independent", retention: `"24h"`},
		{name: "absent"},
		{name: "null", options: `null`},
		{name: "empty", options: `{}`},
		{name: "explicit without breakpoints", options: `{"mode":"explicit"}`, wantOptions: `{"mode":"explicit"}`},
		{name: "Responses-only TTL", options: `{"ttl":"12h"}`, wantError: "prompt_cache_options.ttl"},
		{name: "Responses-only prewarm", options: `{"prewarm":true}`, wantError: "unsupported field \"prewarm\""},
		{name: "malformed mode", options: `{"mode":true}`, wantError: "invalid prompt_cache_options.mode"},
		{name: "unknown option", options: `{"extra":true}`, wantError: "unsupported field \"extra\""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := &dto.GeneralOpenAIRequest{
				Model:                "gpt-test",
				Messages:             []dto.Message{{Role: "user", Content: "stable prompt"}},
				PromptCacheOptions:   json.RawMessage(tc.options),
				PromptCacheRetention: json.RawMessage(tc.retention),
			}
			converted, err := ChatCompletionsRequestToResponsesRequest(context.Background(), request)
			if tc.wantError != "" {
				require.ErrorContains(t, err, tc.wantError)
				assert.Nil(t, converted)
				return
			}
			require.NoError(t, err)
			encoded, err := kitutil.Marshal(converted)
			require.NoError(t, err)
			for name, expected := range map[string]string{"prompt_cache_options": tc.wantOptions, "prompt_cache_retention": tc.retention} {
				if expected == "" {
					assert.False(t, ojson.GetBytes(encoded, name).Exists(), name)
				} else {
					assert.JSONEq(t, expected, ojson.GetBytes(encoded, name).Raw, name)
				}
			}
		})
	}
}

func TestChatCompletionsRequestToResponsesRequestCacheBreakpoints(t *testing.T) {
	for _, tc := range []struct {
		name, request, wantPath string
	}{
		{
			name:     "implicit mode by omission",
			request:  `{"messages":[{"role":"user","content":[{"type":"text","text":"prefix","prompt_cache_breakpoint":{}}]}]}`,
			wantPath: "messages[0].content[0].prompt_cache_breakpoint",
		},
		{
			name:     "implicit mode with developer instructions",
			request:  `{"prompt_cache_options":{"mode":"implicit"},"messages":[{"role":"developer","content":[{"type":"text","text":"prefix","prompt_cache_breakpoint":{"mode":"explicit"}}]}]}`,
			wantPath: "messages[0].content[0].prompt_cache_breakpoint",
		},
		{
			name:     "explicit mode with a tool message",
			request:  `{"prompt_cache_options":{"mode":"explicit"},"messages":[{"role":"tool","tool_call_id":"call_1","content":[{"type":"text","text":"prefix","prompt_cache_breakpoint":{"ttl":"30m"}}]}]}`,
			wantPath: "messages[0].content[0].prompt_cache_breakpoint",
		},
		{
			name:    "text and function parameter names",
			request: `{"messages":[{"role":"user","content":[{"type":"text","text":"{\"prompt_cache_breakpoint\":{}}"}]}],"tools":[{"type":"function","function":{"name":"lookup","parameters":{"type":"object","properties":{"prompt_cache_breakpoint":{"type":"string"}}}}}]}`,
		},
		{
			name:     "prediction content array",
			request:  `{"messages":[{"role":"user","content":"hello"}],"prediction":{"type":"content","content":[{"type":"text","text":"prefix","prompt_cache_breakpoint":{}}]}}`,
			wantPath: "prediction.content[0].prompt_cache_breakpoint",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var req dto.GeneralOpenAIRequest
			require.NoError(t, kitutil.Unmarshal([]byte(tc.request), &req))
			req.Model = "gpt-test"
			converted, err := ChatCompletionsRequestToResponsesRequest(context.Background(), &req)
			if tc.wantPath != "" {
				require.ErrorContains(t, err, tc.wantPath)
				assert.Nil(t, converted)
				return
			}
			require.NoError(t, err)
			assert.Contains(t, string(converted.Input), "prompt_cache_breakpoint")
			assert.Contains(t, string(converted.Tools), "prompt_cache_breakpoint")
		})
	}
}

func TestChatCompletionsRequestToResponsesRequestPreservesQwenThinkingBudget(t *testing.T) {
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
			req := &dto.GeneralOpenAIRequest{
				Model:          "qwen-plus",
				EnableThinking: json.RawMessage(`true`),
				ThinkingBudget: tt.budget,
				Messages: []dto.Message{
					{Role: "user", Content: "hello"},
				},
			}

			got, err := ChatCompletionsRequestToResponsesRequest(context.Background(), req)
			require.NoError(t, err)
			assert.Equal(t, tt.budget, got.ThinkingBudget)

			encoded, err := kitutil.Marshal(got)
			require.NoError(t, err)

			assert.True(t, ojson.GetBytes(encoded, "enable_thinking").Bool())
			value := ojson.GetBytes(encoded, "thinking_budget")
			assert.True(t, value.Exists())
			assert.Equal(t, tt.want, value.Int())
		})
	}
}

func TestChatCompletionsRequestToResponsesRequestRejectsMultipleChoices(t *testing.T) {
	_, err := ChatCompletionsRequestToResponsesRequest(context.Background(), &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		N:     lo.ToPtr(2),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "n>1")
}

func TestChatCompletionsRequestToResponsesRequestPreservesPenalties(t *testing.T) {
	tests := []struct {
		name          string
		frequency     *float64
		frequencyWant json.RawMessage
		presence      *float64
		presenceWant  json.RawMessage
	}{
		{
			name:          "positive values",
			frequency:     lo.ToPtr(0.5),
			frequencyWant: json.RawMessage(`0.5`),
			presence:      lo.ToPtr(1.5),
			presenceWant:  json.RawMessage(`1.5`),
		},
		{
			name:          "explicit zero values",
			frequency:     lo.ToPtr(0.0),
			frequencyWant: json.RawMessage(`0`),
			presence:      lo.ToPtr(0.0),
			presenceWant:  json.RawMessage(`0`),
		},
		{
			name:      "unset stays nil",
			frequency: nil,
			presence:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ChatCompletionsRequestToResponsesRequest(context.Background(), &dto.GeneralOpenAIRequest{
				Model:            "gpt-test",
				Messages:         []dto.Message{{Role: "user", Content: "hello"}},
				FrequencyPenalty: tt.frequency,
				PresencePenalty:  tt.presence,
			})
			require.NoError(t, err)

			assert.Equal(t, tt.frequencyWant, got.FrequencyPenalty)
			assert.Equal(t, tt.presenceWant, got.PresencePenalty)
		})
	}
}

func assistantMessageWithTool(content string, id string, name string, args string) dto.Message {
	msg := dto.Message{Role: "assistant", Content: content}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   id,
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      name,
				Arguments: args,
			},
		},
	})
	return msg
}
