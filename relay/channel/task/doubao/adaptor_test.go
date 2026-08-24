package doubao

import (
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
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
// info.UpstreamModelName / info.OriginModelName).
func newRelayInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta:   &relaycommon.ChannelMeta{},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
}

func ptrInt(i int) *int    { return &i }
func ptrBool(b bool) *bool { return &b }

// teaAdBody is the official seedance content[] body used across tests: text +
// two reference images + a reference video + a reference audio, plus scalars
// and the Doubao-only `tools` extension.
const teaAdBody = `{
	"model":"doubao-seedance-2-0-260128",
	"content":[
		{"type":"text","text":"第一人称果茶宣传广告"},
		{"type":"image_url","image_url":{"url":"https://x/pic1.jpg"},"role":"reference_image"},
		{"type":"image_url","image_url":{"url":"https://x/pic2.jpg"},"role":"reference_image"},
		{"type":"video_url","video_url":{"url":"https://x/v1.mp4"},"role":"reference_video"},
		{"type":"audio_url","audio_url":{"url":"https://x/a1.mp3"},"role":"reference_audio"}
	],
	"ratio":"16:9","duration":5,"watermark":false,"generate_audio":true,
	"tools":[{"type":"web_search"}]
}`

// sampleSeedanceReq mirrors teaAdBody as a struct for the pure-function tests.
func sampleSeedanceReq() dto.SeedanceVideoRequest {
	return dto.SeedanceVideoRequest{
		Model: "doubao-seedance-2-0-260128",
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "第一人称果茶宣传广告"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/pic1.jpg"}, Role: dto.SeedanceRoleReferenceImage},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://x/pic2.jpg"}, Role: dto.SeedanceRoleReferenceImage},
			{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://x/v1.mp4"}, Role: dto.SeedanceRoleReferenceVideo},
			{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://x/a1.mp3"}, Role: dto.SeedanceRoleReferenceAudio},
		},
		Ratio:         "16:9",
		Duration:      ptrInt(5),
		Watermark:     ptrBool(false),
		GenerateAudio: ptrBool(true),
	}
}

func mustVideoRatio(t *testing.T, model, resolution string, hasVideo bool) float64 {
	t.Helper()
	ratio, ok := GetVideoInputRatio(model, resolution, hasVideo)
	if !ok {
		t.Fatalf("missing price table for %s", model)
	}
	return ratio
}

func TestGetVideoInputRatioFallsBackToSameInputTypeBasePrice(t *testing.T) {
	const model = "doubao-seedance-2-0-fast-260128"
	withoutVideo := mustVideoRatio(t, model, "1080p", false)
	withVideo := mustVideoRatio(t, model, "4k", true)

	if withoutVideo != 1 {
		t.Fatalf("1080p ratio without video = %v, want 1", withoutVideo)
	}
	if want := 22.0 / 37.0; withVideo != want {
		t.Fatalf("4k ratio with video = %v, want %v", withVideo, want)
	}
}

// ---- pure mapping function ----------------------------------------------

// buildDoubaoCreateRequest must pass the official content[] through to the Ark
// body verbatim and convert scalar pointers without dropping explicit zeros.
func TestBuildDoubaoCreateRequest_ContentPassthrough(t *testing.T) {
	req := sampleSeedanceReq()
	body := buildDoubaoCreateRequest(&req, doubaoExtensions{})

	if body.Model != "doubao-seedance-2-0-260128" {
		t.Fatalf("model = %q", body.Model)
	}
	if len(body.Content) != 5 {
		t.Fatalf("content len = %d, want 5 (verbatim passthrough)", len(body.Content))
	}
	// Reference video / audio must survive (the legacy metadata path could not
	// carry these).
	if body.Content[3].VideoURL == nil || body.Content[3].VideoURL.URL != "https://x/v1.mp4" {
		t.Errorf("reference_video not passed through: %+v", body.Content[3])
	}
	if body.Content[4].AudioURL == nil || body.Content[4].AudioURL.URL != "https://x/a1.mp3" {
		t.Errorf("reference_audio not passed through: %+v", body.Content[4])
	}
	if body.Ratio != "16:9" {
		t.Errorf("ratio = %q", body.Ratio)
	}
	if body.Duration == nil || int(*body.Duration) != 5 {
		t.Errorf("duration = %v, want 5", body.Duration)
	}
	// Explicit false must be preserved (pointer non-nil), not dropped.
	if body.Watermark == nil || bool(*body.Watermark) {
		t.Errorf("watermark = %v, want explicit false", body.Watermark)
	}
	if body.GenerateAudio == nil || !bool(*body.GenerateAudio) {
		t.Errorf("generate_audio = %v, want true", body.GenerateAudio)
	}
}

