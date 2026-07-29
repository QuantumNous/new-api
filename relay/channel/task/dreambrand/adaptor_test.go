package dreambrand

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
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func TestBuildRequestURL(t *testing.T) {
	adaptor := &TaskAdaptor{}
	adaptor.Init(&relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{
		ChannelBaseUrl: "https://ai.dreambrand.studio/",
	}})

	tests := []struct {
		name string
		info *relaycommon.RelayInfo
		want string
	}{
		{name: "video default", info: nil, want: "https://ai.dreambrand.studio/ai/v1/videos/generations"},
		{name: "image relay", info: &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}, want: "https://ai.dreambrand.studio/ai/v1/images/generations"},
	}
	for _, tt := range tests {
		got, err := adaptor.BuildRequestURL(tt.info)
		if err != nil {
			t.Fatalf("BuildRequestURL() error = %v", err)
		}
		if got != tt.want {
			t.Fatalf("BuildRequestURL() = %q, want %q", got, tt.want)
		}
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
			name:          "native pic and minimum duration",
			body:          `{"prompt":"ride","model":"public-model","duration":4,"pic":"https://example.com/native.png","audio":false}`,
			upstreamModel: "seedance-2.0-standard",
			wantModel:     "seedance-2.0-standard",
			wantPic:       "https://example.com/native.png",
			wantDuration:  "4",
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

func TestBuildImageRequestBody(t *testing.T) {
	tests := []struct {
		name     string
		body     string
		wantPic  string
		wantPics []string
	}{
		{name: "text to image", body: `{"prompt":"sunset","model":"seedream-5.0-lite","size":"1080p","aspect_ratio":"16:9"}`},
		{name: "image to image", body: `{"prompt":"restyle","model":"seedream-4.5","image":"https://example.com/a.png"}`, wantPic: "https://example.com/a.png"},
		{name: "multiple references", body: `{"prompt":"combine","model":"seedream-4.5","images":["https://example.com/a.png","https://example.com/b.png","https://example.com/c.png"]}`, wantPic: "https://example.com/a.png", wantPics: []string{"https://example.com/b.png", "https://example.com/c.png"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, info := buildPayloadForTest(t, "/v1/images/generations", tt.body, relayconstant.RelayModeImagesGenerations)
			if info.Action != constant.TaskActionImageGenerate {
				t.Fatalf("action = %q", info.Action)
			}
			if pointerValue(payload.Pic) != tt.wantPic || strings.Join(payload.Pics, ",") != strings.Join(tt.wantPics, ",") {
				t.Fatalf("references = %q/%v", pointerValue(payload.Pic), payload.Pics)
			}
			if payload.Duration != nil || payload.Pic2 != nil || payload.VideoType != nil {
				t.Fatalf("video-only fields leaked into image payload: %+v", payload)
			}
		})
	}
}

func TestBuildVideoReferenceModes(t *testing.T) {
	tests := []struct {
		name          string
		body          string
		wantPic       string
		wantPic2      string
		wantPics      []string
		wantVideoType string
	}{
		{name: "text to video", body: `{"prompt":"ride","model":"seedance-2.0-fast","duration":"4","audio":false}`},
		{name: "single reference", body: `{"prompt":"ride","model":"seedance-2.0-fast","duration":4,"image":"a"}`, wantPic: "a"},
		{name: "first and last frame default", body: `{"prompt":"ride","model":"seedance-2.0-standard","duration":8,"images":["a","b"]}`, wantPic: "a", wantPic2: "b", wantVideoType: "0"},
		{name: "two reference images", body: `{"prompt":"ride","model":"seedance-2.0-standard","duration":8,"pic":"a","pic2":"b","videoType":1}`, wantPic: "a", wantPic2: "b", wantVideoType: "1"},
		{name: "more than two forces reference mode", body: `{"prompt":"ride","model":"seedance-2.0-standard","duration":8,"images":["a","b","c","d"],"video_type":"0"}`, wantPic: "a", wantPic2: "b", wantPics: []string{"c", "d"}, wantVideoType: "1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, _ := buildPayloadForTest(t, "/v1/video/generations", tt.body, relayconstant.RelayModeVideoSubmit)
			if pointerValue(payload.Pic) != tt.wantPic || pointerValue(payload.Pic2) != tt.wantPic2 || strings.Join(payload.Pics, ",") != strings.Join(tt.wantPics, ",") || pointerValue(payload.VideoType) != tt.wantVideoType {
				t.Fatalf("payload references = pic:%q pic2:%q pics:%v videoType:%q", pointerValue(payload.Pic), pointerValue(payload.Pic2), payload.Pics, pointerValue(payload.VideoType))
			}
			if strings.Contains(tt.body, `"audio":false`) && (payload.Audio == nil || *payload.Audio) {
				t.Fatalf("explicit audio=false was not preserved")
			}
		})
	}
}

