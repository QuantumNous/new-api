package kuaizi

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

// newJSONCtx builds a gin.Context carrying a JSON request body, mirroring the
// relay flow so UnmarshalBodyReusable can decode it (and re-decode it).
func newJSONCtx(body string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c
}

// newRelayInfo builds a RelayInfo with the pointer-embedded ChannelMeta and
// TaskRelayInfo initialized (a zero-value RelayInfo would nil-panic on
// info.UpstreamModelName / info.Action).
func newRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func ptrBool(b bool) *bool { return &b }
func ptrInt(i int) *int    { return &i }

func TestValidateRequestAndSetAction(t *testing.T) {
	a := &TaskAdaptor{}

	t.Run("valid seedance body synthesizes task_request", func(t *testing.T) {
		c := newJSONCtx(`{
			"model":"kuaizi-lizhen-fast",
			"content":[
				{"type":"text","text":"一只猫"},
				{"type":"image_url","image_url":{"url":"https://a/i.jpg"},"role":"first_frame"}
			]
		}`)
		info := newRelayInfo()
		if terr := a.ValidateRequestAndSetAction(c, info); terr != nil {
			t.Fatalf("unexpected task error: %+v", terr)
		}
		if info.Action == "" {
			t.Error("info.Action should be set")
		}
		req, err := relaycommon.GetTaskRequest(c)
		if err != nil {
			t.Fatalf("task_request not stored: %v", err)
		}
		if req.Prompt != "一只猫" {
			t.Errorf("synthesized prompt = %q", req.Prompt)
		}
		if len(req.Images) != 1 || req.Images[0] != "https://a/i.jpg" {
			t.Errorf("synthesized images = %+v", req.Images)
		}
	})

	t.Run("empty content rejected", func(t *testing.T) {
		c := newJSONCtx(`{"model":"kuaizi-lizhen-fast","content":[]}`)
		info := newRelayInfo()
		if terr := a.ValidateRequestAndSetAction(c, info); terr == nil {
			t.Fatal("expected validation error for empty content")
		}
	})

	t.Run("malformed json rejected", func(t *testing.T) {
		c := newJSONCtx(`{not json`)
		info := newRelayInfo()
		if terr := a.ValidateRequestAndSetAction(c, info); terr == nil {
			t.Fatal("expected error for malformed json")
		}
	})

	t.Run("unsupported resolution rejected early", func(t *testing.T) {
		c := newJSONCtx(`{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"x"}],"resolution":"2K"}`)
		info := newRelayInfo()
		if terr := a.ValidateRequestAndSetAction(c, info); terr == nil {
			t.Fatal("expected error for resolution 2K (upstream supports only 480p/720p/1080p)")
		}
	})

	t.Run("supported resolution accepted", func(t *testing.T) {
		c := newJSONCtx(`{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"x"}],"resolution":"1080p"}`)
		info := newRelayInfo()
		if terr := a.ValidateRequestAndSetAction(c, info); terr != nil {
			t.Fatalf("1080p should be accepted: %+v", terr)
		}
	})
}

func TestValidateResolution(t *testing.T) {
	for _, r := range []string{"", "480p", "720p", "1080p"} {
		if err := validateResolution(r); err != nil {
			t.Errorf("validateResolution(%q) = %v, want nil", r, err)
		}
	}
	for _, r := range []string{"2K", "4k", "1080P", "foo"} {
		if err := validateResolution(r); err == nil {
			t.Errorf("validateResolution(%q) should error", r)
		}
	}
}

func TestDroppedSeedanceFields(t *testing.T) {
	r := &dto.SeedanceVideoRequest{
		CameraFixed:     ptrBool(true),
		Frames:          ptrInt(120),
		ReturnLastFrame: ptrBool(true),
		CallbackURL:     "https://cb",
	}
	got := droppedSeedanceFields(r)
	want := map[string]bool{"camera_fixed": true, "frames": true, "return_last_frame": true, "callback_url": true}
	if len(got) != len(want) {
		t.Fatalf("dropped = %v, want all 4", got)
	}
	for _, f := range got {
		if !want[f] {
			t.Errorf("unexpected dropped field %q", f)
		}
	}
	// none set -> nothing dropped
	if d := droppedSeedanceFields(&dto.SeedanceVideoRequest{}); len(d) != 0 {
		t.Errorf("expected no dropped fields, got %v", d)
	}
}