// The marshaled Ark body must contain the seedance content[] shape and must NOT
// emit absent optional scalars (no zero-value leakage).
func TestBuildDoubaoCreateRequest_Marshal(t *testing.T) {
	req := sampleSeedanceReq()
	body := buildDoubaoCreateRequest(&req, doubaoExtensions{})
	data, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	s := string(data)
	for _, want := range []string{
		`"content":`, `"video_url"`, `"audio_url"`, `"reference_video"`,
		`"reference_audio"`, `"ratio":"16:9"`, `"duration":5`,
		`"watermark":false`, `"generate_audio":true`,
	} {
		if !strings.Contains(s, want) {
			t.Errorf("marshaled body missing %s\nbody=%s", want, s)
		}
	}
	// Frames / Seed / CallbackURL were unset -> must be omitted.
	for _, notWant := range []string{`"frames"`, `"seed"`, `"callback_url"`, `"camera_fixed"`} {
		if strings.Contains(s, notWant) {
			t.Errorf("marshaled body should omit %s\nbody=%s", notWant, s)
		}
	}
}

// Doubao-only extensions (tools) ride alongside the official fields.
func TestBuildDoubaoCreateRequest_Extensions(t *testing.T) {
	req := sampleSeedanceReq()
	ext := doubaoExtensions{Tools: []toolItem{{Type: "web_search"}}}
	body := buildDoubaoCreateRequest(&req, ext)
	if len(body.Tools) != 1 || body.Tools[0].Type != "web_search" {
		t.Fatalf("tools extension not mapped: %+v", body.Tools)
	}
}

func TestBuildDoubaoCreateRequest_PriorityPreservesExplicitZero(t *testing.T) {
	req := sampleSeedanceReq()
	req.SafetyIdentifier = "end-user-123"
	req.Priority = ptrInt(0)
	body := buildDoubaoCreateRequest(&req, doubaoExtensions{})

	if body.SafetyIdentifier != "" {
		t.Fatalf("safety_identifier must be gated by channel settings, got %q", body.SafetyIdentifier)
	}
	if body.Priority == nil || int(*body.Priority) != 0 {
		t.Fatalf("priority = %v, want explicit zero", body.Priority)
	}
	data, err := common.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if strings.Contains(string(data), `"safety_identifier"`) {
		t.Fatalf("marshaled body unexpectedly contains safety_identifier: %s", data)
	}
	if !strings.Contains(string(data), `"priority":0`) {
		t.Fatalf("marshaled body missing explicit priority zero: %s", data)
	}
}

// ---- BuildRequestBody end-to-end (gin context) --------------------------

// Drives BuildRequestBody through the real reusable-body decode path and
// asserts the official content[] + Doubao `tools` extension reach the Ark body.
// Unmapped channel: upstream model name is taken from the body.
func TestBuildRequestBody_EndToEnd(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://ark.example"}
	c := newJSONCtx(teaAdBody)
	info := newRelayInfo() // not mapped

	r, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, _ := io.ReadAll(r)

	var body requestPayload
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal upstream body: %v\nraw=%s", err, raw)
	}
	if body.Model != "doubao-seedance-2-0-260128" {
		t.Errorf("model = %q, want body model (unmapped)", body.Model)
	}
	if info.UpstreamModelName != "doubao-seedance-2-0-260128" {
		t.Errorf("UpstreamModelName = %q, want set from body model", info.UpstreamModelName)
	}
	if len(body.Content) != 5 {
		t.Fatalf("content len = %d, want 5 (verbatim through decode)", len(body.Content))
	}
	if body.Content[3].VideoURL == nil || body.Content[3].VideoURL.URL != "https://x/v1.mp4" {
		t.Errorf("reference_video lost through decode: %+v", body.Content[3])
	}
	if body.Content[4].AudioURL == nil || body.Content[4].AudioURL.URL != "https://x/a1.mp3" {
		t.Errorf("reference_audio lost through decode: %+v", body.Content[4])
	}
	if len(body.Tools) != 1 || body.Tools[0].Type != "web_search" {
		t.Errorf("tools extension not decoded alongside seedance fields: %+v", body.Tools)
	}
	if body.Watermark == nil || bool(*body.Watermark) {
		t.Errorf("watermark = %v, want explicit false survives decode", body.Watermark)
	}
}

