package modelapiseedance

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

var (
	_ channel.TaskAdaptor          = (*TaskAdaptor)(nil)
	_ channel.OpenAIVideoConverter = (*TaskAdaptor)(nil)
)

func TestModelAPISeedanceAdaptorIdentity(t *testing.T) {
	adaptor := &TaskAdaptor{}
	if got := adaptor.GetChannelName(); got != "modelapi-seedance" {
		t.Fatalf("GetChannelName() = %q, want modelapi-seedance", got)
	}
	models := adaptor.GetModelList()
	if len(models) != 1 || models[0] != "doubao-seedance-2-5-260628" {
		t.Fatalf("GetModelList() = %v, want [doubao-seedance-2-5-260628]", models)
	}
}

func modelAPIPtrInt(v int) *int    { return &v }
func modelAPIPtrBool(v bool) *bool { return &v }

func newModelAPITestContext(body string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	return c, w
}

func newModelAPIRelayInfo(baseURL, key string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: "client-seedance",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeModelAPISeedance,
			ChannelBaseUrl:    baseURL,
			ApiKey:            key,
			UpstreamModelName: "client-configured-model",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{PublicTaskID: "task_public"},
	}
}

func TestBuildModelAPICreateRequestMapsTextMediaRolesAndVideoAssetSelection(t *testing.T) {
	seedReq := &dto.SeedanceVideoRequest{
		Model: "client-model",
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "make it cinematic"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://cdn.example/ref.png"}},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://cdn.example/first.png"}, Role: dto.SeedanceRoleFirstFrame},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://cdn.example/last.png"}, Role: dto.SeedanceRoleLastFrame},
			{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://cdn.example/ref.mp4"}},
			{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://cdn.example/ref.mp3"}},
		},
		Ratio:           "16:9",
		Resolution:      "720p",
		Duration:        modelAPIPtrInt(5),
		Seed:            modelAPIPtrInt(42),
		GenerateAudio:   modelAPIPtrBool(true),
		Watermark:       modelAPIPtrBool(false),
		ReturnLastFrame: modelAPIPtrBool(false),
	}

	body := buildModelAPICreateRequest(seedReq)
	if body.Model != UpstreamModel {
		t.Fatalf("model = %q, want fixed upstream model %q", body.Model, UpstreamModel)
	}
	if len(body.Input.Text) != 1 || len(body.Input.Image) != 3 || len(body.Input.Video) != 1 || len(body.Input.Audio) != 1 {
		t.Fatalf("input groups not mapped: %+v", body.Input)
	}
	if body.Input.Text[0].Role != "prompt" || body.Input.Text[0].Content != "make it cinematic" {
		t.Fatalf("text input = %+v", body.Input.Text[0])
	}
	wantRoles := []string{"reference", "first_frame", "last_frame", "reference", "reference"}
	gotRoles := []string{
		body.Input.Image[0].Role,
		body.Input.Image[1].Role,
		body.Input.Image[2].Role,
		body.Input.Video[0].Role,
		body.Input.Audio[0].Role,
	}
	for i, want := range wantRoles {
		if got := gotRoles[i]; got != want {
			t.Fatalf("input role[%d] = %q, want %q", i, got, want)
		}
	}
	if body.Params == nil || body.Params.AspectRatio != "16:9" || body.Params.Resolution != "720p" {
		t.Fatalf("params not mapped: %+v", body.Params)
	}

	info, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{
		"task_id":"upstream",
		"status":"succeeded",
		"result":{"assets":[
			{"type":"thumbnail","url":"https://cdn.example/thumb.jpg"},
			{"type":"video","url":"https://cdn.example/final.mp4"}
		]}
	}`))
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if info.Url != "https://cdn.example/final.mp4" {
		t.Fatalf("selected url = %q, want non-first video asset", info.Url)
	}
}

func TestBuildRequestBodyUsesModelAPIGroupedInputWireShape(t *testing.T) {
	c, _ := newModelAPITestContext(`{
		"model":"client-model",
		"content":[
			{"type":"text","text":"make it cinematic"},
			{"type":"image_url","image_url":{"url":"https://example.com/ref.png"},"role":"reference_image"},
			{"type":"image_url","image_url":{"url":"https://example.com/first.png"},"role":"first_frame"},
			{"type":"image_url","image_url":{"url":"https://example.com/last.png"},"role":"last_frame"},
			{"type":"video_url","video_url":{"url":"https://example.com/ref.mp4"}},
			{"type":"audio_url","audio_url":{"url":"https://example.com/ref.mp3"}}
		]
	}`)
	reader, err := (&TaskAdaptor{}).BuildRequestBody(c, newModelAPIRelayInfo("", ""))
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read BuildRequestBody: %v", err)
	}

	var wire map[string]any
	if err := common.Unmarshal(raw, &wire); err != nil {
		t.Fatalf("unmarshal wire body: %v", err)
	}
	input, ok := wire["input"].(map[string]any)
	if !ok {
		t.Fatalf("input wire type = %T, want object: %s", wire["input"], raw)
	}
	if _, flattened := wire["input"].([]any); flattened {
		t.Fatalf("input must not be a flat array: %s", raw)
	}
	assertModelAPIWireItems(t, input, "text", []map[string]string{
		{"role": "prompt", "content": "make it cinematic"},
	})
	assertModelAPIWireItems(t, input, "image", []map[string]string{
		{"role": "reference", "url": "https://example.com/ref.png"},
		{"role": "first_frame", "url": "https://example.com/first.png"},
		{"role": "last_frame", "url": "https://example.com/last.png"},
	})
	assertModelAPIWireItems(t, input, "video", []map[string]string{
		{"role": "reference", "url": "https://example.com/ref.mp4"},
	})
	assertModelAPIWireItems(t, input, "audio", []map[string]string{
		{"role": "reference", "url": "https://example.com/ref.mp3"},
	})
}

func TestBuildRequestBodyOmitsEmptyModelAPIInputGroups(t *testing.T) {
	c, _ := newModelAPITestContext(`{
		"model":"client-model",
		"content":[{"type":"text","text":"make it cinematic"}]
	}`)
	reader, err := (&TaskAdaptor{}).BuildRequestBody(c, newModelAPIRelayInfo("", ""))
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read BuildRequestBody: %v", err)
	}

	var wire map[string]any
	if err := common.Unmarshal(raw, &wire); err != nil {
		t.Fatalf("unmarshal wire body: %v", err)
	}
	input, ok := wire["input"].(map[string]any)
	if !ok {
		t.Fatalf("input wire type = %T, want object: %s", wire["input"], raw)
	}
	if len(input) != 1 {
		t.Fatalf("input keys = %v, want only text: %s", input, raw)
	}
	assertModelAPIWireItems(t, input, "text", []map[string]string{
		{"role": "prompt", "content": "make it cinematic"},
	})
	for _, emptyGroup := range []string{"image", "video", "audio"} {
		if _, ok := input[emptyGroup]; ok {
			t.Fatalf("input.%s should be omitted for text-only request: %s", emptyGroup, raw)
		}
	}
}

func TestBuildRequestBodyPreservesExplicitZeroFalseAndOmitsAbsentParams(t *testing.T) {
	c, _ := newModelAPITestContext(`{
		"model":"client-model",
		"content":[{"type":"text","text":"x"},{"type":"image_url","image_url":{"url":"https://example.com/i.png?a=1&b=2"}}],
		"seed":0,
		"generate_audio":false,
		"watermark":false,
		"return_last_frame":false
	}`)
	reader, err := (&TaskAdaptor{}).BuildRequestBody(c, newModelAPIRelayInfo("", ""))
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	endToEndRaw, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read BuildRequestBody: %v", err)
	}
	if !strings.Contains(string(endToEndRaw), "a=1&b=2") {
		t.Fatalf("BuildRequestBody escaped URL query: %s", endToEndRaw)
	}

	seedReq := &dto.SeedanceVideoRequest{
		Content:         []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "x"}},
		Seed:            modelAPIPtrInt(0),
		GenerateAudio:   modelAPIPtrBool(false),
		Watermark:       modelAPIPtrBool(false),
		ReturnLastFrame: modelAPIPtrBool(false),
	}
	body := buildModelAPICreateRequest(seedReq)
	raw, err := common.MarshalNoHTMLEscape(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	text := string(raw)
	for _, want := range []string{`"seed":0`, `"generate_audio":false`, `"watermark":false`, `"return_last_frame":false`} {
		if !strings.Contains(text, want) {
			t.Fatalf("body missing %s: %s", want, text)
		}
	}
	for _, omitted := range []string{"duration", "resolution", "aspect_ratio"} {
		if strings.Contains(text, omitted) {
			t.Fatalf("body should omit %s when absent: %s", omitted, text)
		}
	}
}

// The upstream defaults an omitted generate_audio to OFF while the other
// seedance channels' upstream defaults it ON. This channel closes that gap by
// sending true when the client said nothing — but an explicit client value,
// including false, must always win (CLAUDE.md Rule 5).
func TestBuildModelAPICreateRequestDefaultsGenerateAudioOnlyWhenClientOmitsIt(t *testing.T) {
	textOnly := func() []dto.SeedanceContentItem {
		return []dto.SeedanceContentItem{{Type: dto.SeedanceContentText, Text: "x"}}
	}

	t.Run("absent defaults to true", func(t *testing.T) {
		body := buildModelAPICreateRequest(&dto.SeedanceVideoRequest{Content: textOnly()})
		if body.Params == nil {
			t.Fatal("params omitted; generate_audio default must be sent")
		}
		if body.Params.GenerateAudio == nil || !*body.Params.GenerateAudio {
			t.Fatalf("generate_audio = %v, want true", body.Params.GenerateAudio)
		}
		raw, err := common.MarshalNoHTMLEscape(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		if !strings.Contains(string(raw), `"generate_audio":true`) {
			t.Fatalf("wire body missing generate_audio true: %s", raw)
		}
	})

	t.Run("explicit false is preserved", func(t *testing.T) {
		body := buildModelAPICreateRequest(&dto.SeedanceVideoRequest{
			Content:       textOnly(),
			GenerateAudio: modelAPIPtrBool(false),
		})
		if body.Params == nil || body.Params.GenerateAudio == nil || *body.Params.GenerateAudio {
			t.Fatalf("generate_audio = %+v, want explicit false", body.Params)
		}
		raw, err := common.MarshalNoHTMLEscape(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		if !strings.Contains(string(raw), `"generate_audio":false`) {
			t.Fatalf("wire body dropped explicit false: %s", raw)
		}
	})

	t.Run("explicit true is preserved", func(t *testing.T) {
		body := buildModelAPICreateRequest(&dto.SeedanceVideoRequest{
			Content:       textOnly(),
			GenerateAudio: modelAPIPtrBool(true),
		})
		if body.Params == nil || body.Params.GenerateAudio == nil || !*body.Params.GenerateAudio {
			t.Fatalf("generate_audio = %+v, want explicit true", body.Params)
		}
	})

	t.Run("default does not leak into other optional params", func(t *testing.T) {
		body := buildModelAPICreateRequest(&dto.SeedanceVideoRequest{Content: textOnly()})
		raw, err := common.MarshalNoHTMLEscape(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		// Assert on decoded keys, not raw substrings — "seed" also occurs
		// inside the upstream model id, which would false-positive.
		var decoded struct {
			Params map[string]any `json:"params"`
		}
		if err := common.Unmarshal(raw, &decoded); err != nil {
			t.Fatalf("unmarshal body: %v", err)
		}
		if len(decoded.Params) != 1 {
			t.Fatalf("params = %+v, want generate_audio only", decoded.Params)
		}
		if _, ok := decoded.Params["generate_audio"]; !ok {
			t.Fatalf("params missing generate_audio: %+v", decoded.Params)
		}
	})
}

// BuildRequestBody is the real entrypoint; assert the default survives the full
// bind → rewrite → marshal path, not just the pure mapping function.
func TestBuildRequestBodyDefaultsGenerateAudioWhenClientOmitsIt(t *testing.T) {
	c, _ := newModelAPITestContext(`{"model":"client-model","content":[{"type":"text","text":"x"}]}`)
	reader, err := (&TaskAdaptor{}).BuildRequestBody(c, newModelAPIRelayInfo("", ""))
	if err != nil {
		t.Fatalf("BuildRequestBody error: %v", err)
	}
	raw, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read BuildRequestBody: %v", err)
	}
	if !strings.Contains(string(raw), `"generate_audio":true`) {
		t.Fatalf("end-to-end body missing generate_audio true: %s", raw)
	}
}

func TestModelAPISeedanceTrustedBoundAssetRewriteReachesWireBody(t *testing.T) {
	const publicURI = "asset://ast_1234567890abcdefABCDEF1234567890"
	const upstreamURI = "asset://asset-upstream_1234567890abcdef"
	c, _ := newModelAPITestContext(`{"model":"seedance-2.0","content":[{"type":"text","text":"x"},{"type":"image_url","image_url":{"url":"` + publicURI + `"},"role":"reference_image"}]}`)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{publicURI: upstreamURI})
	adaptor := &TaskAdaptor{}
	info := newModelAPIRelayInfo("", "")

	if taskErr := adaptor.ValidateRequestAfterModelMapping(c, info); taskErr != nil {
		t.Fatalf("ValidateRequestAfterModelMapping rejected trusted bound asset rewrite: %v", taskErr)
	}
	reader, err := adaptor.BuildRequestBody(c, info)
	if err != nil {
		t.Fatalf("BuildRequestBody rejected trusted bound asset rewrite: %v", err)
	}
	raw, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read BuildRequestBody: %v", err)
	}
	if !strings.Contains(string(raw), upstreamURI) {
		t.Fatalf("wire body missing upstream asset URI: %s", raw)
	}
	if strings.Contains(string(raw), publicURI) {
		t.Fatalf("wire body leaked platform public asset URI: %s", raw)
	}
}

func TestModelAPISeedanceUntrustedUpstreamAssetURIIsRejected(t *testing.T) {
	tests := []struct {
		name       string
		requestURI string
		rewriteURI string
	}{
		{name: "direct client URI", requestURI: "asset://asset-upstream_1234567890abcdef"},
		{name: "trusted map path", requestURI: "asset://ast_1234567890abcdefABCDEF1234567890", rewriteURI: "asset://asset-upstream/path"},
		{name: "trusted map query", requestURI: "asset://ast_1234567890abcdefABCDEF1234567890", rewriteURI: "asset://asset-upstream?token=x"},
		{name: "trusted map userinfo", requestURI: "asset://ast_1234567890abcdefABCDEF1234567890", rewriteURI: "asset://user@asset-upstream"},
		{name: "trusted map fragment", requestURI: "asset://ast_1234567890abcdefABCDEF1234567890", rewriteURI: "asset://asset-upstream#fragment"},
		{name: "trusted map leading whitespace", requestURI: "asset://ast_1234567890abcdefABCDEF1234567890", rewriteURI: " asset://asset-upstream"},
		{name: "trusted map trailing whitespace", requestURI: "asset://ast_1234567890abcdefABCDEF1234567890", rewriteURI: "asset://asset-upstream "},
		{name: "trusted map control character", requestURI: "asset://ast_1234567890abcdefABCDEF1234567890", rewriteURI: "asset://asset-upstream\n"},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			c, _ := newModelAPITestContext(`{"model":"seedance-2.0","content":[{"type":"image_url","image_url":{"url":"` + testCase.requestURI + `"},"role":"reference_image"}]}`)
			if testCase.rewriteURI != "" {
				common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{testCase.requestURI: testCase.rewriteURI})
			}
			if taskErr := (&TaskAdaptor{}).ValidateRequestAfterModelMapping(c, newModelAPIRelayInfo("", "")); taskErr == nil {
				t.Fatal("expected untrusted or malformed upstream asset URI rejection")
			}
		})
	}
}

func TestModelAPISeedanceRejectsDirectUpstreamAssetURIThatCollidesWithTrustedRewrite(t *testing.T) {
	const publicURI = "asset://ast_1234567890abcdefABCDEF1234567890"
	const upstreamURI = "asset://asset-upstream_1234567890abcdef"
	c, _ := newModelAPITestContext(`{"model":"seedance-2.0","content":[{"type":"image_url","image_url":{"url":"` + publicURI + `"},"role":"reference_image"},{"type":"image_url","image_url":{"url":"` + upstreamURI + `"},"role":"reference_image"}]}`)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{publicURI: upstreamURI})

	if taskErr := (&TaskAdaptor{}).ValidateRequestAfterModelMapping(c, newModelAPIRelayInfo("", "")); taskErr == nil {
		t.Fatal("expected direct upstream asset URI collision to be rejected")
	}
}

func TestBuildRequestBodyRejectsDirectUpstreamAssetURIWithoutValidationProvenance(t *testing.T) {
	const publicURI = "asset://ast_1234567890abcdefABCDEF1234567890"
	const upstreamURI = "asset://asset-upstream_1234567890abcdef"
	c, _ := newModelAPITestContext(`{"model":"seedance-2.0","content":[{"type":"image_url","image_url":{"url":"` + publicURI + `"},"role":"reference_image"},{"type":"image_url","image_url":{"url":"` + upstreamURI + `"},"role":"reference_image"}]}`)
	common.SetContextKey(c, constant.ContextKeyAssetRewriteMap, map[string]string{publicURI: upstreamURI})

	if _, err := (&TaskAdaptor{}).BuildRequestBody(c, newModelAPIRelayInfo("", "")); err == nil {
		t.Fatal("expected BuildRequestBody to reject direct upstream asset URI without validation provenance")
	}
}

func assertModelAPIWireItems(t *testing.T, input map[string]any, key string, want []map[string]string) {
	t.Helper()
	items, ok := input[key].([]any)
	if !ok {
		t.Fatalf("input.%s wire type = %T, want array", key, input[key])
	}
	if len(items) != len(want) {
		t.Fatalf("input.%s length = %d, want %d: %+v", key, len(items), len(want), items)
	}
	for i, item := range items {
		got, ok := item.(map[string]any)
		if !ok {
			t.Fatalf("input.%s[%d] wire type = %T, want object", key, i, item)
		}
		for field, wantValue := range want[i] {
			if gotValue, _ := got[field].(string); gotValue != wantValue {
				t.Fatalf("input.%s[%d].%s = %q, want %q", key, i, field, gotValue, wantValue)
			}
		}
	}
}

func TestValidateModelAPISeedanceValues(t *testing.T) {
	valid := dto.SeedanceVideoRequest{
		Content: []dto.SeedanceContentItem{
			{Type: dto.SeedanceContentText, Text: "x"},
			{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/ref.png"}},
			{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://example.com/ref.mp4"}},
			{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://example.com/ref.mp3"}},
		},
		Duration:   modelAPIPtrInt(4),
		Resolution: "480p",
		Ratio:      "adaptive",
	}
	if err := validateModelAPISeedanceRequest(&valid); err != nil {
		t.Fatalf("valid request rejected: %v", err)
	}

	tests := []struct {
		name string
		req  dto.SeedanceVideoRequest
	}{
		{name: "duration low", req: dto.SeedanceVideoRequest{Duration: modelAPIPtrInt(3)}},
		{name: "duration high", req: dto.SeedanceVideoRequest{Duration: modelAPIPtrInt(31)}},
		{name: "resolution", req: dto.SeedanceVideoRequest{Resolution: "1080p"}},
		{name: "aspect", req: dto.SeedanceVideoRequest{Ratio: "3:2"}},
		{name: "image role", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/i.png"}, Role: "cover"}}}},
		{name: "video role", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://example.com/v.mp4"}, Role: "first_frame"}}}},
		{name: "audio role", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://example.com/a.mp3"}, Role: "narration"}}}},
		{name: "last without first", req: dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/last.png"}, Role: dto.SeedanceRoleLastFrame}}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateModelAPISeedanceRequest(&tt.req); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}

	countReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 31; i++ {
		countReq.Content = append(countReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/i.png"}})
	}
	if err := validateModelAPISeedanceRequest(&countReq); err == nil {
		t.Fatal("expected image count error")
	}

	videoCountReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 11; i++ {
		videoCountReq.Content = append(videoCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://example.com/v.mp4"}})
	}
	if err := validateModelAPISeedanceRequest(&videoCountReq); err == nil {
		t.Fatal("expected video count error")
	}

	audioCountReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 11; i++ {
		audioCountReq.Content = append(audioCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://example.com/a.mp3"}})
	}
	if err := validateModelAPISeedanceRequest(&audioCountReq); err == nil {
		t.Fatal("expected audio count error")
	}

	totalCountReq := dto.SeedanceVideoRequest{}
	for i := 0; i < 30; i++ {
		totalCountReq.Content = append(totalCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/i.png"}})
	}
	for i := 0; i < 10; i++ {
		totalCountReq.Content = append(totalCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://example.com/v.mp4"}})
	}
	for i := 0; i < 11; i++ {
		totalCountReq.Content = append(totalCountReq.Content, dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://example.com/a.mp3"}})
	}
	if err := validateModelAPISeedanceRequest(&totalCountReq); err == nil {
		t.Fatal("expected total media count error")
	}

	firstFrameReq := dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/first-a.png"}, Role: dto.SeedanceRoleFirstFrame},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/first-b.png"}, Role: dto.SeedanceRoleFirstFrame},
	}}
	if err := validateModelAPISeedanceRequest(&firstFrameReq); err == nil {
		t.Fatal("expected first_frame max-one error")
	}

	lastFrameReq := dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/first.png"}, Role: dto.SeedanceRoleFirstFrame},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/last-a.png"}, Role: dto.SeedanceRoleLastFrame},
		{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/last-b.png"}, Role: dto.SeedanceRoleLastFrame},
	}}
	if err := validateModelAPISeedanceRequest(&lastFrameReq); err == nil {
		t.Fatal("expected last_frame max-one error")
	}
}

func TestValidateModelAPISeedanceRequestValidatesRemoteMediaURLs(t *testing.T) {
	original := *system_setting.GetFetchSetting()
	t.Cleanup(func() { *system_setting.GetFetchSetting() = original })
	system_setting.GetFetchSetting().EnableSSRFProtection = true
	system_setting.GetFetchSetting().AllowPrivateIp = false
	system_setting.GetFetchSetting().DomainFilterMode = false
	system_setting.GetFetchSetting().IpFilterMode = false
	system_setting.GetFetchSetting().AllowedPorts = []string{"80", "443"}
	system_setting.GetFetchSetting().ApplyIPFilterForDomain = false

	tests := []struct {
		name    string
		content dto.SeedanceContentItem
		wantErr bool
	}{
		{
			name:    "rejects private image url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "http://127.0.0.1/private.png"}},
			wantErr: true,
		},
		{
			name:    "rejects file image url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "file:///tmp/private.png"}},
			wantErr: true,
		},
		{
			name:    "allows public image url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentImage, ImageURL: &dto.SeedanceURLObject{URL: "https://example.com/ref.png"}},
		},
		{
			name:    "rejects private video url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "http://127.0.0.1/private.mp4"}},
			wantErr: true,
		},
		{
			name:    "rejects file video url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "file:///tmp/private.mp4"}},
			wantErr: true,
		},
		{
			name:    "allows public video url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentVideo, VideoURL: &dto.SeedanceURLObject{URL: "https://example.com/ref.mp4"}},
		},
		{
			name:    "rejects private audio url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "http://127.0.0.1/private.mp3"}},
			wantErr: true,
		},
		{
			name:    "rejects file audio url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "file:///tmp/private.mp3"}},
			wantErr: true,
		},
		{
			name:    "allows public audio url",
			content: dto.SeedanceContentItem{Type: dto.SeedanceContentAudio, AudioURL: &dto.SeedanceURLObject{URL: "https://example.com/ref.mp3"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := dto.SeedanceVideoRequest{Content: []dto.SeedanceContentItem{tt.content}}
			err := validateModelAPISeedanceRequest(&req)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected validation error")
				}
				msg := err.Error()
				for _, leaked := range []string{"127.0.0.1", "file:///tmp/private"} {
					if strings.Contains(msg, leaked) {
						t.Fatalf("validation error leaked media URL details: %q", msg)
					}
				}
				return
			}
			if err != nil {
				t.Fatalf("valid public URL rejected: %v", err)
			}
		})
	}
}

func TestValidateRequestAndSetActionAcceptsAudioOnlyAndSetsFixedUpstreamModel(t *testing.T) {
	c, _ := newModelAPITestContext(`{"model":"client-model","content":[{"type":"audio_url","audio_url":{"url":"https://example.com/a.mp3"}}]}`)
	info := newModelAPIRelayInfo("", "")
	a := &TaskAdaptor{}
	if taskErr := a.ValidateRequestAndSetAction(c, info); taskErr != nil {
		t.Fatalf("audio-only request rejected: %+v", taskErr)
	}
	if info.UpstreamModelName != UpstreamModel {
		t.Fatalf("UpstreamModelName = %q, want %q", info.UpstreamModelName, UpstreamModel)
	}
	if info.Action != constant.TaskActionGenerate {
		t.Fatalf("Action = %q, want generate", info.Action)
	}
}

func TestValidateRequestAfterModelMappingRestrictsPublicSubmitEntrypoints(t *testing.T) {
	type postMappingValidator interface {
		ValidateRequestAfterModelMapping(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError
	}
	validator, ok := any(&TaskAdaptor{}).(postMappingValidator)
	if !ok {
		t.Fatal("TaskAdaptor must validate after model mapping")
	}

	validBody := `{"model":"client-model","content":[{"type":"text","text":"hello"}]}`
	for _, path := range []string{"/v1/generation/tasks", "/v1/tasks", "/v1/video-to-music"} {
		t.Run("rejects "+path, func(t *testing.T) {
			c, _ := newModelAPITestContext(validBody)
			c.Request.URL.Path = path
			err := validator.ValidateRequestAfterModelMapping(c, newModelAPIRelayInfo("", ""))
			if err == nil {
				t.Fatal("unsupported submit path was accepted")
			}
			if err.StatusCode != http.StatusBadRequest || err.Code != "invalid_request" {
				t.Fatalf("error = %+v, want invalid_request 400", err)
			}
		})
	}

	t.Run("rejects missing URL without panic", func(t *testing.T) {
		c, _ := newModelAPITestContext(validBody)
		c.Request.URL = nil
		err := validator.ValidateRequestAfterModelMapping(c, newModelAPIRelayInfo("", ""))
		if err == nil || err.Code != "invalid_request" || err.StatusCode != http.StatusBadRequest {
			t.Fatalf("error = %+v, want invalid_request 400", err)
		}
	})

	// Both shared platform video submit routes must work: /v1/videos is the
	// OpenAI-compatible entrypoint and /v1/video/generations is the generic one
	// every other video channel already accepts.
	for _, path := range []string{"/v1/videos", "/v1/video/generations"} {
		t.Run("allows "+path+" and preserves payload validation", func(t *testing.T) {
			c, _ := newModelAPITestContext(validBody)
			c.Request.URL.Path = path
			if err := validator.ValidateRequestAfterModelMapping(c, newModelAPIRelayInfo("", "")); err != nil {
				t.Fatalf("%s rejected: %+v", path, err)
			}

			c, _ = newModelAPITestContext(`{"model":"client-model","duration":31,"content":[{"type":"text","text":"hello"}]}`)
			c.Request.URL.Path = path
			err := validator.ValidateRequestAfterModelMapping(c, newModelAPIRelayInfo("", ""))
			if err == nil || err.Code != "invalid_request" || !strings.Contains(err.Message, "duration") {
				t.Fatalf("invalid payload error = %+v, want duration invalid_request", err)
			}
		})
	}

	t.Run("allows the authenticated Playground video submit route", func(t *testing.T) {
		c, _ := newModelAPITestContext(validBody)
		c.Request.URL.Path = "/pg/videos"
		if err := validator.ValidateRequestAfterModelMapping(c, newModelAPIRelayInfo("", "")); err != nil {
			t.Fatalf("Playground video route rejected: %+v", err)
		}
	})
}

func TestBuildAndFetchPathsHeadersAndEscaping(t *testing.T) {
	service.InitHttpClient()
	a := &TaskAdaptor{}
	info := newModelAPIRelayInfo("https://api.modelapi.co///", "secret")
	a.Init(info)
	if a.baseURL != "https://api.modelapi.co" {
		t.Fatalf("baseURL = %q, want trimmed", a.baseURL)
	}
	if got, err := a.BuildRequestURL(info); err != nil || got != "https://api.modelapi.co/v1/tasks" {
		t.Fatalf("BuildRequestURL = %q, %v", got, err)
	}
	req := httptest.NewRequest(http.MethodPost, "/upstream", nil)
	if err := a.BuildRequestHeader(nil, req, info); err != nil {
		t.Fatalf("BuildRequestHeader error: %v", err)
	}
	if req.Header.Get("Authorization") != "Bearer secret" {
		t.Fatalf("Authorization = %q", req.Header.Get("Authorization"))
	}

	var gotPath, gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.EscapedPath()
		gotAuth = r.Header.Get("Authorization")
		_, _ = w.Write([]byte(`{"task_id":"ok","status":"running"}`))
	}))
	defer server.Close()
	resp, err := a.FetchTask(server.URL, "fetch-key", map[string]any{"task_id": "task/a b"}, "")
	if err != nil {
		t.Fatalf("FetchTask error: %v", err)
	}
	_ = resp.Body.Close()
	if gotPath != "/v1/tasks/task%2Fa%20b" {
		t.Fatalf("fetch path = %q", gotPath)
	}
	if gotAuth != "Bearer fetch-key" {
		t.Fatalf("fetch auth = %q", gotAuth)
	}
}

func TestDoRequestRejectsProxyWithoutUpstreamRequest(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newModelAPITestContext(`{}`)
	info := newModelAPIRelayInfo("", "secret")
	info.ChannelSetting.Proxy = "http://proxy.internal:8080"

	resp, err := a.DoRequest(c, info, strings.NewReader(`{}`))
	if resp != nil {
		_ = resp.Body.Close()
		t.Fatalf("DoRequest returned response with proxy configured")
	}
	if err == nil {
		t.Fatal("expected proxy rejection")
	}
	if err.Error() != "this channel type does not support proxy" {
		t.Fatalf("error = %q", err.Error())
	}
	assertNoModelAPILeak(t, err.Error())
}

func TestDoRequestTreatsWhitespaceProxyAsEmpty(t *testing.T) {
	service.InitHttpClient()
	t.Cleanup(service.ResetProxyClientCache)

	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		_, _ = w.Write([]byte(`{"task_id":"ok","status":"pending"}`))
	}))
	defer server.Close()

	a := &TaskAdaptor{}
	info := newModelAPIRelayInfo(server.URL, "secret")
	info.ChannelSetting.Proxy = " \t\n "
	a.Init(info)
	c, _ := newModelAPITestContext(`{}`)

	resp, err := a.DoRequest(c, info, strings.NewReader(`{}`))
	if err != nil {
		t.Fatalf("DoRequest rejected whitespace proxy: %v", err)
	}
	_ = resp.Body.Close()
	if requestCount != 1 {
		t.Fatalf("DoRequest reached upstream %d times, want 1", requestCount)
	}
	if info.ChannelSetting.Proxy != " \t\n " {
		t.Fatalf("DoRequest mutated RelayInfo proxy to %q", info.ChannelSetting.Proxy)
	}
}

func TestFetchTaskRejectsProxyWithoutUpstreamRequest(t *testing.T) {
	a := &TaskAdaptor{}
	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		_, _ = w.Write([]byte(`{"task_id":"ok","status":"running"}`))
	}))
	defer server.Close()

	resp, err := a.FetchTask(server.URL, "fetch-key", map[string]any{"task_id": "task-1"}, "http://proxy.internal:8080")
	if resp != nil {
		_ = resp.Body.Close()
		t.Fatalf("FetchTask returned response with proxy configured")
	}
	if err == nil {
		t.Fatal("expected proxy rejection")
	}
	if err.Error() != "this channel type does not support proxy" {
		t.Fatalf("error = %q", err.Error())
	}
	if requestCount != 0 {
		t.Fatalf("FetchTask reached upstream %d times", requestCount)
	}
	assertNoModelAPILeak(t, err.Error())
}

func TestFetchTaskWithContextTreatsWhitespaceProxyAsEmpty(t *testing.T) {
	service.InitHttpClient()
	t.Cleanup(service.ResetProxyClientCache)

	a := &TaskAdaptor{}
	var requestCount int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		_, _ = w.Write([]byte(`{"task_id":"ok","status":"running"}`))
	}))
	defer server.Close()

	resp, err := a.FetchTaskWithContext(context.Background(), server.URL, "fetch-key", map[string]any{"task_id": "task-1"}, " \t\n ")
	if err != nil {
		t.Fatalf("FetchTaskWithContext rejected whitespace proxy: %v", err)
	}
	_ = resp.Body.Close()
	if requestCount != 1 {
		t.Fatalf("FetchTaskWithContext reached upstream %d times, want 1", requestCount)
	}
}

func TestInitFallsBackToDefaultBaseURL(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(newModelAPIRelayInfo("", "key"))
	if a.baseURL != constant.ChannelBaseURLs[constant.ChannelTypeModelAPISeedance] {
		t.Fatalf("baseURL = %q", a.baseURL)
	}
}

func TestDoResponseParsesExactTaskIDAndRejectsIDOnly(t *testing.T) {
	a := &TaskAdaptor{}
	info := newModelAPIRelayInfo("", "")
	c, w := newModelAPITestContext(`{}`)
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"task_id":"upstream-task","status":"pending"}`))}
	taskID, taskData, taskErr := a.DoResponse(c, resp, info)
	if taskErr != nil {
		t.Fatalf("DoResponse error: %+v", taskErr)
	}
	if taskID != "upstream-task" {
		t.Fatalf("taskID = %q", taskID)
	}
	if strings.Contains(string(taskData), "upstream-task") || strings.Contains(string(taskData), "task_id") {
		t.Fatalf("persisted taskData leaked upstream task id: %s", taskData)
	}
	if !strings.Contains(string(taskData), `"status":"pending"`) {
		t.Fatalf("persisted taskData missed safe submit status: %s", taskData)
	}
	if strings.Contains(w.Body.String(), "upstream-task") || !strings.Contains(w.Body.String(), `"id":"task_public"`) {
		t.Fatalf("client response leaked upstream or missed public id: %s", w.Body.String())
	}

	c, _ = newModelAPITestContext(`{}`)
	resp = &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"id":"wrong-field","status":"pending"}`))}
	taskID, _, taskErr = a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("expected id-only response to be rejected")
	}
	if taskID != "" {
		t.Fatalf("taskID = %q, want empty on error", taskID)
	}
	if strings.Contains(taskErr.Message, "ModelAPI") || strings.Contains(taskErr.Message, "api.modelapi.co") {
		t.Fatalf("task error leaked provider: %+v", taskErr)
	}

	c, _ = newModelAPITestContext(`{}`)
	resp = &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"task_id":"upstream-task","status":"failed","error":{"message":"ModelAPI api.modelapi.co failed"}}`))}
	_, _, taskErr = a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("expected failed create response to be rejected")
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("failed create message = %q", taskErr.Message)
	}
}

