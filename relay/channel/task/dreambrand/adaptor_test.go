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
	want := "https://ai.dreambrand.studio/ai/v1/videos/generations"
	if got != want {
		t.Fatalf("BuildRequestURL() = %q, want %q", got, want)
	}
}

func TestBuildRequestBodyMapsNewAPIFields(t *testing.T) {
	tests := []struct {
		name           string
		body           string
		upstreamModel  string
		wantModel      string
		wantDuration   string
		wantPic        string
		wantPic2       string
		wantPics       []string
		wantVideoType  string
		wantResolution string
		wantRatio      string
		wantAudio      *bool
		wantWatermark  *bool
		wantContent    []string
	}{
		{
			name:           "official text to video format",
			body:           `{"prompt":"ride","model":"doubao-seedance-2.0","seconds":"15","metadata":{"resolution":"1080p","ratio":"16:9","watermark":false,"generate_audio":true}}`,
			upstreamModel:  "doubao-seedance-2.0",
			wantModel:      "seedance-2.0-standard",
			wantDuration:   "15",
			wantResolution: "1080p",
			wantRatio:      "16:9",
			wantAudio:      boolPointer(true),
			wantWatermark:  boolPointer(false),
			wantContent:    []string{"text"},
		},
		{
			name:           "official numeric seconds",
			body:           `{"prompt":"ride","model":"doubao-seedance-2.0-fast","seconds":4,"metadata":{"resolution":"720p"}}`,
			upstreamModel:  "doubao-seedance-2.0-fast",
			wantModel:      "seedance-2.0-fast",
			wantDuration:   "4",
			wantResolution: "720p",
			wantContent:    []string{"text"},
		},
		{
			name:           "official video reference format",
			body:           `{"prompt":"change the sea to blue","model":"doubao-seedance-2.0","seconds":"4","metadata":{"content":[{"type":"video_url","video_url":{"url":"https://example.com/input.mp4"},"role":"reference_video"}],"resolution":"720p","ratio":"16:9","watermark":false}}`,
			upstreamModel:  "doubao-seedance-2.0",
			wantModel:      "seedance-2.0-standard",
			wantDuration:   "4",
			wantVideoType:  "1",
			wantResolution: "720p",
			wantRatio:      "16:9",
			wantWatermark:  boolPointer(false),
			wantContent:    []string{"video_url", "text"},
		},
		{
			name:           "official reference images",
			body:           `{"prompt":"ride","model":"seedance-2.0-standard","seconds":"8","metadata":{"content":[{"type":"image_url","image_url":{"url":"a"},"role":"reference_image"},{"type":"image_url","image_url":{"url":"b"},"role":"reference_image"}],"resolution":"720p","ratio":"16:9","generate_audio":false}}`,
			upstreamModel:  "seedance-2.0-standard",
			wantModel:      "seedance-2.0-standard",
			wantDuration:   "8",
			wantPic:        "a",
			wantPic2:       "b",
			wantVideoType:  "1",
			wantResolution: "720p",
			wantRatio:      "16:9",
			wantAudio:      boolPointer(false),
			wantContent:    []string{"image_url", "image_url", "text"},
		},
		{
			name:          "official first and last frames",
			body:          `{"prompt":"ride","model":"seedance-2.0-standard","seconds":"8","metadata":{"content":[{"type":"image_url","image_url":{"url":"a"},"role":"first_frame"},{"type":"image_url","image_url":{"url":"b"},"role":"last_frame"}]}}`,
			upstreamModel: "seedance-2.0-standard",
			wantModel:     "seedance-2.0-standard",
			wantDuration:  "8",
			wantPic:       "a",
			wantPic2:      "b",
			wantVideoType: "0",
			wantContent:   []string{"image_url", "image_url", "text"},
		},
		{
			name:          "legacy image compatibility",
			body:          `{"prompt":"ride","model":"seedance-2.0-standard","seconds":"8","images":["a","b","c"]}`,
			upstreamModel: "seedance-2.0-standard",
			wantModel:     "seedance-2.0-standard",
			wantDuration:  "8",
			wantPic:       "a",
			wantPic2:      "b",
			wantPics:      []string{"c"},
			wantVideoType: "1",
			wantContent:   []string{"text"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, info := buildPayloadForTest(t, tt.body, tt.upstreamModel)
			if payload.Model != tt.wantModel || info.UpstreamModelName != tt.wantModel {
				t.Fatalf("model = %q, upstream model = %q, want %q", payload.Model, info.UpstreamModelName, tt.wantModel)
			}
			if pointerValue(payload.Duration) != tt.wantDuration || pointerValue(payload.Pic) != tt.wantPic || pointerValue(payload.Pic2) != tt.wantPic2 {
				t.Fatalf("payload duration/references = %q/%q/%q", pointerValue(payload.Duration), pointerValue(payload.Pic), pointerValue(payload.Pic2))
			}
			if strings.Join(payload.Pics, ",") != strings.Join(tt.wantPics, ",") || pointerValue(payload.VideoType) != tt.wantVideoType {
				t.Fatalf("payload pics/videoType = %v/%q", payload.Pics, pointerValue(payload.VideoType))
			}
			if pointerValue(payload.Size) != tt.wantResolution || pointerValue(payload.Resolution) != tt.wantResolution {
				t.Fatalf("size/resolution = %q/%q, want %q", pointerValue(payload.Size), pointerValue(payload.Resolution), tt.wantResolution)
			}
			if pointerValue(payload.AspectRatio) != tt.wantRatio || pointerValue(payload.Ratio) != tt.wantRatio {
				t.Fatalf("aspectRatio/ratio = %q/%q, want %q", pointerValue(payload.AspectRatio), pointerValue(payload.Ratio), tt.wantRatio)
			}
			if tt.wantAudio != nil && (payload.Audio == nil || payload.GenerateAudio == nil || *payload.Audio != *tt.wantAudio || *payload.GenerateAudio != *tt.wantAudio) {
				t.Fatalf("audio/generate_audio = %v/%v, want %v", payload.Audio, payload.GenerateAudio, *tt.wantAudio)
			}
			if tt.wantWatermark != nil && (payload.Watermark == nil || *payload.Watermark != *tt.wantWatermark) {
				t.Fatalf("watermark = %v, want %v", payload.Watermark, *tt.wantWatermark)
			}
			if len(payload.Content) != len(tt.wantContent) {
				t.Fatalf("content length = %d, want %d", len(payload.Content), len(tt.wantContent))
			}
			for index, raw := range payload.Content {
				var item contentItem
				if err := common.Unmarshal(raw, &item); err != nil {
					t.Fatal(err)
				}
				if item.Type != tt.wantContent[index] {
					t.Fatalf("content[%d].type = %q, want %q", index, item.Type, tt.wantContent[index])
				}
				if item.Type == "text" && item.Text != "ride" && item.Text != "change the sea to blue" {
					t.Fatalf("content[%d].text = %q, want request prompt", index, item.Text)
				}
				if item.Type == "video_url" && (item.VideoURL == nil || item.VideoURL.URL != "https://example.com/input.mp4") {
					t.Fatalf("content[%d].video_url = %+v, want original URL", index, item.VideoURL)
				}
			}
		})
	}
}

