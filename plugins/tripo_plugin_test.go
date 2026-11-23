package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func loadTripoPlugin(t *testing.T) *jsplugin.LoadedPlugin {
	t.Helper()
	source, err := builtinplugins.Source("tripo")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "tripo"})
	require.NoError(t, err)
	return plugin
}

func callObject(t *testing.T, plugin *jsplugin.LoadedPlugin, export string, members []string, args ...any) map[string]any {
	t.Helper()
	var value any
	var err error
	if members == nil {
		value, err = plugin.Engine.Call(t.Context(), export, args...)
	} else {
		value, err = plugin.Engine.CallPath(t.Context(), export, members, args...)
	}
	require.NoError(t, err)
	encoded, err := common.Marshal(value)
	require.NoError(t, err)
	var decoded map[string]any
	require.NoError(t, common.Unmarshal(encoded, &decoded))
	return decoded
}

func TestTripoCreateForwardsBodyAndRewritesGatewayTaskID(t *testing.T) {
	plugin := loadTripoPlugin(t)
	origin := "task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	decoded := callObject(t, plugin, "native", []string{"createTask"}, map[string]any{
		"path": "/v3/models/texture",
		"body": map[string]any{"kind": "json", "value": map[string]any{
			"model": "v3.1-20260211",
			"input": origin,
		}},
	})
	assert.Equal(t, "submit", decoded["kind"])
	assert.Equal(t, "tripo", decoded["model"])
	assert.Equal(t, []any{origin}, decoded["originTaskIds"])

	requestBody, ok := decoded["requestBody"].(map[string]any)
	require.True(t, ok)
	built := callObject(t, plugin, "buildSubmitRequest", nil, map[string]any{
		"baseUrl":     "https://openapi.tripo3d.ai/v3",
		"apiKey":      "tripo-key",
		"requestBody": requestBody,
		"originTasks": []any{map[string]any{"taskId": origin, "upstreamTaskId": "123e4567-e89b-42d3-a456-426614174000"}},
	})
	assert.Equal(t, "https://openapi.tripo3d.ai/v3/models/texture", built["url"])
	assert.Equal(t, "Bearer tripo-key", built["headers"].(map[string]any)["Authorization"])
	body := built["body"].(map[string]any)
	assert.Equal(t, "v3.1-20260211", body["model"])
	assert.Equal(t, "123e4567-e89b-42d3-a456-426614174000", body["input"])

	gateway := callObject(t, plugin, "buildSubmitRequest", nil, map[string]any{
		"baseUrl":     "https://gateway.example",
		"apiKey":      "sk-gateway",
		"upstream":    map[string]any{"kind": "new_api"},
		"requestBody": map[string]any{"route": "/generation/text-to-model", "vendorBody": map[string]any{"prompt": "a cat"}},
	})
	assert.Equal(t, "https://gateway.example/tripo/v3/generation/text-to-model", gateway["url"])
	assert.Equal(t, "a cat", gateway["body"].(map[string]any)["prompt"])
	_, hasModel := gateway["body"].(map[string]any)["model"]
	assert.False(t, hasModel)
}

