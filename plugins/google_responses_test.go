package plugins_test

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/QuantumNous/new-api/relay/channel"
	taskplugin "github.com/QuantumNous/new-api/relay/channel/task/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGoogleResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "google",
		model:     "veo-3.1-fast-generate-preview",
		requestBody: map[string]any{
			"model": "veo-3.1-fast-generate-preview",
			"input": []any{map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "input_text", "text": "animate this frame"},
				map[string]any{"type": "input_image", "image_url": "data:image/png;base64,aGVsbG8="},
			}}},
			"seconds": 8,
			"size":    "1280x720",
		},
		wantAction: "image_to_video",
		wantRequest: map[string]any{
			"model":    "veo-3.1-fast-generate-preview",
			"prompt":   "animate this frame",
			"images":   []any{"data:image/png;base64,aGVsbG8="},
			"duration": float64(8),
			"size":     "1280x720",
			"metadata": map[string]any{},
		},
		wantUsageKeys:  []string{"resolution", "seconds"},
		wantVendorName: "gemini",
	})
}

// A New API channel reaches Veo through another gateway's /google routes. The
// gateway rebuilds the request this driver sent, names the operation after its
// own task so it is polled there, and serves the video file only its Gemini
// key can read.
func TestGoogleThroughNewAPIGateway(t *testing.T) {
	source, err := builtinplugins.Source("google")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "google"})
	require.NoError(t, err)
	call := func(export string, members []string, args ...any) map[string]any {
		t.Helper()
		value, err := plugin.Engine.CallPath(t.Context(), export, members, args...)
		require.NoError(t, err)
		return decodePluginValue(t, value)
	}
	const veo = "veo-3.1-fast-generate-preview"
	gateway := map[string]any{"kind": "new_api"}
	submitParams := map[string]any{"model": veo + ":predictLongRunning"}

	for _, tc := range []struct {
		name        string
		requestBody map[string]any
	}{
		{"text with parameters", map[string]any{"model": veo, "prompt": "p", "duration": 6, "metadata": map[string]any{"resolution": "1080p", "aspectRatio": "9:16", "negativePrompt": "rain"}}},
		{"first frame", map[string]any{"model": veo, "prompt": "p", "images": []any{"data:image/png;base64,aGVsbG8="}, "size": "1280x720"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			downstream := map[string]any{"requestBody": tc.requestBody, "model": veo, "upstreamModel": veo,
				"baseUrl": "https://gateway.example", "apiKey": "sk-gateway", "upstream": gateway}
			sent := call("buildSubmitRequest", nil, downstream)
			assert.Equal(t, "https://gateway.example/google/v1beta/models/"+veo+":predictLongRunning", sent["url"])
			assert.Equal(t, map[string]any{"Accept": "application/json", "Content-Type": "application/json", "Authorization": "Bearer sk-gateway"}, sent["headers"])

			intent := call("native", []string{"predictLongRunning"}, map[string]any{"params": submitParams, "body": map[string]any{"kind": "json", "value": sent["body"]}})
			assert.Equal(t, veo, intent["model"])
			assert.Equal(t, sent["action"], intent["action"])
			upstream := map[string]any{"requestBody": intent["requestBody"], "model": veo, "upstreamModel": veo,
				"baseUrl": "https://generativelanguage.example", "apiKey": "vendor-key", "upstream": map[string]any{"kind": "vendor"}}
			forwarded := call("buildSubmitRequest", nil, upstream)
			assert.Equal(t, "https://generativelanguage.example/v1beta/models/"+veo+":predictLongRunning", forwarded["url"])
			assert.Equal(t, "vendor-key", forwarded["headers"].(map[string]any)["x-goog-api-key"])
			assert.Equal(t, sent["body"], forwarded["body"])
			assert.Equal(t, call("extractUsage", nil, downstream), call("extractUsage", nil, upstream))
		})
	}

	created := call("native", []string{"operation"}, map[string]any{"params": submitParams},
		map[string]any{"task_id": "task_pub", "status": "SUBMITTED", "data": map[string]any{"name": "models/" + veo + "/operations/op-private"}})
	assert.Equal(t, map[string]any{"name": "models/" + veo + "/operations/task_pub"}, created)
	upstreamTaskID := call("parseSubmitResponse", nil, map[string]any{}, map[string]any{"body": created})["taskId"]
	query := call("buildQueryRequest", nil, map[string]any{"taskId": upstreamTaskID, "baseUrl": "https://gateway.example", "apiKey": "sk-gateway", "upstream": gateway})
	assert.Equal(t, "https://gateway.example/google/v1beta/models/"+veo+"/operations/task_pub", query["url"])

	adaptor := taskplugin.New(plugin)
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelType: constant.ChannelTypeNewAPI, ApiKey: "sk-gateway", ChannelBaseUrl: "https://gateway.example",
	}})
	queryParams := map[string]any{"model": veo, "task_id": "task_pub"}
	for _, tc := range []struct {
		name       string
		task       map[string]any
		wantStatus string
		wantReason string
	}{
		{
			name: "running", wantStatus: "IN_PROGRESS",
			task: map[string]any{"status": "IN_PROGRESS", "data": map[string]any{"name": "models/" + veo + "/operations/op-private"}},
		},
		{
			name: "succeeded", wantStatus: "SUCCESS",
			task: map[string]any{"status": "SUCCESS", "data": map[string]any{"name": "models/" + veo + "/operations/op-private", "done": true,
				"response": map[string]any{"generateVideoResponse": map[string]any{"generatedVideos": []any{
					map[string]any{"video": map[string]any{"uri": "https://generativelanguage.example/v1beta/files/f1:download?alt=media"}},
				}}}}},
		},
		{
			name: "failed by the gateway poller", wantStatus: "FAILURE", wantReason: "task timed out",
			task: map[string]any{"status": "FAILURE", "fail_reason": "task timed out", "data": map[string]any{"name": "models/" + veo + "/operations/op-private"}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tc.task["task_id"] = "task_pub"
			rendered := call("native", []string{"operation"}, map[string]any{"params": queryParams}, tc.task)
			assert.Equal(t, "models/"+veo+"/operations/task_pub", rendered["name"])
			result := call("parseTaskResult", nil, map[string]any{}, rendered)
			assert.Equal(t, tc.wantStatus, result["status"])
			assert.Equal(t, tc.wantReason, common.Interface2String(result["reason"]))
			if tc.wantStatus != "SUCCESS" {
				return
			}
			data, err := common.Marshal(rendered)
			require.NoError(t, err)
			task := &model.Task{TaskID: "task_down", Status: model.TaskStatusSuccess, Data: data, PrivateData: model.TaskPrivateData{UpstreamTaskID: upstreamTaskID.(string)}}
			artifacts, err := adaptor.ListArtifacts(task)
			require.NoError(t, err)
			assert.Equal(t, []channel.TaskArtifact{{Key: "video", Type: "video"}}, artifacts)
			descriptor, err := adaptor.BuildContentRequest(t.Context(), task, "video", channel.TaskArtifactClientRequest{Method: http.MethodGet})
			require.NoError(t, err)
			assert.Equal(t, &channel.TaskContentRequest{
				URL:     "https://gateway.example/v1/tasks/task_pub/artifacts/video/content",
				Method:  http.MethodGet,
				Headers: map[string]string{"Authorization": "Bearer sk-gateway"},
			}, descriptor)
		})
	}

	t.Run("native bodies are checked before billing", func(t *testing.T) {
		for _, tc := range []struct {
			model   string
			body    map[string]any
			wantErr string
		}{
			{veo + ":generateVideos", map[string]any{"instances": []any{map[string]any{"prompt": "p"}}}, "models/{model}:predictLongRunning"},
			{veo + ":predictLongRunning", map[string]any{"instances": []any{map[string]any{"prompt": "p", "lastFrame": map[string]any{}}}}, "instances[0].lastFrame is not supported"},
			{veo + ":predictLongRunning", map[string]any{"instances": []any{map[string]any{"prompt": "p"}}, "parameters": map[string]any{"durationSeconds": 5}}, "durationSeconds must be one of 4, 6, or 8"},
		} {
			_, err := plugin.Engine.CallPath(t.Context(), "native", []string{"predictLongRunning"}, map[string]any{
				"params": map[string]any{"model": tc.model}, "body": map[string]any{"kind": "json", "value": tc.body},
			})
			require.ErrorContains(t, err, tc.wantErr)
		}
	})
}
