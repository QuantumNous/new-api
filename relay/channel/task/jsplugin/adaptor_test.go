package jsplugin

import (
	"bytes"
	"context"
	"encoding/base64"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const mockPlugin = `
export const meta = {
  apiVersion: 1, key: "mock-task", name: "Mock Task", version: "1.0.0",
  author: {name: "Test"},
  channelTypes: [1001], models: ["mock-v1"], fetchMode: "per_task",
  protocols: ["openai_video"],
  usageSchema: {seconds: {type: "number", unit: "second"}, mode: {enum: ["std", "pro"]}},
};
export function buildSubmitRequest(ctx) {
  if (!ctx.requestBody.prompt) throw new Error("prompt required");
  return { url: ctx.baseUrl + "/submit", method: "POST", headers: {"X-Plugin": "submit"}, body: {prompt: ctx.requestBody.prompt}, action: "text_to_video", model: "mock-v1", rewriteModel: "mock-upstream" };
}

export function parseSubmitResponse(ctx, resp) {
  return {
    taskId: resp.body.id,
    taskData: {accepted: true, status: resp.statusCode},
  };
}
export function extractUsage(ctx) { return {seconds: 5, mode: "pro"}; }
export function extractUsageOnSubmit(ctx, data) { return {seconds: data.seconds || 7}; }
export function extractUsageOnComplete(task, result) { return {upstreamUnits: 23}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/tasks/" + ctx.taskId, method: "GET", headers: {"X-Plugin": "query"}}; }
export function parseTaskResult(ctx, body) { return {taskId: body.id, status: "SUCCESS", progress: "100%", url: body.url}; }
export function listArtifacts() { return []; }
export function buildContentRequest() { throw new Error("artifact_not_found"); }
export const protocols = {openai_video: {
  decodeRequest: function(ctx) { return {kind: "submit", model: ctx.model, requestBody: ctx.body.value}; },
  render: function(ctx, task) { return {id: task.task_id, status: "completed"}; }
}};
`

func TestTaskAdaptorRejectsDeprecatedClientResponse(t *testing.T) {
	source := strings.Replace(mockPlugin, `taskData: {accepted: true, status: resp.statusCode},`, `taskData: {}, clientResponse: {id: ctx.publicTaskId},`, 1)
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}, TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	response := &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"id":"upstream"}`))}

	parsed, taskErr := adaptor.ParseResponse(c, response, info)

	assert.Nil(t, parsed)
	require.NotNil(t, taskErr)
	require.Error(t, taskErr.Error)
	assert.Contains(t, taskErr.Error.Error(), "must not return clientResponse")
}

func TestTaskAdaptorBuildsMultipartFromOpaqueFileReference(t *testing.T) {
	source := `
