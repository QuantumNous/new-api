package blockrun

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// Note on coverage: the DoRequest x402 two-trip flow (unsigned 402 → sign →
// signed retry, plus the retry-still-402 guard against fund-draining loops) is
// exercised by the gated live end-to-end test in x402_e2e_test.go. It needs the
// full channel.DoApiRequest plumbing (HeaderOverride, proxy, request-id, SSE
// keep-alive) and a real upstream that issues a 402, so it is intentionally NOT
// re-implemented here with elaborate HTTP mocking. The unit tests below cover
// the format-agnostic pieces DoRequest relies on (URL dispatch, header safety,
// signature injection, response dispatch) in isolation.

// fakeWalletKey is a syntactically plausible 0x-prefixed 64-hex EVM private key.
// It is deliberately a throwaway value used ONLY to assert that the key NEVER
// reaches an HTTP header (x-api-key / Authorization). It is not a real key.
const fakeWalletKey = "0x" +
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

// newTestContext builds a *gin.Context with a real inbound *http.Request so that
// SetupApiRequestHeader (which reads c.Request.Header) does not panic. Optional
// inbound headers can be supplied to exercise anthropic-version / anthropic-beta
// passthrough.
func newTestContext(method, path string, inboundHeaders map[string]string) *gin.Context {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(method, path, nil)
	for k, v := range inboundHeaders {
		c.Request.Header.Set(k, v)
	}
	return c
}

// ---------------------------------------------------------------------------
// B) Convert methods — native passthrough / unsupported.
// ---------------------------------------------------------------------------

// TestConvertClaudeRequest_Passthrough asserts the inbound Claude request is
// returned verbatim (same pointer): VIP native passthrough does NOT convert to
// OpenAI.
func TestConvertClaudeRequest_Passthrough(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	in := &dto.ClaudeRequest{Model: "anthropic/claude-haiku-4.5"}

	out, err := a.ConvertClaudeRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, ok := out.(*dto.ClaudeRequest)
	if !ok {
		t.Fatalf("expected *dto.ClaudeRequest, got %T", out)
	}
	if got != in {
		t.Fatalf("ConvertClaudeRequest must return the SAME request pointer (native passthrough); got %p want %p", got, in)
	}
}

// TestConvertClaudeRequest_NilRejected asserts a nil request is rejected rather
// than panicking.
func TestConvertClaudeRequest_NilRejected(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	if _, err := a.ConvertClaudeRequest(c, info, nil); err == nil {
		t.Fatalf("expected error for nil claude request, got nil")
	}
}

// TestConvertOpenAIRequest_Passthrough asserts the inbound OpenAI request is
// returned as-is (passthrough), so StreamOptions and every other field survive.
func TestConvertOpenAIRequest_Passthrough(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	in := &dto.GeneralOpenAIRequest{Model: "openai/gpt-5.4-nano"}

	out, err := a.ConvertOpenAIRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, ok := out.(*dto.GeneralOpenAIRequest)
	if !ok {
		t.Fatalf("expected *dto.GeneralOpenAIRequest, got %T", out)
	}
	if got != in {
		t.Fatalf("ConvertOpenAIRequest must return the SAME request pointer (passthrough); got %p want %p", got, in)
	}
}

// TestConvertOpenAIRequest_DropsParallelToolCallsWhenNoTools asserts that
// parallel_tool_calls is stripped when no tools are present, since the upstream
// rejects "'parallel_tool_calls' is only allowed when 'tools' are specified".
func TestConvertOpenAIRequest_DropsParallelToolCallsWhenNoTools(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}

	ptc := false
	in := &dto.GeneralOpenAIRequest{Model: "openai/gpt-4o-br", ParallelTooCalls: &ptc}

	out, err := a.ConvertOpenAIRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := out.(*dto.GeneralOpenAIRequest)
	if got.ParallelTooCalls != nil {
		t.Fatalf("parallel_tool_calls must be nil when no tools; got %v", *got.ParallelTooCalls)
	}
}

// TestConvertOpenAIRequest_KeepsParallelToolCallsWithTools asserts the field is
// preserved when tools are present (valid upstream combination).
func TestConvertOpenAIRequest_KeepsParallelToolCallsWithTools(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}

	ptc := false
	in := &dto.GeneralOpenAIRequest{
		Model:            "openai/gpt-4o-br",
		ParallelTooCalls: &ptc,
		Tools:            []dto.ToolCallRequest{{Type: "function"}},
	}

	out, err := a.ConvertOpenAIRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := out.(*dto.GeneralOpenAIRequest)
	if got.ParallelTooCalls == nil || *got.ParallelTooCalls != false {
		t.Fatalf("parallel_tool_calls must be preserved when tools present; got %v", got.ParallelTooCalls)
	}
}