func TestDoResponseRejectsOversizedSubmitBodyWithoutReadingPastLimitOrLeaking(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newModelAPITestContext(`{}`)
	body := &countingReadCloser{Reader: strings.NewReader(strings.Repeat("x", (1<<20)+128) + " ModelAPI api.modelapi.co upstream-secret-id")}
	resp := &http.Response{StatusCode: http.StatusOK, Body: body}

	taskID, taskData, taskErr := a.DoResponse(c, resp, newModelAPIRelayInfo("", ""))
	if taskErr == nil {
		t.Fatal("expected oversized submit response to be rejected")
	}
	if taskID != "" || taskData != nil {
		t.Fatalf("oversized response returned taskID=%q taskData=%s", taskID, taskData)
	}
	if taskErr.Code != "invalid_response" || taskErr.StatusCode != http.StatusBadGateway {
		t.Fatalf("taskErr = %+v, want invalid_response/502", taskErr)
	}
	if body.n > (1<<20)+1 {
		t.Fatalf("DoResponse read %d bytes, want at most max+1", body.n)
	}
	assertNoModelAPILeak(t, taskErr.Message)
}

func TestDoResponseClosesSubmitBodyOnReadError(t *testing.T) {
	a := &TaskAdaptor{}
	c, _ := newModelAPITestContext(`{}`)
	body := &submitReadErrorCloser{err: errors.New("read ModelAPI api.modelapi.co upstream-secret-id failed")}
	resp := &http.Response{StatusCode: http.StatusOK, Body: body}

	taskID, taskData, taskErr := a.DoResponse(c, resp, newModelAPIRelayInfo("", ""))
	if taskErr == nil {
		t.Fatal("expected read error")
	}
	if taskID != "" || taskData != nil {
		t.Fatalf("read error returned taskID=%q taskData=%s", taskID, taskData)
	}
	if !body.closed {
		t.Fatal("DoResponse did not close submit response body on read error")
	}
	if taskErr.Code != "read_response_body_failed" || taskErr.StatusCode != http.StatusInternalServerError {
		t.Fatalf("taskErr = %+v, want read_response_body_failed/500", taskErr)
	}
	assertNoModelAPILeak(t, taskErr.Message)
}