export const meta = {apiVersion:1,key:"multipart",name:"Multipart",version:"1.0.0",author:{name:"Test"},models:["m"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) { return {url:ctx.baseUrl+"/submit",bodyType:"multipart",parts:[{name:"model",value:"m"},{name:"input_reference",fileRef:ctx.files[0].ref}]}; }
export function parseSubmitResponse(ctx,r){return {taskId:"1"}} export function buildQueryRequest(){return {url:"https://example.com"}} export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	adaptor.Init(info)
	var input bytes.Buffer
	writer := multipart.NewWriter(&input)
	file, err := writer.CreateFormFile("input_reference", "ref.png")
	require.NoError(t, err)
	_, err = file.Write([]byte("image-bytes"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(input.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	c.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "p"})
	body, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	requestBytes, err := io.ReadAll(body)
	require.NoError(t, err)
	reader := multipart.NewReader(bytes.NewReader(requestBytes), strings.TrimPrefix(c.GetHeader("Content-Type"), "multipart/form-data; boundary="))
	form, err := reader.ReadForm(1024)
	require.NoError(t, err)
	assert.Equal(t, []string{"m"}, form.Value["model"])
	require.Len(t, form.File["input_reference"], 1)
	opened, err := form.File["input_reference"][0].Open()
	require.NoError(t, err)
	content, err := io.ReadAll(opened)
	require.NoError(t, err)
	assert.Equal(t, "image-bytes", string(content))
}

func TestTaskAdaptorInlinesJSONFilePlaceholders(t *testing.T) {
	const fileBytes = "image-bytes"
	encoded := base64.StdEncoding.EncodeToString([]byte(fileBytes))
	source := `
export const meta = {apiVersion:1,key:"json-inline",name:"JSON Inline",version:"1.0.0",author:{name:"Test"},models:["m"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) {
  return {url:ctx.baseUrl+"/submit",body:{
    prompt:"p",
    image:{__fileRef:ctx.files[0].ref,encoding:"base64"},
    nested:{items:[{__fileRef:ctx.files[0].ref,encoding:"dataUrl",mimeType:"image/png"}]},
    dataUrl:{__fileRef:ctx.files[0].ref,encoding:"dataUrl"}
  }};
}
export function parseSubmitResponse(){return {taskId:"1"}} export function buildQueryRequest(){return {url:"https://example.com"}} export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	adaptor.Init(info)
	c := newMultipartFileContext(t, "input_reference", "ref.png", "image/jpeg", []byte(fileBytes))
	c.Set("task_request", map[string]any{"prompt": "p"})
	body, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	requestBytes, err := io.ReadAll(body)
	require.NoError(t, err)
	var decoded map[string]any
	require.NoError(t, common.Unmarshal(requestBytes, &decoded))
	assert.Equal(t, "p", decoded["prompt"])
	assert.Equal(t, encoded, decoded["image"])
	nested := decoded["nested"].(map[string]any)
	items := nested["items"].([]any)
	require.Len(t, items, 1)
	assert.Equal(t, "data:image/png;base64,"+encoded, items[0])
	assert.Equal(t, "data:image/jpeg;base64,"+encoded, decoded["dataUrl"])
}

func TestTaskAdaptorJSONFilePlaceholderErrors(t *testing.T) {
	tests := []struct {
		name        string
		part        string
		fileSize    int
		globalMB    int
		wantContain string
	}{
		{name: "unknown ref", part: `{__fileRef:"request_file:missing",encoding:"base64"}`, fileSize: 4, wantContain: `unknown file reference "request_file:missing"`},
		{name: "extra key", part: `{__fileRef:"request_file:input_reference",encoding:"base64",extra:true}`, fileSize: 4, wantContain: "invalid file placeholder"},
		{name: "missing encoding", part: `{__fileRef:"request_file:input_reference"}`, fileSize: 4, wantContain: "encoding"},
		{name: "oversize maxBytes", part: `{__fileRef:"request_file:input_reference",encoding:"base64",maxBytes:3}`, fileSize: 4, wantContain: "3 byte limit"},
		{name: "oversize global", part: `{__fileRef:"request_file:input_reference",encoding:"base64"}`, fileSize: 2 << 20, globalMB: 1, wantContain: "1048576 byte limit"},
		{name: "multiple references cap", part: `{a:{__fileRef:"request_file:input_reference",encoding:"base64"},b:{__fileRef:"request_file:input_reference",encoding:"base64"}}`, fileSize: 700 << 10, globalMB: 1, wantContain: "1048576 byte limit"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			if testCase.globalMB > 0 {
				previous := constant.MaxFileDownloadMB
				constant.MaxFileDownloadMB = testCase.globalMB
				t.Cleanup(func() { constant.MaxFileDownloadMB = previous })
			}
			source := strings.Replace(`
export const meta = {apiVersion:1,key:"json-inline-err",name:"JSON Inline Err",version:"1.0.0",author:{name:"Test"},models:["m"],fetchMode:"per_task"};
export function buildSubmitRequest() { return {url:"https://provider.example/submit",body:PLACEHOLDER}; }
export function parseSubmitResponse(){return {taskId:"1"}} export function buildQueryRequest(){return {url:"https://example.com"}} export function parseTaskResult(){return {status:"SUCCESS"}}
`, "PLACEHOLDER", testCase.part, 1)
			plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
			require.NoError(t, err)
			adaptor := New(plugin)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
			adaptor.Init(info)
			c := newMultipartFileContext(t, "input_reference", "ref.bin", "application/octet-stream", bytes.Repeat([]byte("x"), testCase.fileSize))
			c.Set("task_request", map[string]any{"prompt": "p"})
			_, err = adaptor.BuildRequestBody(c, info)
			require.Error(t, err)
			assert.Contains(t, err.Error(), testCase.wantContain)
		})
	}
}

func newMultipartFileContext(t *testing.T, field, filename, contentType string, content []byte) *gin.Context {
	t.Helper()
	var input bytes.Buffer
	writer := multipart.NewWriter(&input)
	part, err := writer.CreatePart(textproto.MIMEHeader{
		"Content-Disposition": {`form-data; name="` + field + `"; filename="` + filename + `"`},
		"Content-Type":        {contentType},
	})
	require.NoError(t, err)
	_, err = part.Write(content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(input.Bytes()))
	c.Request.Header.Set("Content-Type", writer.FormDataContentType())
	return c
}

func TestTaskAdaptorDoesNotEmitInjectedMultipartDispositionHeaders(t *testing.T) {
	tests := []struct {
		name string
		part string
	}{
		{name: "part name", part: `{name:"prompt\r\nX-Injected: yes",value:"hello"}`},
		{name: "filename", part: `{name:"input_reference",fileRef:"request_file:input_reference",filename:"safe.png\r\nX-Injected: yes"}`},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			source := strings.Replace(`
export const meta = {apiVersion:1,key:"multipart-safe",name:"Multipart Safe",version:"1.0.0",author:{name:"Test"},models:["m"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) { return {url:ctx.baseUrl+"/submit",bodyType:"multipart",parts:[PART]}; }
export function parseSubmitResponse(){return {taskId:"1"}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {status:"SUCCESS"}}
`, "PART", testCase.part, 1)
			plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
			require.NoError(t, err)
			adaptor := New(plugin)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
			adaptor.Init(info)
			var input bytes.Buffer
			writer := multipart.NewWriter(&input)
			file, err := writer.CreateFormFile("input_reference", "input.png")
			require.NoError(t, err)
			_, err = file.Write([]byte("image"))
			require.NoError(t, err)
			require.NoError(t, writer.Close())
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", bytes.NewReader(input.Bytes()))
			c.Request.Header.Set("Content-Type", writer.FormDataContentType())
			c.Set("task_request", map[string]any{"model": "m"})

			body, buildErr := adaptor.BuildRequestBody(c, info)
			if buildErr != nil {
				assert.Contains(t, buildErr.Error(), "multipart")
				return
			}
			encoded, err := io.ReadAll(body)
			require.NoError(t, err)
			assert.NotContains(t, string(encoded), "\r\nX-Injected: yes")
		})
	}
}

func TestTaskAdaptorRejectsPostDistributionEndpointModelDrift(t *testing.T) {
	source := `
export const meta = {apiVersion:1,key:"endpoint-drift",name:"Endpoint Drift",version:"1.0.0",author:{name:"Test"},models:["claimed-model"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) {
  return {url:ctx.baseUrl+"/submit",method:"POST",model:"outside-model",rewriteModel:"allowed-upstream-rewrite"};
}

export function parseSubmitResponse(){return {taskId:"1"}}
export function buildQueryRequest(){return {url:"https://example.com"}}
export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		OriginModelName: "claimed-model",
	}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set("task_request", map[string]any{"model": "claimed-model"})
	c.Set("resolved_task_model", "claimed-model")
	c.Set(pluginruntime.ContextKeyPinnedEndpoint, pluginruntime.PinnedEndpoint{
		Plugin: plugin,
	})

	taskErr := adaptor.ValidateRequestAndSetAction(c, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, "claimed-model", info.OriginModelName)
	assert.Contains(t, taskErr.Message, "does not match")
}

func TestTaskAdaptorReDecodesFinalCandidateAndRejectsModelDrift(t *testing.T) {
	source := `
export const meta = {apiVersion:1,key:"redecode",name:"Redecode",version:"1.0.0",author:{name:"Test"},models:["claimed-model"],fetchMode:"per_task",protocols:[{name:"openai_responses",supports:["sync","background"]}]};
let calls = 0;
export const protocols = {openai_responses:{decodeRequest:function(ctx){calls++;return {kind:"submit",model:calls === 1 ? ctx.model : "drifted-model",requestBody:ctx.body.value};},renderFinal:function(){return {};}}};
export function buildSubmitRequest(ctx){return {url:ctx.baseUrl+"/submit"}} export function parseSubmitResponse(){return {taskId:"one"}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	protocolContext := pluginruntime.ProtocolRequestContext{
		RouteRequestContext: pluginruntime.RouteRequestContext{Body: map[string]any{"kind": "json", "value": map[string]any{"model": "claimed-model"}}, RequestBody: map[string]any{"model": "claimed-model"}},
		Protocol:            "openai_responses", Model: "claimed-model",
	}
	_, err = plugin.Engine.CallPath(context.Background(), "protocols", []string{"openai_responses", "decodeRequest"}, protocolContext.JSValue())
	require.NoError(t, err)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(pluginruntime.ContextKeyPinnedEndpoint, pluginruntime.PinnedEndpoint{Plugin: plugin, Protocol: "openai_responses", Model: "claimed-model"})
	c.Set(pluginruntime.ContextKeyProtocolRequest, protocolContext)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}, OriginModelName: "claimed-model"}
	adaptor := New(plugin)
	adaptor.Init(info)

	taskErr := adaptor.ValidateRequestAndSetAction(c, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
	assert.Contains(t, taskErr.Message, "pinned model")
}

func TestTaskAdaptorRejectsRendererFromFinalProtocolDecoder(t *testing.T) {
	source := `
export const meta = {apiVersion:1,key:"renderer-reject",name:"Renderer Reject",version:"1.0.0",author:{name:"Test"},models:["claimed-model"],fetchMode:"per_task",protocols:[{name:"openai_responses",supports:["sync","background"]}]};
export const protocols = {openai_responses:{decodeRequest:function(ctx){return {kind:"submit",model:ctx.model,requestBody:ctx.body.value,renderer:"legacy"};},renderFinal:function(){return {};}}};
export function buildSubmitRequest(ctx){return {url:ctx.baseUrl+"/submit"}} export function parseSubmitResponse(){return {taskId:"one"}} export function buildQueryRequest(){return {}} export function parseTaskResult(){return {status:"SUCCESS"}}
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	protocolContext := pluginruntime.ProtocolRequestContext{
		RouteRequestContext: pluginruntime.RouteRequestContext{Body: map[string]any{"kind": "json", "value": map[string]any{"model": "claimed-model"}}},
		Protocol:            "openai_responses", Model: "claimed-model",
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(pluginruntime.ContextKeyPinnedEndpoint, pluginruntime.PinnedEndpoint{Plugin: plugin, Protocol: "openai_responses", Model: "claimed-model"})
	c.Set(pluginruntime.ContextKeyProtocolRequest, protocolContext)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}, OriginModelName: "claimed-model"}
	adaptor := New(plugin)
	adaptor.Init(info)

	taskErr := adaptor.ValidateRequestAndSetAction(c, info)

	require.NotNil(t, taskErr)
	assert.Equal(t, http.StatusBadRequest, taskErr.StatusCode)
	assert.Contains(t, taskErr.Message, "must not return renderer")
}

func TestTaskAdaptorBuildContentRequestHookAndMissingFallback(t *testing.T) {
	source := strings.Replace(mockPlugin, `export function listArtifacts() { return []; }
export function buildContentRequest() { throw new Error("artifact_not_found"); }`, `export function listArtifacts(task) { return [{key: "video", type: "video", mimeType: "video/mp4"}]; }
export function buildContentRequest(ctx) {
  if (ctx.data.id !== "raw-upstream" || ctx.upstreamTaskId !== "upstream-task" || ctx.producerVersion !== "0.9.0") throw new Error("bad task context");
  return {url: ctx.baseUrl + "/content/" + ctx.artifactKey, method: ctx.clientRequest.method, headers: {"X-Content": "plugin"}};
}`, 1)
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example", ApiKey: "key"}})
	taskData, err := common.Marshal(map[string]any{"id": "raw-upstream"})
	require.NoError(t, err)
	task := &model.Task{
		TaskID: "task-public", Status: model.TaskStatusSuccess, Data: taskData,
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID: "upstream-task",
			Execution: &model.TaskExecutionSnapshot{TaskPlugin: &model.TaskPluginSnapshot{
				Version: "0.9.0",
			}},
		},
	}
	artifacts, err := adaptor.ListArtifacts(task)
	require.NoError(t, err)
	require.Equal(t, []channel.TaskArtifact{{Key: "video", Type: "video", MimeType: "video/mp4"}}, artifacts)
	descriptor, err := adaptor.BuildContentRequest(task, "video", channel.TaskArtifactClientRequest{Method: http.MethodHead})
	require.NoError(t, err)
	require.NotNil(t, descriptor)
	assert.Equal(t, "https://provider.example/content/video", descriptor.URL)
	assert.Equal(t, http.MethodHead, descriptor.Method)
	assert.Equal(t, "plugin", descriptor.Headers["X-Content"])

	withoutHook, err := pluginruntime.NewRegistry().Register(`
export const meta = {apiVersion:1,key:"no-artifacts",name:"No Artifacts",version:"1.0.0",author:{name:"Test"},models:["m"],fetchMode:"per_task"};
export function buildSubmitRequest(){return {url:"https://provider.example"};}
export function parseSubmitResponse(){return {taskId:"1"};}
export function buildQueryRequest(){return {url:"https://provider.example"};}
export function parseTaskResult(){return {status:"SUCCESS"};}
`, pluginruntime.Options{})
	require.NoError(t, err)
	fallback := New(withoutHook)
	fallback.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}})
	artifacts, err = fallback.ListArtifacts(&model.Task{})
	require.NoError(t, err)
	assert.Nil(t, artifacts)
	descriptor, err = fallback.BuildContentRequest(&model.Task{}, "video", channel.TaskArtifactClientRequest{Method: http.MethodGet})
	require.NoError(t, err)
	assert.Nil(t, descriptor)
}