// TestConvertOpenAIRequest_NilRejected asserts a nil request is rejected.
func TestConvertOpenAIRequest_NilRejected(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}
	if _, err := a.ConvertOpenAIRequest(c, info, nil); err == nil {
		t.Fatalf("expected error for nil openai request, got nil")
	}
}

// TestConvertOpenAIResponsesRequest_BridgesToChat asserts the inbound Responses
// request is converted to Chat Completions because BlockRun does not expose a
// native /v1/responses endpoint today.
func TestConvertOpenAIResponsesRequest_BridgesToChat(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	stream := true
	instructions, _ := common.Marshal("be brief")
	input, _ := common.Marshal("hello")
	in := dto.OpenAIResponsesRequest{
		Model:         "openai/gpt-5.4",
		Instructions:  instructions,
		Input:         input,
		Stream:        &stream,
		StreamOptions: &dto.StreamOptions{IncludeUsage: true},
	}

	out, err := a.ConvertOpenAIResponsesRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, ok := out.(*apicompat.ChatCompletionsRequest)
	if !ok {
		t.Fatalf("expected *apicompat.ChatCompletionsRequest, got %T", out)
	}
	if got.Model != in.Model {
		t.Fatalf("model not preserved: got %q want %q", got.Model, in.Model)
	}
	if len(got.Messages) != 2 {
		t.Fatalf("expected system + user messages, got %#v", got.Messages)
	}
	if !got.Stream {
		t.Fatalf("stream flag not preserved")
	}
	if got.StreamOptions == nil || !got.StreamOptions.IncludeUsage {
		t.Fatalf("stream_options.include_usage not preserved: %#v", got.StreamOptions)
	}
}

func TestConvertOpenAIResponsesRequest_MissingModelRejected(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/responses", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAI,
	}

	if _, err := a.ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{}); err == nil {
		t.Fatalf("expected error for missing responses model, got nil")
	}
}

