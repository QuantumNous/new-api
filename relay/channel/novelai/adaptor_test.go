package novelai_test

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/relay/channel/novelai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// Matches witch-paintbox's NAI request, including neutral reference fields.
func paintboxRequest(model string) map[string]any {
	return map[string]any{
		"input": "a landscape", "model": model, "action": "generate",
		"parameters": map[string]any{
			"params_version": 4, "width": 832, "height": 1216, "steps": 28,
			"scale": 5, "sampler": "k_euler_ancestral", "seed": 0, "n_samples": 1,
			"negative_prompt": "blur", "qualityToggle": false, "image_format": "png",
			"cfg_rescale": 0, "dynamic_thresholding": false, "skip_cfg_above_sigma": nil,
			"legacy": false, "legacy_v3_extend": false, "add_original_image": false,
			"uncond_scale": 1, "prefer_brownian": true, "deliberate_euler_ancestral_bug": false,
			"noise_schedule": "karras", "straight_alpha": true,
			"v4_prompt": map[string]any{
				"caption":    map[string]any{"base_caption": "a landscape", "char_captions": []any{}},
				"use_coords": false, "use_order": true,
			},
			"v4_negative_prompt": map[string]any{
				"caption": map[string]any{"base_caption": "blur", "char_captions": []any{}}, "legacy_uc": false,
			},
			"use_coords": false, "characterPrompts": []any{},
			"reference_image_multiple": []any{}, "reference_information_extracted_multiple": []any{},
			"reference_strength_multiple": []any{},
		},
	}
}

func TestPaintboxNativeRequest(t *testing.T) {
	for _, tc := range []struct {
		name, field, value, wantError string
		wantCount                     int
	}{
		{name: "complete native request", wantCount: 1},
		{name: "native batch request", field: "parameters.n_samples", value: `2`, wantCount: 2},
		{name: "do not turn img2img into generate", field: "action", value: `"img2img"`, wantError: "action generate"},
		{name: "conflicting prompts", field: "prompt", value: `"another prompt"`, wantError: "input and prompt"},
		{name: "wrong input type", field: "input", value: `[]`, wantError: "input"},
		{name: "unsupported top-level field", field: "unknown_top_field", value: `true`, wantError: "unsupported NovelAI request field"},
		{name: "invalid batch count", field: "parameters.n_samples", value: `129`, wantError: "n_samples"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			payload := paintboxRequest("nai-diffusion-5-full")
			payload["parameters"].(map[string]any)["width"] = 1024
			payload["parameters"].(map[string]any)["height"] = 1536
			if tc.field != "" {
				if field, ok := strings.CutPrefix(tc.field, "parameters."); ok {
					payload["parameters"].(map[string]any)[field] = json.RawMessage(tc.value)
				} else {
					payload[tc.field] = json.RawMessage(tc.value)
				}
			}
			body, err := common.Marshal(payload)
			require.NoError(t, err)
			original := string(body)
			var request dto.ImageRequest
			require.NoError(t, common.Unmarshal(body, &request))
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/ai/generate-image", nil)
			info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}
			converted, err := (&novelai.Adaptor{}).ConvertImageRequest(c, info, request)
			if tc.wantError != "" {
				require.ErrorContains(t, err, tc.wantError)
				return
			}
			require.NoError(t, err)
			body, err = common.Marshal(converted)
			require.NoError(t, err)
			count, err := novelai.ValidateRequest(body)
			require.NoError(t, err)
			assert.Equal(t, tc.wantCount, count)
			assert.JSONEq(t, original, string(body))
		})
	}
}

func TestNativeImageResponse(t *testing.T) {
	var pngBytes bytes.Buffer
	require.NoError(t, png.Encode(&pngBytes, image.NewRGBA(image.Rect(0, 0, 1, 1))))
	for _, accept := range []string{"", "application/zip", "application/json"} {
		t.Run(accept, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/ai/generate-image", nil)
			c.Request.Header.Set("Accept", accept)
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}
			info.PriceData.UsePrice = true
			body, err := common.Marshal(map[string]any{"images": []any{
				map[string]any{"image": base64.StdEncoding.EncodeToString(pngBytes.Bytes()), "index": 0, "seed": 42},
			}})
			require.NoError(t, err)
			_, apiErr := (&novelai.Adaptor{}).DoResponse(c, &http.Response{
				StatusCode: http.StatusOK, Body: io.NopCloser(bytes.NewReader(body)),
			}, info)
			require.Nil(t, apiErr)
			require.Equal(t, http.StatusCreated, recorder.Code)
			assert.Equal(t, float64(1), info.PriceData.OtherRatios()["n"])
			if accept == "application/json" {
				assert.JSONEq(t, string(body), recorder.Body.String())
			} else {
				assert.Equal(t, "application/zip", recorder.Header().Get("Content-Type"))
				archive, err := zip.NewReader(bytes.NewReader(recorder.Body.Bytes()), int64(recorder.Body.Len()))
				require.NoError(t, err)
				require.Len(t, archive.File, 1)
				assert.Equal(t, "image_0.png", archive.File[0].Name)
				entry, err := archive.File[0].Open()
				require.NoError(t, err)
				defer entry.Close()
				data, err := io.ReadAll(entry)
				require.NoError(t, err)
				assert.Equal(t, pngBytes.Bytes(), data)
			}
		})
	}
}