func TestTaskAdaptorRejectsInvalidArtifactProjection(t *testing.T) {
	testCases := []struct {
		name       string
		projection string
	}{
		{name: "duplicate key", projection: `[{key:"video",type:"video"},{key:"video",type:"video"}]`},
		{name: "array index identity", projection: `[{key:"video",type:"video",index:0}]`},
		{name: "upstream url", projection: `[{key:"video",type:"video",url:"https://cdn.example/video.mp4"}]`},
		{name: "invalid key", projection: `[{key:"video/0",type:"video"}]`},
		{name: "unsupported type", projection: `[{key:"video",type:"text"}]`},
	}
	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			source := strings.Replace(mockPlugin, `export function listArtifacts() { return []; }
export function buildContentRequest() { throw new Error("artifact_not_found"); }`, `export function listArtifacts() { return `+testCase.projection+`; }
export function buildContentRequest(ctx) { return {url:ctx.baseUrl+"/content",method:"GET"}; }
`, 1)
			plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
			require.NoError(t, err)
			adaptor := New(plugin)
			_, err = adaptor.ListArtifacts(&model.Task{TaskID: "task", Status: model.TaskStatusSuccess, Data: []byte(`{}`)})
			require.Error(t, err)
		})
	}
}

func TestTaskAdaptorAllowsExplicitCredentiallessCDNRequest(t *testing.T) {
	source := strings.Replace(mockPlugin, `export function listArtifacts() { return []; }
export function buildContentRequest() { throw new Error("artifact_not_found"); }`, `export function listArtifacts() { return [{key:"video",type:"video"}]; }
export function buildContentRequest(ctx) { return {url:"https://cdn.example/video.mp4",method:ctx.clientRequest.method,credentialless:true}; }
`, 1)
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}})
	descriptor, err := adaptor.BuildContentRequest(
		&model.Task{TaskID: "task", Data: []byte(`{}`)},
		"video",
		channel.TaskArtifactClientRequest{Method: http.MethodGet},
	)
	require.NoError(t, err)
	require.NotNil(t, descriptor)
	assert.True(t, descriptor.Credentialless)
	assert.Equal(t, "https://cdn.example/video.mp4", descriptor.URL)
}

