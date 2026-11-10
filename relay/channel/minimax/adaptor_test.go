package minimax

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"

	"github.com/gin-gonic/gin"
)

func TestGetRequestURLForImageGeneration(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.minimax.chat",
		},
	}

	got, err := GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}

	want := "https://api.minimax.chat/v1/image_generation"
	if got != want {
		t.Fatalf("GetRequestURL() = %q, want %q", got, want)
	}
}

func TestConvertImageRequest(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "image-01",
	}
	request := dto.ImageRequest{
		Model:          "image-01",
		Prompt:         "a red fox in snowfall",
		Size:           "1536x1024",
		ResponseFormat: "url",
		N:              uintPtr(2),
	}

	got, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}

	body, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}

	if payload["model"] != "image-01" {
		t.Fatalf("model = %#v, want %q", payload["model"], "image-01")
	}
	if payload["prompt"] != request.Prompt {
		t.Fatalf("prompt = %#v, want %q", payload["prompt"], request.Prompt)
	}
	if payload["n"] != float64(2) {
		t.Fatalf("n = %#v, want 2", payload["n"])
	}
	if payload["aspect_ratio"] != "3:2" {
		t.Fatalf("aspect_ratio = %#v, want %q", payload["aspect_ratio"], "3:2")
	}
	if payload["response_format"] != "url" {
		t.Fatalf("response_format = %#v, want %q", payload["response_format"], "url")
	}
}

func TestDoResponseForImageGeneration(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		StartTime: time.Unix(1700000000, 0),
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       httptest.NewRecorder().Result().Body,
	}
	resp.Body = ioNopCloser(`{"data":{"image_urls":["https://example.com/minimax.png"]}}`)

	adaptor := &Adaptor{}
	usage, err := adaptor.DoResponse(c, resp, info)
	if err != nil {
		t.Fatalf("DoResponse returned error: %v", err)
	}
	if usage == nil {
		t.Fatalf("DoResponse returned nil usage")
	}

	body := recorder.Body.String()
	if !strings.Contains(body, `"url":"https://example.com/minimax.png"`) {
		t.Fatalf("response body = %s, want OpenAI image response with image URL", body)
	}
	if strings.Contains(body, `"image_urls"`) {
		t.Fatalf("response body = %s, should not expose raw MiniMax image_urls payload", body)
	}
}

type nopReadCloser struct {
	*strings.Reader
}

func (n nopReadCloser) Close() error {
	return nil
}

func ioNopCloser(body string) nopReadCloser {
	return nopReadCloser{Reader: strings.NewReader(body)}
}

func uintPtr(v uint) *uint {
	return &v
}

func TestGetRequestURLForH3Image(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "MiniMax-H3-Image",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://api.minimax.io",
			UpstreamModelName: "MiniMax-H3-Image",
		},
	}

	got, err := GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}
	want := "https://api.minimax.io/v1/images/generations"
	if got != want {
		t.Fatalf("GetRequestURL() = %q, want %q", got, want)
	}

	info.RelayMode = relayconstant.RelayModeImagesEdits
	got, err = GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL(edits) returned error: %v", err)
	}
	want = "https://api.minimax.io/v1/images/edits"
	if got != want {
		t.Fatalf("GetRequestURL(edits) = %q, want %q", got, want)
	}
}

func TestConvertImageRequestH3Passthrough(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		OriginModelName: "MiniMax-H3-Image",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "MiniMax-H3-Image",
		},
	}
	aspect, err := json.Marshal("16:9")
	if err != nil {
		t.Fatalf("json.Marshal aspect: %v", err)
	}
	area, err := json.Marshal("1K")
	if err != nil {
		t.Fatalf("json.Marshal area: %v", err)
	}
	request := dto.ImageRequest{
		Model:  "MiniMax-H3-Image",
		Prompt: "a red fox in snowfall",
		Size:   "1024x1024",
		Extra: map[string]json.RawMessage{
			"aspect_ratio": aspect,
			"area":         area,
		},
	}

	got, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, request)
	if err != nil {
		t.Fatalf("ConvertImageRequest returned error: %v", err)
	}
	body, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("json.Marshal returned error: %v", err)
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if payload["model"] != "MiniMax-H3-Image" {
		t.Fatalf("model = %#v, want MiniMax-H3-Image", payload["model"])
	}
	if payload["prompt"] != request.Prompt {
		t.Fatalf("prompt = %#v, want %q", payload["prompt"], request.Prompt)
	}
	if payload["size"] != "1024x1024" {
		t.Fatalf("size = %#v, want 1024x1024", payload["size"])
	}
	if payload["aspect_ratio"] != "16:9" {
		t.Fatalf("aspect_ratio = %#v, want 16:9", payload["aspect_ratio"])
	}
	if payload["area"] != "1K" {
		t.Fatalf("area = %#v, want 1K", payload["area"])
	}
}
