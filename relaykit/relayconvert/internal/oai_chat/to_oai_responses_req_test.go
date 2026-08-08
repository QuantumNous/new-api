package oaichat

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	kitutil "github.com/QuantumNous/new-api/relaykit/relayconvert/kitutil"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
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

	got, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	assert.Equal(t, "gpt-test", got.Model)
	assert.Equal(t, `"system rules\n\ndeveloper rules"`, string(got.Instructions))
	assert.Equal(t, "input_image", gjson.GetBytes(got.Input, "0.content.1.type").String())
	assert.Equal(t, "function_call", gjson.GetBytes(got.Input, "2.type").String())
	assert.Equal(t, "call_1", gjson.GetBytes(got.Input, "2.call_id").String())
	assert.Equal(t, "function_call_output", gjson.GetBytes(got.Input, "3.type").String())
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

			got, err := ChatCompletionsRequestToResponsesRequest(req)
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

func TestChatCompletionsRequestToResponsesRequestPreservesAssistantReasoning(t *testing.T) {
	reasoning := "需要先定位城市，再调用天气接口"

	newAssistantMsg := func() dto.Message {
		msg := dto.Message{Role: "assistant", ReasoningContent: lo.ToPtr(reasoning)}
		msg.SetToolCalls([]dto.ToolCallRequest{
			{
				ID:   "call_1",
				Type: "function",
				Function: dto.FunctionRequest{
					Name:      "get_weather",
					Arguments: `{}`,
				},
			},
		})
		return msg
	}

	t.Run("reasoning with tool calls", func(t *testing.T) {
		got, err := ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
			Model: "gpt-test",
			Messages: []dto.Message{
				{Role: "user", Content: "查天气"},
				newAssistantMsg(),
				{Role: "tool", ToolCallId: "call_1", Content: "晴"},
				{Role: "user", Content: "继续"},
			},
		})
		require.NoError(t, err)

		assert.Equal(t, "user", gjson.GetBytes(got.Input, "0.role").String())
		assert.Equal(t, "reasoning", gjson.GetBytes(got.Input, "1.type").String())
		assert.True(t, strings.HasPrefix(gjson.GetBytes(got.Input, "1.id").String(), "rs_"))
		assert.Equal(t, "summary_text", gjson.GetBytes(got.Input, "1.summary.0.type").String())
		assert.Equal(t, reasoning, gjson.GetBytes(got.Input, "1.summary.0.text").String())
		assert.Equal(t, "assistant", gjson.GetBytes(got.Input, "2.role").String())
		assert.Equal(t, "function_call", gjson.GetBytes(got.Input, "3.type").String())
		assert.Equal(t, "call_1", gjson.GetBytes(got.Input, "3.call_id").String())
		assert.Equal(t, "function_call_output", gjson.GetBytes(got.Input, "4.type").String())
		assert.Equal(t, "user", gjson.GetBytes(got.Input, "5.role").String())
	})

	t.Run("reasoning with text content", func(t *testing.T) {
		msg := dto.Message{Role: "assistant", Content: "已查到结果", ReasoningContent: lo.ToPtr(reasoning)}
		got, err := ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
			Model:    "gpt-test",
			Messages: []dto.Message{msg},
		})
		require.NoError(t, err)

		assert.Equal(t, "reasoning", gjson.GetBytes(got.Input, "0.type").String())
		assert.Equal(t, reasoning, gjson.GetBytes(got.Input, "0.summary.0.text").String())
		assert.Equal(t, "assistant", gjson.GetBytes(got.Input, "1.role").String())
		assert.Equal(t, "已查到结果", gjson.GetBytes(got.Input, "1.content").String())
	})

	t.Run("reasoning alias field", func(t *testing.T) {
		msg := dto.Message{Role: "assistant", Content: "ok", Reasoning: lo.ToPtr(reasoning)}
		got, err := ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
			Model:    "gpt-test",
			Messages: []dto.Message{msg},
		})
		require.NoError(t, err)

		assert.Equal(t, "reasoning", gjson.GetBytes(got.Input, "0.type").String())
		assert.Equal(t, reasoning, gjson.GetBytes(got.Input, "0.summary.0.text").String())
	})

	t.Run("user message reasoning is not emitted", func(t *testing.T) {
		msg := dto.Message{Role: "user", Content: "hi", ReasoningContent: lo.ToPtr(reasoning)}
		got, err := ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
			Model:    "gpt-test",
			Messages: []dto.Message{msg},
		})
		require.NoError(t, err)

		assert.Equal(t, "user", gjson.GetBytes(got.Input, "0.role").String())
		assert.Equal(t, "", gjson.GetBytes(got.Input, "0.type").String())
		assert.Equal(t, "", gjson.GetBytes(got.Input, "1.type").String())
	})
}

func TestChatCompletionsRequestToResponsesRequestRejectsMultipleChoices(t *testing.T) {
	_, err := ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		N:     lo.ToPtr(2),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "n>1")
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
