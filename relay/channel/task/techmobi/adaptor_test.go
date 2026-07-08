package techmobi

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

var (
	_ channel.TaskAdaptor          = (*TaskAdaptor)(nil)
	_ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)
)

func newJSONCtx(body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func newRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeTechMobiVideo,
			ChannelBaseUrl: "https://api.chatgpttech.mobi",
			ApiKey:         "sk-techmobi",
		},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
		OriginModelName: "doubao/doubao-seedance-2-0-260128",
	}
}

func TestBuildRequestURL_UsesGenerationTasksEndpoint(t *testing.T) {
	a := &TaskAdaptor{}
	info := newRelayInfo()
	info.ChannelBaseUrl = "https://api.chatgpttech.mobi/"
	a.Init(info)

	got, err := a.BuildRequestURL(info)
	if err != nil {
		t.Fatalf("BuildRequestURL error: %v", err)
	}
	if got != "https://api.chatgpttech.mobi/v1/generation/tasks" {
		t.Fatalf("url = %q", got)
	}
}

func TestBuildRequestHeader_SetsBearerJSONHeaders(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(newRelayInfo())
	req := httptest.NewRequest(http.MethodPost, "/submit", nil)

	if err := a.BuildRequestHeader(nil, req, newRelayInfo()); err != nil {
		t.Fatalf("BuildRequestHeader error: %v", err)
	}
	if got := req.Header.Get("Content-Type"); got != "application/json" {
		t.Fatalf("Content-Type = %q", got)
	}
	if got := req.Header.Get("Accept"); got != "application/json" {
		t.Fatalf("Accept = %q", got)
	}
	if got := req.Header.Get("Authorization"); got != "Bearer sk-techmobi" {
		t.Fatalf("Authorization = %q", got)
	}
}

func TestValidateRequestAndSetAction_RequiresSeedanceContent(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newJSONCtx(`{"model":"doubao/doubao-seedance-2-0-260128","prompt":"legacy prompt"}`)

	if taskErr := a.ValidateRequestAndSetAction(c, newRelayInfo()); taskErr == nil {
		t.Fatal("expected legacy prompt-only body to be rejected")
	}
}

func TestBuildRequestBody_PassesThroughSeedanceBodyWithoutHTMLEscapingURL(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newJSONCtx(`{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"a cat walking"},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/cat.png?a=1&b=2"},"role":"first_frame"}
		],
		"ratio":"16:9",
		"resolution":"720p",
		"duration":5,
		"seed":42,
		"watermark":false
	}`)
	info := newRelayInfo()
	info.IsModelMapped = true
	info.UpstreamModelName = "upstream/seedance"

	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	body, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	if strings.Contains(string(data), `\u0026`) {
		t.Fatalf("image URL query delimiter was HTML escaped: %s", string(data))
	}

	var payload dto.SeedanceVideoRequest
	if err := common.Unmarshal(data, &payload); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if payload.Model != "upstream/seedance" {
		t.Fatalf("model = %q, want mapped upstream model", payload.Model)
	}
	if payload.Duration == nil || *payload.Duration != 5 {
		t.Fatalf("duration = %+v", payload.Duration)
	}
	if payload.Seed == nil || *payload.Seed != 42 {
		t.Fatalf("seed = %+v", payload.Seed)
	}
	if payload.Watermark == nil || *payload.Watermark != false {
		t.Fatalf("watermark = %+v", payload.Watermark)
	}
	if got := payload.Content[1].ImageURL.URL; got != "https://cdn.example.com/cat.png?a=1&b=2" {
		t.Fatalf("image url = %q", got)
	}
}

func TestBuildRequestBody_UnmappedModelSetsUpstreamModelName(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newJSONCtx(`{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cat walking"}]
	}`)
	info := newRelayInfo()

	if _, err := a.BuildRequestBody(c, info); err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	if info.UpstreamModelName != "doubao/doubao-seedance-2-0-260128" {
		t.Fatalf("UpstreamModelName = %q", info.UpstreamModelName)
	}
}

func TestEstimateBilling_UsesResolutionAndVideoInputRatio(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newJSONCtx(`{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"extend this clip"},
			{"type":"video_url","video_url":{"url":"https://cdn.example.com/input.mp4"}}
		],
		"resolution":"1080p"
	}`)
	info := newRelayInfo()
	info.UpstreamModelName = "doubao/doubao-seedance-2-0-260128"

	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	ratios := a.EstimateBilling(c, info)
	want, _ := GetVideoGenerationRatio("doubao/doubao-seedance-2-0-260128", "1080p", true)
	if ratios["video_generation"] != want {
		t.Fatalf("video_generation ratio = %v, want %v", ratios["video_generation"], want)
	}
}

func TestEstimateBilling_NoExtraRatioForBaseTier(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newJSONCtx(`{
		"model":"doubao/doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"a cat walking"}],
		"resolution":"720p"
	}`)
	info := newRelayInfo()
	info.UpstreamModelName = "doubao/doubao-seedance-2-0-260128"

	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("EstimateBilling = %v, want nil for base tier", ratios)
	}
}

