package dto

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
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

func TestOpenAIResponsesRequestPreserveExplicitZeroValues(t *testing.T) {
	raw := []byte(`{
		"model":"gpt-4.1",
		"max_output_tokens":0,
		"max_tool_calls":0,
		"stream":false,
		"top_p":0
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
}

func TestThinkingBudgetMarshallingIsLimitedToQwenModels(t *testing.T) {
	zero := 0
	positive := 128
	tests := []struct {
		name    string
		request any
		want    int64
		exists  bool
	}{
		{name: "chat qwen preserves zero", request: GeneralOpenAIRequest{Model: "qwen-plus", ThinkingBudget: &zero}, want: 0, exists: true},
		{name: "chat provider qwq preserves value", request: GeneralOpenAIRequest{Model: "provider/QwQ-32B", ThinkingBudget: &positive}, want: 128, exists: true},
		{name: "chat non-qwen drops value", request: GeneralOpenAIRequest{Model: "gpt-4.1", ThinkingBudget: &positive}, exists: false},
		{name: "responses qwen preserves zero", request: OpenAIResponsesRequest{Model: "Qwen/Qwen3-Thinking", ThinkingBudget: &zero}, want: 0, exists: true},
		{name: "responses non-qwen drops value", request: OpenAIResponsesRequest{Model: "deepseek-r1", ThinkingBudget: &positive}, exists: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			encoded, err := common.Marshal(test.request)
			require.NoError(t, err)
			value := gjson.GetBytes(encoded, "thinking_budget")
			require.Equal(t, test.exists, value.Exists())
			if test.exists {
				require.Equal(t, test.want, value.Int())
			}
		})
	}
}

func TestIsQwenThinkingBudgetModel(t *testing.T) {
	tests := map[string]bool{
		"qwen-plus":                    true,
		"Qwen/Qwen3-235B-A22B":         true,
		"qwq-32b":                      true,
		"provider/qwq-32b":             true,
		"gpt-4.1":                      false,
		"provider/not-qwen-compatible": false,
	}
	for model, want := range tests {
		t.Run(model, func(t *testing.T) {
			require.Equal(t, want, IsQwenThinkingBudgetModel(model))
		})
	}
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
