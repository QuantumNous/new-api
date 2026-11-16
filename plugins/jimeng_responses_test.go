package plugins_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJimengResponsesProtocol(t *testing.T) {
	testVideoResponsesProtocol(t, videoResponsesTestCase{
		pluginKey: "jimeng",
		model:     "jimeng_vgfm_t2v_l20",
		requestBody: map[string]any{
			"model":   "jimeng_vgfm_t2v_l20",
			"input":   "a paper boat on a river",
			"seconds": 10,
			"metadata": map[string]any{
				"aspect_ratio": "16:9",
			},
		},
		wantAction: "text_to_video",
		wantRequest: map[string]any{
			"model":    "jimeng_vgfm_t2v_l20",
			"prompt":   "a paper boat on a river",
			"duration": float64(10),
			"metadata": map[string]any{"aspect_ratio": "16:9"},
		},
		wantUsageKeys:  []string{"product", "seconds"},
		wantVendorName: "jimeng",
	})
}

func loadJimengPlugin(t *testing.T) *jsplugin.LoadedPlugin {
	t.Helper()
	source, err := builtinplugins.Source("jimeng")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "jimeng"})
	require.NoError(t, err)
	return plugin
}

func TestJimengSubmitStateDrivesQueryReqKey(t *testing.T) {
	plugin := loadJimengPlugin(t)
	submitValue, err := plugin.Engine.Call(t.Context(), "parseSubmitResponse", map[string]any{
		"upstreamModel": "jimeng_vgfm_i2v_l20",
		"requestBody":   map[string]any{"images": []any{"https://cdn.example/frame.png"}},
	}, map[string]any{"body": map[string]any{"code": 10000, "data": map[string]any{"task_id": "t1"}}})
	require.NoError(t, err)
	encoded, err := common.Marshal(submitValue)
	require.NoError(t, err)
	var submit map[string]any
	require.NoError(t, common.Unmarshal(encoded, &submit))
	state, ok := submit["state"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "jimeng_vgfm_i2v_l20", state["req_key"])

	queryValue, err := plugin.Engine.Call(t.Context(), "buildQueryRequest", map[string]any{
		"taskId":  "t1",
		"action":  "text_to_video",
		"baseUrl": "https://jimeng.example",
		"apiKey":  "sk-test",
		"state":   map[string]any{"req_key": "custom_req_key"},
	})
	require.NoError(t, err)
	queryEncoded, err := common.Marshal(queryValue)
	require.NoError(t, err)
	var query map[string]any
	require.NoError(t, common.Unmarshal(queryEncoded, &query))
	var body map[string]any
	require.NoError(t, common.UnmarshalJsonStr(common.Interface2String(query["body"]), &body))
	assert.Equal(t, "custom_req_key", body["req_key"])
	assert.Equal(t, "t1", body["task_id"])
}

func TestJimengParseTaskResultUnknownStatus(t *testing.T) {
	plugin := loadJimengPlugin(t)
	value, err := plugin.Engine.Call(t.Context(), "parseTaskResult", map[string]any{}, map[string]any{
		"code": 10000,
		"data": map[string]any{"status": "weird"},
	})
	require.NoError(t, err)
	encoded, err := common.Marshal(value)
	require.NoError(t, err)
	var result map[string]any
	require.NoError(t, common.Unmarshal(encoded, &result))
	assert.Equal(t, "UNKNOWN", result["status"])
	assert.Contains(t, common.Interface2String(result["reason"]), "weird")
}