func TestBuildRequestBody_EndToEnd(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://aiopenapi.kuaizi.cn/ai-open-platform-api/v1/lz/video/task"}
	// image URL carries '&' to assert MarshalNoHTMLEscape keeps it literal.
	c := newJSONCtx(`{
		"model":"kuaizi-lizhen-fast",
		"content":[
			{"type":"text","text":"猫"},
			{"type":"image_url","image_url":{"url":"https://x/i.jpg?a=1&b=2"},"role":"reference_image"}
		],
		"resolution":"720p","ratio":"16:9","duration":5,
		"web_search":true,
		"super_resolution_config":{"resolution":"4k","scene":"aigc"}
	}`)
	// UpstreamModelName wins over body model for mode resolution.
	info := newRelayInfo()
	info.UpstreamModelName = ModelLizhenPro

	r, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, _ := io.ReadAll(r)

	if !strings.Contains(string(raw), "a=1&b=2") {
		t.Errorf("'&' must stay literal in image URL, got: %s", raw)
	}

	var body createRequest
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal upstream body: %v", err)
	}
	if body.Mode != ModePro {
		t.Errorf("mode = %q, want pro (from UpstreamModelName)", body.Mode)
	}
	if body.Prompt != "猫" || body.Resolution != "720p" || body.Ratio != "16:9" {
		t.Errorf("body basics mismatch: %+v", body)
	}
	if body.Duration == nil || *body.Duration != 5 {
		t.Errorf("duration = %v", body.Duration)
	}
	if body.InputType != "reference" {
		t.Errorf("input_type = %q, want reference", body.InputType)
	}
	if body.WebSearch == nil || *body.WebSearch != true {
		t.Errorf("web_search extension not forwarded: %v", body.WebSearch)
	}
	if body.SuperResolutionConfig == nil || body.SuperResolutionConfig.Resolution != "4k" {
		t.Errorf("super_resolution_config extension not forwarded: %+v", body.SuperResolutionConfig)
	}
	if len(body.Images) != 1 || body.Images[0].Role != "reference_image" {
		t.Errorf("images = %+v", body.Images)
	}
}

func TestBuildRequestBody_UnsupportedModel(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://x"}
	c := newJSONCtx(`{"model":"gpt-4o","content":[{"type":"text","text":"x"}]}`)
	info := newRelayInfo() // no UpstreamModelName -> falls back to body model
	if _, err := a.BuildRequestBody(c, info); err == nil {
		t.Fatal("expected unsupported model error")
	}
}

func TestBuildKuaiziCreateRequest_VideosAudiosAndDurationNeg1(t *testing.T) {
	seedReq := &dto.SeedanceVideoRequest{
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "x"},
			{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://a/v.mp4"}, Role: dto.SeedanceRoleReferenceVideo},
			{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://a/a.mp3"}, Role: dto.SeedanceRoleReferenceAudio},
		},
		Duration: ptrInt(-1), // model-chosen duration
	}
	body := buildKuaiziCreateRequest(seedReq, kuaiziExtensions{}, ModeFast)
	if len(body.Videos) != 1 || body.Videos[0].Role != "reference_video" {
		t.Errorf("videos = %+v", body.Videos)
	}
	if len(body.Audios) != 1 || body.Audios[0].Role != "reference_audio" {
		t.Errorf("audios = %+v", body.Audios)
	}
	if body.Duration == nil || *body.Duration != -1 {
		t.Errorf("duration -1 must be preserved, got %v", body.Duration)
	}
	// generate_audio not set -> pointer nil -> omitted on marshal
	raw, _ := common.MarshalNoHTMLEscape(body)
	if strings.Contains(string(raw), "generate_audio") {
		t.Errorf("nil generate_audio should be omitted, got: %s", raw)
	}
}

func TestBuildKuaiziCreateRequest_Text2Video(t *testing.T) {
	seedReq := &dto.SeedanceVideoRequest{
		Model: "kuaizi-lizhen-fast",
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "一只猫在草地奔跑"},
		},
		Resolution: "720p",
		Ratio:      "16:9",
		Duration:   ptrInt(5),
		Seed:       ptrInt(42),
		Watermark:  ptrBool(false),
	}
	body := buildKuaiziCreateRequest(seedReq, kuaiziExtensions{}, ModeFast)

	if body.Prompt != "一只猫在草地奔跑" {
		t.Errorf("prompt = %q", body.Prompt)
	}
	if body.GenerationType != "video" || body.Mode != ModeFast {
		t.Errorf("generation_type/mode = %q/%q", body.GenerationType, body.Mode)
	}
	if body.Resolution != "720p" || body.Ratio != "16:9" {
		t.Errorf("resolution/ratio = %q/%q", body.Resolution, body.Ratio)
	}
	if body.Duration == nil || *body.Duration != 5 {
		t.Errorf("duration = %v", body.Duration)
	}
	if body.Seed == nil || *body.Seed != 42 {
		t.Errorf("seed = %v", body.Seed)
	}
	if body.Watermark == nil || *body.Watermark != false {
		t.Errorf("watermark = %v (explicit false must be preserved)", body.Watermark)
	}
	if len(body.Images) != 0 || body.InputType != "" {
		t.Errorf("text2video should have no images and no input_type, got images=%d input_type=%q", len(body.Images), body.InputType)
	}
}