func TestImageConversionRetainsMappedModelAndNativeParameters(t *testing.T) {
	for _, tc := range []struct {
		name, body, wantError string
	}{
		{
			name: "native overrides preserve zero false and character prompts",
			body: `{"prompt":"a landscape","model":"nai-diffusion-5-full","n":1,"size":"1024x1024",
				"extra_fields":{"steps":28,"n_samples":2},
				"parameters":{"seed":0,"sm":false,"cfg_rescale":0,"n_samples":3,
					"negative_prompt":"blur","v4_prompt":{"caption":{"base_caption":"custom","char_captions":[]}}}}`,
		},
		{name: "malformed flat extras", body: `{"prompt":"test","model":"nai-diffusion-5-full","extra_fields":[]}`, wantError: "JSON object"},
		{name: "invalid native quantity", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"n_samples":0}}`, wantError: "n_samples"},
		{name: "oversized flat quantity", body: `{"prompt":"test","model":"nai-diffusion-5-full","extra_fields":{"n_samples":129}}`, wantError: "n_samples"},
		{name: "negative native quantity", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"n_samples":-1}}`, wantError: "invalid NovelAI"},
		{name: "wrapped quantity", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"n_samples":18446744073686646784}}`, wantError: "n_samples"},
		{name: "fractional quantity", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"n_samples":1.5}}`, wantError: "invalid NovelAI"},
		{name: "invalid size", body: `{"prompt":"test","model":"nai-diffusion-5-full","size":"banana"}`, wantError: "size"},
		{name: "invalid dimension", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"width":65}}`, wantError: "multiples of 64"},
		{name: "oversized dimensions", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"height":9223372036854775807}}`, wantError: "4096"},
		{name: "invalid steps", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"steps":0}}`, wantError: "steps"},
		{name: "invalid seed", body: `{"prompt":"test","model":"nai-diffusion-5-full","parameters":{"seed":-1}}`, wantError: "seed"},
		{name: "no hosted URL output", body: `{"prompt":"test","model":"nai-diffusion-5-full","response_format":"url"}`, wantError: "b64_json"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var request dto.ImageRequest
			require.NoError(t, common.UnmarshalJsonStr(tc.body, &request))
			info := &relaycommon.RelayInfo{OriginModelName: "customer-image-alias", RelayMode: relayconstant.RelayModeImagesGenerations}
			converted, err := (&novelai.Adaptor{}).ConvertImageRequest(nil, info, request)
			if tc.wantError != "" {
				require.ErrorContains(t, err, tc.wantError)
				return
			}
			require.NoError(t, err)
			body, err := common.Marshal(converted)
			require.NoError(t, err)
			assert.Equal(t, "nai-diffusion-5-full", gjson.GetBytes(body, "model").String())
			assert.Equal(t, "a landscape", gjson.GetBytes(body, "input").String())
			assert.Equal(t, int64(0), gjson.GetBytes(body, "parameters.seed").Int())
			assert.Equal(t, "false", gjson.GetBytes(body, "parameters.sm").Raw)
			assert.Equal(t, "0", gjson.GetBytes(body, "parameters.cfg_rescale").Raw)
			assert.Equal(t, int64(28), gjson.GetBytes(body, "parameters.steps").Int())
			assert.Equal(t, "custom", gjson.GetBytes(body, "parameters.v4_prompt.caption.base_caption").String())
			assert.Equal(t, "blur", gjson.GetBytes(body, "parameters.v4_negative_prompt.caption.base_caption").String())
			n, err := novelai.ValidateRequest(body)
			require.NoError(t, err)
			assert.Equal(t, 3, n)
		})
	}
}

func TestImageModelDefaults(t *testing.T) {
	for _, tc := range []struct {
		model string
		steps int64
		scale float64
	}{
		{"nai-diffusion-5-full", 23, 7},
		{"nai-diffusion-5-full-medium", 14, 7},
		{"nai-diffusion-5-curated", 23, 7},
		{"nai-diffusion-4-5-full", 23, 5},
	} {
		t.Run(tc.model, func(t *testing.T) {
			adaptor := &novelai.Adaptor{}
			require.Contains(t, adaptor.GetModelList(), tc.model)
			info := &relaycommon.RelayInfo{RelayMode: relayconstant.RelayModeImagesGenerations}
			converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{Model: tc.model, Prompt: "a landscape"})
			require.NoError(t, err)
			body, err := common.Marshal(converted)
			require.NoError(t, err)
			assert.Equal(t, tc.steps, gjson.GetBytes(body, "parameters.steps").Int())
			assert.Equal(t, tc.scale, gjson.GetBytes(body, "parameters.scale").Float())
			assert.Equal(t, "a landscape", gjson.GetBytes(body, "parameters.v4_prompt.caption.base_caption").String())
			assert.Equal(t, int64(832), gjson.GetBytes(body, "parameters.width").Int())
			assert.Equal(t, int64(1216), gjson.GetBytes(body, "parameters.height").Int())
		})
	}
}

func TestOfficialJSONResponseThroughRegisteredAdaptor(t *testing.T) {
	service.InitHttpClient()
	for _, stream := range []bool{false, true} {
		t.Run(map[bool]string{false: "JSON", true: "SSE"}[stream], func(t *testing.T) {
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/ai/generate-image", r.URL.Path)
				assert.Equal(t, "Bearer fixture-upstream-token", r.Header.Get("Authorization"))
				assert.Equal(t, "application/json", r.Header.Get("Accept"))
				assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
				assert.Equal(t, "test-header", r.Header.Get("X-Fixture"))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusCreated)
				_, _ = io.WriteString(w, `{"images":[{"image":"aW1hZ2U=","index":0,"seed":0}]}`)
			}))
			t.Cleanup(upstream.Close)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{}`))
			c.Request.Header.Set("Authorization", "Bearer fixture-client-token")
			apiType, ok := common.ChannelType2APIType(constant.ChannelTypeNovelAI)
			require.True(t, ok)
			adaptor := relay.GetAdaptor(apiType)
			require.NotNil(t, adaptor)
			info := &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeImagesGenerations,
				IsStream:  stream,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: constant.ChannelTypeNovelAI, ApiType: apiType,
					ChannelBaseUrl: upstream.URL, ApiKey: "fixture-upstream-token",
					HeadersOverride: map[string]any{"X-Fixture": "test-header"},
				},
			}
			info.PriceData.UsePrice = true
			info.PriceData.AddOtherRatio("n", 3)
			converted, err := adaptor.ConvertImageRequest(c, info, dto.ImageRequest{
				Model: "nai-diffusion-5-full", Prompt: "a landscape", N: common.GetPointer(uint(3)),
			})
			require.NoError(t, err)
			body, err := common.Marshal(converted)
			require.NoError(t, err)
			result, err := adaptor.DoRequest(c, info, bytes.NewReader(body))
			require.NoError(t, err)
			response := result.(*http.Response)
			require.Equal(t, http.StatusOK, response.StatusCode, "official 201 must reach the shared image response handler")
			usage, apiErr := adaptor.DoResponse(c, response, info)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)
			assert.Equal(t, 1.0, info.PriceData.OtherRatios()["n"], "settlement follows the actual returned payloads")
			if stream {
				assert.Contains(t, recorder.Body.String(), "event: image_generation.completed")
				assert.Contains(t, recorder.Body.String(), "data: [DONE]")
			} else {
				assert.Equal(t, "aW1hZ2U=", gjson.GetBytes(recorder.Body.Bytes(), "data.0.b64_json").String())
			}
		})
	}
}

func TestMalformedResponsesDoNotBecomeSuccessfulImages(t *testing.T) {
	for _, body := range []string{`{}`, `{"images":[]}`, `{"images":[{"image":""}]}`, `{"images":["legacy-base64"]}`, `not JSON`} {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
		info := &relaycommon.RelayInfo{}
		info.PriceData.UsePrice = true
		info.PriceData.AddOtherRatio("n", 2)
		response := &http.Response{
			StatusCode: http.StatusOK, Header: make(http.Header),
			Body: io.NopCloser(strings.NewReader(body)),
		}
		usage, apiErr := (&novelai.Adaptor{}).DoResponse(c, response, info)
		require.NotNil(t, apiErr, body)
		assert.Nil(t, usage, body)
		assert.Equal(t, 2.0, info.PriceData.OtherRatios()["n"])
	}
}

// Explicit opt-in only: ordinary test runs never call the paid upstream.
func TestLiveOpusSmallImage(t *testing.T) {
	if os.Getenv("NAI_LIVE_TEST") != "1" {
		t.Skip("set NAI_LIVE_TEST=1 and NAI_TOKEN to run one real Opus small-image request")
	}
	token := os.Getenv("NAI_TOKEN")
	require.NotEmpty(t, token, "NAI_TOKEN is required")
	liveModel, subscription := liveOpusImageModel(t, token)
	before := *subscription.Points.Fixed + *subscription.Points.Purchased
	service.InitHttpClient()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", strings.NewReader(`{}`))
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesGenerations,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeNovelAI,
			ChannelBaseUrl: "https://image.novelai.net", ApiKey: token,
		},
	}
	adaptor := &novelai.Adaptor{}
	request, err := adaptor.ConvertImageRequest(c, info, dto.ImageRequest{
		Model: liveModel, Prompt: "a quiet mountain lake, pine forest, blue sky, watercolor landscape, no people",
		N: common.GetPointer(uint(1)), Size: "832x1216", ResponseFormat: "b64_json",
	})
	require.NoError(t, err)
	body, err := common.Marshal(request)
	require.NoError(t, err)
	result, err := adaptor.DoRequest(c, info, bytes.NewReader(body))
	require.NoError(t, err)
	response := result.(*http.Response)
	require.Equal(t, http.StatusOK, response.StatusCode)
	_, apiErr := adaptor.DoResponse(c, response, info)
	require.Nil(t, apiErr)
	encoded := gjson.GetBytes(recorder.Body.Bytes(), "data.0.b64_json").String()
	image, err := base64.StdEncoding.DecodeString(encoded)
	require.NoError(t, err)
	config, err := png.DecodeConfig(bytes.NewReader(image))
	require.NoError(t, err)
	assert.Equal(t, 832, config.Width)
	assert.Equal(t, 1216, config.Height)
	after := opusAnlasBalance(t, token)
	assert.Equal(t, before, after, "this small-image test must not consume Anlas")
	if path := os.Getenv("NAI_OUTPUT_PATH"); path != "" {
		require.NoError(t, os.WriteFile(path, image, 0600))
		t.Logf("PNG output: %s (%dx%d)", path, config.Width, config.Height)
	}
	t.Logf("Opus small-image generation succeeded; model=%s; Anlas before=%d after=%d", liveModel, before, after)
}