// Jimeng's Bearer API takes the bodies of the signed actions:
// submit_task_v2 creates a task, get_result_v2 reads one by req_key and
// task_id.
func TestJimengBearerAPIDecoders(t *testing.T) {
	plugin := loadJimengPlugin(t)
	decode := func(member string, body any) (map[string]any, error) {
		value, err := plugin.Engine.CallPath(t.Context(), "native", []string{member}, map[string]any{"body": map[string]any{"kind": "json", "value": body}})
		if err != nil {
			return nil, err
		}
		encoded, err := common.Marshal(value)
		require.NoError(t, err)
		var decoded map[string]any
		require.NoError(t, common.Unmarshal(encoded, &decoded))
		return decoded, nil
	}

	submit, err := decode("submitTask", map[string]any{"req_key": "jimeng_ti2v_v30_pro", "prompt": "a cat", "image_urls": []any{"https://cdn.example/a.png"}})
	require.NoError(t, err)
	assert.Equal(t, "submit", submit["kind"])
	assert.Equal(t, "jimeng_ti2v_v30_pro", submit["model"])
	assert.Equal(t, "image_to_video", submit["action"])
	query, err := decode("getResult", map[string]any{"req_key": "jimeng_ti2v_v30_pro", "task_id": "task_pub"})
	require.NoError(t, err)
	assert.Equal(t, map[string]any{"kind": "query", "taskIds": []any{"task_pub"}}, query)
	for _, body := range []map[string]any{{"task_id": "task_pub"}, {"req_key": "", "task_id": "task_pub"}} {
		_, err = decode("getResult", body)
		require.ErrorContains(t, err, "req_key is required")
	}
	_, err = decode("getResult", map[string]any{"req_key": "jimeng_ti2v_v30_pro"})
	require.ErrorContains(t, err, "task_id is required")
	_, err = plugin.Engine.CallPath(t.Context(), "native", []string{"submitTask"}, map[string]any{"body": map[string]any{"kind": "multipart"}})
	require.ErrorContains(t, err, "JSON body required")
}