func TestBuildRequestBody_RewritesExactAssetUrlsAndPreservesText(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://ark.example"}
	c := newJSONCtx(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"plain asset://ast_1234567890abcdefABCDEF1234567890 mention"},
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"},
			{"type":"video_url","video_url":{"url":"https://cdn.example.com/input.mp4?foo=1&bar=2"},"role":"reference_video"},
			{"type":"audio_url","audio_url":{"url":"asset://ast_abcdef1234567890ABCDEF1234567890"},"role":"reference_audio"}
		]
	}`)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "asset://asset-opaque-123",
		"asset://ast_abcdef1234567890ABCDEF1234567890": "asset://audio-upstream-opaque",
	})

	r, err := a.BuildRequestBody(c, newRelayInfo())
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	s := string(raw)
	if strings.Contains(s, `\u0026`) {
		t.Fatalf("HTML-escaped ampersand leaked into body: %s", s)
	}

	var body requestPayload
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal upstream body: %v\nraw=%s", err, raw)
	}
	if body.Content[0].Text != "plain asset://ast_1234567890abcdefABCDEF1234567890 mention" {
		t.Fatalf("text item changed: %+v", body.Content[0])
	}
	if body.Content[1].ImageURL == nil || body.Content[1].ImageURL.URL != "asset://asset-opaque-123" {
		t.Fatalf("image URL not rewritten: %+v", body.Content[1].ImageURL)
	}
	if body.Content[2].VideoURL == nil || body.Content[2].VideoURL.URL != "https://cdn.example.com/input.mp4?foo=1&bar=2" {
		t.Fatalf("video URL changed: %+v", body.Content[2].VideoURL)
	}
	if body.Content[3].AudioURL == nil || body.Content[3].AudioURL.URL != "asset://audio-upstream-opaque" {
		t.Fatalf("audio URL not rewritten: %+v", body.Content[3].AudioURL)
	}
}

func TestBuildRequestBody_RejectsMissingRewriteMapForExactAssetRef(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://ark.example"}
	c := newJSONCtx(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[
			{"type":"video_url","video_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_video"}
		]
	}`)

	_, err := a.BuildRequestBody(c, newRelayInfo())
	if err == nil || err.Error() != "invalid asset reference" {
		t.Fatalf("BuildRequestBody error = %v, want invalid asset reference", err)
	}
	if strings.Contains(err.Error(), "ast_1234567890abcdefABCDEF1234567890") {
		t.Fatalf("error leaked asset id: %v", err)
	}
}

func TestBuildRequestBody_RejectsMissingRewriteMapForExactAudioAssetRef(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://ark.example"}
	c := newJSONCtx(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[
			{"type":"audio_url","audio_url":{"url":"asset://ast_abcdef1234567890ABCDEF1234567890"},"role":"reference_audio"}
		]
	}`)

	_, err := a.BuildRequestBody(c, newRelayInfo())
	if err == nil || err.Error() != "invalid asset reference" {
		t.Fatalf("BuildRequestBody error = %v, want invalid asset reference", err)
	}
	if strings.Contains(err.Error(), "ast_abcdef1234567890ABCDEF1234567890") {
		t.Fatalf("error leaked asset id: %v", err)
	}
}

func TestBuildRequestBody_RejectsEmptyUpstreamRewrite(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://ark.example"}
	c := newJSONCtx(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[
			{"type":"image_url","image_url":{"url":"asset://ast_1234567890abcdefABCDEF1234567890"},"role":"reference_image"}
		]
	}`)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{
		"asset://ast_1234567890abcdefABCDEF1234567890": "",
	})

	_, err := a.BuildRequestBody(c, newRelayInfo())
	if err == nil || err.Error() != "invalid asset reference" {
		t.Fatalf("BuildRequestBody error = %v, want invalid asset reference", err)
	}
}