type countingReadCloser struct {
	*strings.Reader
	n int
}

func (c *countingReadCloser) Read(p []byte) (int, error) {
	n, err := c.Reader.Read(p)
	c.n += n
	return n, err
}

func (c *countingReadCloser) Close() error { return nil }

type submitReadErrorCloser struct {
	err    error
	closed bool
}

func (c *submitReadErrorCloser) Read([]byte) (int, error) {
	return 0, c.err
}

func (c *submitReadErrorCloser) Close() error {
	c.closed = true
	return nil
}

func TestDoResponseReturnsFailedStatusBeforeMissingTaskIDAndUsesErrorCodeFallback(t *testing.T) {
	a := &TaskAdaptor{}
	info := newModelAPIRelayInfo("", "")
	c, _ := newModelAPITestContext(`{}`)
	resp := &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"status":"failed","error":{"message":"ModelAPI api.modelapi.co rejected https://api.modelapi.co/v1/tasks/real"}}`))}
	_, _, taskErr := a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("expected failed create response to be rejected")
	}
	if taskErr.Code != "upstream_error" {
		t.Fatalf("taskErr.Code = %q, want upstream_error", taskErr.Code)
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("failed-without-task_id message = %q", taskErr.Message)
	}
	assertNoModelAPILeak(t, taskErr.Message)

	c, _ = newModelAPITestContext(`{}`)
	resp = &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"status":"failed","error":{"code":"rate_limit_exceeded"}}`))}
	_, _, taskErr = a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("expected code-only failed create response to be rejected")
	}
	if taskErr.Message == "" {
		t.Fatal("code-only failed create response returned empty message")
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("code-only failed create message = %q", taskErr.Message)
	}
	assertNoModelAPILeak(t, taskErr.Message)

	c, _ = newModelAPITestContext(`{}`)
	resp = &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(`{"status":"failed","error":{"message":"download failed for https://cdn.example/private.mp4 upstream-task-123"}}`))}
	_, _, taskErr = a.DoResponse(c, resp, info)
	if taskErr == nil {
		t.Fatal("expected unbranded failed create response to be rejected")
	}
	if taskErr.Message != "task failed at upstream provider" {
		t.Fatalf("unbranded failed create message = %q", taskErr.Message)
	}
	assertNoModelAPILeak(t, taskErr.Message)
}

