package dreambrand

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
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func TestBuildRequestURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelBaseUrl: "https://ai.dreambrand.studio/",
	}})

	got, err := adaptor.BuildRequestURL(nil)
	if err != nil {
		t.Fatalf("BuildRequestURL() error = %v", err)
	}
	if got != "https://ai.dreambrand.studio/ai/v1/videos/generations" {
		t.Fatalf("BuildRequestURL() = %q", got)
	}
}

func TestBuildRequestBodyMapsStandardFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name          string
		body          string
		upstreamModel string
		wantModel     string
		wantPic       string
		wantDuration  string
	}{
		{
			name:          "single image and string duration",
			body:          `{"prompt":"ride","model":"public-model","size":"1080p","duration":"15","image":"https://example.com/a.png"}`,
			upstreamModel: "doubao-seedance-2.0",
			wantModel:     "seedance-2.0-standard",
			wantPic:       "https://example.com/a.png",
			wantDuration:  "15",
		},
		{
			name:          "images and numeric duration",
			body:          `{"prompt":"ride","model":"public-model","duration":10,"images":["https://example.com/first.png","https://example.com/second.png"]}`,
			upstreamModel: "doubao-seedance-2.0-fast",
			wantModel:     "seedance-2.0-fast",
			wantPic:       "https://example.com/first.png",
			wantDuration:  "10",
		},
		{
			name:          "explicit zero duration",
			body:          `{"prompt":"ride","model":"public-model","duration":0}`,
			upstreamModel: "seedance-2.0-standard",
			wantModel:     "seedance-2.0-standard",
			wantDuration:  "0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(tt.body))
			c.Request.Header.Set("Content-Type", "application/json")
			info := &relaycommon.RelayInfo{
				OriginModelName: "public-model",
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: "https://ai.dreambrand.studio",
				},
				TaskRelayInfo: &relaycommon.TaskRelayInfo{},
			}
			adaptor := &TaskAdaptor{}
			adaptor.Init(info)
			if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
				t.Fatalf("ValidateRequestAndSetAction() error = %v", taskErr)
			}
			info.UpstreamModelName = tt.upstreamModel

			reader, err := adaptor.BuildRequestBody(c, info)
			if err != nil {
				t.Fatalf("BuildRequestBody() error = %v", err)
			}
			data, err := io.ReadAll(reader)
			if err != nil {
				t.Fatalf("ReadAll() error = %v", err)
			}
			var payload requestPayload
			if err := common.Unmarshal(data, &payload); err != nil {
				t.Fatalf("unmarshal request payload error = %v", err)
			}
			if payload.Model != tt.wantModel {
				t.Fatalf("Model = %q, want %q", payload.Model, tt.wantModel)
			}
			if info.UpstreamModelName != tt.wantModel {
				t.Fatalf("UpstreamModelName = %q, want %q", info.UpstreamModelName, tt.wantModel)
			}
			if got := pointerValue(payload.Pic); got != tt.wantPic {
				t.Fatalf("Pic = %q, want %q", got, tt.wantPic)
			}
			if got := pointerValue(payload.Duration); got != tt.wantDuration {
				t.Fatalf("Duration = %q, want %q", got, tt.wantDuration)
			}
		})
	}
}

func TestResolveModelName(t *testing.T) {
	tests := map[string]string{
		"doubao-seedance-2.0":      "seedance-2.0-standard",
		"doubao-seedance-2.0-fast": "seedance-2.0-fast",
		"seedance-2.0-standard":    "seedance-2.0-standard",
		"seedance-2.0-fast":        "seedance-2.0-fast",
		"doubao-seedance-2.0-mini": "doubao-seedance-2.0-mini",
	}
	for input, want := range tests {
		if got := ResolveModelName(input); got != want {
			t.Fatalf("ResolveModelName(%q) = %q, want %q", input, got, want)
		}
	}
}

func pointerValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func TestParseCreateResponse(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{name: "top level id", body: `{"id":"TASK_top"}`, want: "TASK_top"},
		{name: "top level task id", body: `{"task_id":"TASK_task_id"}`, want: "TASK_task_id"},
		{name: "data envelope", body: `{"data":{"id":"TASK_data"}}`, want: "TASK_data"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response, err := parseCreateResponse([]byte(tt.body))
			if err != nil {
				t.Fatalf("parseCreateResponse() error = %v", err)
			}
			got := response.ID
			if got == "" {
				got = response.TaskID
			}
			if got != tt.want {
				t.Fatalf("task ID = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestDoResponseUsesPublicTaskID(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		OriginModelName: "seedance-2.0-standard",
		TaskRelayInfo:   &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"id":"TASK_upstream"}`))}

	taskID, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse() error = %v", taskErr)
	}
	if taskID != "TASK_upstream" {
		t.Fatalf("upstream task ID = %q", taskID)
	}
	var video dto.OpenAIVideo
	if err := common.Unmarshal(recorder.Body.Bytes(), &video); err != nil {
		t.Fatalf("unmarshal response error = %v", err)
	}
	if video.ID != "task_public" || video.TaskID != "task_public" {
		t.Fatalf("public IDs = %q/%q", video.ID, video.TaskID)
	}
}

func TestFetchTask(t *testing.T) {
	service.InitHttpClient()
	var gotPath string
	var gotAuthorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuthorization = r.Header.Get("Authorization")
		_, _ = io.WriteString(w, `{"id":"TASK_1","status":"success"}`)
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL+"/", "test-key", map[string]any{"task_id": "TASK_1"}, "")
	if err != nil {
		t.Fatalf("FetchTask() error = %v", err)
	}
	defer resp.Body.Close()
	if gotPath != "/ai/v1/images/generations/TASK_1" {
		t.Fatalf("path = %q", gotPath)
	}
	if gotAuthorization != "Bearer test-key" {
		t.Fatalf("authorization = %q", gotAuthorization)
	}
}

func TestParseTaskResultStatuses(t *testing.T) {
	tests := []struct {
		status string
		want   model.TaskStatus
	}{
		{status: "created", want: model.TaskStatusSubmitted},
		{status: "pending", want: model.TaskStatusQueued},
		{status: "queued", want: model.TaskStatusQueued},
		{status: "processing", want: model.TaskStatusInProgress},
		{status: "running", want: model.TaskStatusInProgress},
		{status: "success", want: model.TaskStatusSuccess},
		{status: "completed", want: model.TaskStatusSuccess},
		{status: "failed", want: model.TaskStatusFailure},
		{status: "cancelled", want: model.TaskStatusFailure},
	}
	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			body := `{"id":"TASK_1","status":"` + tt.status + `","url":"https://example.com/video.mp4"}`
			result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(body))
			if err != nil {
				t.Fatalf("ParseTaskResult() error = %v", err)
			}
			if result.Status != string(tt.want) {
				t.Fatalf("status = %q, want %q", result.Status, tt.want)
			}
			if result.Url != "https://example.com/video.mp4" {
				t.Fatalf("url = %q", result.Url)
			}
		})
	}
}

func TestParseTaskResultFailureReason(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{
		"id":"TASK_1",
		"status":"failure",
		"error":{"message":"generation rejected"}
	}`))
	if err != nil {
		t.Fatalf("ParseTaskResult() error = %v", err)
	}
	if result.Reason != "generation rejected" {
		t.Fatalf("reason = %q", result.Reason)
	}
}

func TestParseTaskResultErrorWithoutStatus(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"error":"upstream unavailable"}`))
	if err != nil {
		t.Fatalf("ParseTaskResult() error = %v", err)
	}
	if result.Status != string(model.TaskStatusFailure) {
		t.Fatalf("status = %q", result.Status)
	}
	if result.Reason != "upstream unavailable" {
		t.Fatalf("reason = %q", result.Reason)
	}
}

func TestConvertToOpenAIVideo(t *testing.T) {
	originTask := &model.Task{
		TaskID:    "task_public",
		Status:    model.TaskStatusSuccess,
		Progress:  "100%",
		CreatedAt: 100,
		UpdatedAt: 200,
		Properties: model.Properties{
			OriginModelName: "seedance-2.0-standard",
		},
		Data: []byte(`{"id":"TASK_1","status":"success","url":"https://example.com/video.mp4","created":1784883387}`),
	}

	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(originTask)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo() error = %v", err)
	}
	var video dto.OpenAIVideo
	if err := common.Unmarshal(data, &video); err != nil {
		t.Fatalf("unmarshal OpenAIVideo error = %v", err)
	}
	if video.ID != "task_public" || video.Status != dto.VideoStatusCompleted {
		t.Fatalf("video id/status = %q/%q", video.ID, video.Status)
	}
	if video.Metadata["url"] != "https://example.com/video.mp4" {
		t.Fatalf("url = %v", video.Metadata["url"])
	}
	if video.CreatedAt != 1784883387 {
		t.Fatalf("created_at = %d", video.CreatedAt)
	}
}
