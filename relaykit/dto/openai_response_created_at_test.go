package dto

import (
	"encoding/json"
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 上游（如 SGLang）的 /v1/responses 流式快照会把 created_at 序列化成浮点
// （openai SDK 契约中该字段即为 float），严格 int 会让整条快照事件反序列化
// 失败，下游拿不到 usage。payload 为真实抓包结构。
func TestResponsesStreamResponseUnmarshalFloatCreatedAt(t *testing.T) {
	payload := `{"response":{"id":"resp_2489809b0c6841f3949226601c1a4b19","object":"response","created_at":1786588600.0,"model":"DeepSeek-V4-Flash-0731","output":[{"id":"msg_a1c3654451494bf7a8620aaff0effd8b","content":[{"annotations":[],"text":"1","type":"output_text","logprobs":null}],"role":"assistant","status":"completed","type":"message"}],"status":"completed","usage":{"input_tokens":12,"input_tokens_details":{"cached_tokens":0,"cache_write_tokens":0},"output_tokens":48,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":60},"parallel_tool_calls":true,"tool_choice":"auto","tools":[],"error":null,"incomplete_details":null,"instructions":null,"max_output_tokens":1024,"previous_response_id":null,"reasoning":{"effort":null,"summary":null},"store":true,"temperature":null,"text":{"format":{"type":"text"}},"top_p":null,"truncation":"disabled","user":null,"metadata":{}},"sequence_number":12,"type":"response.completed"}`
	var resp ResponsesStreamResponse
	require.NoError(t, json.Unmarshal([]byte(payload), &resp))
	require.NotNil(t, resp.Response)
	assert.Equal(t, "response.completed", resp.Type)
	assert.Equal(t, 1786588600, int(resp.Response.CreatedAt))
	assert.Equal(t, 12, resp.Response.Usage.InputTokens)
	assert.Equal(t, 48, resp.Response.Usage.OutputTokens)
	assert.Equal(t, 60, resp.Response.Usage.TotalTokens)
}

// 整数格式必须保持可解析且序列化仍为整数
func TestResponsesResponseCreatedAtFormats(t *testing.T) {
	var resp OpenAIResponsesResponse
	require.NoError(t, json.Unmarshal([]byte(`{"created_at":1786587534}`), &resp))
	assert.Equal(t, 1786587534, int(resp.CreatedAt))

	out, err := json.Marshal(OpenAIResponsesResponse{CreatedAt: 1786587534})
	require.NoError(t, err)
	assert.Contains(t, string(out), `"created_at":1786587534`)
}

func TestIntValueUnmarshalFloat(t *testing.T) {
	var v IntValue
	require.NoError(t, json.Unmarshal([]byte(`1786588600.0`), &v))
	assert.Equal(t, 1786588600, int(v))

	// 小数截断：openai SDK 契约中 created_at 为 float，亚秒精度是合法形态
	require.NoError(t, json.Unmarshal([]byte(`1786588600.9`), &v))
	assert.Equal(t, 1786588600, int(v))

	require.NoError(t, json.Unmarshal([]byte(`42`), &v))
	assert.Equal(t, 42, int(v))

	require.NoError(t, json.Unmarshal([]byte(`"7"`), &v))
	assert.Equal(t, 7, int(v))

	// 下界 -2^63 可被 float64 精确表示，恰好在范围内
	require.NoError(t, json.Unmarshal([]byte(`-9223372036854775808.0`), &v))
	assert.Equal(t, math.MinInt, int(v))

	// 越界拒绝，避免依赖实现相关的转换结果
	assert.Error(t, json.Unmarshal([]byte(`9223372036854775808.0`), &v)) // 2^63，恰好溢出
	assert.Error(t, json.Unmarshal([]byte(`1e100`), &v))
	assert.Error(t, json.Unmarshal([]byte(`-1e100`), &v))

	assert.Error(t, json.Unmarshal([]byte(`"abc"`), &v))
	assert.Error(t, json.Unmarshal([]byte(`true`), &v))
}
