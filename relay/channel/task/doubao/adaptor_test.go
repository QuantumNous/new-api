package doubao

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSeedanceOfficialBuildRequestBodyPreservesNativeContent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set(common.KeySeedanceOfficialAPI, true)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/seedance/api/v3/contents/generations/tasks", bytes.NewBufferString(`{
		"model":"doubao-seedance-1-5-pro",
		"content":[
			{"type":"image_url","image_url":{"url":"https://example.com/a.png"},"role":"first_frame"},
			{"type":"text","text":"make a video"}
		],
		"duration":5,
		"watermark":false
	}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "upstream-seedance-model"},
	}

	body, err := adaptor.BuildRequestBody(ctx, info)
	require.NoError(t, err)

	raw, err := io.ReadAll(body)
	require.NoError(t, err)

	var payload map[string]any
	require.NoError(t, common.Unmarshal(raw, &payload))
	assert.Equal(t, "upstream-seedance-model", payload["model"])
	assert.Equal(t, float64(5), payload["duration"])
	assert.Equal(t, false, payload["watermark"])

	content, ok := payload["content"].([]any)
	require.True(t, ok)
	require.Len(t, content, 2)
	first, ok := content[0].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "image_url", first["type"])
	assert.Equal(t, "first_frame", first["role"])
}

func TestSeedanceOfficialDoResponseReturnsUpstreamTaskID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set(common.KeySeedanceOfficialAPI, true)

	adaptor := &TaskAdaptor{}
	resp := &http.Response{
		Body: io.NopCloser(bytes.NewBufferString(`{"id":"cgt-upstream"}`)),
	}
	info := &relaycommon.RelayInfo{
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}

	taskID, taskData, taskErr := adaptor.DoResponse(ctx, resp, info)
	require.Nil(t, taskErr)
	assert.Equal(t, "cgt-upstream", taskID)
	assert.JSONEq(t, `{"id":"cgt-upstream"}`, string(taskData))
	assert.JSONEq(t, `{"id":"cgt-upstream"}`, recorder.Body.String())
}