func TestBlockRunChatJSONToResponses(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	body := `{
		"id":"chatcmpl-test",
		"object":"chat.completion",
		"created":1782969000,
		"model":"openai/gpt-5.4",
		"choices":[{"index":0,"message":{"role":"assistant","content":"pong"},"finish_reason":"stop"}],
		"usage":{"prompt_tokens":3,"completion_tokens":4,"total_tokens":7}
	}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "openai/gpt-5.4",
		},
	}

	usageAny, apiErr := blockRunChatJSONToResponses(c, resp, info)
	if apiErr != nil {
		t.Fatalf("unexpected api error: %v", apiErr)
	}
	usage := usageAny.(*dto.Usage)
	if usage.TotalTokens != 7 {
		t.Fatalf("usage not converted: %#v", usage)
	}

	var got apicompat.ResponsesResponse
	if err := common.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("response body is not JSON: %v\n%s", err, rec.Body.String())
	}
	if got.ID != "chatcmpl-test" || got.Object != "response" || got.Status != "completed" {
		t.Fatalf("unexpected responses envelope: %#v", got)
	}
	if len(got.Output) != 1 || len(got.Output[0].Content) != 1 || got.Output[0].Content[0].Text != "pong" {
		t.Fatalf("unexpected responses output: %#v", got.Output)
	}
}

// TestConvertGeminiRequest_Unsupported asserts Gemini inbound is rejected with a
// non-nil error (VIP native passthrough supports only Anthropic and OpenAI).
func TestConvertGeminiRequest_Unsupported(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1beta/models/gemini-pro:generateContent", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatGemini}
	out, err := a.ConvertGeminiRequest(c, info, &dto.GeminiChatRequest{})
	if err == nil {
		t.Fatalf("expected error for gemini request, got nil")
	}
	if out != nil {
		t.Fatalf("expected nil result on unsupported gemini request, got %v", out)
	}
}

// TestConvertImageRequest_GenerationsPassthrough asserts text-to-image
// (RelayModeImagesGenerations) is an OpenAI-compatible JSON passthrough: the
// request is returned for marshalling to BlockRun's /v1/images/generations.
func TestConvertImageRequest_GenerationsPassthrough(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesGenerations,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	in := dto.ImageRequest{Model: "openai/gpt-image-2", Prompt: "a cat"}

	out, err := a.ConvertImageRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out == nil {
		t.Fatalf("expected non-nil converted request")
	}
}

// TestConvertImageRequest_MissingModelRejected asserts a request without a model
// is rejected (BlockRun image endpoints require an explicit model ID).
func TestConvertImageRequest_MissingModelRejected(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/images/generations", nil)
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesGenerations,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	if _, err := a.ConvertImageRequest(c, info, dto.ImageRequest{Prompt: "x"}); err == nil {
		t.Fatalf("expected error for missing model, got nil")
	}
}

// ---------------------------------------------------------------------------
// Multipart edit helpers
// ---------------------------------------------------------------------------

// newMultipartEditContext builds a *gin.Context whose Request is a
// multipart/form-data POST carrying text fields (fields), one or more binary
// image files (images, posted as "image" / "image[]"), and an optional mask
// file. model and prompt are always injected as text fields.
func newMultipartEditContext(t *testing.T, model, prompt string, extraFields map[string]string, images [][]byte, mask []byte) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)

	// Text fields.
	_ = mw.WriteField("model", model)
	_ = mw.WriteField("prompt", prompt)
	for k, v := range extraFields {
		_ = mw.WriteField(k, v)
	}

	// Image file(s): single → "image", multiple → "image[]".
	imageField := "image"
	if len(images) > 1 {
		imageField = "image[]"
	}
	for i, data := range images {
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", `form-data; name="`+imageField+`"; filename="img`+strings.Repeat("x", i)+`.png"`)
		h.Set("Content-Type", "image/png")
		pw, _ := mw.CreatePart(h)
		_, _ = pw.Write(data)
	}

	// Mask file (optional).
	if len(mask) > 0 {
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", `form-data; name="mask"; filename="mask.png"`)
		h.Set("Content-Type", "image/png")
		pw, _ := mw.CreatePart(h)
		_, _ = pw.Write(mask)
	}
	_ = mw.Close()

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	req := httptest.NewRequest(http.MethodPost, "/v1/images/edits", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	c.Request = req
	return c
}

// editInfo returns a RelayInfo for the edits relay mode.
func editInfo() *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesEdits,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
}

// pngBytes returns a minimal 1-byte payload used as fake PNG data in tests.
func pngBytes(seed byte) []byte { return []byte{seed} }

// TestConvertImageRequest_EditNumericFieldsTyped asserts n is forwarded upstream
// as a JSON number and watermark as a bool — sourced from the typed request
// fields (parsed in valid_request.go), NOT the stringified multipart values. A
// raw form passthrough would send "n":"9" and break the upstream wire contract.
func TestConvertImageRequest_EditNumericFieldsTyped(t *testing.T) {
	c := newMultipartEditContext(t, "openai/gpt-image-2", "edit it",
		map[string]string{"n": "9", "watermark": "false"}, // raw form values must be ignored
		[][]byte{pngBytes(1)}, nil)
	n := uint(2)
	wm := true
	out, err := (&Adaptor{}).ConvertImageRequest(c, editInfo(),
		dto.ImageRequest{Model: "openai/gpt-image-2", Prompt: "edit it", N: &n, Watermark: &wm})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	body := out.(map[string]any)
	if v, ok := body["n"].(uint); !ok || v != 2 {
		t.Fatalf("n must be the typed uint 2 (a JSON number), got %T %v", body["n"], body["n"])
	}
	if v, ok := body["watermark"].(bool); !ok || !v {
		t.Fatalf("watermark must be the typed bool true, got %T %v", body["watermark"], body["watermark"])
	}
}

// ---------------------------------------------------------------------------
// Edit tests — multipart/form-data (standard OpenAI interface)
// ---------------------------------------------------------------------------

// TestConvertImageRequest_EditSingleImage asserts img2img with a single source
// image file produces body["image"] as a single base64 data URI string, and
// that extra text fields (quality, size, response_format) survive into the body.
func TestConvertImageRequest_EditSingleImage(t *testing.T) {
	c := newMultipartEditContext(t, "openai/gpt-image-2", "make the sky purple",
		map[string]string{"quality": "hd", "size": "1024x1024", "response_format": "b64_json"},
		[][]byte{pngBytes(1)}, nil)
	info := editInfo()

	out, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{Model: "openai/gpt-image-2", Prompt: "make the sky purple"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	body, ok := out.(map[string]any)
	if !ok {
		t.Fatalf("expected map[string]any body, got %T", out)
	}
	// Single image must be a string (data URI), not an array.
	imgVal, hasImg := body["image"]
	if !hasImg {
		t.Fatalf("body missing 'image' key: %v", body)
	}
	if _, isStr := imgVal.(string); !isStr {
		t.Fatalf("single image must be a string data URI, got %T", imgVal)
	}
	if s := imgVal.(string); !strings.HasPrefix(s, "data:") {
		t.Fatalf("image must be a data URI, got %q", s)
	}
	// Text fields must survive.
	if body["quality"] != "hd" {
		t.Fatalf("quality not forwarded: %v", body["quality"])
	}
	if body["size"] != "1024x1024" {
		t.Fatalf("size not forwarded: %v", body["size"])
	}
	if body["response_format"] != "b64_json" {
		t.Fatalf("response_format not forwarded: %v", body["response_format"])
	}
	if body["model"] != "openai/gpt-image-2" {
		t.Fatalf("model not forwarded: %v", body["model"])
	}
}

// TestConvertImageRequest_EditMultiImageFusion asserts that posting two image[]
// files produces body["image"] as a []string array (BlockRun multi-image fusion).
func TestConvertImageRequest_EditMultiImageFusion(t *testing.T) {
	c := newMultipartEditContext(t, "google/nano-banana", "place the logo on the shirt",
		nil, [][]byte{pngBytes(1), pngBytes(2)}, nil)
	info := editInfo()

	out, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{Model: "google/nano-banana"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	body := out.(map[string]any)
	imgVal := body["image"]
	arr, isArr := imgVal.([]string)
	if !isArr {
		t.Fatalf("multi-image must produce []string array, got %T", imgVal)
	}
	if len(arr) != 2 {
		t.Fatalf("expected 2 images, got %d", len(arr))
	}
	for i, s := range arr {
		if !strings.HasPrefix(s, "data:") {
			t.Fatalf("image[%d] must be a data URI, got %q", i, s)
		}
	}
}

// TestConvertImageRequest_EditMaskWithMultiImageRejected asserts the BlockRun
// constraint that `mask` cannot be combined with multiple source images.
func TestConvertImageRequest_EditMaskWithMultiImageRejected(t *testing.T) {
	c := newMultipartEditContext(t, "openai/gpt-image-2", "edit",
		nil, [][]byte{pngBytes(1), pngBytes(2)}, pngBytes(3))
	info := editInfo()

	_, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{Model: "openai/gpt-image-2"})
	if err == nil {
		t.Fatalf("expected error: mask cannot combine with multiple images")
	}
	if !strings.Contains(err.Error(), "mask") {
		t.Fatalf("error should mention mask, got %v", err)
	}
}

// TestConvertImageRequest_EditMissingImageRejected asserts an edit request with
// no image file at all is rejected (no multipart form / no file field).
func TestConvertImageRequest_EditMissingImageRejected(t *testing.T) {
	// No images slice → context has no "image" file field.
	c := newMultipartEditContext(t, "openai/gpt-image-2", "edit", nil, nil, nil)
	info := editInfo()

	_, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{Model: "openai/gpt-image-2"})
	if err == nil {
		t.Fatalf("expected error for missing source image, got nil")
	}
	if !strings.Contains(err.Error(), "image") {
		t.Fatalf("error should mention image requirement, got %v", err)
	}
}

// TestConvertImageRequest_EditNoFileRejected asserts that sending no image file
// (equivalent to old JSON-null / empty-string image) is rejected. In multipart,
// both cases reduce to "no image file present".
func TestConvertImageRequest_EditNoFileRejected(t *testing.T) {
	// Plain JSON body (no multipart) — simulates a client that forgot to use
	// multipart. The adaptor must reject it as "no image file".
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits",
		strings.NewReader(`{"model":"openai/gpt-image-2","prompt":"edit"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	_, err := (&Adaptor{}).ConvertImageRequest(c, editInfo(), dto.ImageRequest{Model: "openai/gpt-image-2"})
	if err == nil {
		t.Fatalf("expected error for non-multipart request (no image file), got nil")
	}
}

// TestConvertImageRequest_EditMaskNullWithArrayAllowed asserts that sending
// multiple image files but no mask file is allowed (maskless fusion).
func TestConvertImageRequest_EditMaskNullWithArrayAllowed(t *testing.T) {
	c := newMultipartEditContext(t, "google/nano-banana", "fuse",
		nil, [][]byte{pngBytes(1), pngBytes(2)}, nil)
	info := editInfo()

	if _, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{Model: "google/nano-banana"}); err != nil {
		t.Fatalf("maskless multi-image fusion must be allowed, got %v", err)
	}
}

