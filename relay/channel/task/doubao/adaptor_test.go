package doubao

import (
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

func TestBuildRequestURL(t *testing.T) {
	tests := []struct {
		name    string
		adaptor *TaskAdaptor
		baseURL string
		want    string
	}{
		{
			name:    "zero value uses official path",
			adaptor: &TaskAdaptor{},
			baseURL: "https://ark.cn-beijing.volces.com/",
			want:    "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
		},
		{
			name:    "zlhub uses task create path",
			adaptor: NewZLHubTaskAdaptor(),
			baseURL: "https://api.zlhub.cn/",
			want:    "https://api.zlhub.cn/v1/task/create",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.adaptor.baseURL = tt.baseURL
			got, err := tt.adaptor.BuildRequestURL(nil)
			if err != nil {
				t.Fatalf("BuildRequestURL() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("BuildRequestURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestZLHubFetchTask(t *testing.T) {
	service.InitHttpClient()

	var gotPath string
	var gotAuthorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuthorization = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"id":"task-123","status":"queued"}`)
	}))
	defer server.Close()

	resp, err := NewZLHubTaskAdaptor().FetchTask(server.URL+"/", "test-key", map[string]any{
		"task_id": "task-123",
	}, "")
	if err != nil {
		t.Fatalf("FetchTask() error = %v", err)
	}
	defer resp.Body.Close()

	if gotPath != "/v1/task/get/task-123" {
		t.Fatalf("FetchTask() path = %q, want %q", gotPath, "/v1/task/get/task-123")
	}
	if gotAuthorization != "Bearer test-key" {
		t.Fatalf("FetchTask() authorization = %q, want %q", gotAuthorization, "Bearer test-key")
	}
}

func TestZLHubAdaptorMetadata(t *testing.T) {
	adaptor := NewZLHubTaskAdaptor()

	if got := adaptor.GetChannelName(); got != ZLHubChannelName {
		t.Fatalf("GetChannelName() = %q, want %q", got, ZLHubChannelName)
	}
	if !slices.Contains(adaptor.GetModelList(), "doubao-seedance-2.0-fast") {
		t.Fatalf("GetModelList() = %v, want doubao-seedance-2.0-fast", adaptor.GetModelList())
	}
	if slices.Contains(adaptor.GetModelList(), "doubao-seedance-2-0-fast-260128") {
		t.Fatalf("GetModelList() = %v, should not include official suffixed model", adaptor.GetModelList())
	}
}

func TestParseResponsePayloadWithEnvelope(t *testing.T) {
	payload, err := parseResponsePayload([]byte(`{
		"code": "success",
		"data": {
			"id": "cgt-test"
		}
	}`))
	if err != nil {
		t.Fatalf("parseResponsePayload() error = %v", err)
	}
	if payload.ID != "cgt-test" {
		t.Fatalf("parseResponsePayload() id = %q, want %q", payload.ID, "cgt-test")
	}
}

func TestParseTaskResultWithEnvelope(t *testing.T) {
	respBody := []byte(`{
		"code": "success",
		"data": {
			"id": "cgt-test",
			"status": "succeeded",
			"content": {
				"video_url": "https://example.com/video.mp4"
			},
			"usage": {
				"completion_tokens": 123,
				"total_tokens": 456
			}
		}
	}`)

	taskResult, err := NewZLHubTaskAdaptor().ParseTaskResult(respBody)
	if err != nil {
		t.Fatalf("ParseTaskResult() error = %v", err)
	}
	if taskResult.Status != model.TaskStatusSuccess {
		t.Fatalf("ParseTaskResult() status = %q, want %q", taskResult.Status, model.TaskStatusSuccess)
	}
	if taskResult.Url != "https://example.com/video.mp4" {
		t.Fatalf("ParseTaskResult() url = %q, want %q", taskResult.Url, "https://example.com/video.mp4")
	}
	if taskResult.TotalTokens != 456 {
		t.Fatalf("ParseTaskResult() total_tokens = %d, want %d", taskResult.TotalTokens, 456)
	}
}

func TestConvertToOpenAIVideoWithEnvelope(t *testing.T) {
	originTask := &model.Task{
		TaskID:    "task-local",
		Status:    model.TaskStatusSuccess,
		Progress:  "100%",
		CreatedAt: 100,
		UpdatedAt: 200,
		Properties: model.Properties{
			OriginModelName: "doubao-seedance-2.0-fast",
		},
		Data: []byte(`{
			"code": "success",
			"data": {
				"id": "cgt-test",
				"status": "succeeded",
				"content": {
					"video_url": "https://example.com/video.mp4"
				}
			}
		}`),
	}

	data, err := NewZLHubTaskAdaptor().ConvertToOpenAIVideo(originTask)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo() error = %v", err)
	}

	var video dto.OpenAIVideo
	if err := common.Unmarshal(data, &video); err != nil {
		t.Fatalf("unmarshal OpenAIVideo error = %v", err)
	}
	if video.Metadata["url"] != "https://example.com/video.mp4" {
		t.Fatalf("ConvertToOpenAIVideo() url = %q, want %q", video.Metadata["url"], "https://example.com/video.mp4")
	}
}