func TestTaskAdaptorMapsJSContract(t *testing.T) {
	gin.SetMode(gin.TestMode)
	service.InitHttpClient()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/submit":
			assert.Equal(t, "submit", r.Header.Get("X-Plugin"))
			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			assert.JSONEq(t, `{"prompt":"hello"}`, string(body))
			_, _ = w.Write([]byte(`{"id":"upstream-1"}`))
		case "/tasks/upstream-1":
			assert.Equal(t, "query", r.Header.Get("X-Plugin"))
			_, _ = w.Write([]byte(`{"id":"upstream-1","url":"https://cdn.example/video.mp4"}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	registry := pluginruntime.NewRegistry()
	plugin, err := registry.Register(mockPlugin, pluginruntime.Options{Key: "mock-task", Version: "1.0.0"})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: server.URL, ApiKey: "secret"}, OriginModelName: "client-model", TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}}
	adaptor.Init(info)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "hello"})
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	assert.Equal(t, "text_to_video", info.Action)
	assert.Equal(t, "mock-v1", info.OriginModelName)
	assert.Equal(t, "mock-upstream", info.UpstreamModelName)
	assert.Equal(t, []string{"mock-v1"}, adaptor.GetModelList())
	assert.Equal(t, "Mock Task", adaptor.GetChannelName())
	assert.Equal(t, map[string]float64{"seconds": 5}, adaptor.EstimateBilling(c, info))

	requestBody, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	url, err := adaptor.BuildRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, server.URL+"/submit", url)
	req := httptest.NewRequest(http.MethodPost, url, nil)
	require.NoError(t, adaptor.BuildRequestHeader(c, req, info))
	assert.Equal(t, "submit", req.Header.Get("X-Plugin"))

	resp, err := adaptor.DoRequest(c, info, requestBody)
	require.NoError(t, err)
	parsed, taskErr := adaptor.ParseResponse(c, resp, info)
	require.Nil(t, taskErr)
	require.NotNil(t, parsed)
	assert.Equal(t, "upstream-1", parsed.UpstreamTaskID)
	assert.JSONEq(t, `{"accepted":true,"status":200}`, string(parsed.TaskData))
	assert.Nil(t, parsed.ClientResponse)
	assert.Empty(t, recorder.Body.String(), "response parsing must not write before the durable task barrier")
	assert.Equal(t, map[string]float64{"seconds": 7}, adaptor.AdjustBillingOnSubmit(info, []byte(`{"seconds":7}`)))

	queryResp, err := adaptor.FetchTask(server.URL, "secret", map[string]any{"task_id": parsed.UpstreamTaskID, "action": info.Action}, "")
	require.NoError(t, err)
	queryBody, err := io.ReadAll(queryResp.Body)
	require.NoError(t, err)
	require.NoError(t, queryResp.Body.Close())
	result, err := adaptor.ParseTaskResult(queryBody)
	require.NoError(t, err)
	assert.Equal(t, "SUCCESS", result.Status)
	assert.Equal(t, "https://cdn.example/video.mp4", result.Url)
	assert.Zero(t, adaptor.AdjustBillingOnComplete(&model.Task{}, result))
	assert.Equal(t, 23, result.TotalTokens)

	rendered, err := adaptor.ConvertToOpenAIVideo(&model.Task{TaskID: "task_public", Status: model.TaskStatusSuccess})
	require.NoError(t, err)
	assert.JSONEq(t, `{
		"id":"task_public",
		"object":"video",
		"model":"",
		"status":"completed",
		"progress":0,
		"created_at":0
	}`, string(rendered))
	_, err = plugin.Engine.Export(context.Background(), "meta")
	require.NoError(t, err)
}

func TestTaskAdaptorSanitizesOpenAIVideoRendererOutput(t *testing.T) {
	source := `
export const meta = {
  apiVersion: 1, key: "safe-video", name: "Safe Video", version: "1.0.0",
  author: {name: "Test"}, models: ["model"], fetchMode: "per_task", protocols: ["openai_video"],
};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse() { return {taskId: "upstream"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/query"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export function listArtifacts() { return []; }
export function buildContentRequest() { throw new Error("artifact_not_found"); }
export const protocols = {openai_video: {
decodeRequest: function(ctx) { return {kind:"submit", model:ctx.model, requestBody:ctx.body.value}; },
render: function() {
  return {
    id: "upstream-id",
    task_id: "upstream-task-id",
    object: "provider-video",
    model: "model",
    status: "completed",
    progress: 100,
    created_at: 10,
    completed_at: 20,
    metadata: {
      url: "https://upstream.example/video.mp4",
      URL: "https://upstream.example/uppercase.mp4",
      label: "safe",
    },
    url: "https://upstream.example/top-level.mp4",
    upstream_url: "https://upstream.example/unknown.mp4",
    provider_payload: {task_id: "upstream-task-id"},
  };
}}};
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)

	rendered, err := adaptor.ConvertToOpenAIVideo(&model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusInProgress,
		Properties: model.Properties{OriginModelName: "origin-model"},
	})
	require.NoError(t, err)

	var video dto.OpenAIVideo
	require.NoError(t, common.Unmarshal(rendered, &video))
	assert.Equal(t, "task_public", video.ID)
	assert.Equal(t, "video", video.Object)
	assert.Empty(t, video.TaskID)
	assert.Equal(t, "origin-model", video.Model)
	assert.Zero(t, video.CompletedAt)
	assert.Equal(t, map[string]any{"label": "safe"}, video.Metadata)

	var fields map[string]any
	require.NoError(t, common.Unmarshal(rendered, &fields))
	assert.NotContains(t, fields, "url")
	assert.NotContains(t, fields, "upstream_url")
	assert.NotContains(t, fields, "provider_payload")
	assert.NotContains(t, fields, "completed_at")
	assert.NotContains(t, string(rendered), "upstream.example")
	assert.NotContains(t, string(rendered), "upstream-task-id")
}

func TestTaskAdaptorPreservesOpenAIVideoFailureSlotsAndOwnsLifecycle(t *testing.T) {
	source := strings.Replace(mockPlugin, `render: function(ctx, task) { return {id: task.task_id, status: "completed"}; }`, `render: function() { return {id:"provider", object:"provider", model:"provider-model", status:"completed", progress:100, created_at:99, completed_at:20, error:{code:"provider_error",message:"provider rejected request"}}; }`, 1)
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	task := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusFailure,
		FailReason: "provider secret",
		CreatedAt:  10,
		UpdatedAt:  20,
		Properties: model.Properties{OriginModelName: "origin-model"},
	}

	rendered, err := adaptor.ConvertToOpenAIVideo(task)

	require.NoError(t, err)
	assert.JSONEq(t, `{"id":"task_public","object":"video","model":"origin-model","status":"failed","progress":0,"created_at":10,"error":{"message":"provider rejected request","code":"provider_error"}}`, string(rendered))
}

func TestTaskAdaptorBoundsNativeUsageBeforeQuotaCalculation(t *testing.T) {
	source := `
export const meta = {
  apiVersion: 1, key: "bounded-usage", name: "Bounded Usage", version: "1.0.0",
  author: {name: "Test"},
  models: ["model"], fetchMode: "per_task",
  usageSchema: {
    duration: {type: "number", unit: "second"},
    count: {type: "number", unit: "count"},
    tokens: {type: "number", unit: "token"},
    mode: {enum: ["std", "pro"]},
  },
  usageExamples: [{label: "std · 1s", facts: {duration: 1, count: 1, tokens: 1, mode: "std"}}],
};
export function buildSubmitRequest(ctx) {
  return {url: ctx.baseUrl + "/submit", method: "POST", body: {}};
}
export function parseSubmitResponse() { return {taskId: "1"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export function extractUsage(ctx) {
  const entries = (ctx.requestBody || {}).hookUsageEntries || [];
  const facts = {};
  entries.forEach(function(entry) { facts[entry.name] = entry.value; });
  return facts;
}
export function extractUsageOnSubmit(ctx, data) { return (data || {}).usage || {}; }
export function extractUsageOnComplete(task, result, body) { return (body || {}).completionUsage || {}; }
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)

	newRequest := func(t *testing.T, requestBody map[string]any) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
		t.Helper()
		adaptor := New(plugin)
		info := &relaycommon.RelayInfo{
			ChannelMeta:   &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"},
			TaskRelayInfo: &relaycommon.TaskRelayInfo{},
		}
		adaptor.Init(info)
		context, _ := gin.CreateTestContext(httptest.NewRecorder())
		context.Request = httptest.NewRequest(http.MethodPost, "/native/submit", nil)
		context.Set("task_request", requestBody)
		return adaptor, context, info
	}

	requestTests := []struct {
		name string
		body map[string]any
	}{
		{
			name: "duration in resolved metadata",
			body: map[string]any{"metadata": map[string]any{"duration": relaycommon.MaxTaskDurationSeconds + 1}},
		},
		{
			name: "count in resolved metadata",
			body: map[string]any{"metadata": map[string]any{"count": dto.MaxImageN + 1}},
		},
		{
			name: "declared enum in resolved metadata",
			body: map[string]any{"metadata": map[string]any{"mode": "turbo"}},
		},
		{
			name: "implicit duration key without declaration",
			body: map[string]any{"durationSeconds": relaycommon.MaxTaskDurationSeconds + 1},
		},
		{
			name: "implicit count key without declaration",
			body: map[string]any{"image_count": dto.MaxImageN + 1},
		},
		{
			name: "negative resolved duration",
			body: map[string]any{"duration": -1},
		},
		{
			name: "non-finite resolved duration",
			body: map[string]any{"duration": math.Inf(1)},
		},
		{
			name: "metadata cannot hide behind valid top-level duration",
			body: map[string]any{
				"duration": relaycommon.MaxTaskDurationSeconds,
				"metadata": map[string]any{"duration": relaycommon.MaxTaskDurationSeconds + 1},
			},
		},
		{
			name: "nested passthrough duration",
			body: map[string]any{
				"metadata": map[string]any{
					"parameters": map[string]any{"duration": relaycommon.MaxTaskDurationSeconds + 1},
				},
			},
		},
	}
	for _, testCase := range requestTests {
		t.Run(testCase.name, func(t *testing.T) {
			adaptor, context, info := newRequest(t, testCase.body)
			taskErr := adaptor.ValidateRequestAndSetAction(context, info)
			require.NotNil(t, taskErr)
			assert.Equal(t, "plugin_usage_invalid", taskErr.Code)
		})
	}

	hookTests := []struct {
		name  string
		usage map[string]any
	}{
		{
			name:  "duration returned only by extractUsage",
			usage: map[string]any{"duration": float64(relaycommon.MaxTaskDurationSeconds + 1)},
		},
		{
			name:  "count returned only by extractUsage",
			usage: map[string]any{"count": float64(dto.MaxImageN + 1)},
		},
		{
			name:  "enum returned only by extractUsage",
			usage: map[string]any{"mode": "turbo"},
		},
		{
			name:  "undeclared numeric ratio uses conservative host ceiling",
			usage: map[string]any{"custom_ratio": float64(relaycommon.MaxTaskDurationSeconds + 1)},
		},
		{
			name:  "negative hook ratio",
			usage: map[string]any{"custom_ratio": -1.0},
		},
		{
			name:  "non-finite hook ratio",
			usage: map[string]any{"custom_ratio": math.NaN()},
		},
	}
	for _, testCase := range hookTests {
		t.Run(testCase.name, func(t *testing.T) {
			entries := make([]any, 0, len(testCase.usage))
			for key, value := range testCase.usage {
				entries = append(entries, map[string]any{"name": key, "value": value})
			}
			adaptor, context, info := newRequest(t, map[string]any{"hookUsageEntries": entries})
			require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
			ratios, err := adaptor.EstimateBillingValidated(context, info)
			require.Error(t, err)
			assert.Nil(t, ratios)
		})
	}

	t.Run("numeric strings remain valid in vendor request fields", func(t *testing.T) {
		adaptor, context, info := newRequest(t, map[string]any{
			"metadata": map[string]any{
				"duration": "5",
				"count":    "2",
				"mode":     "std",
			},
		})
		assert.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
	})

	t.Run("numeric strings from usage hooks are rejected", func(t *testing.T) {
		adaptor, context, info := newRequest(t, map[string]any{
			"hookUsageEntries": []any{map[string]any{"name": "duration", "value": "5"}},
		})
		require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
		ratios, err := adaptor.EstimateBillingValidated(context, info)
		require.Error(t, err)
		assert.Nil(t, ratios)
	})

	t.Run("declared token facts use int32 saturation instead of duration cap", func(t *testing.T) {
		adaptor, context, info := newRequest(t, map[string]any{
			"hookUsageEntries": []any{
				map[string]any{"name": "tokens", "value": float64(500000)},
			},
		})
		require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
		facts, err := adaptor.ExtractUsageFactsValidated(context, info)
		require.NoError(t, err)
		assert.EqualValues(t, 500000, facts["tokens"])

		ratios, err := adaptor.EstimateBillingValidated(context, info)
		require.NoError(t, err)
		assert.Equal(t, 500000.0, ratios["tokens"])
	})

	t.Run("declared token facts saturate at the int32 quota bound", func(t *testing.T) {
		adaptor, context, info := newRequest(t, map[string]any{
			"hookUsageEntries": []any{
				map[string]any{"name": "tokens", "value": float64(common.MaxQuota) + 1},
			},
		})
		require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
		facts, err := adaptor.ExtractUsageFactsValidated(context, info)
		require.NoError(t, err)
		assert.EqualValues(t, common.MaxQuota, facts["tokens"])
	})

	t.Run("canonical maxima and enum are accepted", func(t *testing.T) {
		adaptor, context, info := newRequest(t, map[string]any{
			"duration": relaycommon.MaxTaskDurationSeconds,
			"count":    dto.MaxImageN,
			"mode":     "std",
			"hookUsageEntries": []any{
				map[string]any{"name": "duration", "value": float64(relaycommon.MaxTaskDurationSeconds)},
				map[string]any{"name": "count", "value": float64(dto.MaxImageN)},
				map[string]any{"name": "mode", "value": "pro"},
			},
		})
		require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
		ratios, err := adaptor.EstimateBillingValidated(context, info)
		require.NoError(t, err)
		assert.Equal(t, map[string]float64{
			"duration": relaycommon.MaxTaskDurationSeconds,
			"count":    dto.MaxImageN,
		}, ratios)
	})

	t.Run("runtime error does not expose plugin-controlled usage key", func(t *testing.T) {
		adaptor, context, info := newRequest(t, map[string]any{
			"hookUsageEntries": []any{
				map[string]any{
					"name":  "https://private.invalid/?token=secret",
					"value": float64(relaycommon.MaxTaskDurationSeconds + 1),
				},
			},
		})
		require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))
		_, err := adaptor.EstimateBillingValidated(context, info)
		require.Error(t, err)
		assert.NotContains(t, err.Error(), "private.invalid")
		assert.NotContains(t, err.Error(), "secret")
	})

	for _, testCase := range []struct {
		name  string
		usage map[string]any
	}{
		{
			name:  "oversized completion duration is discarded",
			usage: map[string]any{"duration": relaycommon.MaxTaskDurationSeconds + 1},
		},
		{
			name:  "oversized completion count is discarded",
			usage: map[string]any{"count": dto.MaxImageN + 1},
		},
		{
			name:  "completion hook numeric string is discarded",
			usage: map[string]any{"duration": "5"},
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			adaptor, _, _ := newRequest(t, map[string]any{})
			body, marshalErr := common.Marshal(map[string]any{"completionUsage": testCase.usage})
			require.NoError(t, marshalErr)
			result, parseErr := adaptor.ParseTaskResult(body)
			require.NoError(t, parseErr)
			assert.Nil(t, result.UsageFacts)
			assert.Zero(t, result.TotalTokens)
		})
	}

	t.Run("declared completion token unit is saturated instead of discarded", func(t *testing.T) {
		adaptor, _, _ := newRequest(t, map[string]any{})
		body, err := common.Marshal(map[string]any{"completionUsage": map[string]any{"tokens": 500000}})
		require.NoError(t, err)
		result, err := adaptor.ParseTaskResult(body)
		require.NoError(t, err)
		assert.EqualValues(t, 500000, result.UsageFacts["tokens"])
	})

	t.Run("declared credit facts keep sub-integer precision", func(t *testing.T) {
		source := `
export const meta = {
  apiVersion: 1, key: "credit-decimals", name: "Credit Decimals", version: "1.0.0",
  author: {name: "Test"}, models: ["model"], fetchMode: "per_task",
  usageSchema: {units: {type: "number", unit: "credit"}},
  usageExamples: [{label: "3.5 credits", facts: {units: 3.5}}],
};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse() { return {taskId: "task"}; }
export function buildQueryRequest() { return {url: "https://example.com"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export function extractUsage() { return {units: 3.5}; }
export function extractUsageOnComplete() { return {units: 3.5}; }
`
		plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
		require.NoError(t, err)
		adaptor := New(plugin)
		info := &relaycommon.RelayInfo{
			ChannelMeta:   &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"},
			TaskRelayInfo: &relaycommon.TaskRelayInfo{},
		}
		adaptor.Init(info)
		context, _ := gin.CreateTestContext(httptest.NewRecorder())
		context.Request = httptest.NewRequest(http.MethodPost, "/native/submit", nil)
		context.Set("task_request", map[string]any{"model": "model"})
		require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))

		facts, err := adaptor.ExtractUsageFactsValidated(context, info)
		require.NoError(t, err)
		assert.Equal(t, 3.5, facts["units"])

		body, err := common.Marshal(map[string]any{})
		require.NoError(t, err)
		result, err := adaptor.ParseTaskResult(body)
		require.NoError(t, err)
		assert.Equal(t, 3.5, result.UsageFacts["units"])
	})

	t.Run("completion token facts are saturated instead of duration-capped", func(t *testing.T) {
		adaptor, _, _ := newRequest(t, map[string]any{})
		body, err := common.Marshal(map[string]any{"completionUsage": map[string]any{"upstreamUnits": 5000}})
		require.NoError(t, err)
		result, err := adaptor.ParseTaskResult(body)
		require.NoError(t, err)
		assert.Equal(t, 5000, result.TotalTokens)
		assert.EqualValues(t, 5000, result.UsageFacts["upstreamUnits"])
	})

	t.Run("invalid post-submit adjustment is discarded before recalculation", func(t *testing.T) {
		adaptor, _, info := newRequest(t, map[string]any{})
		ratios := adaptor.AdjustBillingOnSubmit(info, []byte(`{"usage":{"duration":1000000000000000}}`))
		assert.Nil(t, ratios)
	})
}

func TestTaskAdaptorSeparatesExpressionFactsFromLegacyBillingRatios(t *testing.T) {
	source := `
export const meta = {
  apiVersion: 1, key: "usage-purpose", name: "Usage Purpose", version: "1.0.0",
  author: {name: "Test"}, models: ["usage-model"], fetchMode: "per_task",
  usageSchema: {seconds: {type: "number", unit: "second"}},
};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse() { return {taskId: "task"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/query"}; }
export function parseTaskResult() { return {status: "SUCCESS"}; }
export function extractUsage(ctx) {
  return ctx.usagePurpose === "billing_ratios" ? {legacy_multiplier: 2} : {seconds: 5};
}
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	adaptor.Init(info)
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = httptest.NewRequest(http.MethodPost, "/submit", nil)
	context.Set("task_request", map[string]any{"model": "usage-model"})
	require.Nil(t, adaptor.ValidateRequestAndSetAction(context, info))

	facts, err := adaptor.ExtractUsageFactsValidated(context, info)
	require.NoError(t, err)
	assert.EqualValues(t, 5, facts["seconds"])
	assert.Len(t, facts, 1)

	ratios, err := adaptor.EstimateBillingValidated(context, info)
	require.NoError(t, err)
	assert.Equal(t, map[string]float64{"legacy_multiplier": 2}, ratios)
}

func TestTaskAdaptorAcceptsNormalizedLegacyTokenCounters(t *testing.T) {
	source := `
export const meta = {apiVersion:1,key:"normalized-tokens",name:"Normalized Tokens",version:"1.0.0",author:{name:"Test"},models:["m"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) { return {url: ctx.baseUrl + "/submit"}; }
export function parseSubmitResponse() { return {taskId: "task"}; }
export function buildQueryRequest(ctx) { return {url: ctx.baseUrl + "/query"}; }
export function parseTaskResult(ctx, body) { return {status: "SUCCESS", completionTokens: body.completion, totalTokens: body.total}; }
`
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)

	result, err := adaptor.ParseTaskResult([]byte(`{"completion":13,"total":17}`))
	require.NoError(t, err)
	assert.Equal(t, 13, result.CompletionTokens)
	assert.Equal(t, 17, result.TotalTokens)
	assert.Nil(t, result.UsageFacts)
}

func TestSubmitContextExposesOriginTasks(t *testing.T) {
	plugin, err := pluginruntime.NewRegistry().Register(mockPlugin, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example", ApiKey: "secret"},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			OriginTasks: []relaycommon.OriginTaskRef{{
				TaskID:         "task_pub_1",
				UpstreamTaskID: "cgt-upstream-1",
				Action:         "text_to_video",
				Status:         "SUCCESS",
				Data:           []byte(`{"id":"cgt-upstream-1"}`),
			}},
		},
	}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)

	ctx := adaptor.submitContext(c, info)

	originTasks, ok := ctx["originTasks"].([]map[string]any)
	require.True(t, ok)
	require.Len(t, originTasks, 1)
	assert.Equal(t, "task_pub_1", originTasks[0]["taskId"])
	assert.Equal(t, "cgt-upstream-1", originTasks[0]["upstreamTaskId"])
	assert.Equal(t, "text_to_video", originTasks[0]["action"])
	assert.Equal(t, "SUCCESS", originTasks[0]["status"])
	assert.Equal(t, map[string]any{"id": "cgt-upstream-1"}, originTasks[0]["data"])
}