func TestFetchTaskWithContextHonorsCanceledContext(t *testing.T) {
	type contextTaskFetcher interface {
		FetchTaskWithContext(context.Context, string, string, map[string]any, string) (*http.Response, error)
	}
	fetcher, ok := any(&TaskAdaptor{}).(contextTaskFetcher)
	if !ok {
		t.Fatal("ModelAPI Seedance adaptor does not support context-aware task polling")
	}

	service.InitHttpClient()
	requestStarted := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(requestStarted)
		<-r.Context().Done()
	}))
	defer server.Close()
	t.Cleanup(service.ResetProxyClientCache)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	resp, err := fetcher.FetchTaskWithContext(ctx, server.URL, "fetch-key", map[string]any{"task_id": "task-1"}, "")
	if resp != nil {
		_ = resp.Body.Close()
		t.Fatalf("FetchTaskWithContext returned response for canceled context")
	}
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("FetchTaskWithContext error = %v, want context.Canceled", err)
	}
	select {
	case <-requestStarted:
		t.Fatal("canceled context still reached upstream server")
	case <-time.After(50 * time.Millisecond):
	}
}

func TestParseTaskResultStatusMappingsAndFailureScrub(t *testing.T) {
	a := &TaskAdaptor{}
	tests := []struct {
		name       string
		body       string
		wantStatus string
		wantURL    string
		wantReason string
	}{
		{name: "pending queued", body: `{"task_id":"up","status":"pending"}`, wantStatus: model.TaskStatusQueued},
		{name: "polling progress", body: `{"task_id":"up","status":"polling"}`, wantStatus: model.TaskStatusInProgress},
		{name: "running progress", body: `{"task_id":"up","status":"running"}`, wantStatus: model.TaskStatusInProgress},
		{name: "unknown progress", body: `{"task_id":"up","status":"mystery"}`, wantStatus: model.TaskStatusInProgress},
		{name: "succeeded video", body: `{"task_id":"up","status":"succeeded","result":{"assets":[{"type":"image","url":"https://x/i.png"},{"type":"video","url":"https://x/v.mp4"}]}}`, wantStatus: model.TaskStatusSuccess, wantURL: "https://x/v.mp4"},
		{name: "failed scrubbed", body: `{"task_id":"up","status":"failed","error":{"code":"bad","message":"ModelAPI seedance host api.modelapi.co failed"}}`, wantStatus: model.TaskStatusFailure, wantReason: "task failed at upstream provider"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := a.ParseTaskResult([]byte(tt.body))
			if err != nil {
				t.Fatalf("ParseTaskResult error: %v", err)
			}
			if info.Status != tt.wantStatus || info.Url != tt.wantURL || info.Reason != tt.wantReason {
				t.Fatalf("TaskInfo = %+v", info)
			}
		})
	}
	if _, err := a.ParseTaskResult([]byte(`{"task_id":"up","status":"succeeded","result":{"assets":[{"type":"image","url":"https://x/i.png"}]}}`)); err == nil {
		t.Fatal("expected missing video asset to be retryable error")
	}
}

