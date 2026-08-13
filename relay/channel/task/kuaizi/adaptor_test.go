package kuaizi

import (
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/config"

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

// ============================
// Per-second billing
// ============================

func newKuaiziRelayInfo(modelName string, modelPrice float64) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://kuaizi.example",
			ApiKey:            "test-key",
			UpstreamModelName: modelName,
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	return info
}

// newKuaiziBillingRequest walks the real inbound path (BindSeedanceRequest via
// ValidateRequestAndSetAction) so EstimateBilling sees the same cached seedance
// request production does.
func newKuaiziBillingRequest(t *testing.T, body, modelName string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newJSONCtx(body)
	info := newKuaiziRelayInfo(modelName, modelPrice)
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// installKuaiziVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installKuaiziVideoPriceRules(t *testing.T, rulesJSON string) {
	t.Helper()
	saved := map[string]string{}
	if err := config.GlobalConfig.SaveToDB(func(key, value string) error {
		saved[key] = value
		return nil
	}); err != nil {
		t.Fatalf("snapshot config: %v", err)
	}
	t.Cleanup(func() {
		if err := config.GlobalConfig.LoadFromDB(saved); err != nil {
			t.Fatalf("restore config: %v", err)
		}
	})
	if err := config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting_video.video_price_rules": rulesJSON,
	}); err != nil {
		t.Fatalf("install video price rules: %v", err)
	}
	if len(billing_setting.GetVideoPriceRules()) == 0 {
		t.Fatal("video price rules did not load; the config module name or key is wrong")
	}
}

// Every resolution validateResolution accepts must classify, or a configured
// request would be rejected at submit time.
func TestKuaiziResolveDimensions(t *testing.T) {
	tests := []struct {
		resolution string
		want       string
	}{
		{"480p", "480p"},
		{"720p", "720p"},
		{"1080p", "1080p"},
	}
	for _, tc := range tests {
		t.Run(tc.resolution, func(t *testing.T) {
			got, ok := resolveDimensions(tc.resolution, false)
			if !ok {
				t.Fatal("expected dimensions to resolve")
			}
			if got["resolution"] != tc.want {
				t.Fatalf("resolution = %q, want %q", got["resolution"], tc.want)
			}
			if got["has_video"] != "false" {
				t.Fatalf("has_video = %q, want false", got["has_video"])
			}
		})
	}
}

// A reference video changes what the upstream charges, so it is reported as its
// own dimension rather than folded into the resolution.
func TestKuaiziResolveDimensions_HasVideo(t *testing.T) {
	got, ok := resolveDimensions("720p", true)
	if !ok {
		t.Fatal("expected dimensions to resolve")
	}
	if got["has_video"] != "true" {
		t.Fatalf("has_video = %q, want true", got["has_video"])
	}
}

// An omitted resolution must not resolve. The upstream's default when the field
// is absent is undocumented, so naming a tier here would price the request off
// a guess; refusing keeps it on the per-call path instead.
func TestKuaiziResolveDimensions_RejectsUnknown(t *testing.T) {
	for _, r := range []string{"", "banana", "999x999", "2k"} {
		if _, ok := resolveDimensions(r, false); ok {
			t.Fatalf("unknown resolution %q must not resolve", r)
		}
	}
}

func TestKuaiziSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "720p", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.3 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestKuaiziSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestKuaiziSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "1080p", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.3, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The whole point of the conversion: a configured model must be priced from the
// table via SecondBillingRatios. Kuaizi has no legacy per-second estimate, so
// EstimateBilling returns nil either way and all pricing flows through the hook.
func TestKuaiziEstimateBillingConfiguredModelPricesPerSecond(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"kuaizi-lizhen-pro","match":{"resolution":"1080p"},"price_per_second":0.5,"basis":"output_duration"}
	]`)

	a, c, info := newKuaiziBillingRequest(t,
		`{"model":"kuaizi-lizhen-pro","content":[{"type":"text","text":"猫"}],"resolution":"1080p","duration":8}`,
		"kuaizi-lizhen-pro", 0.5)

	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("kuaizi has no legacy ratios; got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	want := 0.5 * 8 / 0.5
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

// Each accepted resolution prices from its own tier, and a reference video from
// its own rule.
func TestKuaiziEstimateBillingCoversEveryAcceptedResolution(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"480p"},"price_per_second":0.1,"basis":"output_duration"},
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"},
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"1080p"},"price_per_second":0.4,"basis":"output_duration"},
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"720p","has_video":"true"},"price_per_second":0.6,"basis":"output_duration"}
	]`)

	for _, tc := range []struct {
		name        string
		body        string
		wantPrice   float64
		wantSeconds float64
	}{
		{"480p", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"480p","duration":5}`, 0.1, 5},
		{"720p", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p","duration":5}`, 0.2, 5},
		{"1080p", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"1080p","duration":12}`, 0.4, 12},
		{
			"reference video prices from its own rule",
			`{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"},{"type":"video_url","video_url":{"url":"https://a/v.mp4"},"role":"reference_video"}],"resolution":"720p","duration":5}`,
			0.6, 5,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newKuaiziBillingRequest(t, tc.body, "kuaizi-lizhen-fast", 0.5)
			a.EstimateBilling(c, info)
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("SecondBillingRatios error: %v", err)
			}
			want := tc.wantPrice * tc.wantSeconds / 0.5
			if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
				t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
			}
		})
	}
}

