package minimax

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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

func TestConvertMiniMaxH3GenerationRequest(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}

	cases := []struct {
		name    string
		request dto.ImageRequest
		want    MiniMaxH3ImageRequest
	}{
		{
			name: "supported size is forwarded",
			request: dto.ImageRequest{
				Model:          "MiniMax-H3-Image",
				Prompt:         "a red fox in snowfall",
				Size:           "1536x1024",
				ResponseFormat: "b64_json",
				N:              uintPtr(2),
			},
			want: MiniMaxH3ImageRequest{
				Model:          "MiniMax-H3-Image",
				Prompt:         "a red fox in snowfall",
				N:              intPtr(2),
				Size:           "1536x1024",
				ResponseFormat: "b64_json",
			},
		},
		{
			name: "unsupported size degrades to aspect ratio and area",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				Size:   "512x512",
				N:      uintPtr(1),
			},
			want: MiniMaxH3ImageRequest{
				Model:       "MiniMax-H3-Image",
				Prompt:      "a red fox in snowfall",
				N:           intPtr(1),
				AspectRatio: "1:1",
				Area:        "1K",
			},
		},
		{
			name: "explicit size drops aspect ratio and area",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				Size:   "1024x1024",
				N:      uintPtr(1),
				Extra: map[string]json.RawMessage{
					"aspect_ratio": json.RawMessage(`"16:9"`),
					"area":         json.RawMessage(`"2K"`),
				},
			},
			want: MiniMaxH3ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				N:      intPtr(1),
				Size:   "1024x1024",
			},
		},
		{
			name: "aspect ratio and area are forwarded without size",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				N:      uintPtr(1),
				Extra: map[string]json.RawMessage{
					"aspect_ratio":            json.RawMessage(`"16:9"`),
					"area":                    json.RawMessage(`"2K"`),
					"disable_prompt_enhanced": json.RawMessage(`false`),
				},
			},
			want: MiniMaxH3ImageRequest{
				Model:                 "MiniMax-H3-Image",
				Prompt:                "a red fox in snowfall",
				N:                     intPtr(1),
				AspectRatio:           "16:9",
				Area:                  "2K",
				DisablePromptEnhanced: boolPtr(false),
			},
		},
		{
			name: "streaming is forwarded",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				N:      uintPtr(1),
				Stream: boolPtr(true),
			},
			want: MiniMaxH3ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				N:      intPtr(1),
				Stream: true,
			},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			got, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, testCase.request)
			require.NoError(t, err)
			assert.Equal(t, testCase.want, got)
		})
	}
}

func TestConvertMiniMaxH3GenerationRejectsInvalidParameters(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}

	cases := []struct {
		name    string
		request dto.ImageRequest
	}{
		{
			name: "n above the upstream limit",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				N:      uintPtr(11),
			},
		},
		{
			name: "blank prompt",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "   ",
				N:      uintPtr(1),
			},
		},
		{
			name: "unsupported response format",
			request: dto.ImageRequest{
				Model:          "MiniMax-H3-Image",
				Prompt:         "a red fox in snowfall",
				N:              uintPtr(1),
				ResponseFormat: "base64",
			},
		},
		{
			name: "aspect ratio outside the upstream limits",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "a red fox in snowfall",
				N:      uintPtr(1),
				Extra: map[string]json.RawMessage{
					"aspect_ratio": json.RawMessage(`"1:9"`),
				},
			},
		},
		{
			name: "streaming with a base64 response format",
			request: dto.ImageRequest{
				Model:          "MiniMax-H3-Image",
				Prompt:         "a red fox in snowfall",
				N:              uintPtr(1),
				Stream:         boolPtr(true),
				ResponseFormat: "b64_json",
			},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			_, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, testCase.request)
			require.Error(t, err)
			var apiErr *types.NewAPIError
			require.ErrorAs(t, err, &apiErr)
			assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
		})
	}
}

func TestConvertMiniMaxH3EditRequestFromJSON(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}

	cases := []struct {
		name    string
		request dto.ImageRequest
		want    []h3ImageRef
	}{
		{
			name: "image objects",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "replace image 1 with image 2",
				N:      uintPtr(1),
				Images: json.RawMessage(`[{"image_url":"https://example.com/cat.jpg"}]`),
			},
			want: []h3ImageRef{{ImageURL: "https://example.com/cat.jpg"}},
		},
		{
			name: "image array of urls",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "replace image 1 with image 2",
				N:      uintPtr(1),
				Image:  json.RawMessage(`["https://example.com/cat.jpg","https://example.com/dog.png"]`),
			},
			want: []h3ImageRef{
				{ImageURL: "https://example.com/cat.jpg"},
				{ImageURL: "https://example.com/dog.png"},
			},
		},
		{
			name: "single image url",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "replace image 1 with image 2",
				N:      uintPtr(1),
				Image:  json.RawMessage(`"https://example.com/cat.jpg"`),
			},
			want: []h3ImageRef{{ImageURL: "https://example.com/cat.jpg"}},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			got, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, testCase.request)
			require.NoError(t, err)
			body, ok := got.(MiniMaxH3ImageRequest)
			require.True(t, ok)
			assert.Equal(t, testCase.want, body.Images)
		})
	}
}

