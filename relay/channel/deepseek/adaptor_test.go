package deepseek

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestEnsureToolCallReasoningContent 覆盖 DeepSeek 400 报错的回归路径：开启思考模式时，
// 历史消息中带 tool_calls 的 assistant 轮次必须回传 reasoning_content，否则上游直接返回
// 400 "reasoning_content must be passed back to the API"。空字符串即可通过该校验，
// 已有非空值应原样保留，非工具调用消息不得被改写。
func TestEnsureToolCallReasoningContent(t *testing.T) {
	toolCalls := json.RawMessage(`[{"id":"call_1","type":"function","function":{"name":"get_weather","arguments":"{\"city\":\"Paris\"}"}}]`)
	keptReasoning := "Let me check the weather."

	tests := []struct {
		name     string
		messages []dto.Message
		// 期望每一条消息转换后的 reasoning_content："" 表示被补空串，
		// "<unset>" 表示必须保持未设置（nil）。
		want []string
	}{
		{
			name: "带 tool_calls 且缺失 reasoning_content 时补空串",
			messages: []dto.Message{
				{Role: "assistant", ToolCalls: toolCalls},
			},
			want: []string{""},
		},
		{
			name: "带 tool_calls 且已有 reasoning_content 时原样保留",
			messages: []dto.Message{
				{Role: "assistant", ReasoningContent: &keptReasoning, ToolCalls: toolCalls},
			},
			want: []string{keptReasoning},
		},
		{
			name: "assistant 消息无 tool_calls 不被改写",
			messages: []dto.Message{
				{Role: "assistant"},
			},
			want: []string{"<unset>"},
		},
		{
			name: "user 与 tool 消息不受影响",
			messages: []dto.Message{
				{Role: "user"},
				{Role: "tool", ToolCallId: "call_1"},
			},
			want: []string{"<unset>", "<unset>"},
		},
		{
			name: "混合消息只补全工具调用轮次",
			messages: []dto.Message{
				{Role: "user"},
				{Role: "assistant", ToolCalls: toolCalls},
				{Role: "tool", ToolCallId: "call_1"},
				{Role: "assistant", ReasoningContent: &keptReasoning},
			},
			want: []string{"<unset>", "", "<unset>", keptReasoning},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.GeneralOpenAIRequest{Messages: tt.messages}
			ensureToolCallReasoningContent(request)
			require.Len(t, request.Messages, len(tt.want))
			for i, want := range tt.want {
				if want == "<unset>" {
					assert.Nil(t, request.Messages[i].ReasoningContent, "消息 %d 不应被写入 reasoning_content", i)
				} else {
					require.NotNil(t, request.Messages[i].ReasoningContent, "消息 %d 缺少 reasoning_content", i)
					assert.Equal(t, want, *request.Messages[i].ReasoningContent, "消息 %d 的 reasoning_content 不一致", i)
				}
			}
		})
	}
}