func buildPayloadForTest(t *testing.T, body, upstreamModel string) (requestPayload, *relaycommon.RelayInfo) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ai.dreambrand.studio"},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)
	if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction() error = %v", taskErr)
	}
	info.UpstreamModelName = upstreamModel
	request, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody() error = %v", err)
	}
	data, err := io.ReadAll(request)
	if err != nil {
		t.Fatal(err)
	}
	var payload requestPayload
	if err := common.Unmarshal(data, &payload); err != nil {
		t.Fatal(err)
	}
	return payload, info
}

func TestValidateRequest(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "too many references", body: `{"prompt":"x","model":"seedance-2.0-standard","images":["1","2","3","4","5","6","7","8","9","10"]}`},
		{name: "fast 1080p", body: `{"prompt":"x","model":"seedance-2.0-fast","seconds":"4","metadata":{"resolution":"1080p"}}`},
		{name: "duration too short", body: `{"prompt":"x","model":"seedance-2.0-standard","seconds":"3"}`},
		{name: "too many reference videos", body: `{"prompt":"x","model":"seedance-2.0-standard","seconds":"4","metadata":{"content":[{"type":"video_url","video_url":{"url":"1"}},{"type":"video_url","video_url":{"url":"2"}},{"type":"video_url","video_url":{"url":"3"}},{"type":"video_url","video_url":{"url":"4"}}]}}`},
		{name: "audio without visual reference", body: `{"prompt":"x","model":"seedance-2.0-standard","seconds":"4","metadata":{"content":[{"type":"audio_url","audio_url":{"url":"1"}}]}}`},
		{name: "missing media URL", body: `{"prompt":"x","model":"seedance-2.0-standard","seconds":"4","metadata":{"content":[{"type":"video_url","video_url":{}}]}}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", strings.NewReader(tt.body))
			c.Request.Header.Set("Content-Type", "application/json")
			info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
			if taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info); taskErr == nil || taskErr.StatusCode != http.StatusBadRequest {
				t.Fatalf("expected validation error, got %+v", taskErr)
			}
		})
	}
}

func TestResolveModelName(t *testing.T) {
	tests := map[string]string{
		"doubao-seedream-5.0-lite": "seedream-5.0-lite",
		"doubao-seedream-4.5":      "seedream-4.5",
		"doubao-seedance-2.0":      "seedance-2.0-standard",
		"doubao-seedance-2.0-fast": "seedance-2.0-fast",
		"seedance-2.0-standard":    "seedance-2.0-standard",
	}
	for input, want := range tests {
		if got := ResolveModelName(input); got != want {
			t.Fatalf("ResolveModelName(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestParseCreateResponse(t *testing.T) {
	for name, body := range map[string]string{
		"TASK_top":     `{"id":"TASK_top"}`,
		"TASK_task_id": `{"task_id":"TASK_task_id"}`,
		"TASK_data":    `{"data":{"id":"TASK_data"}}`,
	} {
		response, err := parseCreateResponse([]byte(body))
		if err != nil {
			t.Fatalf("parseCreateResponse() error = %v", err)
		}
		got := response.ID
		if got == "" {
			got = response.TaskID
		}
		if got != name {
			t.Fatalf("task ID = %q, want %q", got, name)
		}
	}
}

func TestDoResponse(t *testing.T) {
	t.Run("uses public task ID", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		info := &relaycommon.RelayInfo{OriginModelName: "doubao-seedance-2.0", TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}}
		resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"id":"TASK_upstream"}`))}
		taskID, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
		if taskErr != nil || taskID != "TASK_upstream" {
			t.Fatalf("task ID/error = %q/%v", taskID, taskErr)
		}
		var video dto.OpenAIVideo
		if err := common.Unmarshal(recorder.Body.Bytes(), &video); err != nil {
			t.Fatal(err)
		}
		if video.ID != "task_public" || video.TaskID != "task_public" {
			t.Fatalf("public IDs = %q/%q", video.ID, video.TaskID)
		}
	})

	t.Run("parses HTTP 200 upstream error", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
		resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"code":30001,"message":"MODEL_NOT_FOUND"}`))}
		_, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
		if taskErr == nil || taskErr.Code != "30001" || taskErr.Message != "MODEL_NOT_FOUND" {
			t.Fatalf("task error = %+v", taskErr)
		}
	})
}

func TestFetchTaskPaths(t *testing.T) {
	service.InitHttpClient()
	t.Run("video query", func(t *testing.T) {
		var path, authorization string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path = r.URL.Path
			authorization = r.Header.Get("Authorization")
			_, _ = io.WriteString(w, `{"id":"TASK_1","status":"success"}`)
		}))
		defer server.Close()
		resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "test-key", map[string]any{"task_id": "TASK_1"}, "")
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		if path != "/ai/v1/videos/generations/TASK_1" || authorization != "Bearer test-key" {
			t.Fatalf("path/authorization = %q/%q", path, authorization)
		}
	})

	t.Run("legacy fallback", func(t *testing.T) {
		var paths []string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			paths = append(paths, r.URL.Path)
			if strings.Contains(r.URL.Path, "/videos/") {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			_, _ = io.WriteString(w, `{"id":"TASK_1","status":"processing"}`)
		}))
		defer server.Close()
		resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "key", map[string]any{"task_id": "TASK_1"}, "")
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		if len(paths) != 2 || paths[1] != "/ai/v1/images/generations/TASK_1" {
			t.Fatalf("fallback paths = %v", paths)
		}
	})
}

func TestParseTaskResultStatuses(t *testing.T) {
	tests := map[string]model.TaskStatus{
		"created":    model.TaskStatusSubmitted,
		"pending":    model.TaskStatusQueued,
		"queued":     model.TaskStatusQueued,
		"processing": model.TaskStatusInProgress,
		"running":    model.TaskStatusInProgress,
		"success":    model.TaskStatusSuccess,
		"completed":  model.TaskStatusSuccess,
		"failed":     model.TaskStatusFailure,
		"cancelled":  model.TaskStatusFailure,
	}
	for status, want := range tests {
		result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"id":"TASK_1","status":"` + status + `","url":"https://example.com/video.mp4"}`))
		if err != nil {
			t.Fatal(err)
		}
		if result.Status != string(want) || result.Url != "https://example.com/video.mp4" {
			t.Fatalf("status/url = %q/%q", result.Status, result.Url)
		}
	}
}