func TestBuildKuaiziCreateRequest_FirstLastFrame(t *testing.T) {
	seedReq := &dto.SeedanceVideoRequest{
		Model: "kuaizi-lizhen-fast",
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "镜头推进"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://a/first.jpg"}, Role: dto.SeedanceRoleFirstFrame},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://a/last.jpg"}, Role: dto.SeedanceRoleLastFrame},
		},
	}
	body := buildKuaiziCreateRequest(seedReq, kuaiziExtensions{}, ModeFast)

	if body.InputType != "first_last_frame" {
		t.Errorf("input_type = %q, want first_last_frame", body.InputType)
	}
	if len(body.Images) != 2 || body.Images[0].URL != "https://a/first.jpg" || body.Images[0].Role != "first_frame" {
		t.Errorf("images = %+v", body.Images)
	}
}

func TestBuildKuaiziCreateRequest_ReferenceMode(t *testing.T) {
	seedReq := &dto.SeedanceVideoRequest{
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "参考图生成"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://a/ref.jpg"}, Role: dto.SeedanceRoleReferenceImage},
		},
	}
	body := buildKuaiziCreateRequest(seedReq, kuaiziExtensions{}, ModePro)
	if body.InputType != "reference" {
		t.Errorf("input_type = %q, want reference", body.InputType)
	}
}

func TestBuildKuaiziCreateRequest_Extensions(t *testing.T) {
	seedReq := &dto.SeedanceVideoRequest{
		Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "城市夜景"}},
	}
	ext := kuaiziExtensions{
		InputType: "reference",
		WebSearch: ptrBool(true),
		SuperResolutionConfig: &superResolutionConfig{
			Resolution:  "4k",
			Scene:       "aigc",
			ToolVersion: "professional",
		},
	}
	body := buildKuaiziCreateRequest(seedReq, ext, ModePro)
	if body.InputType != "reference" {
		t.Errorf("explicit input_type override = %q", body.InputType)
	}
	if body.WebSearch == nil || *body.WebSearch != true {
		t.Errorf("web_search = %v", body.WebSearch)
	}
	if body.SuperResolutionConfig == nil || body.SuperResolutionConfig.Resolution != "4k" {
		t.Errorf("super_resolution_config = %+v", body.SuperResolutionConfig)
	}
}

func TestConvertToOpenAIVideo_SurfacesUsage(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:      "task_abc",
		Status:      model.TaskStatusSuccess,
		Progress:    "100%",
		Properties:  model.Properties{OriginModelName: "kuaizi-lizhen-pro"},
		PrivateData: model.TaskPrivateData{ResultURL: "https://my-host/v1/videos/task_abc/content"},
		Data:        []byte(`{"code":0,"data":{"task_id":"kz-cgt-1","status":"succeeded","video_url":"https://x/foo.mp4","usage":{"completion_tokens":120,"total_tokens":120}}}`),
	}
	raw, err := a.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var ov dto.OpenAIVideo
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ov.Usage == nil {
		t.Fatalf("usage should be present on success")
	}
	if ov.Usage.CompletionTokens != 120 || ov.Usage.TotalTokens != 120 {
		t.Errorf("usage = %+v, want completion=120 total=120", ov.Usage)
	}
}

func TestConvertToOpenAIVideo_NoUsageWhenAbsent(t *testing.T) {
	a := &TaskAdaptor{}
	task := &model.Task{
		TaskID:     "task_abc",
		Status:     model.TaskStatusFailure,
		Properties: model.Properties{OriginModelName: "kuaizi-lizhen-fast"},
		FailReason: "content blocked",
		Data:       []byte(`{"code":0,"data":{"task_id":"kz-cgt-1","status":"failed","error":"content blocked"}}`),
	}
	raw, err := a.ConvertToOpenAIVideo(task)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	var ov dto.OpenAIVideo
	if err := common.Unmarshal(raw, &ov); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if ov.Usage != nil {
		t.Errorf("usage should be omitted when no tokens, got %+v", ov.Usage)
	}
}