func TestDoResponse_SubmitIDStartsAsyncTaskWithPublicEnvelope(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(newRelayInfo())
	c, w := newJSONCtx(`{}`)
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(`{"id":"task_upstream_123","status":"processing"}`)),
	}
	info := newRelayInfo()

	taskID, taskData, taskErr := a.DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse task error: %+v", taskErr)
	}
	if taskID != "task_upstream_123" {
		t.Fatalf("taskID = %q, want upstream task id", taskID)
	}
	if string(taskData) != `{"id":"task_upstream_123","status":"processing"}` {
		t.Fatalf("taskData = %s", string(taskData))
	}

	var ov dto.OpenAIVideo
	if err := common.Unmarshal(w.Body.Bytes(), &ov); err != nil {
		t.Fatalf("unmarshal client envelope: %v", err)
	}
	if ov.ID != "task_public" || ov.TaskID != "task_public" {
		t.Fatalf("client ids = %q/%q, want public id", ov.ID, ov.TaskID)
	}
}

func TestDoResponse_GenerationTasksPathUsesDocsEnvelope(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(newRelayInfo())
	c, w := newJSONCtx(`{}`)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/generation/tasks", strings.NewReader(`{}`))
	c.Request.Header.Set("Content-Type", "application/json")
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(`{"id":"task_upstream_123","status":"processing"}`)),
	}

	taskID, _, taskErr := a.DoResponse(c, resp, newRelayInfo())
	if taskErr != nil {
		t.Fatalf("DoResponse task error: %+v", taskErr)
	}
	if taskID != "task_upstream_123" {
		t.Fatalf("taskID = %q, want upstream task id", taskID)
	}

	var got struct {
		ID     string `json:"id"`
		Status string `json:"status"`
		Object string `json:"object"`
	}
	if err := common.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal docs envelope: %v", err)
	}
	if got.ID != "task_public" || got.Status != "processing" {
		t.Fatalf("docs envelope = %+v", got)
	}
	if got.Object != "" {
		t.Fatalf("docs envelope should not include OpenAI object field: %+v", got)
	}
}

