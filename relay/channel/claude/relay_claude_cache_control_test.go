package claude

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

// 模拟客户端发来的标准 JSON：content 为数组分块，文本块带 cache_control。
// 经标准反序列化后，Content 是 []any of map[string]any，这是真实请求的形态。
func buildCacheControlRequest() dto.GeneralOpenAIRequest {
	return dto.GeneralOpenAIRequest{
		Model: "claude-3-5-sonnet",
		Messages: []dto.Message{
			{
				Role: "system",
				Content: []any{
					map[string]any{
						"type":          "text",
						"text":          "you are a helpful assistant with a long cached system prompt",
						"cache_control": map[string]any{"type": "ephemeral"},
					},
				},
			},
			{
				Role: "user",
				Content: []any{
					map[string]any{
						"type":          "text",
						"text":          "hello",
						"cache_control": map[string]any{"type": "ephemeral"},
					},
				},
			},
		},
	}
}

func cacheControlType(raw json.RawMessage) (string, bool) {
	if len(raw) == 0 {
		return "", false
	}
	var m map[string]any
	if err := common.Unmarshal(raw, &m); err != nil {
		return "", false
	}
	t, ok := m["type"].(string)
	return t, ok
}

func TestRequestOpenAI2ClaudeMessage_PreservesUserCacheControl(t *testing.T) {
	req := buildCacheControlRequest()

	claudeReq, err := RequestOpenAI2ClaudeMessage(nil, req)
	require.NoError(t, err)
	require.NotEmpty(t, claudeReq.Messages)

	userMsg := claudeReq.Messages[0]
	blocks, ok := userMsg.Content.([]dto.ClaudeMediaMessage)
	require.True(t, ok, "user content should be a media-message array")
	require.NotEmpty(t, blocks)

	ccType, found := cacheControlType(blocks[0].CacheControl)
	require.True(t, found, "cache_control must be preserved on user text block")
	require.Equal(t, "ephemeral", ccType)
}

func TestRequestOpenAI2ClaudeMessage_PreservesSystemCacheControl(t *testing.T) {
	req := buildCacheControlRequest()

	claudeReq, err := RequestOpenAI2ClaudeMessage(nil, req)
	require.NoError(t, err)

	sys, ok := claudeReq.System.([]dto.ClaudeMediaMessage)
	require.True(t, ok, "system should be a media-message array")
	require.NotEmpty(t, sys)

	ccType, found := cacheControlType(sys[0].CacheControl)
	require.True(t, found, "cache_control must be preserved on system text block")
	require.Equal(t, "ephemeral", ccType)
}
