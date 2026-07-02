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
