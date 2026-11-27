package plugins_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pluginkit"
	builtinplugins "github.com/QuantumNous/new-api/plugins"
	"github.com/QuantumNous/new-api/relay/channel"
	taskplugin "github.com/QuantumNous/new-api/relay/channel/task/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const zhipuVideoModel = "cogvideox-flash"

func newZhipuVideoPlugin(t *testing.T) *jsplugin.LoadedPlugin {
	t.Helper()
	source, err := builtinplugins.Source("zhipu-video")
	require.NoError(t, err)
	plugin, err := jsplugin.NewRegistry().RegisterFactory(source, jsplugin.Options{Key: "zhipu-video"})
	require.NoError(t, err)
	return plugin
}

func TestZhipuVideoRequestValidation(t *testing.T) {
	plugin := newZhipuVideoPlugin(t)
	for _, tc := range []struct {
		name   string
		fields map[string]any
		error  string
	}{
		{"one image without a prompt", map[string]any{"image_url": "https://cdn.example/frame.png"}, ""},
		{"inline image without a prompt", map[string]any{"image_url": "iVBORw0KGgo="}, ""},
		{"data URL image without a prompt", map[string]any{"image_url": "data:image/png;base64,iVBORw0KGgo="}, ""},
		{"512 Unicode code points", map[string]any{"prompt": strings.Repeat("🌱", 512)}, ""},
		{"empty input", map[string]any{}, "prompt or image_url"},
		{"overlong prompt", map[string]any{"prompt": strings.Repeat("🌱", 513)}, "512"},
		{"non-string prompt", map[string]any{"prompt": 2}, "prompt"},
		{"many images", map[string]any{"image_url": []any{"https://cdn.example/one.png", "https://cdn.example/two.png"}}, "image_url"},
		{"malformed image URL", map[string]any{"image_url": "https:///frame.png"}, "image_url"},
		{"malformed inline image", map[string]any{"image_url": "data:image/png;base64,AAAA"}, "image_url"},
		{"oversized inline image", map[string]any{"image_url": "iVBORw0KGgo" + strings.Repeat("A", 7<<20)}, "image_url"},
		{"unsupported duration", map[string]any{"prompt": "seedling", "duration": 5}, "duration"},
		{"unauthorized model", map[string]any{"model": "cogvideox-2", "prompt": "seedling"}, "cogvideox-flash"},
		{"foreign dimensions", map[string]any{"prompt": "seedling", "size": "1280x720"}, "size"},
		{"unsupported quality", map[string]any{"prompt": "seedling", "quality": "ultra"}, "quality"},
		{"unbounded fps", map[string]any{"prompt": "seedling", "fps": 1e30}, "fps"},
		{"non-boolean audio", map[string]any{"prompt": "seedling", "with_audio": "false"}, "with_audio"},
		{"unrecognized native metadata", map[string]any{"prompt": "seedling", "metadata": map[string]any{"fps": 30}}, "metadata"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"model": zhipuVideoModel}
			for key, value := range tc.fields {
				body[key] = value
			}
			decoded, err := plugin.CallRouteDecode(t.Context(), 0, "createTask", jsplugin.RouteRequestContext{
				Body: map[string]any{"kind": "json", "value": body},
			})
			if tc.error != "" {
				require.ErrorContains(t, err, tc.error)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, zhipuVideoModel, decoded.Result["model"])
			assert.Equal(t, body, decoded.Result["requestBody"])
		})
	}

	for _, tc := range []struct {
		name  string
		add   map[string]any
		error string
	}{
		{"maps allowlisted metadata", map[string]any{"metadata": map[string]any{"with_audio": false, "fps": 60}}, ""},
		{"conflicting options", map[string]any{"size": "720x480", "metadata": map[string]any{"size": "1920x1080"}}, "size"},
		{"paid options in metadata", map[string]any{"metadata": map[string]any{"model": "cogvideox-3"}}, "model"},
		{"malformed metadata", map[string]any{"metadata": []any{}}, "metadata"},
		{"unsupported seconds", map[string]any{"seconds": "5"}, "seconds"},
		{"rejects a second image", map[string]any{"input_reference": "https://cdn.example/frame.png", "image_url": "https://cdn.example/frame2.png"}, "image"},
		{"rejects extra media", map[string]any{"video": "https://cdn.example/input.mp4"}, "video"},
		{"rejects vendor-body injection", map[string]any{"vendorBody": map[string]any{"model": "cogvideox-3"}}, "vendorBody"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := map[string]any{"model": zhipuVideoModel, "prompt": "A seedling unfurls in morning light"}
			for key, value := range tc.add {
				body[key] = value
			}
			decoded, err := plugin.CallProtocolDecode(t.Context(), 0, "openai_video", jsplugin.ProtocolRequestContext{
				Model: zhipuVideoModel, RouteRequestContext: jsplugin.RouteRequestContext{
					Body: map[string]any{"kind": "json", "value": body},
				},
			})
			if tc.error != "" {
				require.ErrorContains(t, err, tc.error)
				return
			}
			require.NoError(t, err)
			encoded, err := common.Marshal(decoded.Result["requestBody"])
			require.NoError(t, err)
			assert.JSONEq(t, `{"model":"cogvideox-flash","prompt":"A seedling unfurls in morning light","with_audio":false,"fps":60}`, string(encoded))
		})
	}

	t.Run("passes one multipart reference as a bounded host file placeholder", func(t *testing.T) {
		decoded, err := plugin.CallProtocolDecode(t.Context(), 0, "openai_video", jsplugin.ProtocolRequestContext{
			Model: zhipuVideoModel, RouteRequestContext: jsplugin.RouteRequestContext{
				Body: map[string]any{"kind": "multipart", "fields": map[string][]string{"model": {zhipuVideoModel}, "with_audio": {"false"}, "fps": {"30"}}, "files": []map[string]any{
					{"field": "input_reference", "ref": "request_file:input_reference", "mimeType": "image/png", "size": 1024},
				}},
			},
		})
		require.NoError(t, err)
		encoded, err := common.Marshal(decoded.Result["requestBody"])
		require.NoError(t, err)
		assert.JSONEq(t, `{"model":"cogvideox-flash","image_url":{"__fileRef":"request_file:input_reference","encoding":"dataUrl","mimeType":"image/png","maxBytes":5242880},"with_audio":false,"fps":30}`, string(encoded))
	})
}