// Mapped channel: UpstreamModelName (already resolved by ModelMappedHelper)
// overrides the client-facing body model on the upstream request.
func TestBuildRequestBody_ModelMapped(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://ark.example"}
	c := newJSONCtx(`{"model":"bytedance/seedance-2.0","content":[{"type":"text","text":"猫"}]}`)
	info := newRelayInfo()
	info.IsModelMapped = true
	info.UpstreamModelName = "doubao-seedance-2-0-260128"

	r, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, _ := io.ReadAll(r)
	var body requestPayload
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.Model != "doubao-seedance-2-0-260128" {
		t.Errorf("model = %q, want mapped upstream name", body.Model)
	}
}

func TestBuildRequestBody_SafetyIdentifierRequiresChannelOptIn(t *testing.T) {
	const body = `{
		"model":"doubao-seedance-2-0-260128",
		"content":[{"type":"text","text":"猫"}],
		"safety_identifier":"end-user-123"
	}`
	tests := []struct {
		name  string
		allow bool
		want  bool
	}{
		{name: "default filters", want: false},
		{name: "explicit opt-in forwards", allow: true, want: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &TaskAdaptor{baseURL: "https://ark.example"}
			c := newJSONCtx(body)
			info := newRelayInfo()
			info.ChannelOtherSettings.AllowSafetyIdentifier = tt.allow
			r, err := a.BuildRequestBody(c, info)
			if err != nil {
				t.Fatalf("BuildRequestBody error: %v", err)
			}
			raw, _ := io.ReadAll(r)
			got := strings.Contains(string(raw), `"safety_identifier":"end-user-123"`)
			if got != tt.want {
				t.Fatalf("safety_identifier forwarded = %v, want %v; body=%s", got, tt.want, raw)
			}
		})
	}
}

