package jimengproxy

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

func newJSONCtx(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

func newRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func disableFetchSSRFProtection(t *testing.T) {
	t.Helper()
	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() { *system_setting.GetFetchSetting() = original })
	system_setting.GetFetchSetting().EnableSSRFProtection = false
}

func TestValidateRequestAndSetAction_SeedanceContentBuildsSubmitPayload(t *testing.T) {
	disableFetchSSRFProtection(t)
	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"seedance-2.0",
		"content":[
			{"type":"text","text":"a cat walking"},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/cat.png"},"role":"first_frame"}
		],
		"resolution":"720p",
		"ratio":"16:9",
		"duration":5
	}`)
	info := newRelayInfo()
	info.IsModelMapped = true
	info.UpstreamModelName = "jimeng-video-2.0"

	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("unexpected validation error: %+v", taskErr)
	}

	body, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	data, err := io.ReadAll(body)
	if err != nil {
		t.Fatalf("read request body: %v", err)
	}

	var payload submitPayload
	if err := common.Unmarshal(data, &payload); err != nil {
		t.Fatalf("unmarshal submit payload: %v", err)
	}
	if payload.Model != "jimeng-video-2.0" {
		t.Fatalf("model = %q, want mapped jimeng-video-2.0", payload.Model)
	}
	if payload.Prompt != "a cat walking" {
		t.Fatalf("prompt = %q", payload.Prompt)
	}
	if len(payload.FilePaths) != 1 || payload.FilePaths[0] != "https://cdn.example.com/cat.png" {
		t.Fatalf("file_paths = %+v", payload.FilePaths)
	}
	if payload.Duration != 5 || payload.Resolution != "720p" || payload.Ratio != "16:9" {
		t.Fatalf("duration/resolution/ratio = %d/%q/%q", payload.Duration, payload.Resolution, payload.Ratio)
	}
}

func TestValidateRequestAndSetAction_RejectsTooManyImages(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"seedance-2.0",
		"content":[
			{"type":"text","text":"a cat walking"},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/1.png"}},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/2.png"}},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/3.png"}}
		]
	}`)

	if taskErr := a.ValidateRequestAndSetAction(c, newRelayInfo()); taskErr == nil {
		t.Fatal("expected image count validation error")
	}
}

func TestValidateRequestAndSetAction_NonSeedanceContentUsesBasicTaskRequest(t *testing.T) {
	disableFetchSSRFProtection(t)
	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"jimeng-video-2.0",
		"prompt":"legacy prompt",
		"images":["https://cdn.example.com/input.png"],
		"content":{"note":"not seedance content array"}
	}`)
	info := newRelayInfo()

	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("unexpected validation error for basic task request: %+v", taskErr)
	}
	req, err := relaycommon.GetTaskRequest(c)
	if err != nil {
		t.Fatalf("GetTaskRequest error: %v", err)
	}
	if req.Prompt != "legacy prompt" {
		t.Fatalf("prompt = %q", req.Prompt)
	}
	if len(req.Images) != 1 || req.Images[0] != "https://cdn.example.com/input.png" {
		t.Fatalf("images = %+v", req.Images)
	}
}

func TestValidateRequestAndSetAction_RejectsPrivateInputImageURL(t *testing.T) {
	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() { *system_setting.GetFetchSetting() = original })
	system_setting.GetFetchSetting().EnableSSRFProtection = true
	system_setting.GetFetchSetting().AllowPrivateIp = false
	system_setting.GetFetchSetting().DomainFilterMode = false
	system_setting.GetFetchSetting().IpFilterMode = false
	system_setting.GetFetchSetting().AllowedPorts = []string{"80", "443"}
	system_setting.GetFetchSetting().ApplyIPFilterForDomain = true

	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"jimeng-video-2.0",
		"prompt":"legacy prompt",
		"images":["http://127.0.0.1/private.png"]
	}`)

	if taskErr := a.ValidateRequestAndSetAction(c, newRelayInfo()); taskErr == nil {
		t.Fatal("expected private input image URL to be rejected")
	}
}

func TestValidateRequestAndSetAction_RejectsNonHTTPImageURLWhenSSRFDisabled(t *testing.T) {
	disableFetchSSRFProtection(t)

	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"jimeng-video-2.0",
		"prompt":"legacy prompt",
		"images":["file:///tmp/private.png"]
	}`)

	if taskErr := a.ValidateRequestAndSetAction(c, newRelayInfo()); taskErr == nil {
		t.Fatal("expected non-http image URL to be rejected even when SSRF protection is disabled")
	}
}

func TestParseTaskResult_CompletedWithoutURLFails(t *testing.T) {
	info, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"status":"completed","data":[]}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("status = %q, want FAILURE", info.Status)
	}
	if info.Reason == "" {
		t.Fatal("failure reason should be set")
	}
}

func TestParseTaskResult_QueryErrorFails(t *testing.T) {
	info, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"error":"unauthorized"}`))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("status = %q, want FAILURE", info.Status)
	}
}

func TestDoResponse_InvalidSubmitDoesNotExposeResponseBody(t *testing.T) {
	c := newJSONCtx(`{}`)
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(`{"status":"failed","prompt":"secret prompt","submit_id":""}`)),
	}

	_, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, newRelayInfo())
	if taskErr == nil {
		t.Fatal("expected task error")
	}
	if strings.Contains(taskErr.Message, "secret prompt") || strings.Contains(taskErr.Error.Error(), "secret prompt") {
		t.Fatalf("submit error leaked upstream response body: message=%q error=%q", taskErr.Message, taskErr.Error.Error())
	}
}

func TestDoResponse_MalformedSubmitDoesNotExposeResponseBody(t *testing.T) {
	c := newJSONCtx(`{}`)
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(`not-json secret prompt`)),
	}

	_, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, newRelayInfo())
	if taskErr == nil {
		t.Fatal("expected task error")
	}
	if strings.Contains(taskErr.Message, "secret prompt") || strings.Contains(taskErr.Error.Error(), "secret prompt") {
		t.Fatalf("unmarshal error leaked upstream response body: message=%q error=%q", taskErr.Message, taskErr.Error.Error())
	}
}