func TestParseTaskResultFailureReason(t *testing.T) {
	result, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"id":"TASK_1","status":"failure","error":{"message":"generation rejected"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if result.Reason != "generation rejected" {
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
			OriginModelName: "doubao-seedance-2.0",
		},
		Data: []byte(`{"id":"TASK_1","status":"success","url":"https://example.com/video.mp4","created":1784883387}`),
	}
	data, err := (&TaskAdaptor{}).ConvertToOpenAIVideo(originTask)
	if err != nil {
		t.Fatal(err)
	}
	var video dto.OpenAIVideo
	if err := common.Unmarshal(data, &video); err != nil {
		t.Fatal(err)
	}
	if video.ID != "task_public" || video.Status != dto.VideoStatusCompleted || video.Metadata["url"] != "https://example.com/video.mp4" || video.CreatedAt != 1784883387 {
		t.Fatalf("video = %+v", video)
	}
}

func TestGetModelListContainsVideosOnly(t *testing.T) {
	models := (&TaskAdaptor{}).GetModelList()
	if len(models) != len(VideoModelList) {
		t.Fatalf("models = %v", models)
	}
	for _, modelName := range models {
		if strings.Contains(modelName, "seedream") {
			t.Fatalf("image model leaked into task adaptor: %q", modelName)
		}
	}
}

func pointerValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func boolPointer(value bool) *bool {
	return &value
}
