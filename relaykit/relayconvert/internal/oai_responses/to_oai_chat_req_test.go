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

func TestResponsesRequestToChatCompletionsRequestPreservesPenalties(t *testing.T) {
	tests := []struct {
		name          string
		frequencyRaw  json.RawMessage
		frequencyWant *float64
		presenceRaw   json.RawMessage
		presenceWant  *float64
	}{
		{
			name:          "positive values",
			frequencyRaw:  json.RawMessage(`0.5`),
			frequencyWant: lo.ToPtr(0.5),
			presenceRaw:   json.RawMessage(`1.5`),
			presenceWant:  lo.ToPtr(1.5),
		},
		{
			name:          "explicit zero values",
			frequencyRaw:  json.RawMessage(`0.0`),
			frequencyWant: lo.ToPtr(0.0),
			presenceRaw:   json.RawMessage(`0.0`),
			presenceWant:  lo.ToPtr(0.0),
		},
		{
			name:         "unset stays nil",
			frequencyRaw: nil,
			presenceRaw:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
				Model:            "gpt-test",
				Input:            mustRawMessage(t, "hello"),
				FrequencyPenalty: tt.frequencyRaw,
				PresencePenalty:  tt.presenceRaw,
			})
			require.NoError(t, err)

			assert.Equal(t, tt.frequencyWant, got.FrequencyPenalty)
			assert.Equal(t, tt.presenceWant, got.PresencePenalty)
		})
	}
}

func TestResponsesRequestToChatCompletionsRequestRejectsMalformedPenalty(t *testing.T) {
	_, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{
		Model:            "gpt-test",
		Input:            mustRawMessage(t, "hello"),
		FrequencyPenalty: json.RawMessage(`"not-a-number"`),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "frequency_penalty")
}

func mustRawMessage(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := kitutil.Marshal(value)
	require.NoError(t, err)
	return raw
}

func TestResponsesToolMediaPreservesParallelRepliesAndPayloads(t *testing.T) {
	const image = "data:image/png;base64,AAEC"
	output := []map[string]any{
		{"type": "input_text", "text": "first image"},
		{"type": "input_image", "image_url": image, "detail": "high"},
		{"type": "input_text", "text": "second image"},
		{"type": "input_image", "image_url": "https://example.test/b.png", "detail": "low"},
		{"type": "input_file", "file_data": "data:application/pdf;base64,AAAA", "filename": "report.pdf"},
	}
	input := mustRawMessage(t, []map[string]any{
		{"type": "function_call", "call_id": "a", "name": "inspect", "arguments": "{}"},
		{"type": "function_call", "call_id": "b", "name": "inspect", "arguments": "{}"},
		{"type": "function_call_output", "call_id": "a", "output": output},
		{"type": "function_call_output", "call_id": "b", "output": []map[string]any{{"type": "input_image", "image_url": image}}},
		{"role": "assistant", "content": "done"},
	})
	original := string(input)
	got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{Model: "gpt-test", Input: input})
	require.NoError(t, err)
	require.Len(t, got.Messages, 6)
	assert.Equal(t, []string{"assistant", "tool", "tool", "user", "user", "assistant"}, []string{got.Messages[0].Role, got.Messages[1].Role, got.Messages[2].Role, got.Messages[3].Role, got.Messages[4].Role, got.Messages[5].Role})
	assert.Equal(t, "a", got.Messages[1].ToolCallId)
	assert.Equal(t, "b", got.Messages[2].ToolCallId)
	assert.NotContains(t, got.Messages[1].StringContent(), "base64")
	encoded, err := kitutil.Marshal(got)
	require.NoError(t, err)
	assert.Contains(t, gjson.GetBytes(encoded, "messages.3.content.0.text").String(), `call_id "a"`)
	assert.Equal(t, "first image", gjson.GetBytes(encoded, "messages.3.content.1.text").String())
	assert.Equal(t, image, gjson.GetBytes(encoded, "messages.3.content.2.image_url.url").String())
	assert.Equal(t, "high", gjson.GetBytes(encoded, "messages.3.content.2.image_url.detail").String())
	assert.Equal(t, "second image", gjson.GetBytes(encoded, "messages.3.content.3.text").String())
	assert.Equal(t, "low", gjson.GetBytes(encoded, "messages.3.content.4.image_url.detail").String())
	assert.Equal(t, "data:application/pdf;base64,AAAA", gjson.GetBytes(encoded, "messages.3.content.5.file.file_data").String())
	assert.Equal(t, image, gjson.GetBytes(encoded, "messages.4.content.1.image_url.url").String())
	assert.Equal(t, original, string(input))
}

func TestResponsesToolOutputContentBoundaries(t *testing.T) {
	for _, tt := range []struct {
		name    string
		output  any
		want    string
		wantErr string
		media   bool
	}{
		{name: "string", output: "plain", want: "plain"},
		{name: "object", output: map[string]any{"ok": true}, want: `{"ok":true}`},
		{name: "empty array", output: []any{}, want: `[]`},
		{name: "unknown parts", output: []any{map[string]any{"type": "unknown"}}, want: `[{"type":"unknown"}]`},
		{name: "text parts", output: []any{map[string]any{"type": "input_text", "text": "a"}, map[string]any{"type": "input_text", "text": "b"}}, want: "ab"},
		{name: "image at end", output: []any{map[string]any{"type": "input_image", "image_url": "data:image/png;base64,AAEC"}}, media: true},
		{name: "file id", output: []any{map[string]any{"type": "input_file", "file_id": "file-123"}}, media: true},
		{name: "unsupported image id", output: []any{map[string]any{"type": "input_image", "file_id": "file-123"}}, wantErr: "file_id images are unsupported"},
		{name: "unsupported file url", output: []any{map[string]any{"type": "input_file", "file_url": "https://example.test/a.pdf"}}, wantErr: "file_url is unsupported"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ResponsesRequestToChatCompletionsRequest(&dto.OpenAIResponsesRequest{Model: "gpt-test", Input: mustRawMessage(t, []map[string]any{
				{"type": "function_call", "call_id": "a", "name": "inspect", "arguments": "{}"},
				{"type": "function_call_output", "call_id": "a", "output": tt.output},
			})})
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				return
			}
			require.NoError(t, err)
			if tt.media {
				require.Len(t, got.Messages, 3)
				assert.Equal(t, "user", got.Messages[2].Role)
			} else {
				require.Len(t, got.Messages, 2)
				assert.Equal(t, tt.want, got.Messages[1].StringContent())
			}
		})
	}
}