func TestParseTaskResultUsesErrorCodeFallbackForFailedTasks(t *testing.T) {
	info, err := (&TaskAdaptor{}).ParseTaskResult([]byte(`{"task_id":"up","status":"failed","error":{"code":"quota_exceeded"}}`))
	if err != nil {
		t.Fatalf("ParseTaskResult error: %v", err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("Status = %q, want failure", info.Status)
	}
	if info.Reason != "task failed at upstream provider" {
		t.Fatalf("code-only failure reason = %q", info.Reason)
	}
	assertNoModelAPILeak(t, info.Reason)

	info, err = (&TaskAdaptor{}).ParseTaskResult([]byte(`{"task_id":"up","status":"failed","error":{"code":"ModelAPI api.modelapi.co https://api.modelapi.co/v1/tasks/real"}}`))
	if err != nil {
		t.Fatalf("ParseTaskResult branded code error: %v", err)
	}
	if info.Reason != "task failed at upstream provider" {
		t.Fatalf("branded code-only failure reason = %q", info.Reason)
	}
	assertNoModelAPILeak(t, info.Reason)

	info, err = (&TaskAdaptor{}).ParseTaskResult([]byte(`{"task_id":"up","status":"failed","error":{"message":"download failed for https://cdn.example/private.mp4 upstream-task-123"}}`))
	if err != nil {
		t.Fatalf("ParseTaskResult unbranded URL error: %v", err)
	}
	if info.Reason != "task failed at upstream provider" {
		t.Fatalf("unbranded URL failure reason = %q", info.Reason)
	}
	assertNoModelAPILeak(t, info.Reason)
}

func TestConvertToOpenAIVideoUsesPublicResultURLAndScrubsFailure(t *testing.T) {
	a := &TaskAdaptor{}
	success := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		CreatedAt:  10,
		UpdatedAt:  20,
		Properties: model.Properties{OriginModelName: "client-model"},
		PrivateData: model.TaskPrivateData{
			ResultURL: "https://flatkey.example/v1/videos/task_public/content",
		},
		Data: []byte(`{"result":{"assets":[{"type":"video","url":"https://cdn.modelapi.co/private.mp4"}]}}`),
	}
	raw, err := a.ConvertToOpenAIVideo(success)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo success error: %v", err)
	}
	var got dto.OpenAIVideo
	if err := common.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal video: %v", err)
	}
	if got.Metadata["url"] != "https://flatkey.example/v1/videos/task_public/content" {
		t.Fatalf("metadata.url = %v", got.Metadata["url"])
	}
	if strings.Contains(string(raw), "cdn.modelapi.co") {
		t.Fatalf("success leaked upstream asset URL: %s", raw)
	}

	failure := &model.Task{
		TaskID:     "task_public",
		Status:     model.TaskStatusFailure,
		FailReason: "download failed for https://cdn.example/private.mp4 upstream-task-123",
	}
	raw, err = a.ConvertToOpenAIVideo(failure)
	if err != nil {
		t.Fatalf("ConvertToOpenAIVideo failure error: %v", err)
	}
	if err := common.Unmarshal(raw, &got); err != nil {
		t.Fatalf("unmarshal failure video: %v", err)
	}
	if got.Error == nil || got.Error.Message != "task failed at upstream provider" {
		t.Fatalf("failure error = %+v", got.Error)
	}
}

func assertNoModelAPILeak(t *testing.T, s string) {
	t.Helper()
	for _, leaked := range []string{"ModelAPI", "modelapi", "api.modelapi.co", "https://api.modelapi.co/v1/tasks/real", "https://cdn.example/private.mp4", "upstream-task-123"} {
		if strings.Contains(s, leaked) {
			t.Fatalf("message leaked %q: %q", leaked, s)
		}
	}
}