type opusTestSubscription struct {
	Active    bool  `json:"active"`
	Tier      int   `json:"tier"`
	ExpiresAt int64 `json:"expiresAt"`
	Points    struct {
		Fixed     *int64 `json:"fixedTrainingStepsLeft"`
		Purchased *int64 `json:"purchasedTrainingSteps"`
	} `json:"trainingStepsLeft"`
	Usage *struct {
		Negative *bool `json:"isNegative"`
		Percent  *int  `json:"percent"`
	} `json:"usage"`
}

// This is a read-only snapshot, not a guarantee that a subsequent request is
// free: another client may consume the allowance between the two requests.
func (s opusTestSubscription) hasV5Allowance(now int64) bool {
	return s.Active && s.Tier == 3 && s.ExpiresAt > now &&
		s.Usage != nil && s.Usage.Negative != nil && !*s.Usage.Negative
}

func TestV5AllowanceSnapshot(t *testing.T) {
	for _, tc := range []struct {
		name, body string
		want       bool
	}{
		{"available", `{"active":true,"tier":3,"expiresAt":200,"usage":{"isNegative":false,"percent":25}}`, true},
		{"fractional remainder rounds to zero", `{"active":true,"tier":3,"expiresAt":200,"usage":{"isNegative":false,"percent":0}}`, true},
		{"exhausted", `{"active":true,"tier":3,"expiresAt":200,"usage":{"isNegative":true,"percent":0}}`, false},
		{"missing usage is unknown", `{"active":true,"tier":3,"expiresAt":200}`, false},
		{"missing exhaustion flag is unknown", `{"active":true,"tier":3,"expiresAt":200,"usage":{"percent":25}}`, false},
		{"inactive", `{"active":false,"tier":3,"expiresAt":200,"usage":{"isNegative":false}}`, false},
		{"expired", `{"active":true,"tier":3,"expiresAt":100,"usage":{"isNegative":false}}`, false},
		{"not Opus", `{"active":true,"tier":2,"expiresAt":200,"usage":{"isNegative":false}}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var subscription opusTestSubscription
			require.NoError(t, common.UnmarshalJsonStr(tc.body, &subscription))
			assert.Equal(t, tc.want, subscription.hasV5Allowance(100))
		})
	}
}

// This opt-in test only reads subscription state; it never generates images.
func TestLiveOpusSubscription(t *testing.T) {
	if os.Getenv("NAI_SUBSCRIPTION_TEST") != "1" {
		t.Skip("set NAI_SUBSCRIPTION_TEST=1 and NAI_TOKEN to read the current Opus allowance")
	}
	token := os.Getenv("NAI_TOKEN")
	require.NotEmpty(t, token, "NAI_TOKEN is required")
	subscription := readOpusSubscription(t, token)
	t.Logf("Opus subscription active; Anlas=%d; V5 allowance snapshot available=%t",
		*subscription.Points.Fixed+*subscription.Points.Purchased, subscription.hasV5Allowance(time.Now().Unix()))
	if subscription.Usage != nil && subscription.Usage.Percent != nil {
		t.Logf("V5 allowance reported by upstream: %d%%", *subscription.Usage.Percent)
	}
}

func opusAnlasBalance(t *testing.T, token string) int64 {
	t.Helper()
	subscription := readOpusSubscription(t, token)
	return *subscription.Points.Fixed + *subscription.Points.Purchased
}

func liveOpusImageModel(t *testing.T, token string) (string, opusTestSubscription) {
	t.Helper()
	modelName := os.Getenv("NAI_LIVE_MODEL")
	if modelName == "" {
		modelName = "nai-diffusion-4-5-full"
	}
	require.Contains(t, []string{"nai-diffusion-4-5-full", "nai-diffusion-5-full", "nai-diffusion-5-full-medium", "nai-diffusion-5-curated"}, modelName)
	if strings.HasPrefix(modelName, "nai-diffusion-5-") {
		require.Equal(t, "1", os.Getenv("NAI_ALLOW_ANLAS_TEST"), "V5 may fall back to Anlas; explicit permission is required before testing")
	}
	subscription := readOpusSubscription(t, token)
	if strings.HasPrefix(modelName, "nai-diffusion-5-") {
		require.True(t, subscription.hasV5Allowance(time.Now().Unix()), "do not deliberately test an exhausted V5 allowance")
	}
	return modelName, subscription
}

func readOpusSubscription(t *testing.T, token string) opusTestSubscription {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, "https://image.novelai.net/user/subscription", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+token)
	response, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, http.StatusOK, response.StatusCode)
	var subscription opusTestSubscription
	require.NoError(t, common.DecodeJson(response.Body, &subscription))
	require.True(t, subscription.Active)
	require.Equal(t, 3, subscription.Tier, "only run the free small-image test with an active Opus subscription")
	require.Greater(t, subscription.ExpiresAt, time.Now().Unix(), "Opus must not be expired")
	require.NotNil(t, subscription.Points.Fixed)
	require.NotNil(t, subscription.Points.Purchased)
	require.GreaterOrEqual(t, *subscription.Points.Fixed, int64(0))
	require.GreaterOrEqual(t, *subscription.Points.Purchased, int64(0))
	require.LessOrEqual(t, *subscription.Points.Fixed, int64(1<<31-1))
	require.LessOrEqual(t, *subscription.Points.Purchased, int64(1<<31-1))
	return subscription
}

// Opt-in only, against an uninitialized disposable gateway, never production.
func TestGatewayImageBilling(t *testing.T) {
	base := strings.TrimRight(os.Getenv("NAI_GATEWAY_URL"), "/")
	if base == "" {
		t.Skip("set NAI_GATEWAY_URL to a fresh, isolated nai-test gateway")
	}
	target, err := url.Parse(base)
	require.NoError(t, err)
	require.Equal(t, "http", target.Scheme)
	require.Contains(t, []string{"127.0.0.1", "localhost", "::1"}, target.Hostname())
	client := &http.Client{Timeout: 120 * time.Second}
	request := func(t *testing.T, method, path, key string, payload any) (int, []byte) {
		t.Helper()
		body, err := common.Marshal(payload)
		require.NoError(t, err)
		req, err := http.NewRequest(method, base+path, bytes.NewReader(body))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		if key != "" {
			req.Header.Set("Authorization", "Bearer "+key)
		}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		return resp.StatusCode, data
	}
	api := func(t *testing.T, method, path, key string, payload any) gjson.Result {
		t.Helper()
		status, body := request(t, method, path, key, payload)
		require.Equal(t, http.StatusOK, status, "%s %s", method, path)
		require.True(t, gjson.GetBytes(body, "success").Bool(), "%s %s: %s", method, path, gjson.GetBytes(body, "message").String())
		return gjson.GetBytes(body, "data")
	}
	require.Contains(t, api(t, "GET", "/api/status", "", nil).Get("version").String(), "nai-test")
	setup := api(t, "GET", "/api/setup", "", nil)
	require.False(t, setup.Get("status").Bool(), "only an uninitialized disposable gateway is allowed")
	require.False(t, setup.Get("root_init").Bool())
	password := "Nai-Test-9!" + rand.Text()
	api(t, "POST", "/api/setup", "", map[string]any{
		"username": "naitest", "password": password, "confirmPassword": password, "SelfUseModeEnabled": true,
	})
	admin := api(t, "POST", "/api/user/login", "", map[string]string{"username": "naitest", "password": password}).Get("access_token").String()
	require.NotEmpty(t, admin)
	api(t, "PUT", "/api/option/", admin, map[string]any{"key": "RetryTimes", "value": 0})
	api(t, "PUT", "/api/option/", admin, map[string]any{"key": "AutomaticRetryStatusCodes", "value": "429,500-503"})
	api(t, "POST", "/api/token/", admin, map[string]any{
		"name": "nai-gateway-test", "remain_quota": 1000000, "expired_time": -1, "group": "default",
	})
	tokens := api(t, "GET", "/api/token/", admin, nil).Get("items").Array()
	require.Len(t, tokens, 1)
	tokenID := tokens[0].Get("id").Int()
	tokenPath := fmt.Sprintf("/api/token/%d", tokenID)
	key := api(t, "POST", tokenPath+"/key", admin, nil).Get("key").String()
	require.NotEmpty(t, key)
	t.Cleanup(func() { api(t, "DELETE", tokenPath, admin, nil) })

	var calls, retryCalls, returned, upstreamStatus, retryStatus, receivedQuantity atomic.Int64
	var subscriptionBody, retrySubscriptionBody, responseMode atomic.Value
	const activeOpus = `{"active":true,"tier":3,"expiresAt":2147483647,"usage":{"isNegative":false}}`
	subscriptionBody.Store(activeOpus)
	retrySubscriptionBody.Store(activeOpus)
	responseMode.Store("")
	type generationGate struct {
		entered chan struct{}
		release chan struct{}
	}
	var gate atomic.Pointer[generationGate]
	fixtureImage := image.NewRGBA(image.Rect(0, 0, 832, 1216))
	draw.Draw(fixtureImage, fixtureImage.Bounds(), image.NewUniform(color.RGBA{R: 96, G: 160, B: 112, A: 255}), image.Point{}, draw.Src)
	draw.Draw(fixtureImage, image.Rect(128, 192, 704, 1024), image.NewUniform(color.RGBA{R: 232, G: 192, B: 224, A: 255}), image.Point{}, draw.Src)
	var fixturePNG bytes.Buffer
	require.NoError(t, png.Encode(&fixturePNG, fixtureImage))
	returned.Store(1)
	upstreamStatus.Store(http.StatusCreated)
	bind := os.Getenv("NAI_FIXTURE_BIND")
	if bind == "" {
		bind = "127.0.0.1:0"
	}
	listener, err := net.Listen("tcp", bind)
	require.NoError(t, err)
	ip := listener.Addr().(*net.TCPAddr).IP
	require.True(t, ip.IsLoopback() || ip.IsPrivate(), "fixture must not listen on a public interface")
	fixture := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/retry")
		retry := path != r.URL.Path
		if path == "/user/subscription" {
			assert.Equal(t, "Bearer fixture-upstream-token", r.Header.Get("Authorization"))
			w.Header().Set("Content-Type", "application/json")
			subscription := subscriptionBody.Load().(string)
			if retry {
				subscription = retrySubscriptionBody.Load().(string)
			}
			_, _ = io.WriteString(w, subscription)
			return
		}
		calls.Add(1)
		if retry {
			retryCalls.Add(1)
		}
		assert.Equal(t, "/ai/generate-image", path)
		assert.Equal(t, "Bearer fixture-upstream-token", r.Header.Get("Authorization"))
		assert.Equal(t, "application/json", r.Header.Get("Accept"))
		body, err := io.ReadAll(r.Body)
		if !assert.NoError(t, err) {
			return
		}
		assert.Contains(t, []string{"nai-diffusion-4-5-full", "nai-diffusion-5-full-medium", "nai-diffusion-5-full"}, gjson.GetBytes(body, "model").String())
		assert.Equal(t, "generate", gjson.GetBytes(body, "action").String())
		receivedQuantity.Store(gjson.GetBytes(body, "parameters.n_samples").Int())
		if barrier := gate.Load(); barrier != nil {
			barrier.entered <- struct{}{}
			select {
			case <-barrier.release:
			case <-r.Context().Done():
				return
			}
		}
		status := upstreamStatus.Load()
		if retry {
			status = retryStatus.Load()
		}
		if gjson.GetBytes(body, "input").String() == "fixture-reject" {
			status = http.StatusBadRequest
		}
		if !retry {
			switch responseMode.Load().(string) {
			case "disconnect":
				connection, _, err := w.(http.Hijacker).Hijack()
				if assert.NoError(t, err) {
					_ = connection.Close()
				}
				return
			case "malformed", "truncated":
				if responseMode.Load().(string) == "truncated" {
					w.Header().Set("Content-Length", "1000")
				}
				w.WriteHeader(int(status))
				_, _ = io.WriteString(w, `{"images":[`)
				return
			case "missing":
				w.WriteHeader(int(status))
				_, _ = io.WriteString(w, `{"images":[]}`)
				return
			case "empty":
				w.WriteHeader(int(status))
				_, _ = io.WriteString(w, `{"images":[{"image":""}]}`)
				return
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(int(status))
		images := make([]map[string]string, returned.Load())
		for i := range images {
			images[i] = map[string]string{"image": base64.StdEncoding.EncodeToString(fixturePNG.Bytes())}
		}
		response, err := common.Marshal(map[string]any{"images": images})
		if !assert.NoError(t, err) {
			return
		}
		_, _ = w.Write(response)
	}))
	require.NoError(t, fixture.Listener.Close())
	fixture.Listener = listener
	fixture.Start()
	t.Cleanup(fixture.Close)

	const paid, free, legacy, nativeModel = "nai-diffusion-gateway-paid", "nai-diffusion-gateway-free", "nai-diffusion-gateway-legacy", "nai-diffusion-5-full"
	mapping, err := common.Marshal(map[string]string{paid: "nai-diffusion-4-5-full", free: "nai-diffusion-4-5-full", legacy: "nai-diffusion-4-5-full"})
	require.NoError(t, err)
	api(t, "POST", "/api/channel/", admin, map[string]any{
		"mode": "single", "channel": map[string]any{
			"type": constant.ChannelTypeNovelAI, "name": "nai-gateway-test", "key": "fixture-upstream-token",
			"base_url": fixture.URL, "models": strings.Join([]string{paid, free, legacy, nativeModel}, ","), "group": "default",
			"model_mapping": string(mapping), "auto_ban": 0,
		},
	})
	channels := api(t, "GET", "/api/channel/", admin, nil).Get("items").Array()
	require.Len(t, channels, 1)
	channelID := channels[0].Get("id").Int()
	channelPath := fmt.Sprintf("/api/channel/%d", channelID)
	t.Cleanup(func() { api(t, "DELETE", channelPath, admin, nil) })
	snapshot := api(t, "GET", "/api/option/model_pricing", admin, nil)
	changes := []map[string]any{}
	for _, name := range []string{paid, free, legacy, nativeModel} {
		version := snapshot.Get("empty_version").String()
		for _, entry := range snapshot.Get("entries").Array() {
			if entry.Get("model_name").String() == name {
				version = entry.Get("version").String()
			}
		}
		pricing := map[string]any{
			"billing_setting.billing_mode": "tiered_expr",
			"billing_setting.billing_expr": `tier("image", fixed(0.01)) * image_count`,
		}
		if name == free {
			pricing["billing_setting.billing_expr"] = `tier("image", fixed(0)) * image_count`
		} else if name == legacy {
			pricing = map[string]any{"ModelPrice": 0.01}
		}
		changes = append(changes, map[string]any{"model_name": name, "expected_version": version, "pricing": pricing})
	}
	api(t, "PATCH", "/api/option/model_pricing", admin, map[string]any{"changes": changes})
	balances := func(t *testing.T) [6]int64 {
		t.Helper()
		user := api(t, "GET", "/api/user/self", admin, nil)
		token := api(t, "GET", tokenPath, admin, nil)
		channel := api(t, "GET", channelPath, admin, nil)
		return [6]int64{user.Get("quota").Int(), user.Get("used_quota").Int(), user.Get("request_count").Int(),
			token.Get("remain_quota").Int(), token.Get("used_quota").Int(), channel.Get("used_quota").Int()}
	}
	t.Run("native endpoint requires authentication", func(t *testing.T) {
		for _, key := range []string{"", "invalid-fixture-token"} {
			code, _ := request(t, "POST", "/ai/generate-image", key, paintboxRequest(nativeModel))
			assert.Equal(t, http.StatusUnauthorized, code)
		}
		assert.Zero(t, calls.Load())
	})
	t.Run("native endpoint respects token model restrictions", func(t *testing.T) {
		api(t, "PUT", "/api/token/", admin, map[string]any{
			"id": tokenID, "name": "nai-gateway-test", "remain_quota": 1000000, "expired_time": -1, "group": "default",
			"model_limits_enabled": true, "model_limits": paid,
		})
		code, _ := request(t, "POST", "/ai/generate-image", key, paintboxRequest(nativeModel))
		assert.Equal(t, http.StatusForbidden, code)
		assert.Zero(t, calls.Load())
		api(t, "PUT", "/api/token/", admin, map[string]any{
			"id": tokenID, "name": "nai-gateway-test", "remain_quota": 1000000, "expired_time": -1, "group": "default",
			"model_limits_enabled": false,
		})
	})
	for _, tc := range []struct {
		name, path, override             string
		width, status                    int
		charge                           int64
		field                            string
		value                            any
		poor, otherProvider, passthrough bool
	}{
		{name: "paintbox native ZIP", charge: 5000},
		{name: "paintbox body on OpenAI image endpoint", path: "/v1/images/generations", charge: 5000},
		{name: "native passthrough retains request validation", passthrough: true, charge: 5000},
		{name: "native overridden quantity reserves final count", charge: 10000, override: `{"operations":[{"path":"parameters.n_samples","mode":"set","value":2}]}`},
		{name: "native insufficient quota blocks upstream", width: 1024, poor: true, status: 403},
		{name: "native action is not silently rewritten", field: "action", value: "img2img", status: 400},
		{name: "native invalid count is rejected", field: "parameters.n_samples", value: 129, status: 400},
		{name: "native endpoint cannot use another provider", otherProvider: true, status: 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			override := tc.override
			if override == "" {
				override = "{}"
			}
			channelType := constant.ChannelTypeNovelAI
			if tc.otherProvider {
				channelType = constant.ChannelTypeOpenAI
			}
			setting, err := common.Marshal(map[string]any{"pass_through_body_enabled": tc.passthrough})
			require.NoError(t, err)
			api(t, "PUT", "/api/channel/", admin, map[string]any{
				"id": channelID, "type": channelType, "param_override": override, "setting": string(setting),
			})
			quota := 1000000
			if tc.poor {
				quota = 1
			}
			api(t, "PUT", "/api/token/", admin, map[string]any{"id": tokenID, "name": "nai-gateway-test", "remain_quota": quota, "expired_time": -1, "group": "default"})
			payload := paintboxRequest(nativeModel)
			parameters := payload["parameters"].(map[string]any)
			if tc.width != 0 {
				parameters["width"] = tc.width
				parameters["height"] = 1536
			}
			if field, ok := strings.CutPrefix(tc.field, "parameters."); ok {
				parameters[field] = tc.value
			} else if tc.field != "" {
				payload[tc.field] = tc.value
			}
			path := tc.path
			if path == "" {
				path = "/ai/generate-image"
			}
			returned.Store(1)
			if tc.charge == 10000 {
				returned.Store(2)
			}
			before, beforeCalls := balances(t), calls.Load()
			code, body := request(t, "POST", path, key, payload)
			wantStatus := tc.status
			if wantStatus == 0 {
				wantStatus = http.StatusCreated
				if path == "/v1/images/generations" {
					wantStatus = http.StatusOK
				}
			}
			require.Equal(t, wantStatus, code, "%s", body)
			want := before
			if tc.status == 0 {
				assert.Equal(t, beforeCalls+1, calls.Load())
				want = [6]int64{before[0] - tc.charge, before[1] + tc.charge, before[2] + 1, before[3] - tc.charge, before[4] + tc.charge, before[5] + tc.charge}
				if path == "/ai/generate-image" {
					archive, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
					require.NoError(t, err)
					require.NotEmpty(t, archive.File)
					entry, err := archive.File[0].Open()
					require.NoError(t, err)
					defer entry.Close()
					data, err := io.ReadAll(entry)
					require.NoError(t, err)
					assert.Equal(t, fixturePNG.Bytes(), data)
					if output := os.Getenv("NAI_NATIVE_OUTPUT_PATH"); output != "" {
						require.NoError(t, os.WriteFile(output, body, 0600))
					}
				} else {
					assert.Equal(t, base64.StdEncoding.EncodeToString(fixturePNG.Bytes()), gjson.GetBytes(body, "data.0.b64_json").String())
				}
			} else {
				assert.Equal(t, beforeCalls, calls.Load())
			}
			require.Eventually(t, func() bool { return balances(t) == want }, 5*time.Second, 100*time.Millisecond,
				"native requests must reconcile wallet, token and channel accounting")
		})
	}
	for _, tc := range []struct {
		name, model                  string
		native, override, images     int64
		status, wantStatus           int
		wantCalls, wantCount, charge int64
		stream, poor                 bool
	}{
		{name: "mapped model and expression price", model: paid, native: 1, images: 1, wantCount: 1, wantCalls: 1, charge: 5000},
		{name: "native count settles two payloads", model: paid, native: 2, images: 2, wantCount: 2, wantCalls: 1, charge: 10000},
		{name: "override reserves two refunds missing image", model: paid, native: 1, override: 2, images: 1, wantCount: 2, wantCalls: 1, charge: 5000},
		{name: "JSON as SSE settles actual image", model: paid, native: 2, images: 1, wantCount: 2, wantCalls: 1, charge: 5000, stream: true},
		{name: "explicit zero price remains free", model: free, native: 1, images: 1, wantCount: 1, wantCalls: 1},
		{name: "legacy per image price", model: legacy, native: 2, images: 1, wantCount: 2, wantCalls: 1, charge: 5000},
		{name: "invalid native count never submitted", model: paid, native: 129, images: 1, wantStatus: 400},
		{name: "invalid override never submitted", model: paid, native: 1, override: 129, images: 1, wantStatus: 400},
		{name: "upstream failure refunds reservation", model: paid, native: 2, images: 0, status: 400, wantStatus: 400, wantCount: 2, wantCalls: 1},
		{name: "missing image refunds reservation", model: paid, native: 2, images: 0, wantStatus: 502, wantCount: 2, wantCalls: 1},
		{name: "insufficient token quota blocks upstream", model: paid, native: 2, images: 1, wantStatus: 403, poor: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			override := "{}"
			if tc.override != 0 {
				data, err := common.Marshal(map[string]any{"operations": []any{map[string]any{"path": "parameters.n_samples", "mode": "set", "value": tc.override}}})
				require.NoError(t, err)
				override = string(data)
			}
			api(t, "PUT", "/api/channel/", admin, map[string]any{"id": channelID, "type": constant.ChannelTypeNovelAI, "param_override": override})
			if tc.poor {
				api(t, "PUT", "/api/token/", admin, map[string]any{"id": tokenID, "name": "nai-gateway-test", "remain_quota": 1, "expired_time": -1, "group": "default"})
			}
			before := balances(t)
			callCount := calls.Load()
			returned.Store(tc.images)
			status := tc.status
			if status == 0 {
				status = http.StatusCreated
			}
			upstreamStatus.Store(int64(status))
			code, body := request(t, "POST", "/v1/images/generations", key, map[string]any{
				"model": tc.model, "prompt": "a landscape", "n": 1, "size": "832x1216",
				"parameters": map[string]any{"n_samples": tc.native}, "stream": tc.stream,
			})
			wantStatus := tc.wantStatus
			if wantStatus == 0 {
				wantStatus = http.StatusOK
			}
			require.Equal(t, wantStatus, code, "error code: %s", gjson.GetBytes(body, "error.code").String())
			assert.Equal(t, tc.wantCalls, calls.Load()-callCount)
			if tc.wantCalls != 0 {
				assert.Equal(t, tc.wantCount, receivedQuantity.Load())
			}
			if code == http.StatusOK {
				if tc.stream {
					assert.Equal(t, int(tc.images), bytes.Count(body, []byte("event: image_generation.completed")))
					assert.Contains(t, string(body), "data: [DONE]")
				} else {
					assert.Len(t, gjson.GetBytes(body, "data").Array(), int(tc.images))
				}
			}
			want := before
			want[0] -= tc.charge
			want[1] += tc.charge
			want[3] -= tc.charge
			want[4] += tc.charge
			want[5] += tc.charge
			if code == http.StatusOK {
				want[2]++
			}
			require.Eventually(t, func() bool { return balances(t) == want }, 5*time.Second, 100*time.Millisecond,
				"wallet, user usage, request count, token and channel accounting must reconcile")
			if code == http.StatusOK {
				logs := api(t, "GET", "/api/log/?type=2&token_name=nai-gateway-test", admin, nil).Get("items").Array()
				require.NotEmpty(t, logs)
				assert.Equal(t, tc.charge, logs[0].Get("quota").Int())
				assert.Equal(t, channelID, logs[0].Get("channel").Int())
				if tc.model != legacy {
					assert.Equal(t, tc.images, gjson.Get(logs[0].Get("other").String(), "image_count").Int())
				}
			}
		})
	}
	for _, tc := range []struct {
		name       string
		models     [2]string
		quota      int
		reject     bool
		wantStatus []int
		wantCalls  int
		charges    []int64
	}{
		{name: "concurrent free and paid requests stay independent", models: [2]string{free, paid}, quota: 1000000, wantStatus: []int{200, 200}, wantCalls: 2, charges: []int64{0, 5000}},
		{name: "concurrent requests cannot overspend one image quota", models: [2]string{paid, paid}, quota: 5000, wantStatus: []int{200, 403}, wantCalls: 1, charges: []int64{5000}},
		{name: "concurrent failed image refunds without refunding success", models: [2]string{paid, paid}, quota: 1000000, reject: true, wantStatus: []int{200, 400}, wantCalls: 2, charges: []int64{5000}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			returned.Store(1)
			upstreamStatus.Store(http.StatusCreated)
			api(t, "PUT", "/api/channel/", admin, map[string]any{"id": channelID, "type": constant.ChannelTypeNovelAI, "param_override": "{}"})
			api(t, "PUT", "/api/token/", admin, map[string]any{"id": tokenID, "name": "nai-gateway-test", "remain_quota": tc.quota, "expired_time": -1, "group": "default"})
			before := balances(t)
			logsBefore := api(t, "GET", "/api/log/?type=2&token_name=nai-gateway-test", admin, nil).Get("total").Int()
			callCount := calls.Load()
			barrier := &generationGate{entered: make(chan struct{}, 2), release: make(chan struct{})}
			gate.Store(barrier)
			defer gate.Store(nil)
			defer func() {
				select {
				case <-barrier.release:
				default:
					close(barrier.release)
				}
			}()
			type result struct {
				status int
				body   []byte
				err    error
			}
			results := make(chan result, 2)
			start := make(chan struct{})
			for i, modelName := range tc.models {
				prompt := "a landscape"
				if tc.reject && i == 0 {
					prompt = "fixture-reject"
				}
				body, err := common.Marshal(map[string]any{"model": modelName, "prompt": prompt, "size": "832x1216", "n": 1})
				require.NoError(t, err)
				req, err := http.NewRequest("POST", base+"/v1/images/generations", bytes.NewReader(body))
				require.NoError(t, err)
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("Authorization", "Bearer "+key)
				go func() {
					<-start
					response, err := client.Do(req)
					if err != nil {
						results <- result{err: err}
						return
					}
					defer response.Body.Close()
					data, err := io.ReadAll(response.Body)
					results <- result{status: response.StatusCode, body: data, err: err}
				}()
			}
			close(start)
			for range tc.wantCalls {
				select {
				case <-barrier.entered:
				case <-time.After(10 * time.Second):
					t.Fatal("reserved requests did not reach the upstream barrier")
				}
			}
			statuses := []int{}
			if tc.wantCalls == 1 {
				select {
				case response := <-results:
					require.NoError(t, response.err)
					require.Equal(t, http.StatusForbidden, response.status)
					statuses = append(statuses, response.status)
				case <-time.After(10 * time.Second):
					t.Fatal("competing request was not rejected before settlement")
				}
			}
			close(barrier.release)
			for len(statuses) < 2 {
				response := <-results
				require.NoError(t, response.err)
				statuses = append(statuses, response.status)
				if response.status == http.StatusOK {
					assert.Len(t, gjson.GetBytes(response.body, "data").Array(), 1)
				}
			}
			assert.ElementsMatch(t, tc.wantStatus, statuses)
			assert.Equal(t, int64(tc.wantCalls), calls.Load()-callCount)
			charge := int64(0)
			for _, c := range tc.charges {
				charge += c
			}
			want := [6]int64{before[0] - charge, before[1] + charge, before[2] + int64(len(tc.charges)), before[3] - charge, before[4] + charge, before[5] + charge}
			require.Eventually(t, func() bool { return balances(t) == want }, 5*time.Second, 100*time.Millisecond)
			logs := api(t, "GET", "/api/log/?type=2&token_name=nai-gateway-test", admin, nil)
			require.Equal(t, logsBefore+int64(len(tc.charges)), logs.Get("total").Int(), "only successful requests get one consume log each")
		})
	}
	t.Run("channel retry refreshes quantity and never resubmits uncertain generations", func(t *testing.T) {
		api(t, "POST", "/api/channel/", admin, map[string]any{
			"mode": "single", "channel": map[string]any{
				"type": constant.ChannelTypeNovelAI, "name": "nai-retry-test", "key": "fixture-upstream-token",
				"base_url": fixture.URL + "/retry", "models": paid, "group": "default",
				"model_mapping": string(mapping), "priority": 0, "auto_ban": 0,
			},
		})
		channels := api(t, "GET", "/api/channel/", admin, nil).Get("items").Array()
		require.Len(t, channels, 2)
		retryID := channels[0].Get("id").Int()
		if retryID == channelID {
			retryID = channels[1].Get("id").Int()
		}
		retryPath := fmt.Sprintf("/api/channel/%d", retryID)
		defer api(t, "DELETE", retryPath, admin, nil)
		api(t, "PUT", "/api/option/", admin, map[string]any{"key": "RetryTimes", "value": 1})
		defer api(t, "PUT", "/api/option/", admin, map[string]any{"key": "RetryTimes", "value": 0})
		defer responseMode.Store("")
		const twoSamples = `{"operations":[{"path":"parameters.n_samples","mode":"set","value":2}]}`
		for _, tc := range []struct {
			name, firstOverride, retryOverride, response string
			status, firstStatus, retryStatus, quota      int
			calls, retryCalls, charge                    int64
		}{
			{name: "two-image override to single-image retry refunds difference", firstOverride: twoSamples, calls: 2, retryCalls: 1, charge: 5000},
			{name: "single-image to two-image override reserves before retry", retryOverride: twoSamples, calls: 2, retryCalls: 1, charge: 10000},
			{name: "all attempts fail and refund only once", firstOverride: twoSamples, retryOverride: twoSamples, retryStatus: 503, status: 503, calls: 2, retryCalls: 1},
			{name: "insufficient retry quota never submits second image", retryOverride: twoSamples, quota: 5000, status: 403, calls: 1},
			{name: "disconnect never resubmits an uncertain generation", firstOverride: twoSamples, response: "disconnect", status: 500, calls: 1},
			{name: "malformed success never resubmits", firstOverride: twoSamples, firstStatus: 201, response: "malformed", status: 502, calls: 1},
			{name: "truncated success never resubmits", firstOverride: twoSamples, firstStatus: 201, response: "truncated", status: 502, calls: 1},
			{name: "missing images never resubmits", firstOverride: twoSamples, firstStatus: 201, response: "missing", status: 502, calls: 1},
			{name: "empty image never resubmits", firstOverride: twoSamples, firstStatus: 201, response: "empty", status: 502, calls: 1},
		} {
			t.Run(tc.name, func(t *testing.T) {
				firstCode := tc.firstStatus
				if firstCode == 0 {
					firstCode = http.StatusServiceUnavailable
				}
				upstreamStatus.Store(int64(firstCode))
				responseMode.Store(tc.response)
				retryCode := tc.retryStatus
				if retryCode == 0 {
					retryCode = http.StatusCreated
				}
				retryStatus.Store(int64(retryCode))
				returned.Store(1)
				if tc.charge == 10000 {
					returned.Store(2)
				}
				quota := tc.quota
				if quota == 0 {
					quota = 1000000
				}
				api(t, "PUT", "/api/token/", admin, map[string]any{"id": tokenID, "name": "nai-gateway-test", "remain_quota": quota, "expired_time": -1, "group": "default"})
				firstOverride, retryOverride := tc.firstOverride, tc.retryOverride
				if firstOverride == "" {
					firstOverride = "{}"
				}
				if retryOverride == "" {
					retryOverride = "{}"
				}
				api(t, "PUT", "/api/channel/", admin, map[string]any{"id": channelID, "type": constant.ChannelTypeNovelAI, "priority": 10, "param_override": firstOverride})
				api(t, "PUT", "/api/channel/", admin, map[string]any{"id": retryID, "type": constant.ChannelTypeNovelAI, "param_override": retryOverride, "model_mapping": string(mapping)})
				before := balances(t)
				retryUsed := api(t, "GET", retryPath, admin, nil).Get("used_quota").Int()
				logsBefore := api(t, "GET", "/api/log/?type=2&token_name=nai-gateway-test", admin, nil).Get("total").Int()
				beforeCalls, beforeRetryCalls := calls.Load(), retryCalls.Load()
				status, body := request(t, "POST", "/v1/images/generations", key, map[string]any{"model": paid, "prompt": "a landscape", "size": "832x1216", "n": 1})
				wantStatus := tc.status
				if wantStatus == 0 {
					wantStatus = http.StatusOK
				}
				require.Equal(t, wantStatus, status, "error code: %s", gjson.GetBytes(body, "error.code").String())
				assert.Equal(t, tc.calls, calls.Load()-beforeCalls)
				assert.Equal(t, tc.retryCalls, retryCalls.Load()-beforeRetryCalls, "retry must select the lower-priority channel")
				charge, successes := int64(0), int64(0)
				if status == http.StatusOK {
					charge, successes = tc.charge, 1
				}
				want := [6]int64{before[0] - charge, before[1] + charge, before[2] + successes, before[3] - charge, before[4] + charge, before[5]}
				require.Eventually(t, func() bool { return balances(t) == want }, 5*time.Second, 100*time.Millisecond)
				assert.Equal(t, retryUsed+charge, api(t, "GET", retryPath, admin, nil).Get("used_quota").Int())
				logs := api(t, "GET", "/api/log/?type=2&token_name=nai-gateway-test", admin, nil)
				require.Equal(t, logsBefore+successes, logs.Get("total").Int())
				if status == http.StatusOK {
					entry := logs.Get("items.0")
					assert.Equal(t, retryID, entry.Get("channel").Int())
					assert.Equal(t, charge, entry.Get("quota").Int())
				}
			})
		}
	})
	t.Run("unauthenticated request never reaches upstream", func(t *testing.T) {
		before := calls.Load()
		status, _ := request(t, "POST", "/v1/images/generations", "", map[string]any{"model": paid, "prompt": "test"})
		assert.Equal(t, http.StatusUnauthorized, status)
		assert.Equal(t, before, calls.Load())
	})
	t.Run("existing image client selects a model and saves PNG", func(t *testing.T) {
		bun, script := os.Getenv("NAI_CLIENT_BUN"), os.Getenv("NAI_CLIENT_SCRIPT")
		if bun == "" || script == "" {
			t.Skip("set NAI_CLIENT_BUN and NAI_CLIENT_SCRIPT to test baoyu-image-gen with the mock upstream")
		}
		upstreamStatus.Store(http.StatusCreated)
		returned.Store(1)
		api(t, "PUT", "/api/channel/", admin, map[string]any{"id": channelID, "type": constant.ChannelTypeNovelAI, "param_override": "{}"})
		api(t, "PUT", "/api/token/", admin, map[string]any{"id": tokenID, "name": "nai-gateway-test", "remain_quota": 1000000, "expired_time": -1, "group": "default"})
		status, body := request(t, "GET", "/v1/models", key, nil)
		require.Equal(t, http.StatusOK, status)
		models := []string{}
		for _, entry := range gjson.GetBytes(body, "data").Array() {
			models = append(models, entry.Get("id").String())
		}
		require.Contains(t, models, free)
		home := t.TempDir()
		configDir := filepath.Join(home, ".baoyu-skills", "baoyu-image-gen")
		require.NoError(t, os.MkdirAll(configDir, 0700))
		require.NoError(t, os.WriteFile(filepath.Join(configDir, "EXTEND.md"), []byte("---\nversion: 1\ndefault_provider: openai\ndefault_quality: normal\ndefault_model:\n  openai: "+free+"\n---\n"), 0600))
		output := filepath.Join(home, "client.png")
		if path := os.Getenv("NAI_CLIENT_OUTPUT_PATH"); path != "" {
			output = path
		}
		before := balances(t)
		beforeCalls := calls.Load()
		command := exec.CommandContext(t.Context(), bun, script,
			"--provider", "openai", "--model", free, "--prompt", "a landscape",
			"--size", "832x1216", "--quality", "normal", "--image", output, "--json")
		command.Dir = home
		command.Env = []string{"PATH=" + os.Getenv("PATH"), "HOME=" + home, "OPENAI_API_KEY=" + key, "OPENAI_BASE_URL=" + base + "/v1"}
		clientOutput, err := command.CombinedOutput()
		require.NoError(t, err, "image client: %s", clientOutput)
		data, err := os.ReadFile(output)
		require.NoError(t, err)
		decoded, err := png.Decode(bytes.NewReader(data))
		require.NoError(t, err)
		assert.Equal(t, fixtureImage.Bounds(), decoded.Bounds())
		assert.Equal(t, fixturePNG.Bytes(), data, "the client must preserve the complete image payload")
		assert.Equal(t, beforeCalls+1, calls.Load(), "client compatibility must not require a second generation")
		want := before
		want[2]++
		require.Eventually(t, func() bool { return balances(t) == want }, 5*time.Second, 100*time.Millisecond)
		t.Logf("baoyu-image-gen selected %s and saved a valid %dx%d mock PNG", free, decoded.Bounds().Dx(), decoded.Bounds().Dy())
	})
	require.False(t, t.Failed(), "fixture checks must pass before contacting the live provider")
	t.Run("live Opus image through full gateway", func(t *testing.T) {
		if os.Getenv("NAI_LIVE_TEST") != "1" {
			t.Skip("set NAI_LIVE_TEST=1 and NAI_TOKEN for one real Opus image")
		}
		token := os.Getenv("NAI_TOKEN")
		require.NotEmpty(t, token)
		liveModel, subscription := liveOpusImageModel(t, token)
		anlas := *subscription.Points.Fixed + *subscription.Points.Purchased
		width, height, expectedAnlas := 832, 1216, int64(0)
		if os.Getenv("NAI_LIVE_PAID_TEST") == "1" {
			require.Equal(t, "1", os.Getenv("NAI_ALLOW_ANLAS_TEST"))
			require.Equal(t, "nai-diffusion-5-full-medium", liveModel)
			width, height, expectedAnlas = 1024, 1536, 26
			require.GreaterOrEqual(t, anlas, expectedAnlas)
		}
		liveMapping, err := common.Marshal(map[string]string{paid: liveModel, free: liveModel, legacy: liveModel})
		require.NoError(t, err)
		api(t, "PUT", "/api/token/", admin, map[string]any{"id": tokenID, "name": "nai-gateway-test", "remain_quota": 1000000, "expired_time": -1, "group": "default"})
		api(t, "PUT", "/api/channel/", admin, map[string]any{
			"id": channelID, "type": constant.ChannelTypeNovelAI, "base_url": "https://image.novelai.net",
			"key": token, "param_override": "{}", "model_mapping": string(liveMapping),
		})
		liveSteps := 23
		if liveModel == "nai-diffusion-5-full-medium" {
			liveSteps = 14
		}
		resources := func(t *testing.T) opusTestSubscription {
			t.Helper()
			status, body := request(t, "GET", fmt.Sprintf("/api/channel/update_balance/%d", channelID), admin, nil)
			require.Equal(t, http.StatusOK, status)
			require.True(t, gjson.GetBytes(body, "success").Bool())
			require.False(t, gjson.GetBytes(body, "balance").Exists(), "Anlas must not be exposed as USD")
			require.Greater(t, gjson.GetBytes(body, "novelai.sampled_at").Int(), int64(0))
			var snapshot opusTestSubscription
			require.NoError(t, common.UnmarshalJsonStr(gjson.GetBytes(body, "novelai").Raw, &snapshot))
			require.NotNil(t, snapshot.Points.Fixed)
			require.NotNil(t, snapshot.Points.Purchased)
			if strings.HasPrefix(liveModel, "nai-diffusion-5-") {
				require.NotNil(t, snapshot.Usage)
				require.NotNil(t, snapshot.Usage.Percent)
				require.NotNil(t, snapshot.Usage.Negative)
			}
			return snapshot
		}
		resourcesBefore := resources(t)
		require.Equal(t, anlas, *resourcesBefore.Points.Fixed+*resourcesBefore.Points.Purchased)
		channelBefore := api(t, "GET", channelPath, admin, nil)
		before := balances(t)
		expectedCharge := int64(5000)
		code, body := request(t, "POST", "/v1/images/generations", key, map[string]any{
			"model": paid, "prompt": "a quiet mountain lake, pine forest, blue sky, watercolor landscape, no people",
			"n": 1, "size": fmt.Sprintf("%dx%d", width, height), "response_format": "b64_json",
			"parameters": map[string]any{"steps": liveSteps},
		})
		require.Equal(t, http.StatusOK, code, "error code: %s", gjson.GetBytes(body, "error.code").String())
		image, err := base64.StdEncoding.DecodeString(gjson.GetBytes(body, "data.0.b64_json").String())
		require.NoError(t, err)
		config, err := png.DecodeConfig(bytes.NewReader(image))
		require.NoError(t, err)
		require.Equal(t, width, config.Width)
		require.Equal(t, height, config.Height)
		resourcesAfter := resources(t)
		anlasAfter := *resourcesAfter.Points.Fixed + *resourcesAfter.Points.Purchased
		assert.Equal(t, expectedAnlas, anlas-anlasAfter, "upstream deduction must match the checked price")
		want := [6]int64{before[0] - expectedCharge, before[1] + expectedCharge, before[2] + 1, before[3] - expectedCharge, before[4] + expectedCharge, before[5] + expectedCharge}
		require.Eventually(t, func() bool { return balances(t) == want }, 5*time.Second, 100*time.Millisecond,
			"the explicitly selected test price must reconcile all accounts")
		channelAfter := api(t, "GET", channelPath, admin, nil)
		assert.Equal(t, channelBefore.Get("balance").Raw, channelAfter.Get("balance").Raw)
		assert.Equal(t, channelBefore.Get("balance_updated_time").Raw, channelAfter.Get("balance_updated_time").Raw,
			"resource queries must not persist a USD balance")
		logs := api(t, "GET", "/api/log/?type=2&token_name=nai-gateway-test", admin, nil).Get("items").Array()
		require.NotEmpty(t, logs)
		assert.Equal(t, expectedCharge, logs[0].Get("quota").Int())
		assert.Equal(t, int64(1), gjson.Get(logs[0].Get("other").String(), "image_count").Int())
		if path := os.Getenv("NAI_OUTPUT_PATH"); path != "" {
			require.NoError(t, os.WriteFile(path, image, 0600))
		}
		t.Logf("full authenticated image relay completed; model=%s; size=%dx%d; steps=%d; Anlas before=%d after=%d; isolated deduction=%d",
			liveModel, width, height, liveSteps, anlas, anlasAfter, anlas-anlasAfter)
	})
}