// A model absent from the table keeps today's behaviour byte for byte: no
// ratios, no per-second units, pure per-call pricing.
func TestKuaiziEstimateBillingUnconfiguredModelStaysPerCall(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	a, c, info := newKuaiziBillingRequest(t,
		`{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p","duration":5}`,
		"kuaizi-lizhen-fast", 0.5)
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("unconfigured model produced ratios: %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("SecondBillingRatios error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unconfigured model produced per-second units: %v", got)
	}
}

// A configured model whose resolution matches no rule must be rejected before
// the upstream call rather than quietly reserved at another tier's price.
func TestKuaiziEstimateBillingConfiguredModelWithNoMatchingRuleFails(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	a, c, info := newKuaiziBillingRequest(t,
		`{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"1080p","duration":5}`,
		"kuaizi-lizhen-fast", 0.5)
	a.EstimateBilling(c, info)
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// The table and ModelPrice are both keyed on the client-facing name, so capture
// must key on info.OriginModelName. Keying on the request body's model would
// divide one model's per-second rate by another model's price.
func TestKuaiziEstimateBillingKeysTableOnOriginModelNameNotBodyModel(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	// A body model that IS in the table, behind a client-facing name that is not.
	a, c, info := newKuaiziBillingRequest(t,
		`{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p","duration":5}`,
		"unpriced-alias", 0.5)
	a.EstimateBilling(c, info)
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("body model must not drag an unconfigured alias onto the per-second path: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("priced per-second off the body model: %v", got)
	}
}

// unpriceableRequests are the request shapes this channel cannot price. Duration
// -1 explicitly hands the length to the model, and an omitted duration or
// resolution has no documented upstream default for this channel — so both are
// unknowable rather than defaultable. frames is unknowable too: it sets the
// length in frames at a per-model fps the gateway does not know, and this channel
// does not even forward it.
//
// What happens to them depends entirely on whether the model is configured for
// per-second billing, which is why the two tests below share this list.
var unpriceableRequests = []struct {
	name string
	body string
}{
	{"duration omitted", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p"}`},
	{"duration -1 is model-chosen", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p","duration":-1}`},
	{"duration 0", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p","duration":0}`},
	{"frames instead of duration", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p","frames":120}`},
	{"frames alongside duration", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"resolution":"720p","duration":5,"frames":120}`},
	{"resolution omitted", `{"model":"kuaizi-lizhen-fast","content":[{"type":"text","text":"猫"}],"duration":5}`},
}

// A configured model returns nil from EstimateBilling — this channel has no
// legacy ratios at all — so per-second is the whole price. When the request
// cannot be priced, returning no ratios therefore bills the bare ModelPrice with
// no seconds multiplier, charging a 30-second render as a single unit. It has to
// fail instead, so relay_task rejects before submitting upstream and the request
// costs nothing.
func TestKuaiziEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range unpriceableRequests {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newKuaiziBillingRequest(t, tc.body, "kuaizi-lizhen-fast", 0.5)
			if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
				t.Fatalf("kuaizi has no legacy ratios; got %v", ratios)
			}
			if _, err := a.SecondBillingRatios(); err == nil {
				t.Fatal("a configured but unpriceable request must return an error")
			}
		})
	}
}

// The mirror image: an UNCONFIGURED model is untouched by all of this. It has no
// per-second price to fail to compute, so the same shapes must stay silently on
// the per-call path exactly as they do today — failing them would reject requests
// this gateway has always accepted.
func TestKuaiziEstimateBillingUnconfiguredModelStaysPerCallWhenUnpriceable(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	for _, tc := range unpriceableRequests {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newKuaiziBillingRequest(t, tc.body, "kuaizi-lizhen-fast", 0.5)
			if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
				t.Fatalf("kuaizi has no legacy ratios; got %v", ratios)
			}
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("an unconfigured model must never fail pricing: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("priced off an undeterminable request: %v", got)
			}
		})
	}
}

// Without a parseable body there is nothing to price; EstimateBilling must
// return cleanly rather than capture a zero-valued request.
func TestKuaiziEstimateBillingWithMalformedBodyCapturesNothing(t *testing.T) {
	installKuaiziVideoPriceRules(t, `[
		{"model":"kuaizi-lizhen-fast","match":{"resolution":"720p"},"price_per_second":0.2,"basis":"output_duration"}
	]`)

	c := newJSONCtx(`{not json`)
	info := newKuaiziRelayInfo("kuaizi-lizhen-fast", 0.5)
	a := &TaskAdaptor{}
	if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
		t.Fatalf("expected nil ratios, got %v", ratios)
	}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("captured from a malformed body: %v", got)
	}
}