func TestTripoCreditEstimate(t *testing.T) {
	plugin := loadTripoPlugin(t)
	cases := []struct {
		name  string
		route string
		body  map[string]any
		want  float64
	}{
		{name: "text standard texture", route: "/generation/text-to-model", body: map[string]any{"model": "v3.1-20260211"}, want: 20},
		{name: "text geometry only", route: "/generation/text-to-model", body: map[string]any{"texture": false, "pbr": false}, want: 10},
		{name: "omitted pbr keeps texture", route: "/generation/text-to-model", body: map[string]any{"model": "v3.1-20260211", "texture": false, "texture_quality": "extreme"}, want: 40},
		{name: "image 8k with addons", route: "/generation/image-to-model", body: map[string]any{"model": "v3.1-20260211", "texture_quality": "extreme", "geometry_quality": "detailed", "quad": true, "smart_low_poly": true, "generate_parts": true}, want: 105},
		{name: "p series image detailed", route: "/generation/image-to-model", body: map[string]any{"model": "P1-20260311", "texture_quality": "detailed"}, want: 60},
		{name: "p2 text 8k ignores h addons", route: "/generation/text-to-model", body: map[string]any{"model": "P2-20260801", "texture_quality": "extreme", "geometry_quality": "detailed", "quad": true, "smart_low_poly": true, "generate_parts": true}, want: 130},
		{name: "p2 image standard texture", route: "/generation/image-to-model", body: map[string]any{"model": "P2-20260801"}, want: 110},
		{name: "p2 image geometry only", route: "/generation/image-to-model", body: map[string]any{"model": "P2-20260801", "texture": false, "pbr": false}, want: 100},
		{name: "text to image defaults to seedream v4", route: "/generation/text-to-image", body: map[string]any{"prompt": "a cat"}, want: 5},
		{name: "image to image defaults to seedream v5", route: "/generation/image-to-image", body: map[string]any{"input": "https://example.com/a.png"}, want: 5},
		{name: "explicit seedream v4 stays at 5", route: "/generation/text-to-image", body: map[string]any{"model": "seedream_v4", "size": "4k"}, want: 5},
		{name: "unknown image model holds 50", route: "/generation/text-to-image", body: map[string]any{"model": "not-a-model"}, want: 50},
		{name: "unknown image size holds 50", route: "/generation/image-to-image", body: map[string]any{"size": "huge"}, want: 50},
		{name: "one multiview edit", route: "/generation/edit-multiview", body: map[string]any{"prompts": []any{map[string]any{"view": "front", "prompt": "red"}}}, want: 5},
		{name: "four multiview edits", route: "/generation/edit-multiview", body: map[string]any{"prompts": []any{"a", "b", "c", "d"}}, want: 20},
		{name: "missing multiview prompts hold 20", route: "/generation/edit-multiview", body: map[string]any{"images": []any{"front"}}, want: 20},
		{name: "unknown model holds the ceiling", route: "/models/import", body: map[string]any{"input": "https://example.com/a.glb"}, want: 130},
		{name: "rig check is free", route: "/animations/rig-check", body: map[string]any{"input": "task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}, want: 0},
		{name: "presign is free", route: "/files/presign", body: map[string]any{"format": "glb"}, want: 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			usage := callObject(t, plugin, "extractUsage", nil, map[string]any{
				"requestBody": map[string]any{"route": tc.route, "vendorBody": tc.body},
			})
			assert.Equal(t, tc.want, usage["credits"])
		})
	}
}

func TestTripoTaskResultAndSettlement(t *testing.T) {
	plugin := loadTripoPlugin(t)
	created := callObject(t, plugin, "parseSubmitResponse", nil, map[string]any{
		"requestBody": map[string]any{"route": "/generation/text-to-model"},
	}, map[string]any{"body": map[string]any{"code": float64(0), "data": map[string]any{"task_id": "upstream-1"}}})
	assert.Equal(t, "upstream-1", created["taskId"])

	running := callObject(t, plugin, "parseTaskResult", nil, map[string]any{}, map[string]any{
		"code": float64(0),
		"data": map[string]any{"status": "running", "progress": float64(40)},
	})
	assert.Equal(t, "IN_PROGRESS", running["status"])
	assert.Equal(t, "40%", running["progress"])

	unknown := callObject(t, plugin, "parseTaskResult", nil, map[string]any{}, map[string]any{
		"code": float64(0),
		"data": map[string]any{"status": "unknown"},
	})
	assert.Equal(t, "UNKNOWN", unknown["status"])

	failed := callObject(t, plugin, "parseTaskResult", nil, map[string]any{}, map[string]any{
		"code": float64(0),
		"data": map[string]any{"status": "failed", "error_message": "rejected"},
	})
	assert.Equal(t, "FAILURE", failed["status"])
	assert.Equal(t, "rejected", failed["reason"])

	settled := callObject(t, plugin, "extractUsageOnComplete", nil, map[string]any{}, map[string]any{}, map[string]any{
		"code": float64(0),
		"data": map[string]any{"status": "success", "credits_consumed": 17.5},
	})
	assert.Equal(t, 17.5, settled["credits"])

	refunded := callObject(t, plugin, "extractUsageOnComplete", nil, map[string]any{}, map[string]any{}, map[string]any{
		"code": float64(0),
		"data": map[string]any{"status": "cancelled"},
	})
	assert.Equal(t, float64(0), refunded["credits"])

	presented := callObject(t, plugin, "native", []string{"taskStatus"}, map[string]any{}, map[string]any{
		"task_id": "task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"status":  "SUCCESS",
		"data": map[string]any{
			"code": float64(0),
			"data": map[string]any{"task_id": "upstream-1", "status": "success", "output": map[string]any{"model_url": "https://cdn.example/model.glb"}},
		},
	})
	detail := presented["data"].(map[string]any)
	assert.Equal(t, "task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", detail["task_id"])
	assert.Equal(t, "success", detail["status"])
	assert.Equal(t, "https://cdn.example/model.glb", detail["output"].(map[string]any)["model_url"])
}

func TestTripoListAndFileUpload(t *testing.T) {
	plugin := loadTripoPlugin(t)
	origin := "task_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	listed := callObject(t, plugin, "native", []string{"listTasks"}, map[string]any{
		"body": map[string]any{"kind": "json", "value": map[string]any{"task_ids": []any{origin, origin}}},
	})
	assert.Equal(t, "query", listed["kind"])
	assert.Equal(t, []any{origin}, listed["taskIds"])

	_, err := plugin.Engine.CallPath(t.Context(), "native", []string{"listTasks"}, map[string]any{
		"body": map[string]any{"kind": "json", "value": map[string]any{"task_ids": []any{"123e4567-e89b-42d3-a456-426614174000"}}},
	})
	require.Error(t, err)

	listedTasks := callObject(t, plugin, "native", []string{"taskList"}, map[string]any{
		"missedTaskIds": []any{"task_missingmissingmissingmissingmiss"},
	}, []any{
		map[string]any{"task_id": origin, "status": "SUCCESS", "data": map[string]any{"code": float64(0), "data": map[string]any{"task_id": "upstream-1", "status": "success"}}},
	})
	data := listedTasks["data"].(map[string]any)
	tasks := data["tasks"].(map[string]any)
	assert.Equal(t, origin, tasks[origin].(map[string]any)["task_id"])
	assert.Equal(t, []any{"task_missingmissingmissingmissingmiss"}, data["missed"])

	found := callObject(t, plugin, "native", []string{"taskList"}, map[string]any{}, []any{
		map[string]any{"task_id": origin, "status": "SUCCESS", "data": map[string]any{"code": float64(0), "data": map[string]any{"status": "success"}}},
	})
	assert.Nil(t, found["data"].(map[string]any)["missed"])

	passed := callObject(t, plugin, "native", []string{"error"}, map[string]any{}, map[string]any{
		"httpStatus": float64(502),
		"message":    "Task request failed",
		"upstream": map[string]any{
			"status":     float64(429),
			"retryAfter": "5",
			"body":       map[string]any{"code": float64(2000), "status": "error", "message": "slow down"},
		},
	})
	assert.Equal(t, float64(429), passed["__status"])
	assert.Equal(t, "5", passed["__headers"].(map[string]any)["Retry-After"])
	assert.Equal(t, "slow down", passed["__body"].(map[string]any)["message"])

	local := callObject(t, plugin, "native", []string{"error"}, map[string]any{}, map[string]any{
		"httpStatus": float64(400),
		"message":    "task_ids must be an array",
	})
	assert.Equal(t, float64(400), local["code"])
	assert.Equal(t, "task_ids must be an array", local["message"])

	uploaded := callObject(t, plugin, "native", []string{"uploadFile"}, map[string]any{
		"body": map[string]any{
			"kind":  "multipart",
			"files": []any{map[string]any{"field": "file", "ref": "request_file:file", "filename": "cat.png", "mimeType": "image/png", "size": float64(1024)}},
		},
	})
	assert.Equal(t, "tripo", uploaded["model"])
	usage := callObject(t, plugin, "extractUsage", nil, map[string]any{"requestBody": uploaded["requestBody"]})
	assert.Equal(t, float64(0), usage["credits"])

	largeImage := callObject(t, plugin, "native", []string{"uploadFile"}, map[string]any{
		"body": map[string]any{
			"kind":  "multipart",
			"files": []any{map[string]any{"field": "file", "ref": "request_file:file", "filename": "big.png", "mimeType": "image/png", "size": float64(21 * 1024 * 1024)}},
		},
	})
	assert.Equal(t, "submit", largeImage["kind"])

	presigned := callObject(t, plugin, "parseSubmitResponse", nil, map[string]any{
		"publicTaskId": "task_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		"requestBody":  map[string]any{"route": "/files/presign"},
	}, map[string]any{"body": map[string]any{"code": float64(0), "data": map[string]any{"file_token": "file_abc", "presigned_url": "https://storage.example/upload"}}})
	assert.Equal(t, "task_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", presigned["taskId"])
	immediate := presigned["immediate"].(map[string]any)
	assert.Equal(t, "SUCCESS", immediate["status"])
}