func TestDoResponse_RejectsMissingIDAndFailedSubmit(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{"missing id", `{"status":"processing"}`},
		{"failed", `{"id":"task_upstream_123","status":"failed","error":{"message":"chatgpttech upstream failed"}}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &TaskAdaptor{}
			c, _ := newJSONCtx(`{}`)
			resp := &http.Response{Body: io.NopCloser(strings.NewReader(tt.body))}

			taskID, taskData, taskErr := a.DoResponse(c, resp, newRelayInfo())
			if taskErr == nil {
				t.Fatal("expected task error")
			}
			if taskID != "" {
				t.Fatalf("taskID = %q, want empty", taskID)
			}
			if len(taskData) != 0 {
				t.Fatalf("taskData = %s, want empty", string(taskData))
			}
		})
	}
}

func TestFetchTask_GETsEscapedTaskStatusEndpoint(t *testing.T) {
	service.InitHttpClient()
	var sawPoll bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawPoll = true
		if r.Method != http.MethodGet {
			t.Fatalf("method = %s, want GET", r.Method)
		}
		if r.URL.EscapedPath() != "/v1/generation/tasks/task%2Fupstream%20123" {
			t.Fatalf("escaped path = %s", r.URL.EscapedPath())
		}
		if got := r.Header.Get("Authorization"); got != "Bearer sk-techmobi" {
			t.Fatalf("Authorization = %q", got)
		}
		_, _ = w.Write([]byte(`{"status":"processing"}`))
	}))
	defer srv.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(srv.URL+"/", "sk-techmobi", map[string]any{
		"task_id": "task/upstream 123",
	}, "")
	if err != nil {
		t.Fatalf("FetchTask error: %v", err)
	}
	defer resp.Body.Close()
	if !sawPoll {
		t.Fatal("poll endpoint was not requested")
	}
}

func TestFetchTask_RejectsEmptyTaskID(t *testing.T) {
	service.InitHttpClient()
	resp, err := (&TaskAdaptor{}).FetchTask("https://api.chatgpttech.mobi", "sk-techmobi", map[string]any{
		"task_id": " ",
	}, "")
	if err == nil {
		if resp != nil && resp.Body != nil {
			_ = resp.Body.Close()
		}
		t.Fatal("expected empty task_id to be rejected")
	}
}

func TestParseTaskResult_MapsStatusesAndUsage(t *testing.T) {
	a := &TaskAdaptor{}

	info, err := a.ParseTaskResult([]byte(`{"id":"task_upstream_123","status":"processing"}`))
	if err != nil {
		t.Fatalf("processing: %v", err)
	}
	if info.Status != model.TaskStatusInProgress || info.Progress != "30%" {
		t.Fatalf("processing status/progress = %q/%q", info.Status, info.Progress)
	}

	info, err = a.ParseTaskResult([]byte(`{
		"id":"task_upstream_123",
		"status":"succeeded",
		"content":[{"type":"video_url","video_url":{"url":"https://cdn.example.com/output.mp4"}}],
		"usage":{"completion_tokens":108000}
	}`))
	if err != nil {
		t.Fatalf("succeeded: %v", err)
	}
	if info.Status != model.TaskStatusSuccess || info.Url != "https://cdn.example.com/output.mp4" {
		t.Fatalf("success status/url = %q/%q", info.Status, info.Url)
	}
	if info.CompletionTokens != 108000 || info.TotalTokens != 108000 {
		t.Fatalf("usage = %d/%d, want completion and total from completion_tokens fallback", info.CompletionTokens, info.TotalTokens)
	}

	info, err = a.ParseTaskResult([]byte(`{"id":"task_upstream_123","status":"failed","error":{"message":"chatgpttech failed"}}`))
	if err != nil {
		t.Fatalf("failed: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("failed status = %q", info.Status)
	}
	if info.Reason != "task failed at upstream provider" {
		t.Fatalf("failed reason = %q", info.Reason)
	}
}

func TestParseTaskResult_MapsTerminalFailureStatuses(t *testing.T) {
	a := &TaskAdaptor{}

	for _, status := range []string{"cancelled", "canceled", "expired", "timeout", "timed_out", "rejected"} {
		t.Run(status, func(t *testing.T) {
			info, err := a.ParseTaskResult([]byte(`{"id":"task_upstream_123","status":"` + status + `"}`))
			if err != nil {
				t.Fatalf("%s: %v", status, err)
			}
			if info.Status != model.TaskStatusFailure || info.Progress != "100%" {
				t.Fatalf("%s status/progress = %q/%q", status, info.Status, info.Progress)
			}
		})
	}
}

func TestParseTaskResult_FailsUnknownNonEmptyStatus(t *testing.T) {
	a := &TaskAdaptor{}

	info, err := a.ParseTaskResult([]byte(`{"id":"task_upstream_123","status":"stalled"}`))
	if err != nil {
		t.Fatalf("stalled: %v", err)
	}
	if info.Status != model.TaskStatusFailure || info.Progress != "100%" {
		t.Fatalf("unknown status/progress = %q/%q", info.Status, info.Progress)
	}
	if info.Reason != "unrecognized upstream task status: stalled" {
		t.Fatalf("unknown reason = %q", info.Reason)
	}
}

func TestParseTaskResult_AcceptsTechMobiContentObject(t *testing.T) {
	a := &TaskAdaptor{}

	info, err := a.ParseTaskResult([]byte(`{
		"id":"task_upstream_123",
		"model":"doubao-seedance-2-0-260128",
		"status":"running",
		"content":{"video_url":""},
		"usage":{"completion_tokens":0,"total_tokens":0}
	}`))
	if err != nil {
		t.Fatalf("running content object: %v", err)
	}
	if info.Status != model.TaskStatusInProgress || info.Progress != "30%" {
		t.Fatalf("running status/progress = %q/%q", info.Status, info.Progress)
	}

	info, err = a.ParseTaskResult([]byte(`{
		"id":"task_upstream_123",
		"status":"succeeded",
		"content":{"video_url":"https://cdn.example.com/output.mp4"},
		"usage":{"completion_tokens":108000,"total_tokens":120000}
	}`))
	if err != nil {
		t.Fatalf("succeeded content object: %v", err)
	}
	if info.Status != model.TaskStatusSuccess || info.Url != "https://cdn.example.com/output.mp4" {
		t.Fatalf("success status/url = %q/%q", info.Status, info.Url)
	}
	if info.CompletionTokens != 108000 || info.TotalTokens != 120000 {
		t.Fatalf("usage = %d/%d", info.CompletionTokens, info.TotalTokens)
	}
}

func TestExtractUpstreamVideoURL(t *testing.T) {
	raw := []byte(`{"status":"succeeded","content":[{"type":"video_url","video_url":{"url":"https://cdn.example.com/output.mp4"}}]}`)

	if got := ExtractUpstreamVideoURL(raw); got != "https://cdn.example.com/output.mp4" {
		t.Fatalf("ExtractUpstreamVideoURL = %q", got)
	}
}

func TestConvertToOpenAIVideo_SuccessUsesProxyURLAndFailureScrubsBrand(t *testing.T) {
	a := &TaskAdaptor{}
	success := &model.Task{
		TaskID:   "task_public",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://newapi.example/v1/videos/task_public/content",
		},
	}
	raw, err := a.ConvertToOpenAIVideo(success)
	if err != nil {
		t.Fatalf("success ConvertToOpenAIVideo error: %v", err)
	}
	var ov dto.OpenAIVideo
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal success OpenAI video: %v", err)
	}
	if ov.Metadata["url"] != "https://newapi.example/v1/videos/task_public/content" {
		t.Fatalf("metadata url = %v", ov.Metadata["url"])
	}

	failed := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusFailure,
		FailReason: "chatgpttech.mobi returned failed",
	}
	raw, err = a.ConvertToOpenAIVideo(failed)
	if err != nil {
		t.Fatalf("failure ConvertToOpenAIVideo error: %v", err)
	}
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal failure OpenAI video: %v", err)
	}
	if ov.Error == nil || ov.Error.Message != "task failed at upstream provider" {
		t.Fatalf("error = %+v", ov.Error)
	}
}