// TestConvertImageRequest_EditMaskWithSingleImageAllowed asserts that a single
// image + mask combination is accepted (the constraint only blocks mask+multi).
func TestConvertImageRequest_EditMaskWithSingleImageAllowed(t *testing.T) {
	c := newMultipartEditContext(t, "openai/gpt-image-2", "edit with mask",
		nil, [][]byte{pngBytes(1)}, pngBytes(2))
	info := editInfo()

	out, err := (&Adaptor{}).ConvertImageRequest(c, info, dto.ImageRequest{Model: "openai/gpt-image-2"})
	if err != nil {
		t.Fatalf("single image + mask must be allowed, got %v", err)
	}
	body := out.(map[string]any)
	if _, hasMask := body["mask"]; !hasMask {
		t.Fatalf("mask must be present in body: %v", body)
	}
	if _, hasImg := body["image"]; !hasImg {
		t.Fatalf("image must be present in body: %v", body)
	}
}

// TestConvertImageRequest_EditTooManyImagesRejected asserts the per-request
// source-image count cap (maxImageEditImages): more than the cap is rejected with
// a clear client error rather than silently fusing dozens of images.
func TestConvertImageRequest_EditTooManyImagesRejected(t *testing.T) {
	imgs := make([][]byte, maxImageEditImages+1)
	for i := range imgs {
		imgs[i] = pngBytes(byte(i))
	}
	c := newMultipartEditContext(t, "openai/gpt-image-2", "edit", nil, imgs, nil)

	_, err := (&Adaptor{}).ConvertImageRequest(c, editInfo(), dto.ImageRequest{Model: "openai/gpt-image-2"})
	if err == nil {
		t.Fatalf("expected rejection for more than %d source images", maxImageEditImages)
	}
	if !strings.Contains(err.Error(), "at most") {
		t.Fatalf("error should mention the cap, got %v", err)
	}
}

