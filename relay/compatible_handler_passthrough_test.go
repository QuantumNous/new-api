package relay

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// 透传分支的 param_override 接线：覆盖必须生效，且原始 body 的未知字段
// （透传语义的核心，如自定义 content 块）必须原样保留。
func TestBuildPassthroughRequestBodyAppliesOverrideAndKeepsUnknownFields(t *testing.T) {
	raw := []byte(`{"model":"m1","messages":[{"role":"user","content":[{"type":"video_url","video_url":{"url":"data:video/mp4;base64,AAA"}}]}],"client_custom":{"keep":"me"}}`)
	storage, err := common.CreateBodyStorage(raw)
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ParamOverride: map[string]any{"reasoning_effort": "low"}}}
	body, closer, apiErr := buildPassthroughRequestBody(ctx, storage, info)
	require.Nil(t, apiErr)
	require.NotNil(t, body)
	if closer != nil {
		defer closer.Close()
	}

	got, err := io.ReadAll(body)
	require.NoError(t, err)

	var m map[string]any
	require.NoError(t, json.Unmarshal(got, &m))
	assert.Equal(t, "low", m["reasoning_effort"], "override should be applied on passthrough path")

	var msg0 map[string]any
	msgs, _ := m["messages"].([]any)
	require.Len(t, msgs, 1)
	msg0, _ = msgs[0].(map[string]any)
	content, _ := msg0["content"].([]any)
	require.Len(t, content, 1)
	block, _ := content[0].(map[string]any)
	assert.Equal(t, "video_url", block["type"], "unknown content block must survive")
	vu, _ := block["video_url"].(map[string]any)
	assert.Equal(t, "data:video/mp4;base64,AAA", vu["url"])

	custom, _ := m["client_custom"].(map[string]any)
	assert.Equal(t, "me", custom["keep"], "unknown top-level field must survive")
	assert.Equal(t, "m1", m["model"])
}

// 无覆盖配置时：字节级原样回放（透传分支的既有行为不得改变）。
func TestBuildPassthroughRequestBodyWithoutOverrideIsVerbatim(t *testing.T) {
	raw := []byte(`{"model":"m1","weird_field":[1,2,3]}`)
	storage, err := common.CreateBodyStorage(raw)
	require.NoError(t, err)

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())

	body, closer, apiErr := buildPassthroughRequestBody(ctx, storage, &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}})
	require.Nil(t, apiErr)
	require.NotNil(t, body)
	assert.Nil(t, closer)

	got, err := io.ReadAll(body)
	require.NoError(t, err)
	assert.True(t, bytes.Equal(raw, got), "verbatim passthrough expected, got: %s", got)
}
