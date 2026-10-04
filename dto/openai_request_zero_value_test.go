package dto

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestGeneralOpenAIRequestPreserveExplicitZeroValues(t *testing.T) {
	raw := []byte(`{
		"model":"gpt-4.1",
		"stream":false,
		"max_tokens":0,
		"max_completion_tokens":0,
		"top_p":0,
		"top_k":0,
		"n":0,
		"frequency_penalty":0,
		"presence_penalty":0,
		"seed":0,
		"logprobs":false,
		"top_logprobs":0,
		"dimensions":0,
		"return_images":false,
		"return_related_questions":false
	}`)

	var req GeneralOpenAIRequest
	err := common.Unmarshal(raw, &req)
	require.NoError(t, err)

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	require.True(t, gjson.GetBytes(encoded, "stream").Exists())
	require.True(t, gjson.GetBytes(encoded, "max_tokens").Exists())
	require.True(t, gjson.GetBytes(encoded, "max_completion_tokens").Exists())
	require.True(t, gjson.GetBytes(encoded, "top_p").Exists())
	require.True(t, gjson.GetBytes(encoded, "top_k").Exists())
	require.True(t, gjson.GetBytes(encoded, "n").Exists())
	require.True(t, gjson.GetBytes(encoded, "frequency_penalty").Exists())
	require.True(t, gjson.GetBytes(encoded, "presence_penalty").Exists())
	require.True(t, gjson.GetBytes(encoded, "seed").Exists())
	require.True(t, gjson.GetBytes(encoded, "logprobs").Exists())
	require.True(t, gjson.GetBytes(encoded, "top_logprobs").Exists())
	require.True(t, gjson.GetBytes(encoded, "dimensions").Exists())
	require.True(t, gjson.GetBytes(encoded, "return_images").Exists())
	require.True(t, gjson.GetBytes(encoded, "return_related_questions").Exists())
}

func TestGeneralOpenAIRequestPreserveQwenThinkingBudget(t *testing.T) {
	req := GeneralOpenAIRequest{
		Model:          "qwen-plus",
		ThinkingBudget: json.RawMessage(`0`),
	}

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	value := gjson.GetBytes(encoded, "thinking_budget")
	assert.True(t, value.Exists())
	assert.Equal(t, int64(0), value.Int())
}

func TestGeneralOpenAIRequestPreserveQwQThinkingBudget(t *testing.T) {
	req := GeneralOpenAIRequest{
		Model:          "QwQ-32B",
		ThinkingBudget: json.RawMessage(`128`),
	}

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	value := gjson.GetBytes(encoded, "thinking_budget")
	assert.True(t, value.Exists())
	assert.Equal(t, int64(128), value.Int())
}

func TestGeneralOpenAIRequestDropsThinkingBudgetForNonQwenModel(t *testing.T) {
	req := GeneralOpenAIRequest{
		Model:          "gpt-4.1",
		ThinkingBudget: json.RawMessage(`128`),
	}

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	assert.False(t, gjson.GetBytes(encoded, "thinking_budget").Exists())
}

func TestIsQwenThinkingBudgetModel(t *testing.T) {
	tests := []struct {
		model string
		want  bool
	}{
		{model: "qwen-plus", want: true},
		{model: "Qwen/Qwen3-235B-A22B-Thinking-2507", want: true},
		{model: "qwq-32b", want: true},
		{model: "provider/qwen-plus", want: true},
		{model: "provider/qwq-32b", want: true},
		{model: "gpt-4.1", want: false},
		{model: "deepseek-r1", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			assert.Equal(t, tt.want, IsQwenThinkingBudgetModel(tt.model))
		})
	}
}

func TestOpenAIResponsesRequestPreserveExplicitZeroValues(t *testing.T) {
	raw := []byte(`{
		"model":"gpt-4.1",
		"max_output_tokens":0,
		"max_tool_calls":0,
		"stream":false,
		"top_p":0,
		"frequency_penalty":0,
		"presence_penalty":0,
		"caching":{"type":"enabled"},
		"thinking":{"type":"disabled"}
	}`)

	var req OpenAIResponsesRequest
	err := common.Unmarshal(raw, &req)
	require.NoError(t, err)

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	require.True(t, gjson.GetBytes(encoded, "max_output_tokens").Exists())
	require.True(t, gjson.GetBytes(encoded, "max_tool_calls").Exists())
	require.True(t, gjson.GetBytes(encoded, "stream").Exists())
	require.True(t, gjson.GetBytes(encoded, "top_p").Exists())
	require.True(t, gjson.GetBytes(encoded, "frequency_penalty").Exists())
	require.True(t, gjson.GetBytes(encoded, "presence_penalty").Exists())
	require.Equal(t, "enabled", gjson.GetBytes(encoded, "caching.type").String())
	require.Equal(t, "disabled", gjson.GetBytes(encoded, "thinking.type").String())
}