// TestCollectMultipartFiles_NumericBracketOrder asserts that image[N] indexed
// fields are ordered by NUMERIC index, so image[10] follows image[2]. A plain
// string sort would put image[10] before image[2] and scramble fusion order.
func TestCollectMultipartFiles_NumericBracketOrder(t *testing.T) {
	mf := &multipart.Form{File: map[string][]*multipart.FileHeader{
		"image[10]": {{Filename: "ten"}},
		"image[2]":  {{Filename: "two"}},
		"image[0]":  {{Filename: "zero"}},
	}}
	out := collectMultipartFiles(mf, "image")
	var got []string
	for _, fh := range out {
		got = append(got, fh.Filename)
	}
	want := "zero,two,ten"
	if strings.Join(got, ",") != want {
		t.Fatalf("numeric bracket order expected [%s], got %v", want, got)
	}
}

// TestCollectMultipartFiles_PlainBeforeBracketAndNonNumericLast locks the overall
// ordering contract: bare `image`, then `image[]`, then numeric `image[N]`, then
// any non-numeric bracket name (stable lexicographic) last.
func TestCollectMultipartFiles_PlainBeforeBracketAndNonNumericLast(t *testing.T) {
	mf := &multipart.Form{File: map[string][]*multipart.FileHeader{
		"image":    {{Filename: "plain"}},
		"image[]":  {{Filename: "arr"}},
		"image[1]": {{Filename: "one"}},
		"image[x]": {{Filename: "nonnum"}},
	}}
	out := collectMultipartFiles(mf, "image")
	var got []string
	for _, fh := range out {
		got = append(got, fh.Filename)
	}
	want := "plain,arr,one,nonnum"
	if strings.Join(got, ",") != want {
		t.Fatalf("ordering expected [%s], got %v", want, got)
	}
}

// TestSetupRequestHeader_ImageForcesJSON asserts that for image relay modes the
// outbound Content-Type is forced to application/json — the edits body is always
// JSON, so a multipart inbound Content-Type must NOT be copied through verbatim.
func TestSetupRequestHeader_ImageForcesJSON(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/images/edits", map[string]string{
		"Content-Type": "multipart/form-data; boundary=xyz",
	})
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeImagesEdits,
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	h := http.Header{}
	if err := a.SetupRequestHeader(c, &h, info); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := h.Get("Content-Type"); got != "application/json" {
		t.Fatalf("image edits outbound Content-Type = %q, want application/json", got)
	}
}