func buildPayloadForTest(t *testing.T, path, body string, relayMode int) (requestPayload, *relaycommon.RelayInfo) {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{RelayMode: relayMode, ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://ai.dreambrand.studio"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	adaptor := &TaskAdaptor{}
	adaptor.Init(info)
	if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction() error = %v", taskErr)
	}
	info.UpstreamModelName = info.OriginModelName
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

func TestResolveModelName(t *testing.T) {
	tests := map[string]string{
		"doubao-seedream-5.0-lite": "seedream-5.0-lite",
		"doubao-seedream-4.5":      "seedream-4.5",
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

func TestDoResponseImageAndUpstreamError(t *testing.T) {
	t.Run("image creation", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations, ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "seedream-5.0-lite"}, TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}}
		resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"id":"TASK_upstream","status":"processing","created":123}`))}
		taskID, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
		if taskErr != nil || taskID != "TASK_upstream" {
			t.Fatalf("taskID/error = %q/%v", taskID, taskErr)
		}
		var result imageTaskAPIResponse
		if err := common.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.ID != "task_public" || result.Status != "processing" || result.URL != nil || result.Created != 123 {
			t.Fatalf("result = %+v", result)
		}
	})

	t.Run("http 200 error payload", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		info := &relaycommon.RelayInfo{TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"}}
		resp := &http.Response{Body: io.NopCloser(strings.NewReader(`{"code":30001,"message":"MODEL_NOT_FOUND"}`))}
		_, _, taskErr := (&TaskAdaptor{}).DoResponse(c, resp, info)
		if taskErr == nil || taskErr.Code != "30001" || taskErr.Message != "MODEL_NOT_FOUND" {
			t.Fatalf("task error = %+v", taskErr)
		}
	})
}

func TestFetchTaskPaths(t *testing.T) {
	service.InitHttpClient()
	var paths []string
	var gotAuthorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paths = append(paths, r.URL.Path)
		gotAuthorization = r.Header.Get("Authorization")
		if strings.Contains(r.URL.Path, "/videos/") && r.URL.Query().Get("fallback") == "1" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_, _ = io.WriteString(w, `{"id":"TASK_1","status":"success"}`)
	}))
	defer server.Close()

	resp, err := (&TaskAdaptor{}).FetchTask(server.URL+"/", "test-key", map[string]any{"task_id": "TASK_1", "action": constant.TaskActionImageGenerate}, "")
	if err != nil {
		t.Fatalf("FetchTask() error = %v", err)
	}
	_ = resp.Body.Close()
	if paths[0] != "/ai/v1/images/generations/TASK_1" {
		t.Fatalf("image path = %q", paths[0])
	}

	resp, err = (&TaskAdaptor{}).FetchTask(server.URL+"/", "test-key", map[string]any{"task_id": "TASK_2", "action": constant.TaskActionGenerate}, "")
	if err != nil {
		t.Fatalf("FetchTask() error = %v", err)
	}
	_ = resp.Body.Close()
	if paths[1] != "/ai/v1/videos/generations/TASK_2" {
		t.Fatalf("video path = %q", paths[1])
	}
	if gotAuthorization != "Bearer test-key" {
		t.Fatalf("authorization = %q", gotAuthorization)
	}
}

func TestFetchTaskVideoLegacyFallback(t *testing.T) {
	service.InitHttpClient()
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
	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "key", map[string]any{"task_id": "TASK_1", "action": constant.TaskActionGenerate}, "")
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if len(paths) != 2 || paths[1] != "/ai/v1/images/generations/TASK_1" {
		t.Fatalf("fallback paths = %v", paths)
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

func TestConvertToOpenAIImageTask(t *testing.T) {
	originTask := &model.Task{
		TaskID:      "task_public",
		Status:      model.TaskStatusSuccess,
		CreatedAt:   100,
		PrivateData: model.TaskPrivateData{ResultURL: "https://example.com/final.png"},
		Data:        []byte(`{"id":"TASK_1","status":"success","url":"https://example.com/final.png","created":123}`),
	}
	data, err := (&TaskAdaptor{}).ConvertToOpenAIImageTask(originTask)
	if err != nil {
		t.Fatal(err)
	}
	var result imageTaskAPIResponse
	if err := common.Unmarshal(data, &result); err != nil {
		t.Fatal(err)
	}
	if result.ID != "task_public" || result.Status != "success" || pointerValue(result.URL) != "https://example.com/final.png" || result.Created != 123 {
		t.Fatalf("result = %+v", result)
	}
}

func TestDreamBrandReferenceLimits(t *testing.T) {
	images := `["1","2","3","4","5","6","7"]`
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"prompt":"x","model":"seedream-4.5","images":`+images+`}`))
	c.Request.Header.Set("Content-Type", "application/json")
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations, TaskRelayInfo: &relaycommon.TaskRelayInfo{}}
	if taskErr := (&TaskAdaptor{}).ValidateRequestAndSetAction(c, info); taskErr == nil || taskErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected image reference limit error, got %+v", taskErr)
	}
}
