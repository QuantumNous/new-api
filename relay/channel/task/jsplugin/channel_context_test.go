package jsplugin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// channelContextTaskPlugin echoes the channel parts of its submit ctx.
const channelContextTaskPlugin = `
export const meta = {
  apiVersion: 1, key: "%KEY%", name: "Channel context", version: "1.0.0", author: {name: "Test"},
  models: ["ctx-video"], fetchMode: "per_task", channelTypes: [41],
  channelConfig: {type: "object", properties: {
    region: {type: "string", title: {en: "Region"}, default: "r-default"},
    zone: {type: "string", title: {en: "Zone"}},
  }},
};
export function buildSubmitRequest(ctx) {
  return {url: ctx.baseUrl + "/submit", method: "POST", body: {config: ctx.config, channelOther: ctx.channelOther === undefined ? null : ctx.channelOther}};
}
export function parseSubmitResponse() { return {taskId: "up-1"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/tasks/" + ctx.taskId, method: "GET"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
`

// A driver's ctx carries the plugin config of the task plugin channel it runs
// on, with its defaults, and on a built-in channel type it serves the
// channel's raw other field as channelOther.
func TestDriverContextCarriesTheChannelConfigAndOther(t *testing.T) {
	useCredentialTestDB(t, &model.Channel{})
	// Its own registry: the built-in vertex-ai plugin serves type 41 in the
	// default one.
	plugin, err := pluginruntime.NewRegistry().Register(strings.ReplaceAll(channelContextTaskPlugin, "%KEY%", "task-channel-context"), pluginruntime.Options{})
	require.NoError(t, err)

	submitted := func(channelType int, other string, otherSettings dto.ChannelOtherSettings) map[string]any {
		t.Helper()
		var body map[string]any
		upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			_, _ = w.Write([]byte(`{"id":"up-1"}`))
		}))
		t.Cleanup(upstream.Close)
		baseURL := upstream.URL
		stored := &model.Channel{Type: channelType, Key: "sk-static", Status: common.ChannelStatusEnabled, Models: "ctx-video", Group: "default", BaseURL: &baseURL, Other: other}
		stored.SetSetting(dto.ChannelSettings{TaskPluginKey: "task-channel-context"})
		stored.SetOtherSettings(otherSettings)
		require.NoError(t, model.DB.Create(stored).Error)
		info := &relaycommon.RelayInfo{
			ChannelMeta:   &relaycommon.ChannelMeta{ChannelType: channelType, ChannelId: stored.Id, ChannelBaseUrl: baseURL, ApiKey: "sk-static"},
			TaskRelayInfo: &relaycommon.TaskRelayInfo{},
		}
		adaptor := New(plugin)
		adaptor.Init(info)
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
		c.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "hello"})
		requestBody, err := adaptor.BuildRequestBody(c, info)
		require.NoError(t, err)
		resp, err := adaptor.DoRequest(c, info, requestBody)
		require.NoError(t, err)
		_ = resp.Body.Close()
		return body
	}

	pluginChannel := submitted(constant.ChannelTypeTaskPlugin, "", dto.ChannelOtherSettings{PluginConfig: json.RawMessage(`{"zone":"z1"}`)})
	assert.Equal(t, map[string]any{"region": "r-default", "zone": "z1"}, pluginChannel["config"])
	assert.Nil(t, pluginChannel["channelOther"])

	vertexChannel := submitted(constant.ChannelTypeVertexAi, `{"default":"us-east5"}`, dto.ChannelOtherSettings{PluginConfig: json.RawMessage(`{"zone":"ignored"}`)})
	assert.Equal(t, map[string]any{}, vertexChannel["config"], "a built-in channel type has no plugin config")
	assert.Equal(t, `{"default":"us-east5"}`, vertexChannel["channelOther"])
}