// ---------------------------------------------------------------------------
// C) SetupRequestHeader — SECURITY: wallet private key must NEVER hit a header.
// ---------------------------------------------------------------------------

// headerForbidden is the set of header keys that must NEVER appear after
// SetupRequestHeader, because info.ApiKey is the EVM wallet private key for this
// channel. http.Header.Get is case-insensitive (canonicalised), so we probe the
// canonical forms; we ALSO walk every raw key to be defensive against any
// non-canonical insertion.
var headerForbidden = []string{"X-Api-Key", "Authorization"}

// assertNoCredentialHeaders fails if any credential-bearing header is present
// (non-empty) in h. Checks both canonical Get and a raw key walk.
func assertNoCredentialHeaders(t *testing.T, h http.Header) {
	t.Helper()
	for _, k := range headerForbidden {
		if v := h.Get(k); v != "" {
			t.Fatalf("SECURITY: header %q must be empty/absent, got %q", k, v)
		}
	}
	// Defensive: walk every raw key in case something inserted a non-canonical
	// variant that Get would miss.
	for k, vs := range h {
		lower := http.CanonicalHeaderKey(k)
		if lower == "X-Api-Key" || lower == "Authorization" {
			t.Fatalf("SECURITY: forbidden credential header %q present with values %v", k, vs)
		}
	}
}

// TestSetupRequestHeader_NoWalletKeyLeak is the most important test: regardless
// of inbound format, the wallet private key in info.ApiKey must NOT be written
// to x-api-key or Authorization (the claude/openai adaptors would set those by
// default — this adaptor must not).
//
// It ALSO covers the inbound-credential-stripping case: a client that supplies
// its own Authorization / x-api-key must NOT have those forwarded upstream —
// authentication is the EIP-712 x402 signature only, never a passed-through
// secret. We set dummy inbound credentials and assert the outbound header still
// carries neither, for both Claude and OpenAI formats.
func TestSetupRequestHeader_NoWalletKeyLeak(t *testing.T) {
	cases := []struct {
		name        string
		relayFormat types.RelayFormat
		path        string
	}{
		{"claude format", types.RelayFormatClaude, "/v1/messages"},
		{"openai format", types.RelayFormatOpenAI, "/v1/chat/completions"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := &Adaptor{}
			c := newTestContext(http.MethodPost, tc.path, map[string]string{
				"Content-Type": "application/json",
				// Client-supplied credentials that must be stripped, not forwarded.
				"Authorization": "Bearer client-supplied-token",
				"x-api-key":     "client-supplied-key",
			})
			info := &relaycommon.RelayInfo{
				RelayMode:   0, // RelayModeUnknown → standard content-type path in SetupApiRequestHeader
				RelayFormat: tc.relayFormat,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: "https://blockrun.ai/api",
					ApiKey:         fakeWalletKey, // the wallet PRIVATE KEY
				},
			}

			req := &http.Header{}
			if err := a.SetupRequestHeader(c, req, info); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assertNoCredentialHeaders(t, *req)

			// Sanity: the wallet key must not appear anywhere in any header value.
			for k, vs := range *req {
				for _, v := range vs {
					if v == fakeWalletKey {
						t.Fatalf("SECURITY: wallet key leaked into header %q", k)
					}
				}
			}

			// Content-Type should still be propagated from the inbound request.
			if got := req.Get("Content-Type"); got != "application/json" {
				t.Fatalf("expected Content-Type application/json, got %q", got)
			}
		})
	}
}