func TestZhipuVideoSubmitAndPollThroughTaskAdaptor(t *testing.T) {
	plugin := newZhipuVideoPlugin(t)
	service.InitHttpClient()
	const imageURL = "https://cdn.example/source.png"
	const videoURL = "https://cdn.example/result.mp4"
	const coverURL = "https://cdn.example/cover.png"
	const vendorID = "vendor/job?x=1"
	const taskID = "task_public"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer stored-fixture-key", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		switch r.Method + " " + r.URL.RequestURI() {
		case "POST /api/paas/v4/videos/generations":
			assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
			body, err := io.ReadAll(r.Body)
			assert.NoError(t, err)
			assert.JSONEq(t, `{"model":"cogvideox-flash","prompt":"A seedling unfurls","image_url":"`+imageURL+`","quality":"speed","size":"720x480","fps":30,"with_audio":false,"watermark_enabled":false}`, string(body))
			w.WriteHeader(http.StatusAccepted)
			_, _ = io.WriteString(w, `{"id":"`+vendorID+`","model":"cogvideox-flash","request_id":"request-zhipu","task_status":"PROCESSING"}`)
		case "GET /api/paas/v4/async-result/vendor%2Fjob%3Fx%3D1":
			_, _ = io.WriteString(w, `{"id":"`+vendorID+`","model":"cogvideox-flash","request_id":"request-zhipu","task_status":"SUCCESS","video_result":[{"url":"`+videoURL+`","cover_image_url":"`+coverURL+`"}]}`)
		default:
			t.Errorf("unexpected upstream request %s %s", r.Method, r.URL.RequestURI())
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	input := map[string]any{
		"model": zhipuVideoModel, "prompt": "A seedling unfurls", "input_reference": imageURL, "size": "720x480",
		"metadata": map[string]any{"quality": "speed", "fps": 30, "with_audio": false, "watermark_enabled": false},
	}
	protocolRequest := jsplugin.ProtocolRequestContext{
		Model: zhipuVideoModel, RouteRequestContext: jsplugin.RouteRequestContext{
			Body: map[string]any{"kind": "json", "value": input},
		},
	}
	decoded, err := plugin.CallProtocolDecode(t.Context(), 0, "openai_video", protocolRequest)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelType: 26, ChannelBaseUrl: server.URL, ApiKey: "stored-fixture-key", UpstreamModelName: zhipuVideoModel},
		OriginModelName: zhipuVideoModel,
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: taskID, Action: "image_to_video"},
	}
	adaptor := taskplugin.New(plugin)
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Request.Header.Set("Authorization", "Bearer client-fixture-key")
	c.Set("task_request", decoded.Result["requestBody"])
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	body, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	response, err := adaptor.DoRequest(c, info, body)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, http.StatusAccepted, response.StatusCode)
	submitted, taskErr := adaptor.ParseResponse(c, response, info)
	require.Nil(t, taskErr)
	require.NotNil(t, submitted)
	assert.Equal(t, vendorID, submitted.UpstreamTaskID)
	assert.Nil(t, submitted.Immediate)

	task := &model.Task{
		TaskID: taskID, Action: "image_to_video", Status: model.TaskStatusSubmitted, Data: submitted.TaskData,
		Properties: model.Properties{OriginModelName: zhipuVideoModel, UpstreamModelName: zhipuVideoModel},
	}
	task.PrivateData.UpstreamTaskID = vendorID
	view, err := service.BuildTaskPluginView(task)
	require.NoError(t, err)
	created, err := plugin.Engine.CallPath(t.Context(), "native", []string{"taskCreated"}, map[string]any{}, view)
	require.NoError(t, err)
	createdJSON, err := common.Marshal(created)
	require.NoError(t, err)
	assert.JSONEq(t, `{"id":"task_public","model":"cogvideox-flash","request_id":"request-zhipu","task_status":"PROCESSING"}`, string(createdJSON))

	query, err := adaptor.FetchTask(server.URL, "stored-fixture-key", task, "")
	require.NoError(t, err)
	defer query.Body.Close()
	require.Equal(t, http.StatusOK, query.StatusCode)
	queryBody, err := io.ReadAll(query.Body)
	require.NoError(t, err)
	result, err := adaptor.ParseTaskResult(task, query, queryBody)
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", result.Status)
	assert.Equal(t, videoURL, result.Url)
	task.Status, task.Progress, task.Data = model.TaskStatusSuccess, result.Progress, queryBody
	video, err := adaptor.ConvertToOpenAIVideo(task)
	require.NoError(t, err)
	var openAI map[string]any
	require.NoError(t, common.Unmarshal(video, &openAI))
	assert.Equal(t, taskID, openAI["id"])
	assert.Equal(t, "completed", openAI["status"])
	assert.Equal(t, zhipuVideoModel, openAI["model"])
	assert.NotContains(t, string(video), vendorID)

	artifacts, err := taskplugin.RendererArtifacts(plugin, task, func(id, key string) (string, error) {
		assert.Equal(t, taskID, id)
		return "https://gateway.example/artifacts/" + key, nil
	})
	require.NoError(t, err)
	view, err = service.BuildTaskPluginView(task)
	require.NoError(t, err)
	native, err := plugin.Engine.CallPath(t.Context(), "native", []string{"taskStatus"}, map[string]any{"artifacts": artifacts}, view)
	require.NoError(t, err)
	nativeJSON, err := common.Marshal(native)
	require.NoError(t, err)
	assert.JSONEq(t, `{"id":"task_public","model":"cogvideox-flash","request_id":"request-zhipu","task_status":"SUCCESS","video_result":[{"url":"https://gateway.example/artifacts/video","cover_image_url":"https://gateway.example/artifacts/cover"}]}`, string(nativeJSON))
	for kind, url := range map[string]string{"video": videoURL, "cover": coverURL} {
		content, err := adaptor.BuildContentRequest(t.Context(), task, kind, channel.TaskArtifactClientRequest{Method: http.MethodHead})
		require.NoError(t, err)
		require.NotNil(t, content)
		assert.Equal(t, url, content.URL)
		assert.Equal(t, http.MethodHead, content.Method)
		assert.True(t, content.Credentialless)
		assert.Empty(t, content.Headers)
	}

	info.UpstreamModelName = "cogvideox-3"
	adaptor = taskplugin.New(plugin)
	adaptor.Init(info)
	mappingErr := adaptor.ValidateRequestAndSetAction(c, info)
	require.NotNil(t, mappingErr)
	assert.Equal(t, http.StatusBadRequest, mappingErr.StatusCode)
	assert.Contains(t, mappingErr.Message, "cogvideox-flash")
}

