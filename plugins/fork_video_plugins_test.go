package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMediaKitPluginPersistsEnhancementAndUsage(t *testing.T) {
	source, err := plugins.Source("doubao-mediakit")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "doubao-mediakit"})
	require.NoError(t, err)
	ctx := map[string]any{"apiKey": "ark-secret|media-secret", "baseUrl": "https://ark.example", "mediaKitBaseUrl": "https://media.example", "publicTaskId": "task_public", "upstreamModel": "seedance-upstream", "requestBody": map[string]any{"prompt": "sunrise", "seconds": 5, "metadata": map[string]any{"resolution": "720p"}}}
	value, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", ctx)
	require.NoError(t, err)
	request := value.(map[string]any)
	assert.Equal(t, "Bearer ark-secret", request["headers"].(map[string]any)["Authorization"])
	assert.Equal(t, "480p", request["body"].(map[string]any)["resolution"])
	value, err = plugin.Engine.Call(t.Context(), "parseSubmitResponse", ctx, map[string]any{"body": map[string]any{"id": "ark-task"}})
	require.NoError(t, err)
	ctx["state"] = value.(map[string]any)["state"]
	value, err = plugin.Engine.Call(t.Context(), "parseTaskResult", ctx, map[string]any{"status": "succeeded", "content": map[string]any{"video_url": "https://cdn.example/source.mp4"}, "usage": map[string]any{"total_tokens": 4567}, "duration": 7})
	require.NoError(t, err)
	result := value.(map[string]any)
	assert.Equal(t, "IN_PROGRESS", result["status"], "generation success must not settle the composite task")
	ctx["state"] = result["state"]
	first, err := plugin.Engine.Call(t.Context(), "buildQueryRequest", ctx)
	require.NoError(t, err)
	second, err := plugin.Engine.Call(t.Context(), "buildQueryRequest", ctx)
	require.NoError(t, err)
	assert.Equal(t, first, second, "retry must reuse the enhancement idempotency token")
	request = first.(map[string]any)
	assert.Equal(t, "https://media.example/api/v1/tools/enhance-video", request["url"])
	assert.Equal(t, "1080p", request["body"].(map[string]any)["resolution"])
	assert.Equal(t, "Bearer media-secret", request["headers"].(map[string]any)["Authorization"])
	value, err = plugin.Engine.Call(t.Context(), "parseTaskResult", ctx, map[string]any{"task_id": "media-task", "success": true})
	require.NoError(t, err)
	ctx["state"] = value.(map[string]any)["state"]
	ctx["data"] = map[string]any{"status": "running"} // polling replaces public data
	value, err = plugin.Engine.Call(t.Context(), "parseTaskResult", ctx, map[string]any{"status": "completed", "result": map[string]any{"output_url": "https://cdn.example/enhanced.mp4"}})
	require.NoError(t, err)
	result = value.(map[string]any)
	assert.Equal(t, "SUCCESS", result["status"])
	assert.EqualValues(t, 4567, result["totalTokens"])
	assert.EqualValues(t, 7, result["durationSeconds"])
	assert.Equal(t, "https://cdn.example/enhanced.mp4", result["url"])
	assert.NotContains(t, result["state"], "apiKey")
}

