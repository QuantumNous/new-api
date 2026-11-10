package minimax

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
	"io"
	"mime/multipart"
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

func TestH3ImageRoutesAndJSONFields(t *testing.T) {
	for _, model := range []string{"MiniMax-H3-Image", "MiniMax-H3-Image-Highspeed"} {
		for _, mode := range []int{relayconstant.RelayModeImagesGenerations, relayconstant.RelayModeImagesEdits} {
			t.Run(fmt.Sprintf("%s/%d", model, mode), func(t *testing.T) {
				info := &relaycommon.RelayInfo{OriginModelName: "public-alias", RelayMode: mode,
					ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://api.minimax.cn/v1/", UpstreamModelName: model}}
				path := "/v1/images/generations"
				if mode == relayconstant.RelayModeImagesEdits {
					path = "/v1/images/edits"
				}
				u, err := GetRequestURL(info)
				require.NoError(t, err)
				assert.Equal(t, "https://api.minimax.cn"+path, u)
				body := `{"model":"` + model + `","prompt":"synthetic image","n":2,"size":"auto","area":"2K","aspect_ratio":"16:9","disable_prompt_enhanced":false,"aigc_watermark":false,"stream":false,"output_format":"webp","output_compression":0,"response_format":"b64_json","images":[{"image_url":"mm_file://test"}],"unknown_vendor_field":123}`
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
				c.Request.Header.Set("Content-Type", "application/json")
				t.Cleanup(func() { common.CleanupBodyStorage(c) })
				req, err := helper.GetAndValidOpenAIImageRequest(c, mode)
				require.NoError(t, err)
				req, err = common.DeepCopy(req)
				require.NoError(t, err)
				converted, err := (&Adaptor{}).ConvertImageRequest(c, info, *req)
				require.NoError(t, err)
				wire, err := common.Marshal(converted)
				require.NoError(t, err)
				for _, field := range []string{"model", "prompt", "n", "size", "area", "aspect_ratio", "disable_prompt_enhanced", "aigc_watermark", "stream", "output_format", "output_compression", "response_format", "images"} {
					assert.Equal(t, gjson.Get(body, field).Raw, gjson.GetBytes(wire, field).Raw, field)
				}
				assert.False(t, gjson.GetBytes(wire, "unknown_vendor_field").Exists())
			})
		}
	}
}

func TestH3MultipartEditHTTP(t *testing.T) {
	service.InitHttpClient()
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	for field, value := range map[string]string{"model": "alias", "prompt": "combine", "stream": "false", "n": "2", "area": "2K", "aspect_ratio": "3:2", "output_compression": "0", "aigc_watermark": "false"} {
		require.NoError(t, w.WriteField(field, value))
	}
	for _, data := range []string{"first image", "second image"} {
		part, err := w.CreateFormFile("image[]", "input.png")
		require.NoError(t, err)
		_, err = io.WriteString(part, data)
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())
	type received struct {
		path, auth, model, area, compression, watermark string
		images                                          []string
		err                                             error
	}
	got := make(chan received, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		result := received{path: r.URL.Path, auth: r.Header.Get("Authorization")}
		result.err = r.ParseMultipartForm(1 << 20)
		if result.err == nil {
			defer r.MultipartForm.RemoveAll()
			result.model, result.area, result.compression, result.watermark = r.FormValue("model"), r.FormValue("area"), r.FormValue("output_compression"), r.FormValue("aigc_watermark")
			for _, part := range r.MultipartForm.File["image[]"] {
				f, err := part.Open()
				if err != nil {
					result.err = err
					break
				}
				data, err := io.ReadAll(f)
				f.Close()
				result.err = err
				result.images = append(result.images, string(data))
			}
		}
		got <- result
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{}`)
	}))
	defer server.Close()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/edits", &body)
	c.Request.Header.Set("Content-Type", w.FormDataContentType())
	t.Cleanup(func() { common.CleanupBodyStorage(c) })
	req, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesEdits)
	require.NoError(t, err)
	req.Model = "MiniMax-H3-Image-Highspeed"
	info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesEdits, OriginModelName: "alias", ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: server.URL, UpstreamModelName: req.Model, ApiKey: "synthetic-key"}}
	a := &Adaptor{}
	converted, err := a.ConvertImageRequest(c, info, *req)
	require.NoError(t, err)
	resp, err := a.DoRequest(c, info, converted.(io.Reader))
	require.NoError(t, err)
	resp.(*http.Response).Body.Close()
	result := <-got
	require.NoError(t, result.err)
	assert.Equal(t, "/v1/images/edits", result.path)
	assert.Equal(t, "Bearer synthetic-key", result.auth)
	assert.Equal(t, req.Model, result.model)
	assert.Equal(t, "2K", result.area)
	assert.Equal(t, "0", result.compression)
	assert.Equal(t, "false", result.watermark)
	assert.Equal(t, []string{"first image", "second image"}, result.images)
}

func TestH3ImageResponseContract(t *testing.T) {
	old := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = old })
	const usage = `"usage":{"generated_images":1,"input_tokens":10,"output_tokens":20,"total_tokens":30,"input_tokens_details":{"text_tokens":7,"image_tokens":3},"output_tokens_details":{"image_tokens":20}}`
	const success = "data: {\"type\":\"image_generation.partial_succeeded\",\"image_index\":1,\"url\":\"https://example.com/final.png\"}\n\n"
	const failed = "data: {\"type\":\"image_generation.partial_failed\",\"image_index\":0,\"code\":\"1027\",\"message\":\"blocked\"}\n\n"
	completed := "data: {\"type\":\"image_generation.completed\"," + usage + "}\n\n"
	for _, tc := range []struct {
		name, body     string
		stream, failed bool
		count          float64
	}{
		{"JSON partial failure", `{"data":[{"url":"https://example.com/final.png"},{"error":{"code":"1027"}}],` + usage + `}`, false, false, 1},
		{"Base64", `{"data":[{"b64_json":"result"}],` + usage + `}`, false, false, 1},
		{"SSE summary", success + failed + completed, true, false, 1},
		{"duplicate image", success + success + failed + completed, true, false, 1},
		{"truncated SSE", success, true, true, 2},
		{"malformed SSE", success + "data: broken\n\n", true, true, 2},
		{"inconsistent usage", success + strings.Replace(completed, `"generated_images":1`, `"generated_images":2`, 1), true, true, 2},
		{"all failed", failed + "data: {\"type\":\"error\",\"error\":{\"message\":\"blocked\"}}\n\n", true, true, 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
			contentType := "application/json"
			if tc.stream {
				contentType = "text/event-stream"
			}
			resp := &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {contentType}}, Body: io.NopCloser(strings.NewReader(tc.body))}
			info := &relaycommon.RelayInfo{OriginModelName: "MiniMax-H3-Image", ChannelMeta: &relaycommon.ChannelMeta{}, RelayMode: relayconstant.RelayModeImagesGenerations, IsStream: tc.stream, ImageRequestCount: 2}
			info.PriceData.UsePrice = true
			info.PriceData.AddOtherRatio("n", 2)
			got, err := (&Adaptor{}).DoResponse(c, resp, info)
			if tc.failed {
				require.NotNil(t, err)
				assert.True(t, types.IsSkipRetryError(err))
				assert.NotContains(t, recorder.Body.String(), "image_generation.completed")
			} else {
				require.Nil(t, err)
				usage := got.(*dto.Usage)
				assert.Equal(t, 10, usage.PromptTokens)
				assert.Equal(t, 20, usage.CompletionTokens)
				assert.Equal(t, 3, usage.PromptTokensDetails.ImageTokens)
				if tc.stream {
					assert.Contains(t, recorder.Body.String(), "event: image_generation.completed")
					assert.Equal(t, 1, strings.Count(recorder.Body.String(), "event: image_generation.partial_succeeded"))
				}
			}
			assert.Equal(t, tc.count, info.PriceData.OtherRatios()["n"])
		})
	}
}

func TestH3ImageRejectsInvalidCount(t *testing.T) {
	for _, n := range []string{"0", "11", "-1", "1.5"} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{"model":"MiniMax-H3-Image","prompt":"test","n":`+n+`}`))
		c.Request.Header.Set("Content-Type", "application/json")
		_, err := helper.GetAndValidOpenAIImageRequest(c, relayconstant.RelayModeImagesGenerations)
		require.Error(t, err, n)
		common.CleanupBodyStorage(c)
	}
}