func TestParseTaskResult(t *testing.T) {
	a := &TaskAdaptor{}
	tests := []struct {
		name           string
		body           string
		wantStatus     string
		wantURL        string
		wantCompletion int
		wantTotal      int
		wantReason     string
	}{
		{
			name:       "pending maps to queued",
			body:       `{"code":0,"data":{"task_id":"kz-cgt-1","status":"pending"}}`,
			wantStatus: model.TaskStatusQueued,
		},
		{
			name:       "submitted maps to submitted",
			body:       `{"code":0,"data":{"task_id":"kz-cgt-1","status":"submitted"}}`,
			wantStatus: model.TaskStatusSubmitted,
		},
		{
			name:       "running maps to in_progress",
			body:       `{"code":0,"data":{"task_id":"kz-cgt-1","status":"running"}}`,
			wantStatus: model.TaskStatusInProgress,
		},
		{
			name:           "succeeded carries url and usage",
			body:           `{"code":0,"data":{"task_id":"kz-cgt-1","status":"succeeded","video_url":"https://x/foo.mp4","usage":{"completion_tokens":120,"total_tokens":120}}}`,
			wantStatus:     model.TaskStatusSuccess,
			wantURL:        "https://x/foo.mp4",
			wantCompletion: 120,
			wantTotal:      120,
		},
		{
			name:       "failed carries error reason",
			body:       `{"code":0,"data":{"task_id":"kz-cgt-1","status":"failed","error":"content blocked"}}`,
			wantStatus: model.TaskStatusFailure,
			wantReason: "content blocked",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := a.ParseTaskResult([]byte(tt.body))
			if err != nil {
				t.Fatalf("ParseTaskResult error: %v", err)
			}
			if info.Status != tt.wantStatus {
				t.Errorf("status = %q, want %q", info.Status, tt.wantStatus)
			}
			if info.Url != tt.wantURL {
				t.Errorf("url = %q, want %q", info.Url, tt.wantURL)
			}
			if info.CompletionTokens != tt.wantCompletion {
				t.Errorf("completion_tokens = %d, want %d", info.CompletionTokens, tt.wantCompletion)
			}
			if info.TotalTokens != tt.wantTotal {
				t.Errorf("total_tokens = %d, want %d", info.TotalTokens, tt.wantTotal)
			}
			if info.Reason != tt.wantReason {
				t.Errorf("reason = %q, want %q", info.Reason, tt.wantReason)
			}
		})
	}
}

func TestExtractUpstreamVideoURL(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "envelope with video_url",
			body: `{"code":0,"message":"","data":{"task_id":"kz-cgt-1","status":"succeeded","video_url":"https://x.tos-cn-beijing.volces.com/foo.mp4"}}`,
			want: "https://x.tos-cn-beijing.volces.com/foo.mp4",
		},
		{
			name: "envelope without url field",
			body: `{"code":0,"message":"","data":{"task_id":"kz-cgt-2","status":"running"}}`,
			want: "",
		},
		{
			name: "envelope with nested result.url",
			body: `{"code":0,"data":{"result":{"url":"https://example.com/v.mp4"}}}`,
			want: "https://example.com/v.mp4",
		},
		{
			name: "empty body",
			body: "",
			want: "",
		},
		{
			name: "invalid json",
			body: "not-json",
			want: "",
		},
		{
			name: "envelope with null data",
			body: `{"code":0,"data":null}`,
			want: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ExtractUpstreamVideoURL([]byte(tt.body)); got != tt.want {
				t.Errorf("ExtractUpstreamVideoURL(%q) = %q, want %q", tt.body, got, tt.want)
			}
		})
	}
}

func TestModelToMode(t *testing.T) {
	tests := []struct {
		model    string
		wantMode string
		wantOK   bool
	}{
		{ModelLizhenFast, ModeFast, true},
		{ModelLizhenPro, ModePro, true},
		{"unknown-model", "", false},
		{"", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			gotMode, gotOK := ModelToMode(tt.model)
			if gotMode != tt.wantMode || gotOK != tt.wantOK {
				t.Errorf("ModelToMode(%q) = (%q, %v), want (%q, %v)",
					tt.model, gotMode, gotOK, tt.wantMode, tt.wantOK)
			}
		})
	}
}