// TestSetupRequestHeader_ClaudeAnthropicVersionDefault asserts that on the Claude
// leg, anthropic-version is set to the default when the client sent none, and is
// passed through unchanged when the client did send one.
func TestSetupRequestHeader_ClaudeAnthropicVersionDefault(t *testing.T) {
	t.Run("default when client sent none", func(t *testing.T) {
		a := &Adaptor{}
		c := newTestContext(http.MethodPost, "/v1/messages", map[string]string{
			"Content-Type": "application/json",
		})
		info := &relaycommon.RelayInfo{
			RelayFormat: types.RelayFormatClaude,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelBaseUrl: "https://blockrun.ai/api",
				ApiKey:         fakeWalletKey,
			},
		}
		req := &http.Header{}
		if err := a.SetupRequestHeader(c, req, info); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got := req.Get("anthropic-version"); got != defaultAnthropicVersion {
			t.Fatalf("expected default anthropic-version %q, got %q", defaultAnthropicVersion, got)
		}
		// anthropic-beta must be absent when the client did not send it.
		if got := req.Get("anthropic-beta"); got != "" {
			t.Fatalf("expected no anthropic-beta header, got %q", got)
		}
		assertNoCredentialHeaders(t, *req)
	})

	t.Run("passthrough client-supplied version and beta", func(t *testing.T) {
		a := &Adaptor{}
		c := newTestContext(http.MethodPost, "/v1/messages", map[string]string{
			"Content-Type":      "application/json",
			"anthropic-version": "2024-10-22",
			"anthropic-beta":    "prompt-caching-2024-07-31",
		})
		info := &relaycommon.RelayInfo{
			RelayFormat: types.RelayFormatClaude,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelBaseUrl: "https://blockrun.ai/api",
				ApiKey:         fakeWalletKey,
			},
		}
		req := &http.Header{}
		if err := a.SetupRequestHeader(c, req, info); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got := req.Get("anthropic-version"); got != "2024-10-22" {
			t.Fatalf("expected client anthropic-version 2024-10-22, got %q", got)
		}
		if got := req.Get("anthropic-beta"); got != "prompt-caching-2024-07-31" {
			t.Fatalf("expected client anthropic-beta passthrough, got %q", got)
		}
		assertNoCredentialHeaders(t, *req)
	})
}

// TestSetupRequestHeader_OpenAINoAnthropicVersion asserts the OpenAI leg does NOT
// inject any Anthropic-specific headers (anthropic-version / anthropic-beta are
// Claude-only).
func TestSetupRequestHeader_OpenAINoAnthropicVersion(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", map[string]string{
		"Content-Type": "application/json",
	})
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://blockrun.ai/api",
			ApiKey:         fakeWalletKey,
		},
	}
	req := &http.Header{}
	if err := a.SetupRequestHeader(c, req, info); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := req.Get("anthropic-version"); got != "" {
		t.Fatalf("openai leg must not set anthropic-version, got %q", got)
	}
	if got := req.Get("anthropic-beta"); got != "" {
		t.Fatalf("openai leg must not set anthropic-beta, got %q", got)
	}
	assertNoCredentialHeaders(t, *req)
}

// TestSetupRequestHeader_PaymentSignatureInjection asserts that the
// PAYMENT-SIGNATURE header is injected only when DoRequest stashed a signature
// in the gin context (the signed retry leg), and is absent on the first leg.
//
// Parameterized over BOTH RelayFormatClaude and RelayFormatOpenAI to document
// the format-agnostic guarantee: the x402 signature lifecycle is identical for
// the /v1/messages and /v1/chat/completions legs.
func TestSetupRequestHeader_PaymentSignatureInjection(t *testing.T) {
	makeInfo := func(format types.RelayFormat) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			RelayFormat: format,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelBaseUrl: "https://blockrun.ai/api",
				ApiKey:         fakeWalletKey,
			},
		}
	}

	formats := []struct {
		name        string
		relayFormat types.RelayFormat
		path        string
	}{
		{"claude format", types.RelayFormatClaude, "/v1/messages"},
		{"openai format", types.RelayFormatOpenAI, "/v1/chat/completions"},
	}

	for _, f := range formats {
		t.Run(f.name, func(t *testing.T) {
			t.Run("absent on first (unsigned) leg", func(t *testing.T) {
				a := &Adaptor{}
				c := newTestContext(http.MethodPost, f.path, map[string]string{
					"Content-Type": "application/json",
				})
				req := &http.Header{}
				if err := a.SetupRequestHeader(c, req, makeInfo(f.relayFormat)); err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if got := req.Get(headerPaymentSignature); got != "" {
					t.Fatalf("expected no PAYMENT-SIGNATURE on first leg, got %q", got)
				}
			})

			t.Run("injected on signed retry leg", func(t *testing.T) {
				a := &Adaptor{}
				c := newTestContext(http.MethodPost, f.path, map[string]string{
					"Content-Type": "application/json",
				})
				const sig = "eyJzaWduYXR1cmUiOiJmYWtlIn0=" // arbitrary base64 stand-in
				c.Set(ctxKeyPaymentSignature, sig)

				req := &http.Header{}
				if err := a.SetupRequestHeader(c, req, makeInfo(f.relayFormat)); err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if got := req.Get(headerPaymentSignature); got != sig {
					t.Fatalf("expected PAYMENT-SIGNATURE %q on signed retry, got %q", sig, got)
				}
				// Even with a signature present, credentials must still be absent.
				assertNoCredentialHeaders(t, *req)
			})
		})
	}
}

