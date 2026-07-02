package jimengzhizinan

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

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
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://zhizinan.example",
			ApiKey:         "session-id",
		},
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
		OriginModelName: "jimeng-video-3.0-fast",
	}
}

func TestBuildRequestURL_UsesSynchronousVideoGenerationsEndpoint(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(newRelayInfo())

	got, err := a.BuildRequestURL(newRelayInfo())
	if err != nil {
		t.Fatalf("BuildRequestURL error: %v", err)
	}
	if got != "https://zhizinan.example/v1/videos/generations" {
		t.Fatalf("url = %q", got)
	}
}

func TestValidateRequestAndSetAction_RequiresSeedanceContent(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"jimeng-video-seedance-2.0-mini",
		"prompt":"legacy prompt"
	}`)

	if taskErr := a.ValidateRequestAndSetAction(c, newRelayInfo()); taskErr == nil {
		t.Fatal("expected legacy prompt/file_paths request to be rejected")
	}
}

func TestValidateRequestAndSetAction_RejectsUnsupportedSeedanceMedia(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"jimeng-video-seedance-2.0-mini",
		"content":[
			{"type":"video_url","video_url":{"url":"https://cdn.example.com/input.mp4"}}
		]
	}`)

	if taskErr := a.ValidateRequestAndSetAction(c, newRelayInfo()); taskErr == nil {
		t.Fatal("expected video_url content to be rejected")
	}
}

func TestBuildRequestBody_MapsSeedanceContentWithoutHTMLEscapingURL(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(`{
		"model":"jimeng-video-seedance-2.0-mini",
		"content":[
			{"type":"text","text":"a cat walking"},
			{"type":"image_url","image_url":{"url":"https://cdn.example.com/cat.png?a=1&b=2"},"role":"first_frame"}
		],
		"resolution":"720p",
		"ratio":"16:9",
		"duration":5
	}`)
	info := newRelayInfo()
	info.IsModelMapped = true
	info.UpstreamModelName = "jimeng-video-seedance-2.0-fast"

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
	if strings.Contains(string(data), `\u0026`) {
		t.Fatalf("image URL query delimiter was HTML escaped: %s", string(data))
	}

	var payload generationPayload
	if err := common.Unmarshal(data, &payload); err != nil {
		t.Fatalf("unmarshal generation payload: %v", err)
	}
	if payload.Model != "jimeng-video-seedance-2.0-fast" {
		t.Fatalf("model = %q, want mapped jimeng-video-seedance-2.0-fast", payload.Model)
	}
	if payload.Prompt != "a cat walking" {
		t.Fatalf("prompt = %q", payload.Prompt)
	}
	if len(payload.FilePaths) != 1 || payload.FilePaths[0] != "https://cdn.example.com/cat.png?a=1&b=2" {
		t.Fatalf("file_paths = %+v", payload.FilePaths)
	}
	if payload.Duration != 5 || payload.Resolution != "720p" || payload.Ratio != "16:9" {
		t.Fatalf("duration/resolution/ratio = %d/%q/%q", payload.Duration, payload.Resolution, payload.Ratio)
	}
}

func TestDoResponse_SynchronousURLBecomesSyntheticCompletedPoll(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(`{}`)
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(`{"created":1,"data":[{"url":"https://cdn.example.com/video.mp4"}]}`)),
	}
	info := newRelayInfo()

	taskID, taskData, taskErr := a.DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse task error: %+v", taskErr)
	}
	if taskID != "https://cdn.example.com/video.mp4" {
		t.Fatalf("taskID = %q, want generated URL as synthetic upstream task id", taskID)
	}
	if len(taskData) == 0 {
		t.Fatal("taskData should be persisted")
	}

	poll, err := a.ParseTaskResult(taskData)
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if poll.Status != model.TaskStatusSuccess {
		t.Fatalf("status = %q, want SUCCESS", poll.Status)
	}
	if poll.Url != "https://cdn.example.com/video.mp4" {
		t.Fatalf("url = %q", poll.Url)
	}
}

func TestExtractUpstreamVideoURL(t *testing.T) {
	raw := []byte(`{"status":"SUCCESS","data":[{"url":"https://cdn.example.com/video.mp4"}]}`)

	if got := ExtractUpstreamVideoURL(raw); got != "https://cdn.example.com/video.mp4" {
		t.Fatalf("ExtractUpstreamVideoURL = %q", got)
	}
}

func TestConvertToOpenAIVideo_SuccessUsesResultURL(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:   "task_public",
		Status:   model.TaskStatusSuccess,
		Progress: "100%",
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://cdn.example.com/video.mp4",
		},
	}

	raw, err := a.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo error: %v", err)
	}
	var ov dto.OpenAIVideo
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal OpenAI video: %v", err)
	}
	if ov.Metadata["url"] != "https://cdn.example.com/video.mp4" {
		t.Fatalf("metadata url = %v", ov.Metadata["url"])
	}
}