func TestSubmitContextOmitsOriginTasksWhenEmpty(t *testing.T) {
	plugin, err := pluginruntime.NewRegistry().Register(mockPlugin, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example", ApiKey: "secret"},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)

	ctx := adaptor.submitContext(c, info)

	_, ok := ctx["originTasks"]
	assert.False(t, ok)
}

func TestSubmitContextOriginTasksNilDataOnInvalidJSON(t *testing.T) {
	plugin, err := pluginruntime.NewRegistry().Register(mockPlugin, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example", ApiKey: "secret"},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{
			OriginTasks: []relaycommon.OriginTaskRef{{
				TaskID:         "task_pub_1",
				UpstreamTaskID: "cgt-upstream-1",
				Action:         "text_to_video",
				Status:         "SUCCESS",
				Data:           []byte("not-json"),
			}},
		},
	}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)

	ctx := adaptor.submitContext(c, info)

	originTasks, ok := ctx["originTasks"].([]map[string]any)
	require.True(t, ok)
	require.Len(t, originTasks, 1)
	assert.Nil(t, originTasks[0]["data"])
}

func TestTaskAdaptorRejectsRequestHostOverride(t *testing.T) {
	source := strings.Replace(mockPlugin, `ctx.baseUrl + "/submit"`, `"https://attacker.example/steal"`, 1)
	plugin, err := pluginruntime.NewRegistry().Register(source, pluginruntime.Options{Key: "mock-task", Version: "1.0.0"})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{Prompt: "hello"})
	taskErr := adaptor.ValidateRequestAndSetAction(c, info)
	require.NotNil(t, taskErr)
	assert.Contains(t, taskErr.Message, "not allowed")
}