// The Bearer API sends Jimeng's own body as is and answers with Jimeng's
// own replies: no shorthands, no gateway fields, Jimeng's statuses.
func TestJimengNativeBodiesAndReplies(t *testing.T) {
	plugin := loadJimengPlugin(t)
	call := func(path []string, args ...any) (map[string]any, error) {
		value, err := plugin.Engine.CallPath(t.Context(), path[0], path[1:], args...)
		if err != nil {
			return nil, err
		}
		encoded, err := common.Marshal(value)
		require.NoError(t, err)
		var decoded map[string]any
		require.NoError(t, common.Unmarshal(encoded, &decoded))
		return decoded, nil
	}
	jsonBody := func(body any) map[string]any {
		return map[string]any{"body": map[string]any{"kind": "json", "value": body}}
	}

	t.Run("submit sends the client's body with the channel's req_key", func(t *testing.T) {
		client := map[string]any{"req_key": "jimeng_vgfm_t2v_l20", "prompt": "a cat", "image_urls": []any{"https://cdn.example/a.png"}, "aspect_ratio": "9:21"}
		intent, err := call([]string{"native", "submitTask"}, jsonBody(client))
		require.NoError(t, err)
		driver := map[string]any{"model": "jimeng_vgfm_t2v_l20", "upstreamModel": "jimeng_vgfm_t2v_l20", "requestBody": intent["requestBody"], "baseUrl": "https://gw.example", "apiKey": "token", "upstream": map[string]any{"kind": "new_api"}}
		descriptor, err := call([]string{"buildSubmitRequest"}, driver)
		require.NoError(t, err)
		var sent map[string]any
		require.NoError(t, common.UnmarshalJsonStr(common.Interface2String(descriptor["body"]), &sent))
		assert.Equal(t, client, sent, "no seed is added and an image does not switch the req_key")
		assert.Equal(t, "https://gw.example/jimeng/api/common/v3/submit_task_v2", descriptor["url"])
		facts, err := call([]string{"extractUsage"}, driver)
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"seconds": float64(5), "product": "s2_pro"}, facts)

		parsed, err := call([]string{"parseSubmitResponse"}, driver, map[string]any{"body": map[string]any{"code": 10000, "data": map[string]any{"task_id": "t1"}, "message": "Success"}})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"code": float64(10000), "data": map[string]any{"task_id": "t1"}, "message": "Success"}, parsed["taskData"], "the reply is not given a req_key")
		assert.Equal(t, map[string]any{"req_key": "jimeng_vgfm_t2v_l20"}, parsed["state"])
	})

	for _, tc := range []struct {
		name    string
		member  string
		body    map[string]any
		wantErr string
	}{
		{"req_key is required", "submitTask", map[string]any{"prompt": "a cat"}, "req_key is required"},
		{"live query settings", "getResult", map[string]any{"req_key": "jimeng_t2v_v30", "task_id": "task_pub", "req_json": "{}"}, "req_json is not supported"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := call([]string{"native", tc.member}, jsonBody(tc.body))
			require.ErrorContains(t, err, tc.wantErr)
		})
	}

	// Jimeng reports no usage, so a req_key the plugin cannot price is
	// refused before it is sent, however the request named it.
	for _, tc := range []struct {
		name          string
		decoder       []string
		input         map[string]any
		upstreamModel string
	}{
		{"a channel maps a native body to it", []string{"native", "submitTask"}, jsonBody(map[string]any{"req_key": "jimeng_vgfm_t2v_l20", "prompt": "a cat"}), "jimeng_unknown_model"},
		{"host protocol metadata names it", []string{"protocols", "openai_video", "decodeRequest"}, map[string]any{"model": "jimeng_vgfm_t2v_l20", "body": map[string]any{"kind": "json",
			"value": map[string]any{"model": "jimeng_vgfm_t2v_l20", "prompt": "a cat", "metadata": map[string]any{"req_key": "jimeng_unknown_model"}}}}, "jimeng_vgfm_t2v_l20"},
	} {
		t.Run("unknown req_key: "+tc.name, func(t *testing.T) {
			intent, err := call(tc.decoder, tc.input)
			require.NoError(t, err)
			_, err = call([]string{"buildSubmitRequest"}, map[string]any{"model": "jimeng_vgfm_t2v_l20", "upstreamModel": tc.upstreamModel, "requestBody": intent["requestBody"],
				"baseUrl": "https://gw.example", "apiKey": "token", "upstream": map[string]any{"kind": "new_api"}})
			require.ErrorContains(t, err, "unsupported req_key jimeng_unknown_model")
		})
	}

	// Jimeng checks its own fields; image and images reach it as sent.
	t.Run("fields Jimeng does not document go as sent", func(t *testing.T) {
		client := map[string]any{"req_key": "jimeng_t2v_v30", "prompt": "a cat", "image": "https://cdn.example/a.png", "images": []any{"https://cdn.example/b.png"}}
		intent, err := call([]string{"native", "submitTask"}, jsonBody(client))
		require.NoError(t, err)
		driver := map[string]any{"model": "jimeng_t2v_v30", "upstreamModel": "jimeng_t2v_v30", "requestBody": intent["requestBody"], "baseUrl": "https://gw.example", "apiKey": "token", "upstream": map[string]any{"kind": "new_api"}}
		descriptor, err := call([]string{"buildSubmitRequest"}, driver)
		require.NoError(t, err)
		var sent map[string]any
		require.NoError(t, common.UnmarshalJsonStr(common.Interface2String(descriptor["body"]), &sent))
		assert.Equal(t, client, sent)
		facts, err := call([]string{"extractUsage"}, driver)
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"seconds": float64(5), "product": "v30_720p"}, facts)
	})

	// A /v1/videos client cannot pass a body off as a native one.
	t.Run("a vendorBody field is not a native body", func(t *testing.T) {
		intent, err := call([]string{"protocols", "openai_video", "decodeRequest"}, map[string]any{"model": "jimeng_t2v_v30", "body": map[string]any{"kind": "json",
			"value": map[string]any{"model": "jimeng_t2v_v30", "prompt": "a cat", "vendorBody": map[string]any{"prompt": "x", "callback_url": "https://client.example/hook"}}}})
		require.NoError(t, err)
		descriptor, err := call([]string{"buildSubmitRequest"}, map[string]any{"model": "jimeng_t2v_v30", "upstreamModel": "jimeng_t2v_v30", "requestBody": intent["requestBody"],
			"baseUrl": "https://gw.example", "apiKey": "token", "upstream": map[string]any{"kind": "new_api"}})
		require.NoError(t, err)
		var sent map[string]any
		require.NoError(t, common.UnmarshalJsonStr(common.Interface2String(descriptor["body"]), &sent))
		assert.Equal(t, "a cat", sent["prompt"])
		assert.NotContains(t, sent, "callback_url")
	})

	t.Run("frames bill five or ten seconds", func(t *testing.T) {
		intent, err := call([]string{"native", "submitTask"}, jsonBody(map[string]any{"req_key": "jimeng_t2v_v30_1080p", "prompt": "a cat", "frames": 241}))
		require.NoError(t, err)
		facts, err := call([]string{"extractUsage"}, map[string]any{"upstreamModel": "jimeng_t2v_v30_1080p", "requestBody": intent["requestBody"]})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"seconds": float64(10), "product": "v30_1080p"}, facts)
		intent, err = call([]string{"native", "submitTask"}, jsonBody(map[string]any{"req_key": "jimeng_t2v_v30", "prompt": "a cat", "frames": 200}))
		require.NoError(t, err)
		_, err = call([]string{"extractUsage"}, map[string]any{"upstreamModel": "jimeng_t2v_v30", "requestBody": intent["requestBody"]})
		require.ErrorContains(t, err, "frames must be 121 or 241")
	})

	t.Run("statuses", func(t *testing.T) {
		for status, want := range map[string]string{"in_queue": "QUEUED", "generating": "IN_PROGRESS", "done": "SUCCESS", "not_found": "FAILURE", "expired": "FAILURE"} {
			result, err := call([]string{"parseTaskResult"}, map[string]any{}, map[string]any{"code": 10000, "data": map[string]any{"status": status}})
			require.NoError(t, err)
			assert.Equal(t, want, result["status"], status)
		}
	})

	t.Run("query replies", func(t *testing.T) {
		created := map[string]any{"code": float64(10000), "data": map[string]any{"task_id": "task_pub"}, "message": "Success", "request_id": "r1"}
		reply, err := call([]string{"native", "taskResult"}, map[string]any{}, []any{map[string]any{"task_id": "task_pub", "status": "SUBMITTED", "data": created}})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"code": float64(10000), "data": map[string]any{"status": "in_queue"}, "message": "Success", "request_id": "r1"}, reply)

		generating := map[string]any{"code": float64(10000), "data": map[string]any{"status": "generating"}, "message": "Success", "request_id": "r2"}
		reply, err = call([]string{"native", "taskResult"}, map[string]any{}, map[string]any{"task_id": "task_pub", "status": "FAILURE", "fail_reason": "task timed out", "data": generating})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"code": float64(50500), "status": float64(50500), "data": nil, "message": "task timed out", "request_id": "r2"}, reply)

		rejected := map[string]any{"code": float64(50413), "data": nil, "message": "Post Text Risk Not Pass", "request_id": "r3", "status": float64(50413)}
		reply, err = call([]string{"native", "taskResult"}, map[string]any{}, map[string]any{"task_id": "task_pub", "status": "FAILURE", "fail_reason": "Post Text Risk Not Pass", "data": rejected})
		require.NoError(t, err)
		assert.Equal(t, rejected, reply, "Jimeng's own error keeps data null")

		missing, err := call([]string{"native", "error"}, map[string]any{"path": "/api/common/v3/get_result_v2"}, map[string]any{"httpStatus": 404, "message": "Task not found", "requestId": "r4"})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"__status": float64(200), "__body": map[string]any{
			"code": float64(10000), "data": map[string]any{"status": "not_found"}, "message": "Success", "request_id": "r4", "status": float64(10000),
		}}, missing)
		invalid, err := call([]string{"native", "error"}, map[string]any{"path": "/api/common/v3/submit_task_v2"}, map[string]any{"httpStatus": 400, "message": "req_key is required", "requestId": "r5"})
		require.NoError(t, err)
		assert.Equal(t, map[string]any{"code": float64(50200), "data": nil, "message": "req_key is required", "request_id": "r5", "status": float64(50200)}, invalid)
	})
}