func TestConvertMiniMaxH3EditRequestRejectsUnsupportedInput(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}

	cases := []struct {
		name    string
		request dto.ImageRequest
	}{
		{
			name: "legacy model",
			request: dto.ImageRequest{
				Model:  "image-01",
				Prompt: "replace image 1 with image 2",
				N:      uintPtr(1),
				Image:  json.RawMessage(`"https://example.com/cat.jpg"`),
			},
		},
		{
			name: "missing reference image",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "replace image 1 with image 2",
				N:      uintPtr(1),
			},
		},
		{
			name: "unsupported reference image source",
			request: dto.ImageRequest{
				Model:  "MiniMax-H3-Image",
				Prompt: "replace image 1 with image 2",
				N:      uintPtr(1),
				Image:  json.RawMessage(`"ftp://example.com/cat.jpg"`),
			},
		},
		{
			name: "streaming with a base64 response format",
			request: dto.ImageRequest{
				Model:          "MiniMax-H3-Image",
				Prompt:         "replace image 1 with image 2",
				N:              uintPtr(1),
				Stream:         boolPtr(true),
				ResponseFormat: "b64_json",
				Image:          json.RawMessage(`"https://example.com/cat.jpg"`),
			},
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			_, err := adaptor.ConvertImageRequest(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), info, testCase.request)
			require.Error(t, err)
			var apiErr *types.NewAPIError
			require.ErrorAs(t, err, &apiErr)
			assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
		})
	}
}

func TestConvertMiniMaxH3EditRequestFromMultipart(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits}
	context := newMiniMaxMultipartContext(t,
		map[string]string{
			"model":           "MiniMax-H3-Image",
			"prompt":          "replace image 1 with image 2",
			"n":               "2",
			"aspect_ratio":    "16:9",
			"response_format": "url",
			"stream":          "true",
		},
		map[string][]string{"image[]": {"cat.jpg", "dog.png"}},
	)

	got, err := adaptor.ConvertImageRequest(context, info, dto.ImageRequest{
		Model:  "MiniMax-H3-Image",
		Prompt: "replace image 1 with image 2",
		N:      uintPtr(2),
	})
	require.NoError(t, err)
	body, ok := got.(*bytes.Buffer)
	require.True(t, ok)

	payload := body.String()
	assert.Contains(t, payload, `name="model"`)
	assert.Contains(t, payload, "MiniMax-H3-Image")
	assert.Contains(t, payload, `name="n"`)
	assert.Contains(t, payload, `name="aspect_ratio"`)
	assert.Contains(t, payload, "16:9")
	assert.Contains(t, payload, `name="stream"`)
	assert.Contains(t, payload, "true")
	assert.Contains(t, payload, `name="image[]"`)
	assert.Contains(t, payload, "cat.jpg")
	assert.Contains(t, payload, "dog.png")
	assert.True(t, strings.HasPrefix(context.Request.Header.Get("Content-Type"), "multipart/form-data"))
}

func TestMiniMaxH3ImageHandler(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	estimatedCount := 2
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
		TieredBillingSnapshot: &billingexpr.BillingSnapshot{
			BillingMode:         "tiered_expr",
			EstimatedImageCount: &estimatedCount,
		},
	}
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       ioNopCloser(`{"created":1792308678,"data":[{"url":"https://example.com/h3-image/output-0.jpg","size":"5440x3072"},{"error":{"code":"1027","message":"output image failed content safety check"}}],"output_format":"jpeg","usage":{"generated_images":1,"total_tokens":40225,"input_tokens":23905,"output_tokens":16320,"input_tokens_details":{"text_tokens":12093,"image_tokens":11812},"output_tokens_details":{"image_tokens":16320}}}`),
	}

	adaptor := &Adaptor{}
	usage, err := adaptor.DoResponse(c, resp, info)
	require.Nil(t, err)
	require.NotNil(t, usage)

	imageUsage, ok := usage.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 23905, imageUsage.PromptTokens)
	assert.Equal(t, 16320, imageUsage.CompletionTokens)
	assert.Equal(t, 11812, imageUsage.PromptTokensDetails.ImageTokens)
	assert.Equal(t, 12093, imageUsage.PromptTokensDetails.TextTokens)
	assert.Equal(t, 16320, imageUsage.CompletionTokenDetails.ImageTokens)
	require.NotNil(t, info.BillingImageCount)
	assert.Equal(t, 1, *info.BillingImageCount)
	assert.Contains(t, recorder.Body.String(), "https://example.com/h3-image/output-0.jpg")
}

func newMiniMaxMultipartContext(t *testing.T, fields map[string]string, files map[string][]string) *gin.Context {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	for key, value := range fields {
		require.NoError(t, writer.WriteField(key, value))
	}
	for field, names := range files {
		for _, name := range names {
			part, err := writer.CreateFormFile(field, name)
			require.NoError(t, err)
			_, err = part.Write([]byte("image-bytes"))
			require.NoError(t, err)
		}
	}
	require.NoError(t, writer.Close())

	form, err := multipart.NewReader(bytes.NewReader(body.Bytes()), writer.Boundary()).ReadForm(1 << 20)
	require.NoError(t, err)

	request := httptest.NewRequest(http.MethodPost, "/v1/images/edits", bytes.NewReader(body.Bytes()))
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.MultipartForm = form
	request.PostForm = url.Values(form.Value)

	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	context.Request = request
	return context
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

func intPtr(v int) *int {
	return &v
}

func boolPtr(v bool) *bool {
	return &v
}