// ---------------------------------------------------------------------------
// D) DoResponse — dispatch by RelayFormat to the correct NATIVE handler.
// ---------------------------------------------------------------------------

// dispatchProbeBody is a single non-stream JSON body crafted to be parseable by
// BOTH native handlers, but to yield DISTINGUISHABLE usage depending on which
// one ran:
//
//   - openai.OpenaiHandler unmarshals dto.OpenAITextResponse and reports
//     usage.prompt_tokens (11) as PromptTokens; it never sets UsageSemantic.
//   - claude.ClaudeHandler unmarshals dto.ClaudeResponse and maps
//     usage.input_tokens (33) to PromptTokens AND tags UsageSemantic="anthropic".
//
// The two token sets differ (11/22 vs 33/44) precisely so the returned usage
// proves the Claude branch is taken ONLY for RelayFormatClaude and the OpenAI
// branch for every other format — without weakening any assertion.
const dispatchProbeBody = `{
  "id": "probe-1",
  "type": "message",
  "role": "assistant",
  "model": "probe-model",
  "object": "chat.completion",
  "content": [{"type": "text", "text": "hi"}],
  "choices": [{"index": 0, "message": {"role": "assistant", "content": "hi"}, "finish_reason": "stop"}],
  "usage": {
    "prompt_tokens": 11, "completion_tokens": 22,
    "input_tokens": 33, "output_tokens": 44
  }
}`

// newProbeResponse builds a minimal non-stream *http.Response over the probe
// body. A non-nil Header is required because the handlers copy upstream headers
// to the client writer via service.IOCopyBytesGracefully.
func newProbeResponse() *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(dispatchProbeBody)),
	}
}

// TestDoResponse_DispatchByRelayFormat asserts DoResponse routes to the native
// handler selected purely by info.RelayFormat: RelayFormatClaude reaches the
// claude handler, every other format reaches the openai handler. We assert the
// observable difference in the returned *dto.Usage (token mapping + the
// anthropic UsageSemantic tag that only the Claude handler sets).
func TestDoResponse_DispatchByRelayFormat(t *testing.T) {
	cases := []struct {
		name              string
		relayFormat       types.RelayFormat
		path              string
		wantPromptTokens  int
		wantUsageSemantic string // claude handler tags "anthropic"; openai leaves ""
	}{
		{
			name:              "claude format → native claude handler",
			relayFormat:       types.RelayFormatClaude,
			path:              "/v1/messages",
			wantPromptTokens:  33, // input_tokens
			wantUsageSemantic: "anthropic",
		},
		{
			name:              "openai format → native openai handler",
			relayFormat:       types.RelayFormatOpenAI,
			path:              "/v1/chat/completions",
			wantPromptTokens:  11, // prompt_tokens
			wantUsageSemantic: "",
		},
		{
			name:              "default (empty) format → native openai handler",
			relayFormat:       "",
			path:              "/v1/chat/completions",
			wantPromptTokens:  11, // prompt_tokens
			wantUsageSemantic: "",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := &Adaptor{}
			c := newTestContext(http.MethodPost, tc.path, nil)
			info := &relaycommon.RelayInfo{
				RelayMode:   0, // default branch in openai.DoResponse → OpenaiHandler (non-stream)
				IsStream:    false,
				RelayFormat: tc.relayFormat,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    "https://blockrun.ai/api",
					UpstreamModelName: "probe-model",
				},
			}

			usage, apiErr := a.DoResponse(c, newProbeResponse(), info)
			if apiErr != nil {
				t.Fatalf("unexpected DoResponse error: %v", apiErr)
			}
			u, ok := usage.(*dto.Usage)
			if !ok {
				t.Fatalf("expected *dto.Usage, got %T", usage)
			}
			if u.PromptTokens != tc.wantPromptTokens {
				t.Fatalf("wrong handler dispatched: PromptTokens=%d want %d (claude reads input_tokens=33, openai reads prompt_tokens=11)",
					u.PromptTokens, tc.wantPromptTokens)
			}
			if u.UsageSemantic != tc.wantUsageSemantic {
				t.Fatalf("UsageSemantic=%q want %q — only the claude handler tags \"anthropic\"; this proves the Claude branch is taken iff RelayFormatClaude",
					u.UsageSemantic, tc.wantUsageSemantic)
			}
		})
	}
}