const batchMockPlugin = `
export const meta = { apiVersion: 1, key: "mock-batch", name: "Mock Batch", version: "1.0.0", author: {name: "Test"}, channelTypes: [1002], models: ["batch-v1"], fetchMode: "batch" };
export function buildSubmitRequest(ctx) { return { url: ctx.baseUrl + "/submit", method: "POST", body: {} }; }
export function parseSubmitResponse(ctx, resp) { return { taskId: resp.body.id }; }
export function buildQueryRequest(ctx) { return { url: ctx.baseUrl + "/tasks/" + ctx.taskId }; }
export function parseTaskResult(ctx, body) { return { taskId: body.id, status: "SUCCESS" }; }
export function buildBatchQueryRequest(ctx, taskIds) { return { url: ctx.baseUrl + "/batch", method: "POST", headers: { "X-Plugin": "batch" }, body: { ids: taskIds } }; }
export function parseBatchResult(ctx, body) {
  return body.items.map(function (item) {
    return { taskId: item.id, action: item.action, status: item.status, progress: item.progress, url: (item.urls || [])[0] || "", finishTime: item.finish || 0, data: item };
  });
}
export function extractUsageOnComplete(task, result, body) { return {upstreamUnits: body.usage || 0}; }
`

// Covers the bridge half of the batch contract: FetchBatchTasks must build the
// upstream request from the plugin descriptor, and ParseBatchResult must key
// results by taskId, preserve the explicit result URL, and skip entries without
// a task id.
func TestTaskAdaptorBatchBridge(t *testing.T) {
	service.InitHttpClient()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/batch", r.URL.Path)
		require.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "batch", r.Header.Get("X-Plugin"))
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.JSONEq(t, `{"ids":["task-a","task-b"]}`, string(body))
		_, _ = w.Write([]byte(`{"items":[
			{"id":"task-a","action":"music","status":"SUCCESS","progress":"100%","urls":["https://cdn.example/a1.mp3","https://cdn.example/a2.mp3"],"finish":1700000000,"usage":23},
			{"id":"task-b","status":"IN_PROGRESS","progress":"40%"},
			{"id":"","status":"SUCCESS"}
		]}`))
	}))
	defer server.Close()

	plugin, err := pluginruntime.NewRegistry().Register(batchMockPlugin, pluginruntime.Options{Key: "mock-batch", Version: "1.0.0"})
	require.NoError(t, err)
	adaptor := New(plugin)
	require.Equal(t, "batch", adaptor.FetchMode())

	resp, err := adaptor.FetchBatchTasks(server.URL, "secret", []string{"task-a", "task-b"}, "")
	require.NoError(t, err)
	defer resp.Body.Close()
	payload, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	results, err := adaptor.ParseBatchResult(payload)
	require.NoError(t, err)
	require.Len(t, results, 2, "entry without taskId must be skipped")

	done := results["task-a"]
	require.NotNil(t, done)
	assert.Equal(t, "music", done.Action)
	assert.Equal(t, "SUCCESS", done.TaskInfo.Status)
	assert.Equal(t, "100%", done.TaskInfo.Progress)
	assert.Equal(t, "https://cdn.example/a1.mp3", done.TaskInfo.Url)
	assert.Equal(t, int64(1700000000), done.FinishTime)
	assert.EqualValues(t, 23, done.TaskInfo.UsageFacts["upstreamUnits"])
	assert.Equal(t, 23, done.TaskInfo.TotalTokens)
	require.NotNil(t, done.Data)

	pending := results["task-b"]
	require.NotNil(t, pending)
	assert.Equal(t, "IN_PROGRESS", pending.TaskInfo.Status)
	assert.Equal(t, "40%", pending.TaskInfo.Progress)
	assert.Empty(t, pending.TaskInfo.Url)
}