func TestOpenAIResponsesRequestPreserveQwenThinkingBudget(t *testing.T) {
	req := OpenAIResponsesRequest{
		Model:          "qwen-plus",
		ThinkingBudget: json.RawMessage(`0`),
	}

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	value := gjson.GetBytes(encoded, "thinking_budget")
	assert.True(t, value.Exists())
	assert.Equal(t, int64(0), value.Int())
}

func TestOpenAIResponsesRequestPreserveQwQThinkingBudget(t *testing.T) {
	req := OpenAIResponsesRequest{
		Model:          "provider/QwQ-32B",
		ThinkingBudget: json.RawMessage(`128`),
	}

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	value := gjson.GetBytes(encoded, "thinking_budget")
	assert.True(t, value.Exists())
	assert.Equal(t, int64(128), value.Int())
}

func TestOpenAIResponsesRequestDropsThinkingBudgetForNonQwenModel(t *testing.T) {
	req := OpenAIResponsesRequest{
		Model:          "gpt-4.1",
		ThinkingBudget: json.RawMessage(`128`),
	}

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	assert.False(t, gjson.GetBytes(encoded, "thinking_budget").Exists())
}

func TestUsageGetOutputTokenDetailsSupportsResponsesShape(t *testing.T) {
	raw := []byte(`{
		"input_tokens":35,
		"output_tokens":118,
		"total_tokens":153,
		"output_tokens_details":{
			"text_tokens":36,
			"reasoning_tokens":82
		}
	}`)

	var usage Usage
	err := common.Unmarshal(raw, &usage)
	require.NoError(t, err)

	details := usage.GetOutputTokenDetails()
	require.Equal(t, 36, details.TextTokens)
	require.Equal(t, 82, details.ReasoningTokens)
}

func TestGeneralOpenAIRequestGetSystemRoleName(t *testing.T) {
	tests := []struct {
		name  string
		model string
		want  string
	}{
		{name: "o1 uses developer", model: "o1", want: "developer"},
		{name: "o3 family uses developer", model: "o3-mini-high", want: "developer"},
		{name: "o4 family uses developer", model: "o4-mini", want: "developer"},
		{name: "o1 mini stays system", model: "o1-mini", want: "system"},
		{name: "o1 preview stays system", model: "o1-preview", want: "system"},
		{name: "gpt 5 uses developer", model: "gpt-5", want: "developer"},
		{name: "omni is not o series", model: "omni-moderation-latest", want: "system"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := GeneralOpenAIRequest{Model: tt.model}

			require.Equal(t, tt.want, req.GetSystemRoleName())
		})
	}
}

func TestGeneralOpenAIRequestPreserveMessageLevelTools(t *testing.T) {
	raw := []byte(`{
		"model":"kimi-k3",
		"tool_choice":"required",
		"tools":[{"type":"function","function":{"name":"get_weather","description":"Get the weather","parameters":{"type":"object","properties":{"city":{"type":"string"}}}}}],
		"messages":[
			{"role":"system","content":"You are Kimi."},
			{"role":"user","content":"What time is it in Beijing?"},
			{"role":"system","tools":[{"type":"function","function":{"name":"get_current_time","description":"Get the current time of a city","parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}}}]},
			{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"get_current_time","arguments":"{\"city\":\"Beijing\"}"}}]},
			{"role":"system","content":"","tools":[{"type":"function","function":{"name":"lookup_order","parameters":{"type":"object"}}}]}
		]
	}`)

	var req GeneralOpenAIRequest
	require.NoError(t, common.Unmarshal(raw, &req))
	require.Len(t, req.Messages, 5)

	encoded, err := common.Marshal(req)
	require.NoError(t, err)

	messages := gjson.GetBytes(encoded, "messages").Array()
	require.Len(t, messages, 5)
	assert.Equal(t, "required", gjson.GetBytes(encoded, "tool_choice").String())
	assert.JSONEq(t, gjson.GetBytes(raw, "tools").Raw, gjson.GetBytes(encoded, "tools").Raw)

	// Regular messages keep their content untouched.
	assert.Equal(t, "You are Kimi.", messages[0].Get("content").String())
	assert.False(t, messages[0].Get("tools").Exists())
	assert.Equal(t, "What time is it in Beijing?", messages[1].Get("content").String())

	// Kimi K3 dynamic tool loading message: tools preserved byte-for-byte, no content key at all.
	assert.JSONEq(t, gjson.GetBytes(raw, "messages.2.tools").Raw, messages[2].Get("tools").Raw)
	assert.False(t, messages[2].Get("content").Exists())
	assert.Equal(t, "system", messages[2].Get("role").String())

	// Token estimation sees message-level tools alongside the top-level ones.
	meta := req.GetTokenCountMeta()
	assert.Equal(t, 3, meta.ToolsCount)
	assert.Equal(t, 5, meta.MessagesCount)
	assert.Contains(t, meta.CombineText, "get_weather")
	assert.Contains(t, meta.CombineText, "get_current_time")
	assert.Contains(t, meta.CombineText, "Get the current time of a city")
	assert.Contains(t, meta.CombineText, "lookup_order")
}