func TestZhipuVideoHandlesUpstreamStatus(t *testing.T) {
	plugin := newZhipuVideoPlugin(t)
	for _, tc := range []struct {
		name, body, status string
		wantErr            string
	}{
		{"accepted", `{"id":"upstream","task_status":"PROCESSING"}`, "", ""},
		{"success awaits missing submit artifact", `{"id":"upstream","task_status":"SUCCESS"}`, "", ""},
		{"immediate success with artifact", `{"id":"upstream","task_status":"SUCCESS","video_result":[{"url":"https://cdn.example/result.mp4"}]}`, "SUCCESS", ""},
		{"immediate failure", `{"id":"upstream","task_status":"FAIL","error":{"code":"1234","message":"Generation rejected"}}`, "FAILURE", ""},
		{"provider error in 2xx body", `{"error":{"code":"1234","message":"Generation rejected"}}`, "", "Generation rejected"},
		{"missing task ID", `{"task_status":"PROCESSING"}`, "", "task ID"},
		{"unrecognized status", `{"id":"upstream","task_status":"NEW_STATE"}`, "", "unrecognized"},
		{"malformed reply", `"not a response object"`, "", "response"},
	} {
		t.Run("submit "+tc.name, func(t *testing.T) {
			var value any
			require.NoError(t, common.UnmarshalJsonStr(tc.body, &value))
			result, err := plugin.CallParseSubmitResponse(t.Context(), map[string]any{}, pluginkit.SubmitResponse{StatusCode: http.StatusAccepted, Body: value})
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, "upstream", result.TaskID)
			if tc.status == "" {
				assert.Nil(t, result.Immediate)
			} else {
				require.NotNil(t, result.Immediate)
				assert.Equal(t, tc.status, result.Immediate.Status)
			}
		})
	}
	for _, tc := range []struct{ name, body, status, reason string }{
		{"processing", `{"task_status":"PROCESSING"}`, "IN_PROGRESS", ""},
		{"failed", `{"task_status":"FAIL","error":{"message":"Generation rejected"}}`, "FAILURE", "Generation rejected"},
		{"successful without artifact", `{"task_status":"SUCCESS","video_result":[{}]}`, "UNKNOWN", ""},
		{"successful with invalid URL", `{"task_status":"SUCCESS","video_result":[{"url":"file:///tmp/invalid"}]}`, "UNKNOWN", ""},
		{"mismatched task", `{"id":"other-task","task_status":"SUCCESS","video_result":[{"url":"https://cdn.example/foreign.mp4"}]}`, "UNKNOWN", ""},
		{"provider error", `{"error":{"code":"1234","message":"Generation rejected"}}`, "UNKNOWN", ""},
		{"unknown state", `{"task_status":"NEW_STATE"}`, "UNKNOWN", ""},
		{"non-JSON body", `unexpected HTML`, "UNKNOWN", ""},
	} {
		t.Run("query "+tc.name, func(t *testing.T) {
			adaptor := taskplugin.New(plugin)
			adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelType: 26}})
			task := &model.Task{TaskID: "task_public", Properties: model.Properties{OriginModelName: zhipuVideoModel}}
			task.PrivateData.UpstreamTaskID = "upstream"
			result, err := adaptor.ParseTaskResult(task, &http.Response{StatusCode: http.StatusOK}, []byte(tc.body))
			require.NoError(t, err)
			assert.Equal(t, tc.status, result.Status)
			assert.Equal(t, tc.reason, result.Reason)
			assert.Empty(t, result.Url)
		})
	}
}