const mappingOrderAdaptorPlugin = `
export const meta = {apiVersion:1,key:"map-order-adaptor",name:"Map Order Adaptor",version:"1.0.0",author:{name:"Test"},models:["declared-model"],fetchMode:"per_task"};
export function buildSubmitRequest(ctx) {
  return {url: ctx.baseUrl+"/submit", method:"POST", body:{upstreamModel: ctx.upstreamModel, model: ctx.model}};
}
export function parseSubmitResponse(){return {taskId:"1"};}
export function buildQueryRequest(){return {url:"https://provider.example"};}
export function parseTaskResult(){return {status:"SUCCESS"};}
`

func mappingOrderSubmitBody(t *testing.T, origin, mapping string) []byte {
	t.Helper()
	plugin, err := pluginruntime.NewRegistry().Register(mappingOrderAdaptorPlugin, pluginruntime.Options{})
	require.NoError(t, err)
	adaptor := New(plugin)
	info := &relaycommon.RelayInfo{
		ChannelMeta:     &relaycommon.ChannelMeta{ChannelBaseUrl: "https://provider.example"},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{},
		OriginModelName: origin,
	}
	adaptor.Init(info)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
	if mapping != "" {
		c.Set("model_mapping", mapping)
	}
	c.Set("task_request", map[string]any{"prompt": "p"})
	info.UpstreamModelName = info.OriginModelName
	require.NoError(t, helper.ModelMappedHelper(c, info, nil))
	require.Nil(t, adaptor.ValidateRequestAndSetAction(c, info))
	body, err := adaptor.BuildRequestBody(c, info)
	require.NoError(t, err)
	raw, err := io.ReadAll(body)
	require.NoError(t, err)
	return raw
}

func TestTaskAdaptorBuildSubmitReceivesMappedUpstreamModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mapped := mappingOrderSubmitBody(t, "alias-model", `{"alias-model":"mid-model","mid-model":"declared-model"}`)
	var decoded map[string]any
	require.NoError(t, common.Unmarshal(mapped, &decoded))
	assert.Equal(t, "declared-model", decoded["upstreamModel"])
	assert.Equal(t, "alias-model", decoded["model"])

	withoutMapping := mappingOrderSubmitBody(t, "declared-model", "")
	emptyMapping := mappingOrderSubmitBody(t, "declared-model", "{}")
	assert.Equal(t, withoutMapping, emptyMapping)
	require.NoError(t, common.Unmarshal(withoutMapping, &decoded))
	assert.Equal(t, "declared-model", decoded["upstreamModel"])
	assert.Equal(t, "declared-model", decoded["model"])
}