func TestForkVideoDecodersKeepNativeEndpointsAndBoundDuration(t *testing.T) {
	for _, key := range []string{"xai", "doubao-mediakit"} {
		t.Run(key, func(t *testing.T) {
			source, err := plugins.Source(key)
			require.NoError(t, err)
			registry := jsplugin.NewRegistry()
			plugin, err := registry.RegisterFactory(source, jsplugin.Options{Key: key})
			require.NoError(t, err)
			model := plugin.Meta.Models[0]
			for _, seconds := range []any{0, -2, true, 1.5, 3601, "18446744073686646784"} {
				_, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_video", "decodeRequest"}, map[string]any{"model": model, "path": "/openai/v1/videos", "body": map[string]any{"kind": "json", "value": map[string]any{"model": model, "prompt": "test", "seconds": seconds}}})
				assert.Error(t, err, "duration %v", seconds)
			}
			if key != "xai" {
				return
			}
			for _, path := range []string{"/v1/videos", "/v1/videos/generations", "/v1/videos/edits", "/v1/videos/extensions"} {
				_, found := registry.Generation().LookupEndpoint("POST", path, model)
				require.True(t, found)
				value, err := plugin.Engine.CallPath(t.Context(), "protocols", []string{"openai_video", "decodeRequest"}, map[string]any{"model": model, "path": path, "body": map[string]any{"kind": "json", "value": map[string]any{"model": model, "prompt": "sunrise", "duration": 5, "video": map[string]any{"url": "https://cdn.example/source.mp4"}}}})
				require.NoError(t, err)
				value, err = plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{"baseUrl": "https://api.x.ai", "apiKey": "xai-key", "model": model, "upstreamModel": "mapped-video", "requestBody": value.(map[string]any)["requestBody"]})
				require.NoError(t, err)
				request := value.(map[string]any)
				assert.Equal(t, "https://api.x.ai"+path, request["url"])
				assert.Equal(t, "mapped-video", request["body"].(map[string]any)["model"])
				assert.NotContains(t, request["body"], "_nativePath")
			}
		})
	}
}

func TestSeedancePluginsPreserveAdaptiveDuration(t *testing.T) {
	for _, key := range []string{"doubao", "doubao-mediakit"} {
		t.Run(key, func(t *testing.T) {
			source, err := plugins.Source(key)
			require.NoError(t, err)
			plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: key})
			require.NoError(t, err)
			value, err := plugin.Engine.Call(t.Context(), "buildSubmitRequest", map[string]any{
				"baseUrl": "https://ark.example", "apiKey": "ark|media", "model": "doubao-seedance-2-0-260128", "upstreamModel": "mapped-model",
				"requestBody": map[string]any{"seconds": -1, "metadata": map[string]any{"resolution": "720p", "content": []any{map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://cdn.example/image.png"}}}}},
			})
			require.NoError(t, err)
			body := value.(map[string]any)["body"].(map[string]any)
			assert.EqualValues(t, -1, body["duration"])
			assert.Equal(t, "mapped-model", body["model"])
		})
	}
}

func TestXAILegacyTaskCompatibility(t *testing.T) {
	source, err := plugins.Source("xai")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "xai"})
	require.NoError(t, err)
	assert.Contains(t, plugin.Meta.Models, "grok-imagine-video-1.5-preview")
	for _, status := range []string{"done", "completed", "succeeded", "success", " SUCCESS "} {
		t.Run(status, func(t *testing.T) {
			data := map[string]any{"status": status, "id": "private-id", "request_id": "private-id", "usage": map[string]any{"cost": 12}, "video": map[string]any{"url": "https://cdn.example/video.mp4", "duration": 7}}
			task := map[string]any{"task_id": "task_public", "status": "SUCCESS", "data": data}
			value, err := plugin.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, data)
			require.NoError(t, err)
			assert.Equal(t, "SUCCESS", value.(map[string]any)["status"])
			value, err = plugin.Engine.Call(t.Context(), "extractUsageOnComplete", task, map[string]any{}, data)
			require.NoError(t, err)
			assert.EqualValues(t, 7, value.(map[string]any)["seconds"])
			value, err = plugin.Engine.Call(t.Context(), "listArtifacts", task)
			require.NoError(t, err)
			assert.Len(t, value, 1, "historical tasks must still expose their video artifact")
			value, err = plugin.Engine.CallMember(t.Context(), "native", "render", map[string]any{}, task)
			require.NoError(t, err)
			output := value.(map[string]any)
			assert.Equal(t, "task_public", output["request_id"])
			assert.NotContains(t, output, "id")
			assert.NotContains(t, output, "usage")
			assert.Equal(t, data["video"], output["video"])
		})
	}
	for _, status := range []string{"queued", "in_progress", "processing", "running"} {
		value, err := plugin.Engine.CallMember(t.Context(), "native", "render", map[string]any{}, map[string]any{
			"task_id": "task_public", "status": "FAILURE", "fail_reason": "task expired", "data": map[string]any{"status": status},
		})
		require.NoError(t, err)
		assert.Equal(t, "failed", value.(map[string]any)["status"], "host failure must override stale %s state", status)
	}
}
