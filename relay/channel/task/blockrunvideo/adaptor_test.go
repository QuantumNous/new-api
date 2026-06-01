package blockrunvideo

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestConvertToRequestPayload_Text2Video(t *testing.T) {
	a := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Model:   "bytedance/seedance-2.0",
		Prompt:  "宇航员在月球漫步",
		Seconds: "5",
		Metadata: map[string]interface{}{
			"resolution": "1080p",
			"ratio":      "16:9",
		},
	}
	r, err := a.convertToRequestPayload(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Model != "bytedance/seedance-2.0" || r.Prompt != "宇航员在月球漫步" {
		t.Fatalf("model/prompt mismatch: %+v", r)
	}
	if r.Seconds != "5" {
		t.Fatalf("seconds = %q, want 5", r.Seconds)
	}
	if r.Resolution != "1080p" || r.Ratio != "16:9" {
		t.Fatalf("resolution/ratio from metadata mismatch: %+v", r)
	}
	if r.ImageURL != "" {
		t.Fatalf("ImageURL should be empty for text2video, got %q", r.ImageURL)
	}
}

func TestConvertToRequestPayload_DurationFallback(t *testing.T) {
	a := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Model:    "bytedance/seedance-2.0",
		Prompt:   "x",
		Seconds:  "",
		Duration: 8,
	}
	r, err := a.convertToRequestPayload(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.Seconds != "8" {
		t.Fatalf("seconds fallback = %q, want 8", r.Seconds)
	}
}

func TestConvertToRequestPayload_Image2Video(t *testing.T) {
	a := &TaskAdaptor{}
	req := &relaycommon.TaskSubmitReq{
		Model:  "bytedance/seedance-2.0",
		Prompt: "x",
		Images: []string{"https://example.com/a.jpg", "https://example.com/b.jpg"},
	}
	r, err := a.convertToRequestPayload(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if r.ImageURL != "https://example.com/a.jpg" {
		t.Fatalf("ImageURL = %q, want first image", r.ImageURL)
	}
}

func TestConvertToOpenAIVideo_SuccessUsesProxyURL(t *testing.T) {
	a := &TaskAdaptor{}
	// 成功:metadata.url 必须是代理地址(ResultURL),绝不能泄露上游 blockrun.ai。
	proxyURL := "https://my-host.example/v1/videos/task_abc/content"
	task := &model.Task{
		TaskID:      "task_abc",
		Status:      model.TaskStatusSuccess,
		Progress:    "100%",
		Properties:  model.Properties{OriginModelName: "bytedance/seedance-2.0"},
		PrivateData: model.TaskPrivateData{ResultURL: proxyURL},
	}
	raw, err := a.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var ov dto.OpenAIVideo
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if got, _ := ov.Metadata["url"].(string); got != proxyURL {
		t.Fatalf("metadata.url = %q, want proxy URL %q", got, proxyURL)
	}
	if ov.ID != "task_abc" {
		t.Fatalf("id = %q, want task_abc", ov.ID)
	}
}

func TestConvertToOpenAIVideo_FailureScrubsError(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:     "task_def",
		Status:     model.TaskStatusFailure,
		Progress:   "100%",
		FailReason: "generation timed out",
		Properties: model.Properties{OriginModelName: "bytedance/seedance-2.0"},
	}
	raw, err := a.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var ov dto.OpenAIVideo
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ov.Error == nil {
		t.Fatalf("expected Error to be set on failure")
	}
	// 非品牌词:ScrubBrandedText 原样返回。
	if ov.Error.Message != "generation timed out" {
		t.Fatalf("error message = %q, want %q", ov.Error.Message, "generation timed out")
	}
}

func TestExtractUpstreamVideoURL(t *testing.T) {
	cases := []struct {
		name string
		data string
		want string
	}{
		{
			name: "top_level_url",
			data: `{"status":"completed","url":"https://blockrun.ai/a.mp4","data":[{"url":"https://blockrun.ai/a.mp4"}]}`,
			want: "https://blockrun.ai/a.mp4",
		},
		{
			name: "data_url_only",
			data: `{"status":"completed","data":[{"url":"https://blockrun.ai/b.mp4"}]}`,
			want: "https://blockrun.ai/b.mp4",
		},
		{"empty", "", ""},
		{"garbage", "not-json", ""},
		{"no_url", `{"status":"completed"}`, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := ExtractUpstreamVideoURL([]byte(tc.data)); got != tc.want {
				t.Fatalf("ExtractUpstreamVideoURL = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestParseTaskResult(t *testing.T) {
	a := &TaskAdaptor{}

	cases := []struct {
		name       string
		body       string
		wantStatus string
		wantURL    string
		wantReason string
	}{
		{
			name:       "queued",
			body:       `{"object":"video","id":"video_x","status":"queued","progress":0}`,
			wantStatus: model.TaskStatusQueued,
		},
		{
			name:       "in_progress",
			body:       `{"object":"video","id":"video_x","status":"in_progress","progress":10}`,
			wantStatus: model.TaskStatusInProgress,
		},
		{
			name:       "completed_top_url",
			body:       `{"object":"video","id":"video_x","status":"completed","progress":100,"url":"https://blockrun.ai/v.mp4","data":[{"url":"https://blockrun.ai/v.mp4"}]}`,
			wantStatus: model.TaskStatusSuccess,
			wantURL:    "https://blockrun.ai/v.mp4",
		},
		{
			name:       "completed_data_url_only",
			body:       `{"object":"video","id":"video_x","status":"completed","progress":100,"data":[{"url":"https://blockrun.ai/only.mp4"}]}`,
			wantStatus: model.TaskStatusSuccess,
			wantURL:    "https://blockrun.ai/only.mp4",
		},
		{
			// 关键:error 是字符串,必须能解析(Sora 用对象会解析失败)
			name:       "failed_string_error",
			body:       `{"object":"video","id":"video_x","status":"failed","error":"Video generation did not complete within 300s. No payment was taken."}`,
			wantStatus: model.TaskStatusFailure,
			wantReason: "Video generation did not complete within 300s. No payment was taken.",
		},
		{
			// 查不到任务:无 status、有 error → 视为失败(触发退款)
			name:       "not_found",
			body:       `{"error":"task not found","id":"video_x"}`,
			wantStatus: model.TaskStatusFailure,
			wantReason: "task not found",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			info, err := a.ParseTaskResult([]byte(tc.body))
			if err != nil {
				t.Fatalf("ParseTaskResult error: %v", err)
			}
			if info.Status != tc.wantStatus {
				t.Fatalf("status = %q, want %q", info.Status, tc.wantStatus)
			}
			if tc.wantURL != "" && info.Url != tc.wantURL {
				t.Fatalf("url = %q, want %q", info.Url, tc.wantURL)
			}
			if tc.wantReason != "" && info.Reason != tc.wantReason {
				t.Fatalf("reason = %q, want %q", info.Reason, tc.wantReason)
			}
		})
	}
}