func TestBuildRequestBody_PriorityValidatedAfterModelMapping(t *testing.T) {
	tests := []struct {
		name          string
		clientModel   string
		mappedModel   string
		wantErr       bool
		wantPriority0 bool
	}{
		{
			name:          "unmapped Seedance 2.0 accepts explicit zero",
			clientModel:   "doubao-seedance-2-0-260128",
			wantPriority0: true,
		},
		{
			name:          "alias mapped to Seedance 2.0 accepts explicit zero",
			clientModel:   "bytedance/seedance-2.0",
			mappedModel:   "doubao-seedance-2-0-fast-260128",
			wantPriority0: true,
		},
		{
			name:        "Seedance 2.0 client mapped to older upstream is rejected",
			clientModel: "doubao-seedance-2-0-260128",
			mappedModel: "doubao-seedance-1-5-pro-251215",
			wantErr:     true,
		},
		{
			name:        "unmapped older upstream is rejected",
			clientModel: "doubao-seedance-1-5-pro-251215",
			wantErr:     true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			a := &TaskAdaptor{baseURL: "https://ark.example"}
			c := newJSONCtx(`{"model":"` + tt.clientModel + `","content":[{"type":"text","text":"猫"}],"priority":0}`)
			info := newRelayInfo()
			if tt.mappedModel != "" {
				info.IsModelMapped = true
				info.UpstreamModelName = tt.mappedModel
			}
			r, err := a.BuildRequestBody(c, info)
			if tt.wantErr {
				if err == nil || !strings.Contains(err.Error(), "priority is only supported") {
					t.Fatalf("error = %v, want priority model validation error", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("BuildRequestBody error: %v", err)
			}
			raw, _ := io.ReadAll(r)
			if tt.wantPriority0 && !strings.Contains(string(raw), `"priority":0`) {
				t.Fatalf("explicit priority zero lost: %s", raw)
			}
		})
	}
}

// A text+audio request (no image/video) decodes and forwards the audio item;
// unset optionals decoded from real JSON stay omitted on re-marshal (Rule 5).
func TestBuildRequestBody_AudioPassthroughAndOptionalsOmitted(t *testing.T) {
	a := &TaskAdaptor{baseURL: "https://ark.example"}
	c := newJSONCtx(`{
		"model":"doubao-seedance-2-0-260128",
		"content":[
			{"type":"text","text":"用这段音乐"},
			{"type":"audio_url","audio_url":{"url":"https://x/a.mp3"},"role":"reference_audio"}
		]
	}`)
	info := newRelayInfo()
	r, err := a.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, _ := io.ReadAll(r)
	s := string(raw)
	if !strings.Contains(s, `"audio_url"`) {
		t.Errorf("audio not forwarded: %s", s)
	}
	var body requestPayload
	if err := common.Unmarshal(raw, &body); err != nil {
		t.Fatalf("unmarshal upstream body: %v\nraw=%s", err, raw)
	}
	if body.Content[1].AudioURL == nil || body.Content[1].AudioURL.URL != "https://x/a.mp3" {
		t.Fatalf("audio URL changed: %+v", body.Content[1].AudioURL)
	}
	for _, notWant := range []string{`"duration"`, `"frames"`, `"seed"`, `"watermark"`, `"generate_audio"`} {
		if strings.Contains(s, notWant) {
			t.Errorf("absent optional %s should be omitted: %s", notWant, s)
		}
	}
}

// ---- EstimateBilling (gin context) --------------------------------------

// A video_url input on a discountable model yields the video-input ratio.
func TestEstimateBilling_VideoInput(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(teaAdBody)
	info := newRelayInfo()
	info.OriginModelName = "doubao-seedance-2-0-260128"
	info.UpstreamModelName = "doubao-seedance-2-0-260128"

	ratios := a.EstimateBilling(c, info)
	want := mustVideoRatio(t, "doubao-seedance-2-0-260128", "", true)
	if ratios["video_input"] != want {
		t.Fatalf("video_input ratio = %v, want %v", ratios["video_input"], want)
	}
}

// EstimateBilling reuses the request bound by ValidateRequestAndSetAction (the
// cache-hit path), resolving the discount through the full Validate→Estimate
// flow without a second body decode.
func TestEstimateBilling_ReusesBoundRequest(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(teaAdBody)
	info := newRelayInfo()
	info.OriginModelName = "doubao-seedance-2-0-260128"
	info.UpstreamModelName = "doubao-seedance-2-0-260128"

	if terr := a.ValidateRequestAndSetAction(c, info); terr != nil {
		t.Fatalf("validate: %+v", terr)
	}
	ratios := a.EstimateBilling(c, info)
	want := mustVideoRatio(t, "doubao-seedance-2-0-260128", "", true)
	if ratios["video_input"] != want {
		t.Fatalf("video_input = %v, want %v (via bound request)", ratios["video_input"], want)
	}
}

// Regression for the model-mapping discount miss: with mapping, OriginModelName
// is the client alias (absent from the ratio map) but UpstreamModelName is the
// real model — the discount must still resolve off UpstreamModelName.
func TestEstimateBilling_MappedModelResolvesDiscount(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(teaAdBody)
	info := newRelayInfo()
	info.OriginModelName = "bytedance/seedance-2.0" // client alias, not in ratio map
	info.UpstreamModelName = "doubao-seedance-2-0-260128"

	ratios := a.EstimateBilling(c, info)
	if _, ok := ratios["video_input"]; !ok {
		t.Fatal("mapped channel lost the video-input discount (overcharge): want ratio keyed on UpstreamModelName")
	}
}

// A baseline-resolution request without video uses the configured base price,
// so no extra ratio is returned.
func TestEstimateBilling_BaselineWithoutVideo(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}]}`)
	info := newRelayInfo()
	info.UpstreamModelName = "doubao-seedance-2-0-260128"
	if r := a.EstimateBilling(c, info); len(r) != 0 {
		t.Fatalf("EstimateBilling = %v, want nil for no-video request", r)
	}
}

func TestEstimateBilling_ResolutionAndVideoPricingEndToEnd(t *testing.T) {
	tests := []struct {
		name       string
		resolution string
		hasVideo   bool
		want       float64
		wantRatio  bool
	}{
		{name: "720p no video", resolution: "720p", want: 1},
		{name: "720p video", resolution: "720p", hasVideo: true, want: 28.0 / 46.0, wantRatio: true},
		{name: "1080p no video", resolution: "1080P", want: 51.0 / 46.0, wantRatio: true},
		{name: "1080p video", resolution: " 1080p ", hasVideo: true, want: 31.0 / 46.0, wantRatio: true},
		{name: "4k no video", resolution: "4K", want: 26.0 / 46.0, wantRatio: true},
		{name: "4k video", resolution: " 4k ", hasVideo: true, want: 16.0 / 46.0, wantRatio: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := `[{"type":"text","text":"hi"}]`
			if tt.hasVideo {
				content = `[{"type":"text","text":"hi"},{"type":"video_url","video_url":{"url":"https://x/v.mp4"},"role":"reference_video"}]`
			}
			c := newJSONCtx(`{"model":"doubao-seedance-2-0-260128","resolution":"` + tt.resolution + `","content":` + content + `}`)
			info := newRelayInfo()
			info.UpstreamModelName = "doubao-seedance-2-0-260128"
			got := (&TaskAdaptor{}).EstimateBilling(c, info)
			if !tt.wantRatio {
				if len(got) != 0 {
					t.Fatalf("EstimateBilling = %v, want no ratio for baseline", got)
				}
				return
			}
			if got["video_input"] != tt.want {
				t.Fatalf("video_input ratio = %v, want %v", got["video_input"], tt.want)
			}
		})
	}
}

// Video input but a model without a configured discount -> no ratio.
func TestEstimateBilling_UnknownModelNoDiscount(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(teaAdBody)
	info := newRelayInfo()
	info.UpstreamModelName = "doubao-seedance-1-0-pro-250528" // not in videoInputRatioMap
	if r := a.EstimateBilling(c, info); len(r) != 0 {
		t.Fatalf("EstimateBilling = %v, want nil for non-discount model", r)
	}
}

// Videos() drives the video-input billing discount; confirm detection.
func TestVideosDetection(t *testing.T) {
	req := sampleSeedanceReq()
	if len(req.Videos()) != 1 {
		t.Fatalf("Videos() = %d, want 1", len(req.Videos()))
	}
	noVideo := dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "hi"}}}
	if len(noVideo.Videos()) != 0 {
		t.Fatalf("Videos() = %d, want 0", len(noVideo.Videos()))
	}
}

func TestDoubaoResolveDimensions(t *testing.T) {
	tests := []struct {
		name       string
		resolution string
		hasVideo   bool
		wantRes    string
		wantVideo  string
	}{
		{"1080p no video", "1080p", false, "1080p", "false"},
		{"4k with video", "4k", true, "4k", "true"},
		{"uppercase 4K", "4K", false, "4k", "false"},
		{"720p default tier", "720p", false, "720p", "false"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := resolveDimensions(tc.resolution, tc.hasVideo)
			if !ok {
				t.Fatal("expected dimensions to resolve")
			}
			if got["resolution"] != tc.wantRes {
				t.Fatalf("resolution = %q, want %q", got["resolution"], tc.wantRes)
			}
			if got["has_video"] != tc.wantVideo {
				t.Fatalf("has_video = %q, want %q", got["has_video"], tc.wantVideo)
			}
		})
	}
}

func TestDoubaoResolveDimensions_RejectsUnknown(t *testing.T) {
	if _, ok := resolveDimensions("banana", false); ok {
		t.Fatal("unknown resolution must not resolve")
	}
}

func TestDoubaoSecondBillingRatios_UsesConfiguredPrice(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "1080p", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "1080p"},
			PricePerSecond: 0.374, Basis: billing_setting.BasisOutputDuration},
	}

	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := 0.374 * 5 / 0.14
	if math.Abs(got[taskcommon.BillingUnitsKey]-want) > 1e-9 {
		t.Fatalf("units = %v, want %v", got[taskcommon.BillingUnitsKey], want)
	}
}

func TestDoubaoSecondBillingRatios_NotCapturedIsNoOp(t *testing.T) {
	a := &TaskAdaptor{}
	got, err := a.SecondBillingRatios()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil ratios, got %v", got)
	}
}

func TestDoubaoSecondBillingRatios_ConfiguredButUnmatchedErrors(t *testing.T) {
	a := &TaskAdaptor{}
	a.secondBillingModel = "m1"
	a.secondBillingDims = map[string]string{"resolution": "4k", "has_video": "false"}
	a.secondBillingSeconds = 5
	a.secondBillingModelPrice = 0.14
	a.secondBillingRules = []billing_setting.VideoPriceRule{
		{Model: "m1", Match: map[string]string{"resolution": "720p"},
			PricePerSecond: 0.314, Basis: billing_setting.BasisOutputDuration},
	}
	if _, err := a.SecondBillingRatios(); err == nil {
		t.Fatal("a configured model with no matching rule must fail loudly")
	}
}

// installDoubaoVideoPriceRules loads a rule set into the live config and
// restores the previous configuration afterwards. It exercises the real
// GetVideoPriceRules path rather than hand-setting adapter fields, so a test
// using it proves EstimateBilling actually consults the configured table.
func installDoubaoVideoPriceRules(t *testing.T, rulesJSON string) {
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

func newDoubaoBillingRequest(t *testing.T, body, originModel string, modelPrice float64) (*TaskAdaptor, *gin.Context, *relaycommon.RelayInfo) {
	t.Helper()
	c := newJSONCtx(body)
	info := newRelayInfo()
	info.OriginModelName = originModel
	info.UpstreamModelName = "doubao-seedance-2-0-260128"
	info.PriceData.UsePrice = true
	info.PriceData.ModelPrice = modelPrice
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAndSetAction error: %+v", taskErr)
	}
	return a, c, info
}

// A configured model returns nil from EstimateBilling, so its legacy video_input
// ratio never applies -- per-second is the whole price. When the request cannot
// be priced, returning no ratios therefore bills the bare ModelPrice with no
// seconds multiplier, charging a 30-second render as a single unit. It has to
// fail instead, so relay_task rejects before submitting upstream and the request
// costs nothing.
func TestDoubaoEstimateBillingConfiguredButUnpriceableErrors(t *testing.T) {
	installDoubaoVideoPriceRules(t, `[
		{"model":"public-seedance","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	for _, tc := range []struct{ name, body string }{
		// frames sets the length at a per-model fps the gateway does not know.
		{"frames", `{"model":"doubao-seedance-2-0-260128","resolution":"720p","frames":121,"content":[{"type":"text","text":"hi"}]}`},
		// duration -1 explicitly hands the length to the model.
		{"model-chosen duration", `{"model":"doubao-seedance-2-0-260128","resolution":"720p","duration":-1,"content":[{"type":"text","text":"hi"}]}`},
		// A tier NormalizeResolution refuses to classify.
		{"unclassifiable resolution", `{"model":"doubao-seedance-2-0-260128","resolution":"banana","duration":5,"content":[{"type":"text","text":"hi"}]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newDoubaoBillingRequest(t, tc.body, "public-seedance", 0.14)
			if ratios := a.EstimateBilling(c, info); len(ratios) != 0 {
				t.Fatalf("configured model must not use legacy ratios: %v", ratios)
			}
			if _, err := a.SecondBillingRatios(); err == nil {
				t.Fatal("a configured but unpriceable request must return an error")
			}
		})
	}
}

// The mirror image: an UNCONFIGURED model must still reach its legacy path when
// the same request shapes appear. GetVideoInputRatio buckets an unrecognised
// resolution into the base tier and ignores the length entirely, so it really
// does still price these -- returning nil for them would be a silent regression.
func TestDoubaoEstimateBillingUnconfiguredModelKeepsLegacyRatioWhenUnpriceable(t *testing.T) {
	installDoubaoVideoPriceRules(t, `[
		{"model":"some-other-model","match":{"resolution":"720p"},"price_per_second":0.3,"basis":"output_duration"}
	]`)

	video := `{"type":"video_url","video_url":{"url":"https://x/v.mp4"},"role":"reference_video"}`
	for _, tc := range []struct{ name, body string }{
		{"frames", `{"model":"doubao-seedance-2-0-260128","resolution":"720p","frames":121,"content":[{"type":"text","text":"hi"},` + video + `]}`},
		{"model-chosen duration", `{"model":"doubao-seedance-2-0-260128","resolution":"720p","duration":-1,"content":[{"type":"text","text":"hi"},` + video + `]}`},
		{"unclassifiable resolution", `{"model":"doubao-seedance-2-0-260128","resolution":"banana","duration":5,"content":[{"type":"text","text":"hi"},` + video + `]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a, c, info := newDoubaoBillingRequest(t, tc.body, "doubao-unconfigured", 0.14)
			ratios := a.EstimateBilling(c, info)
			if ratios["video_input"] != 28.0/46.0 {
				t.Fatalf("unconfigured model lost its legacy video_input ratio: %v", ratios)
			}
			got, err := a.SecondBillingRatios()
			if err != nil {
				t.Fatalf("an unconfigured model must never fail pricing: %v", err)
			}
			if len(got) != 0 {
				t.Fatalf("unconfigured model produced per-second units: %v", got)
			}
		})
	}
}
