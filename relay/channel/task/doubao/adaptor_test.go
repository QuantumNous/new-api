package doubao

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
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
	if !strings.Contains(s, `"audio_url"`) || !strings.Contains(s, "https://x/a.mp3") {
		t.Errorf("audio not forwarded: %s", s)
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
	want, _ := GetVideoInputRatio("doubao-seedance-2-0-260128")
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
	want, _ := GetVideoInputRatio("doubao-seedance-2-0-260128")
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

// No video input -> no discount.
func TestEstimateBilling_NoVideo(t *testing.T) {
	a := &TaskAdaptor{}
	c := newJSONCtx(`{"model":"doubao-seedance-2-0-260128","content":[{"type":"text","text":"hi"}]}`)
	info := newRelayInfo()
	info.UpstreamModelName = "doubao-seedance-2-0-260128"
	if r := a.EstimateBilling(c, info); len(r) != 0 {
		t.Fatalf("EstimateBilling = %v, want nil for no-video request", r)
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
