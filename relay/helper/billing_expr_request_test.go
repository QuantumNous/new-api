package helper

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func outboundImageBillingInfo(apiType int, model string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{ApiType: apiType},
		Request:     &dto.ImageRequest{Model: model},
	}
}

func outboundPromptTexts(t *testing.T, billing *OutboundImageBilling) []string {
	t.Helper()
	field := reflect.ValueOf(billing).Elem().FieldByName("PromptTexts")
	require.True(t, field.IsValid(), "outbound billing must separate transient PromptTexts")
	texts, ok := field.Interface().([]string)
	require.True(t, ok, "PromptTexts must be []string")
	return texts
}

func imageRequestScalar(t *testing.T, input billingexpr.RequestInput, fieldName string) float64 {
	t.Helper()
	switch fieldName {
	case "ImagesUpTo1_5K":
		require.NotNil(t, input.ImagesUpTo1_5K)
		return *input.ImagesUpTo1_5K
	case "ImagesAbove1_5K":
		require.NotNil(t, input.ImagesAbove1_5K)
		return *input.ImagesAbove1_5K
	case "InputImages":
		require.NotNil(t, input.InputImages)
		return *input.InputImages
	default:
		t.Fatalf("unknown request scalar field %s", fieldName)
		return 0
	}
}

func TestResolveIncomingBillingExprRequestInput(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("Content-Type", "application/json")

	body := []byte(`{"service_tier":"fast"}`)
	ctx.Request.Body = io.NopCloser(bytes.NewReader(body))
	ctx.Set(common.KeyRequestBody, body)

	info := &relaycommon.RelayInfo{
		RequestHeaders: map[string]string{"Content-Type": "application/json"},
	}

	input, err := ResolveIncomingBillingExprRequestInput(ctx, info)
	require.NoError(t, err)
	require.Equal(t, body, input.Body)
	require.Equal(t, "application/json", input.Headers["Content-Type"])
}

func TestBuildBillingExprRequestInputFromRequest(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:  "gemini-3.1-pro-preview",
		Stream: lo.ToPtr(true),
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hi",
			},
		},
		MaxTokens: lo.ToPtr(uint(3000)),
	}

	input, err := BuildBillingExprRequestInputFromRequest(request, map[string]string{
		"Content-Type": "application/json",
		"X-Test":       "1",
	})
	require.NoError(t, err)
	require.Equal(t, "application/json", input.Headers["Content-Type"])
	require.Equal(t, "1", input.Headers["X-Test"])
	require.True(t, gjson.GetBytes(input.Body, "stream").Bool())
	require.Equal(t, "user", gjson.GetBytes(input.Body, "messages.0.role").String())
	require.Equal(t, float64(3000), gjson.GetBytes(input.Body, "max_tokens").Float())
}

func TestBuildBillingExprRequestInputFromRequestSanitizesSeedreamImages(t *testing.T) {
	request := &dto.ImageRequest{}
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"doubao-seedream-5-0-pro-260628",
		"prompt":"secret prompt",
		"size":"1K",
		"image":"data:image/png;base64,c2VjcmV0"
	}`), request))

	input, err := BuildBillingExprRequestInputFromRequest(request, map[string]string{"X-Test": "1"})
	require.NoError(t, err)
	require.Empty(t, input.Body)
	assert.Equal(t, "1", input.Headers["X-Test"])
	assert.Equal(t, float64(1), imageRequestScalar(t, input, "ImagesUpTo1_5K"))
	assert.Equal(t, float64(0), imageRequestScalar(t, input, "ImagesAbove1_5K"))
	assert.Equal(t, float64(1), imageRequestScalar(t, input, "InputImages"))
}

func TestResolveImageBillingRequestInputDerivesOnlyBoundedSeedreamScalars(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantLower  float64
		wantHigher float64
		wantInputs float64
		wantError  string
	}{
		{name: "default size is 2K", body: `{"model":"doubao-seedream-5-0-pro-260628","prompt":"secret prompt"}`, wantHigher: 1},
		{name: "1K is lower tier", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"1K"}`, wantLower: 1},
		{name: "1.5K is lower tier", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"1.5k"}`, wantLower: 1},
		{name: "2K is higher tier", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"2K"}`, wantHigher: 1},
		{name: "pixel boundary is lower tier", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"1500x1740"}`, wantLower: 1},
		{name: "pixel above boundary is higher tier", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"1501*1740"}`, wantHigher: 1},
		{name: "multiple outputs stay in one tier", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"1K","n":3}`, wantLower: 3},
		{name: "reference array stores only its count", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"1K","image":["https://secret.example/a.png","data:image/png;base64,c2VjcmV0"]}`, wantLower: 1, wantInputs: 2},
		{name: "layer decomposition reserves seventeen lower outputs", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"1K","image":"https://secret.example/a.png","layer_decomposition":true}`, wantLower: 17, wantInputs: 1},
		{name: "layer decomposition default is conservative", body: `{"model":"doubao-seedream-5-0-pro-260628","image":"https://secret.example/a.png","layer_decomposition":true}`, wantHigher: 17, wantInputs: 1},
		{name: "unknown size is conservative", body: `{"model":"doubao-seedream-5-0-pro-260628","size":"provider-auto"}`, wantHigher: 1},
		{name: "pro output count follows profile limit", body: `{"model":"doubao-seedream-5-0-pro-260628","n":16}`, wantError: "between 1 and 15"},
		{name: "pro references follow profile limit", body: `{"model":"doubao-seedream-5-0-pro-260628","image":["1","2","3","4","5","6","7","8","9","10","11"]}`, wantError: "at most 10"},
		{name: "ordinary references follow provider ceiling", body: `{"model":"doubao-seedream-4-0-20260415","image":["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15"]}`, wantError: "at most 14"},
		{name: "layer decomposition requires one reference", body: `{"model":"doubao-seedream-5-0-pro-260628","layer_decomposition":true}`, wantError: "exactly one"},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			request := &dto.ImageRequest{}
			require.NoError(t, common.Unmarshal([]byte(testCase.body), request))
			input, err := ResolveImageBillingRequestInput(
				nil,
				&relaycommon.RelayInfo{Request: request},
				billingexpr.RequestInput{Body: []byte(testCase.body)},
			)
			if testCase.wantError != "" {
				require.ErrorContains(t, err, testCase.wantError)
				return
			}
			require.NoError(t, err)
			require.Empty(t, input.Body, "image billing snapshots retain only scalar counts")
			assert.Equal(t, testCase.wantLower, imageRequestScalar(t, input, "ImagesUpTo1_5K"))
			assert.Equal(t, testCase.wantHigher, imageRequestScalar(t, input, "ImagesAbove1_5K"))
			assert.Equal(t, testCase.wantInputs, imageRequestScalar(t, input, "InputImages"))
			encoded, marshalErr := common.Marshal(input)
			require.NoError(t, marshalErr)
			assert.NotContains(t, string(encoded), "secret")
			assert.NotContains(t, string(encoded), "base64")
			assert.NotContains(t, string(encoded), "prompt")
		})
	}
}

func TestResolveIncomingBillingExprRequestInputClonesSeedreamScalars(t *testing.T) {
	request := &dto.ImageRequest{}
	require.NoError(t, common.Unmarshal([]byte(`{"model":"doubao-seedream-5-0-pro-260628","size":"1K"}`), request))
	input, err := ResolveImageBillingRequestInput(nil, &relaycommon.RelayInfo{Request: request}, billingexpr.RequestInput{})
	require.NoError(t, err)

	cloned, err := ResolveIncomingBillingExprRequestInput(nil, &relaycommon.RelayInfo{BillingRequestInput: &input})
	require.NoError(t, err)
	require.NotNil(t, input.ImagesUpTo1_5K)
	*input.ImagesUpTo1_5K = 9
	assert.Equal(t, float64(1), imageRequestScalar(t, cloned, "ImagesUpTo1_5K"))
}

func TestResolveIncomingBillingExprRequestInputFreezesSeedreamScalars(t *testing.T) {
	request := &dto.ImageRequest{}
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"doubao-seedream-5-0-pro-260628",
		"prompt":"secret prompt",
		"size":"2K",
		"image":["https://secret.example/a.png","https://secret.example/b.png"]
	}`), request))
	input, err := ResolveIncomingBillingExprRequestInput(nil, &relaycommon.RelayInfo{Request: request})
	require.NoError(t, err)
	require.Empty(t, input.Body)

	request.Size = "1K"
	request.Image = nil
	cost, trace, err := billingexpr.RunExprWithRequest(
		`tier("seedream", fixed(images_up_to_1_5k * 0.1 + images_above_1_5k * 0.2 + max(input_images - 1, 0) * 0.01))`,
		billingexpr.TokenParams{},
		input,
	)
	require.NoError(t, err)
	assert.Equal(t, billingexpr.BillingUnitRequest, trace.BillingUnit)
	assert.InDelta(t, 210000, cost, 1e-9)
}

func TestResolveOutboundImageBillingJSONPreservesOriginIdentity(t *testing.T) {
	info := outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin-image")
	info.BillingRequestInput = &billingexpr.RequestInput{
		Headers:         map[string]string{"X-Frozen": "yes"},
		Body:            []byte(`{"quality":"standard"}`),
		EvaluatedAtUnix: 123,
	}
	resolved, err := ResolveOutboundImageBillingJSON(info, []byte(`{
		"model":"provider-image-alias",
		"prompt":"secret prompt",
		"n":2,
		"size":"1024x1024",
		"quality":"hd",
		"parameters":{"n":3}
	}`))
	require.NoError(t, err)
	require.NotNil(t, resolved)
	assert.Equal(t, "billing-origin-image", resolved.Request.Model)
	assert.Empty(t, resolved.Request.Prompt)
	assert.Equal(t, []string{"secret prompt"}, outboundPromptTexts(t, resolved))
	assert.Equal(t, 2, resolved.Count)
	assert.Equal(t, "yes", resolved.Input.Headers["X-Frozen"])
	assert.Equal(t, int64(123), resolved.Input.EvaluatedAtUnix)
	assert.Equal(t, "billing-origin-image", gjson.GetBytes(resolved.Input.Body, "model").String())
	assert.Equal(t, int64(2), gjson.GetBytes(resolved.Input.Body, "n").Int())
	assert.Equal(t, "hd", gjson.GetBytes(resolved.Input.Body, "quality").String())
	assert.Equal(t, int64(3), gjson.GetBytes(resolved.Input.Body, "parameters.n").Int())
	assert.NotContains(t, string(resolved.Input.Body), "secret")
	assert.NotContains(t, string(resolved.Input.Body), "prompt")
}

func TestResolveOutboundImageBillingJSONUsesExplicitNativeSchemas(t *testing.T) {
	tests := []struct {
		name        string
		apiType     int
		payload     string
		wantCount   int
		wantPrompts []string
		assertBody  func(t *testing.T, body []byte)
	}{
		{
			name:      "Gemini",
			apiType:   constant.APITypeGemini,
			wantCount: 2,
			payload: `{
				"instances":[{"prompt":"gemini secret"}],
				"parameters":{"sampleCount":2,"aspectRatio":"3:2","imageSize":"2K","personGeneration":"allow_adult"}
			}`,
			wantPrompts: []string{"gemini secret"},
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, "billing-origin", gjson.GetBytes(body, "model").String())
				assert.Equal(t, int64(2), gjson.GetBytes(body, "n").Int())
				assert.Equal(t, "3:2", gjson.GetBytes(body, "size").String())
				assert.Equal(t, "2K", gjson.GetBytes(body, "resolution").String())
				assert.Equal(t, int64(2), gjson.GetBytes(body, "parameters.sampleCount").Int())
				assert.Equal(t, "allow_adult", gjson.GetBytes(body, "parameters.personGeneration").String())
			},
		},
		{
			name:      "Vertex",
			apiType:   constant.APITypeVertexAi,
			wantCount: 3,
			payload: `{
				"instances":[{"prompt":"vertex secret"}],
				"parameters":{"sampleCount":3,"aspectRatio":"16:9","imageSize":"1K","personGeneration":"dont_allow"}
			}`,
			wantPrompts: []string{"vertex secret"},
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, int64(3), gjson.GetBytes(body, "n").Int())
				assert.Equal(t, int64(3), gjson.GetBytes(body, "parameters.sampleCount").Int())
				assert.Equal(t, "16:9", gjson.GetBytes(body, "parameters.aspectRatio").String())
				assert.Equal(t, "1K", gjson.GetBytes(body, "quality").String())
			},
		},
		{
			name:      "Replicate",
			apiType:   constant.APITypeReplicate,
			wantCount: 4,
			payload: `{
				"input":{
					"prompt":"replicate secret",
					"negative_prompt":"replicate negative secret",
					"num_outputs":4,
					"aspect_ratio":"16:9",
					"width":1024,
					"height":576,
					"prompt_upsampling":true,
					"output_format":"webp",
					"image_prompt":"https://secret.invalid/input.png",
					"Extra":"must-not-survive"
				}
			}`,
			wantPrompts: []string{"replicate secret", "replicate negative secret"},
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, int64(4), gjson.GetBytes(body, "n").Int())
				assert.Equal(t, int64(4), gjson.GetBytes(body, "input.num_outputs").Int())
				assert.Equal(t, "16:9", gjson.GetBytes(body, "input.aspect_ratio").String())
				assert.Equal(t, int64(1024), gjson.GetBytes(body, "input.width").Int())
				assert.True(t, gjson.GetBytes(body, "input.prompt_upsampling").Bool())
				assert.Equal(t, "webp", gjson.GetBytes(body, "input.output_format").String())
				assert.False(t, gjson.GetBytes(body, "input.image_prompt").Exists())
				assert.False(t, gjson.GetBytes(body, "input.Extra").Exists())
			},
		},
		{
			name:      "SiliconFlow",
			apiType:   constant.APITypeSiliconFlow,
			wantCount: 2,
			payload: `{
				"model":"provider-alias",
				"prompt":"silicon prompt secret",
				"negative_prompt":"silicon negative secret",
				"batch_size":2,
				"image_size":"1024x768",
				"seed":42,
				"num_inference_steps":30,
				"guidance_scale":7.5,
				"cfg":4.5,
				"image":"data:image/png;base64,c2VjcmV0",
				"image2":"https://secret.invalid/two.png",
				"image3":"secret-three"
			}`,
			wantPrompts: []string{"silicon prompt secret", "silicon negative secret"},
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, "billing-origin", gjson.GetBytes(body, "model").String())
				assert.Equal(t, int64(2), gjson.GetBytes(body, "n").Int())
				assert.Equal(t, int64(2), gjson.GetBytes(body, "batch_size").Int())
				assert.Equal(t, "1024x768", gjson.GetBytes(body, "size").String())
				assert.Equal(t, int64(42), gjson.GetBytes(body, "seed").Int())
				assert.InDelta(t, 7.5, gjson.GetBytes(body, "guidance_scale").Float(), 1e-9)
				assert.False(t, gjson.GetBytes(body, "image").Exists())
				assert.False(t, gjson.GetBytes(body, "image2").Exists())
				assert.False(t, gjson.GetBytes(body, "image3").Exists())
			},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
			)
			require.NoError(t, err)
			require.NotNil(t, resolved)
			assert.Equal(t, testCase.wantCount, resolved.Count)
			assert.Equal(t, testCase.wantPrompts, outboundPromptTexts(t, resolved))
			testCase.assertBody(t, resolved.Input.Body)
			assert.NotContains(t, string(resolved.Input.Body), "secret")
			assert.NotContains(t, string(resolved.Input.Body), "base64")
			assert.False(t, gjson.GetBytes(resolved.Input.Body, "prompt").Exists())
			assert.False(t, gjson.GetBytes(resolved.Input.Body, "negative_prompt").Exists())
			assert.False(t, gjson.GetBytes(resolved.Input.Body, "instances.0.prompt").Exists())
			assert.False(t, gjson.GetBytes(resolved.Input.Body, "input.prompt").Exists())
		})
	}
}

func TestResolveOutboundImageBillingJSONDefaultsMissingConfirmedNativeCount(t *testing.T) {
	tests := []struct {
		name      string
		apiType   int
		payload   string
		countPath string
	}{
		{
			name:      "Replicate",
			apiType:   constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"replicate prompt"}}`,
			countPath: "input.num_outputs",
		},
		{
			name:      "SiliconFlow",
			apiType:   constant.APITypeSiliconFlow,
			payload:   `{"prompt":"silicon prompt"}`,
			countPath: "batch_size",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
				true,
			)
			require.NoError(t, err)
			require.NotNil(t, resolved)
			assert.Equal(t, 1, resolved.Count)
			assert.Equal(t, int64(1), gjson.GetBytes(resolved.Input.Body, testCase.countPath).Int())
		})
	}
}

func TestMaterializeOutboundImageBillingDefaultsOnlyForConfirmedMissingCount(t *testing.T) {
	tests := []struct {
		name            string
		apiType         int
		payload         string
		schemaConfirmed bool
		countPath       string
		wantExists      bool
		wantNull        bool
	}{
		{
			name: "confirmed Replicate", apiType: constant.APITypeReplicate,
			payload:         `{"input":{"prompt":"replicate prompt"}}`,
			schemaConfirmed: true, countPath: "input.num_outputs", wantExists: true,
		},
		{
			name: "unconfirmed Replicate", apiType: constant.APITypeReplicate,
			payload:         `{"input":{"prompt":"replicate prompt"}}`,
			schemaConfirmed: false, countPath: "input.num_outputs",
		},
		{
			name: "explicit Replicate null", apiType: constant.APITypeReplicate,
			payload:         `{"input":{"prompt":"replicate prompt","num_outputs":null}}`,
			schemaConfirmed: true, countPath: "input.num_outputs", wantExists: true, wantNull: true,
		},
		{
			name: "confirmed SiliconFlow", apiType: constant.APITypeSiliconFlow,
			payload:         `{"prompt":"silicon prompt"}`,
			schemaConfirmed: true, countPath: "batch_size", wantExists: true,
		},
		{
			name: "unconfirmed SiliconFlow", apiType: constant.APITypeSiliconFlow,
			payload:         `{"prompt":"silicon prompt"}`,
			schemaConfirmed: false, countPath: "batch_size",
		},
		{
			name: "explicit SiliconFlow null", apiType: constant.APITypeSiliconFlow,
			payload:         `{"prompt":"silicon prompt","batch_size":null}`,
			schemaConfirmed: true, countPath: "batch_size", wantExists: true, wantNull: true,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			materialized, err := MaterializeOutboundImageBillingDefaults(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
				testCase.schemaConfirmed,
			)
			require.NoError(t, err)
			count := gjson.GetBytes(materialized, testCase.countPath)
			assert.Equal(t, testCase.wantExists, count.Exists())
			assert.Equal(t, testCase.wantNull, count.Type == gjson.Null && count.Exists())
			if testCase.wantExists && !testCase.wantNull {
				assert.Equal(t, int64(1), count.Int())
			}
		})
	}
}

func TestResolveOutboundImageBillingJSONConfirmedNativeCountRejectsExplicitInvalidValues(t *testing.T) {
	tests := []struct {
		name      string
		apiType   int
		payload   string
		wantError string
	}{
		{
			name: "Replicate null", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"replicate prompt","num_outputs":null}}`,
			wantError: "between 1 and 128",
		},
		{
			name: "Replicate zero", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"replicate prompt","num_outputs":0}}`,
			wantError: "between 1 and 128",
		},
		{
			name: "Replicate string", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"replicate prompt","num_outputs":"1"}}`,
			wantError: "integer between 1 and 128",
		},
		{
			name: "Replicate above limit", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"replicate prompt","num_outputs":129}}`,
			wantError: "between 1 and 128",
		},
		{
			name: "SiliconFlow null", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"silicon prompt","batch_size":null}`,
			wantError: "between 1 and 128",
		},
		{
			name: "SiliconFlow zero", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"silicon prompt","batch_size":0}`,
			wantError: "between 1 and 128",
		},
		{
			name: "SiliconFlow string", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"silicon prompt","batch_size":"1"}`,
			wantError: "integer between 1 and 128",
		},
		{
			name: "SiliconFlow above limit", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"silicon prompt","batch_size":129}`,
			wantError: "between 1 and 128",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
				true,
			)
			require.ErrorContains(t, err, testCase.wantError)
			assert.Nil(t, resolved)
		})
	}
}

func TestResolveOutboundImageBillingJSONSupportsRemainingNativeSchemas(t *testing.T) {
	tests := []struct {
		name        string
		apiType     int
		payload     string
		wantCount   int
		wantPrompts []string
		assertBody  func(t *testing.T, body []byte)
	}{
		{
			name: "MiniMax", apiType: constant.APITypeMiniMax, wantCount: 3,
			payload:     `{"model":"upstream","prompt":"minimax secret","n":3,"aspect_ratio":"16:9","response_format":"url","prompt_optimizer":true,"aigc_watermark":false}`,
			wantPrompts: []string{"minimax secret"},
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, int64(3), gjson.GetBytes(body, "n").Int())
				assert.Equal(t, "16:9", gjson.GetBytes(body, "aspect_ratio").String())
				assert.Equal(t, "16:9", gjson.GetBytes(body, "size").String())
				assert.True(t, gjson.GetBytes(body, "prompt_optimizer").Bool())
				assert.True(t, gjson.GetBytes(body, "aigc_watermark").Exists())
			},
		},
		{
			name: "Jimeng", apiType: constant.APITypeJimeng, wantCount: 1,
			payload: `{
				"req_key":"mapped-model",
				"prompt":"jimeng secret",
				"seed":-1,
				"width":768,
				"height":768,
				"use_pre_llm":true,
				"use_sr":false,
				"return_url":true,
				"logo_info":{"add_logo":true,"position":1,"language":0,"opacity":0.5,"logo_text_content":"secret logo"},
				"image_urls":["https://secret.invalid/input.png"],
				"binary_data_base64":["c2VjcmV0"]
			}`,
			wantPrompts: []string{"jimeng secret"},
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, "billing-origin", gjson.GetBytes(body, "model").String())
				assert.Equal(t, int64(1), gjson.GetBytes(body, "n").Int())
				assert.Equal(t, int64(-1), gjson.GetBytes(body, "seed").Int())
				assert.Equal(t, "768x768", gjson.GetBytes(body, "resolution").String())
				assert.True(t, gjson.GetBytes(body, "logo_info.add_logo").Bool())
				assert.InDelta(t, 0.5, gjson.GetBytes(body, "logo_info.opacity").Float(), 1e-9)
				assert.False(t, gjson.GetBytes(body, "req_key").Exists())
				assert.False(t, gjson.GetBytes(body, "logo_info.logo_text_content").Exists())
				assert.False(t, gjson.GetBytes(body, "image_urls").Exists())
				assert.False(t, gjson.GetBytes(body, "binary_data_base64").Exists())
			},
		},
		{
			name: "xAI", apiType: constant.APITypeXai, wantCount: 2,
			payload:     `{"model":"mapped-model","prompt":"xai secret","n":2,"response_format":"url"}`,
			wantPrompts: []string{"xai secret"},
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, "billing-origin", gjson.GetBytes(body, "model").String())
				assert.Equal(t, int64(2), gjson.GetBytes(body, "n").Int())
				assert.Equal(t, "url", gjson.GetBytes(body, "response_format").String())
			},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
			)
			require.NoError(t, err)
			require.NotNil(t, resolved)
			assert.Equal(t, testCase.wantCount, resolved.Count)
			assert.Equal(t, testCase.wantPrompts, outboundPromptTexts(t, resolved))
			testCase.assertBody(t, resolved.Input.Body)
			assert.NotContains(t, string(resolved.Input.Body), "secret")
			assert.False(t, gjson.GetBytes(resolved.Input.Body, "prompt").Exists())
			assert.False(t, gjson.GetBytes(resolved.Input.Body, "input.prompt").Exists())
		})
	}
}

func TestResolveOutboundImageBillingJSONUsesOnlyBoundedTypesWithoutJimengSourceRanges(t *testing.T) {
	resolved, err := ResolveOutboundImageBillingJSON(
		outboundImageBillingInfo(constant.APITypeJimeng, "billing-origin"),
		[]byte(`{
			"prompt":"jimeng secret",
			"seed":-2,
			"width":256,
			"height":768,
			"logo_info":{"position":-1,"language":-1,"opacity":2}
		}`),
	)
	require.NoError(t, err)
	require.NotNil(t, resolved)
	assert.Equal(t, int64(-2), gjson.GetBytes(resolved.Input.Body, "seed").Int())
	assert.Equal(t, int64(-1), gjson.GetBytes(resolved.Input.Body, "logo_info.position").Int())
	assert.Equal(t, int64(-1), gjson.GetBytes(resolved.Input.Body, "logo_info.language").Int())
	assert.InDelta(t, 2, gjson.GetBytes(resolved.Input.Body, "logo_info.opacity").Float(), 1e-9)
}

func TestResolveOutboundImageBillingJSONExposesOnlyAllowedOpenAIScalars(t *testing.T) {
	resolved, err := ResolveOutboundImageBillingJSON(
		outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
		[]byte(`{
			"model":"mapped-model",
			"prompt":"openai secret",
			"n":2,
			"size":"1536x1024",
			"quality":"high",
			"response_format":"url",
			"style":"vivid",
			"background":"transparent",
			"moderation":"low",
			"output_format":"webp",
			"output_compression":90,
			"partial_images":1,
			"stream":true,
			"input_fidelity":"high",
			"watermark":false,
			"layer_decomposition":false,
			"watermark_enabled":true,
			"parameters":{"n":3,"prompt_extend":true,"unsafe":"must-not-survive"},
			"image":"https://secret.invalid/input.png",
			"mask":"data:image/png;base64,c2VjcmV0",
			"Extra":"must-not-survive"
		}`),
	)
	require.NoError(t, err)
	require.NotNil(t, resolved)
	assert.Equal(t, 2, resolved.Count)
	assert.Equal(t, []string{"openai secret"}, outboundPromptTexts(t, resolved))
	assert.Equal(t, "billing-origin", gjson.GetBytes(resolved.Input.Body, "model").String())
	assert.Equal(t, int64(2), gjson.GetBytes(resolved.Input.Body, "n").Int())
	assert.Equal(t, "1536x1024", gjson.GetBytes(resolved.Input.Body, "resolution").String())
	assert.Equal(t, "transparent", gjson.GetBytes(resolved.Input.Body, "background").String())
	assert.Equal(t, "webp", gjson.GetBytes(resolved.Input.Body, "output_format").String())
	assert.Equal(t, int64(3), gjson.GetBytes(resolved.Input.Body, "parameters.n").Int())
	assert.True(t, gjson.GetBytes(resolved.Input.Body, "parameters.prompt_extend").Bool())
	assert.False(t, gjson.GetBytes(resolved.Input.Body, "parameters.unsafe").Exists())
	assert.False(t, gjson.GetBytes(resolved.Input.Body, "image").Exists())
	assert.False(t, gjson.GetBytes(resolved.Input.Body, "mask").Exists())
	assert.False(t, gjson.GetBytes(resolved.Input.Body, "Extra").Exists())
	assert.NotContains(t, string(resolved.Input.Body), "secret")

	cost, trace, err := billingexpr.RunExprWithRequest(
		`param("background") == "transparent" ? tier("transparent", fixed(0.2)) : tier("opaque", fixed(0.1))`,
		billingexpr.TokenParams{},
		resolved.Input,
	)
	require.NoError(t, err)
	assert.Equal(t, "transparent", trace.MatchedTier)
	assert.InDelta(t, 200_000, cost, 1e-9)
}

func TestResolveImageBillingRequestInputPreservesFinalNativeScalars(t *testing.T) {
	info := outboundImageBillingInfo(constant.APITypeSiliconFlow, "billing-origin")
	resolved, err := ResolveOutboundImageBillingJSON(info, []byte(`{
		"prompt":"transient",
		"batch_size":2,
		"image_size":"1024x768"
	}`))
	require.NoError(t, err)

	info.Request = resolved.Request
	info.BillingRequestInput = &resolved.Input
	cloned, err := ResolveIncomingBillingExprRequestInput(nil, info)
	require.NoError(t, err)
	refreshed, err := ResolveImageBillingRequestInput(nil, info, cloned)
	require.NoError(t, err)
	assert.Equal(t, "1024x768", gjson.GetBytes(refreshed.Body, "image_size").String())

	cost, trace, err := billingexpr.RunExprWithRequest(
		`(param("image_size") == "1024x768" ? tier("native", fixed(0.1)) : tier("fallback", fixed(0.01))) * image_count`,
		billingexpr.TokenParams{},
		refreshed,
	)
	require.NoError(t, err)
	assert.Equal(t, "native", trace.MatchedTier)
	assert.InDelta(t, 200_000, cost, 1e-9)
}

func TestResolveOutboundImageBillingJSONAcceptsConfirmedOpenAIDelegation(t *testing.T) {
	for _, apiType := range []int{constant.APITypeAdvancedCustom, constant.APITypeTencent} {
		resolved, err := ResolveOutboundImageBillingJSON(
			outboundImageBillingInfo(apiType, "billing-origin"),
			[]byte(`{"model":"mapped","prompt":"transient","n":2,"quality":"high"}`),
			true,
		)
		require.NoError(t, err)
		require.NotNil(t, resolved)
		assert.Equal(t, 2, resolved.Count)
		assert.Equal(t, "billing-origin", gjson.GetBytes(resolved.Input.Body, "model").String())
		assert.Equal(t, "high", gjson.GetBytes(resolved.Input.Body, "quality").String())
		assert.False(t, gjson.GetBytes(resolved.Input.Body, "prompt").Exists())
	}
}

func TestResolveOutboundImageBillingJSONFailsClosedForUnknownOrInvalidShape(t *testing.T) {
	tests := []struct {
		name      string
		apiType   int
		payload   string
		wantError string
	}{
		{
			name: "unknown API type", apiType: constant.APITypeAws,
			payload:   `{"prompt":"secret","n":1}`,
			wantError: "unsupported image billing schema",
		},
		{
			name: "unconfirmed dynamic API type", apiType: constant.APITypeAdvancedCustom,
			payload:   `{"prompt":"secret","n":1}`,
			wantError: "unsupported image billing schema",
		},
		{
			name: "unconfirmed Tencent API type", apiType: constant.APITypeTencent,
			payload:   `{"prompt":"secret","n":1}`,
			wantError: "unsupported image billing schema",
		},
		{
			name: "Replicate missing count", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"secret"}}`,
			wantError: "input.num_outputs is required",
		},
		{
			name: "Gemini missing nested shape", apiType: constant.APITypeGemini,
			payload:   `{"prompt":"secret","n":1}`,
			wantError: "instances",
		},
		{
			name: "Gemini zero instances", apiType: constant.APITypeGemini,
			payload:   `{"instances":[],"parameters":{"sampleCount":1}}`,
			wantError: "exactly one",
		},
		{
			name: "Vertex multiple instances", apiType: constant.APITypeVertexAi,
			payload:   `{"instances":[{"prompt":"one"},{"prompt":"two"}],"parameters":{"sampleCount":1}}`,
			wantError: "exactly one",
		},
		{
			name: "Gemini zero count", apiType: constant.APITypeGemini,
			payload:   `{"instances":[{"prompt":"secret"}],"parameters":{"sampleCount":0}}`,
			wantError: "between 1 and 128",
		},
		{
			name: "OpenAI null count", apiType: constant.APITypeOpenAI,
			payload:   `{"prompt":"secret","n":null}`,
			wantError: "between 1 and 128",
		},
		{
			name: "SiliconFlow count above limit", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"secret","batch_size":129}`,
			wantError: "between 1 and 128",
		},
		{
			name: "SiliconFlow missing count", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"secret"}`,
			wantError: "batch_size is required",
		},
		{
			name: "MiniMax null count", apiType: constant.APITypeMiniMax,
			payload:   `{"prompt":"secret","n":null}`,
			wantError: "between 1 and 128",
		},
		{
			name: "Jimeng string width", apiType: constant.APITypeJimeng,
			payload:   `{"prompt":"secret","width":"https://secret.invalid/image.png","height":768}`,
			wantError: "width must be a number",
		},
		{
			name: "Jimeng string boolean", apiType: constant.APITypeJimeng,
			payload:   `{"prompt":"secret","use_sr":"true"}`,
			wantError: "use_sr must be a boolean",
		},
		{
			name: "Jimeng string logo number", apiType: constant.APITypeJimeng,
			payload:   `{"prompt":"secret","logo_info":{"position":"one"}}`,
			wantError: "logo_info.position must be a number",
		},
		{
			name: "xAI fractional count", apiType: constant.APITypeXai,
			payload:   `{"prompt":"secret","n":1.5}`,
			wantError: "integer",
		},
		{
			name: "Gemini unsafe aspect ratio", apiType: constant.APITypeGemini,
			payload:   `{"instances":[{"prompt":"secret"}],"parameters":{"sampleCount":1,"aspectRatio":"https://secret.invalid/image.png"}}`,
			wantError: "parameters.aspectRatio",
		},
		{
			name: "Replicate zero width", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"secret","num_outputs":1,"width":0,"height":768}}`,
			wantError: "input.width",
		},
		{
			name: "Replicate string boolean", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"secret","num_outputs":1,"prompt_upsampling":"true"}}`,
			wantError: "input.prompt_upsampling",
		},
		{
			name: "SiliconFlow fractional seed", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"secret","batch_size":1,"seed":1.5}`,
			wantError: "seed",
		},
		{
			name: "SiliconFlow non finite guidance", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"secret","batch_size":1,"guidance_scale":1e309}`,
			wantError: "guidance_scale",
		},
		{
			name: "MiniMax string watermark", apiType: constant.APITypeMiniMax,
			payload:   `{"prompt":"secret","n":1,"aigc_watermark":"false"}`,
			wantError: "aigc_watermark",
		},
		{
			name: "Jimeng fractional width", apiType: constant.APITypeJimeng,
			payload:   `{"prompt":"secret","width":512.5,"height":768}`,
			wantError: "width",
		},
		{
			name: "Jimeng string seed", apiType: constant.APITypeJimeng,
			payload:   `{"prompt":"secret","seed":"-1","width":512,"height":768}`,
			wantError: "seed",
		},
		{
			name: "xAI unsafe response format", apiType: constant.APITypeXai,
			payload:   `{"prompt":"secret","n":1,"response_format":"data:image/png;base64,c2VjcmV0"}`,
			wantError: "response_format",
		},
		{
			name: "OpenAI string stream", apiType: constant.APITypeOpenAI,
			payload:   `{"prompt":"secret","n":1,"stream":"true"}`,
			wantError: "stream",
		},
		{
			name: "OpenAI compression above safety bound", apiType: constant.APITypeOpenAI,
			payload:   `{"prompt":"secret","n":1,"output_compression":1000001}`,
			wantError: "output_compression",
		},
		{
			name: "OpenAI partial images above safety bound", apiType: constant.APITypeOpenAI,
			payload:   `{"prompt":"secret","n":1,"partial_images":1000001}`,
			wantError: "partial_images",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
			)
			require.ErrorContains(t, err, testCase.wantError)
			assert.Nil(t, resolved)
		})
	}
}

func TestResolveOutboundImageBillingJSONRejectsProtocolInvalidScalars(t *testing.T) {
	tests := []struct {
		name      string
		apiType   int
		payload   string
		wantError string
	}{
		{
			name: "OpenAI size", apiType: constant.APITypeOpenAI,
			payload:   `{"prompt":"secret","n":1,"size":"not-a-size"}`,
			wantError: "size",
		},
		{
			name: "OpenAI quality", apiType: constant.APITypeOpenAI,
			payload:   `{"prompt":"secret","n":1,"quality":"not-a-quality"}`,
			wantError: "quality",
		},
		{
			name: "OpenAI response format", apiType: constant.APITypeOpenAI,
			payload:   `{"prompt":"secret","n":1,"response_format":"raw"}`,
			wantError: "response_format",
		},
		{
			name: "Gemini image size", apiType: constant.APITypeGemini,
			payload:   `{"instances":[{"prompt":"secret"}],"parameters":{"sampleCount":1,"imageSize":"3K"}}`,
			wantError: "parameters.imageSize",
		},
		{
			name: "Gemini aspect ratio shape", apiType: constant.APITypeGemini,
			payload:   `{"instances":[{"prompt":"secret"}],"parameters":{"sampleCount":1,"aspectRatio":"not-a-ratio"}}`,
			wantError: "parameters.aspectRatio",
		},
		{
			name: "Replicate aspect ratio", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"secret","num_outputs":1,"aspect_ratio":"7:5"}}`,
			wantError: "input.aspect_ratio",
		},
		{
			name: "Replicate width below converter range", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"secret","num_outputs":1,"width":255,"height":768}}`,
			wantError: "input.width",
		},
		{
			name: "Replicate width outside converter step", apiType: constant.APITypeReplicate,
			payload:   `{"input":{"prompt":"secret","num_outputs":1,"width":257,"height":768}}`,
			wantError: "input.width",
		},
		{
			name: "SiliconFlow image size", apiType: constant.APITypeSiliconFlow,
			payload:   `{"prompt":"secret","batch_size":1,"image_size":"c2VjcmV0"}`,
			wantError: "image_size",
		},
		{
			name: "MiniMax aspect ratio", apiType: constant.APITypeMiniMax,
			payload:   `{"prompt":"secret","n":1,"aspect_ratio":"7:5"}`,
			wantError: "aspect_ratio",
		},
		{
			name: "MiniMax response format", apiType: constant.APITypeMiniMax,
			payload:   `{"prompt":"secret","n":1,"response_format":"b64_json"}`,
			wantError: "response_format",
		},
		{
			name: "Jimeng width below protocol range", apiType: constant.APITypeJimeng,
			payload:   `{"prompt":"secret","width":255,"height":768}`,
			wantError: "width",
		},
		{
			name: "Jimeng height above protocol range", apiType: constant.APITypeJimeng,
			payload:   `{"prompt":"secret","width":256,"height":769}`,
			wantError: "height",
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
			)
			require.ErrorContains(t, err, testCase.wantError)
			assert.Nil(t, resolved)
		})
	}
}

func TestResolveOutboundImageBillingJSONAllowsSafeUnknownScalarsWithoutSourceEnums(t *testing.T) {
	tests := []struct {
		name       string
		apiType    int
		payload    string
		assertBody func(t *testing.T, body []byte)
	}{
		{
			name:    "OpenAI",
			apiType: constant.APITypeOpenAI,
			payload: `{
				"prompt":"secret",
				"n":1,
				"style":"photographic",
				"background":"blue",
				"moderation":"strict",
				"output_format":"gif",
				"input_fidelity":"medium",
				"output_compression":101,
				"partial_images":4
			}`,
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, "photographic", gjson.GetBytes(body, "style").String())
				assert.Equal(t, "blue", gjson.GetBytes(body, "background").String())
				assert.Equal(t, "strict", gjson.GetBytes(body, "moderation").String())
				assert.Equal(t, "gif", gjson.GetBytes(body, "output_format").String())
				assert.Equal(t, "medium", gjson.GetBytes(body, "input_fidelity").String())
				assert.Equal(t, int64(101), gjson.GetBytes(body, "output_compression").Int())
				assert.Equal(t, int64(4), gjson.GetBytes(body, "partial_images").Int())
			},
		},
		{
			name:    "Gemini person generation",
			apiType: constant.APITypeGemini,
			payload: `{
				"instances":[{"prompt":"secret"}],
				"parameters":{"sampleCount":1,"personGeneration":"sometimes"}
			}`,
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, "sometimes", gjson.GetBytes(body, "parameters.personGeneration").String())
			},
		},
		{
			name:    "xAI response format",
			apiType: constant.APITypeXai,
			payload: `{"prompt":"secret","n":1,"response_format":"raw"}`,
			assertBody: func(t *testing.T, body []byte) {
				assert.Equal(t, "raw", gjson.GetBytes(body, "response_format").String())
			},
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(testCase.apiType, "billing-origin"),
				[]byte(testCase.payload),
			)
			require.NoError(t, err)
			require.NotNil(t, resolved)
			testCase.assertBody(t, resolved.Input.Body)
		})
	}
}

func TestResolveOutboundImageBillingJSONRejectsSensitiveAllowedScalar(t *testing.T) {
	tests := []struct {
		name    string
		payload string
	}{
		{name: "data URI", payload: `{"prompt":"secret","n":1,"style":"data:image/png;base64,c2VjcmV0"}`},
		{name: "URL", payload: `{"prompt":"secret","n":1,"style":"https://secret.invalid/image.png"}`},
		{name: "base64 image", payload: `{"prompt":"secret","n":1,"style":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"}`},
		{name: "control character", payload: `{"prompt":"secret","n":1,"style":"high\nsecret"}`},
		{name: "overlong blob", payload: fmt.Sprintf(
			`{"prompt":"secret","n":1,"style":"%s"}`,
			strings.Repeat("a", maxImageBillingScalarBytes+1),
		)},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
				[]byte(testCase.payload),
			)
			require.Error(t, err)
			assert.Nil(t, resolved, "rejected sensitive scalars must not produce retained billing input")
		})
	}
}

func TestResolveOutboundImageBillingJSONAllowsBoundedIdentifiersThatDecodeAsBase64(t *testing.T) {
	tests := []struct {
		field string
		value string
	}{
		{field: "style", value: strings.Repeat("a", 64)},
		{field: "background", value: strings.Repeat("a", 96)},
		{field: "moderation", value: "webp"},
		{field: "output_format", value: "future_safe_format"},
		{field: "input_fidelity", value: "c2VjcmV0"},
	}
	for _, testCase := range tests {
		t.Run(testCase.field, func(t *testing.T) {
			resolved, err := ResolveOutboundImageBillingJSON(
				outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
				fmt.Appendf(nil, `{"prompt":"secret","n":1,%q:%q}`, testCase.field, testCase.value),
			)
			require.NoError(t, err)
			require.NotNil(t, resolved)
			assert.Equal(t, testCase.value, gjson.GetBytes(resolved.Input.Body, testCase.field).String())
		})
	}
}

func TestValidateImageBillingStringRejectsBase64ImageMagic(t *testing.T) {
	tests := []struct {
		name  string
		magic []byte
	}{
		{name: "PNG", magic: []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}},
		{name: "JPEG", magic: []byte{0xff, 0xd8, 0xff}},
		{name: "GIF", magic: []byte("GIF89a")},
		{name: "WebP", magic: []byte{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'}},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			value := base64.RawURLEncoding.EncodeToString(testCase.magic)
			_, err := validateImageBillingString(value, "style")
			require.ErrorContains(t, err, "bounded non-sensitive string")
		})
	}
}

func TestResolveOutboundImageBillingMultipartRejectsFileContentAsScalar(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("output_format", "secret.txt")
	require.NoError(t, err)
	_, err = part.Write([]byte("webp"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	resolved, err := ResolveOutboundImageBillingMultipart(
		outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
		writer.FormDataContentType(),
		bytes.NewReader(body.Bytes()),
	)
	require.ErrorContains(t, err, "file content")
	assert.Nil(t, resolved)
}

func TestResolveOutboundImageBillingMultipartKeepsOnlySeedreamScalars(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "provider-seedream-alias"))
	require.NoError(t, writer.WriteField("prompt", "secret multipart prompt"))
	require.NoError(t, writer.WriteField("n", "2"))
	require.NoError(t, writer.WriteField("size", "1K"))
	image, err := writer.CreateFormFile("image", "secret.png")
	require.NoError(t, err)
	_, err = image.Write([]byte("secret image bytes"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	info := outboundImageBillingInfo(constant.APITypeOpenAI, "doubao-seedream-5-0-pro-260628")
	resolved, err := ResolveOutboundImageBillingMultipart(info, writer.FormDataContentType(), bytes.NewReader(body.Bytes()))
	require.NoError(t, err)
	require.NotNil(t, resolved)
	assert.Equal(t, "doubao-seedream-5-0-pro-260628", resolved.Request.Model)
	assert.Empty(t, resolved.Request.Prompt)
	assert.Equal(t, []string{"secret multipart prompt"}, outboundPromptTexts(t, resolved))
	assert.Equal(t, 2, resolved.Count)
	assert.Equal(t, float64(2), imageRequestScalar(t, resolved.Input, "ImagesUpTo1_5K"))
	assert.Equal(t, float64(0), imageRequestScalar(t, resolved.Input, "ImagesAbove1_5K"))
	assert.Equal(t, float64(1), imageRequestScalar(t, resolved.Input, "InputImages"))
	encoded, err := common.Marshal(resolved.Input)
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "secret")
	assert.NotContains(t, string(encoded), "image bytes")
}

func TestResolveOutboundImageBillingMultipartKeepsOnlyAllowedOpenAIScalars(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range map[string]string{
		"model":              "mapped-model",
		"prompt":             "secret multipart prompt",
		"n":                  "2",
		"size":               "1536x1024",
		"quality":            "high",
		"response_format":    "url",
		"style":              "vivid",
		"background":         "transparent",
		"moderation":         "low",
		"output_format":      "webp",
		"output_compression": "90",
		"partial_images":     "1",
		"stream":             "true",
		"input_fidelity":     "high",
		"watermark":          "false",
		"watermark_enabled":  "true",
		"image_url":          "https://secret.invalid/input.png",
		"b64_json":           "c2VjcmV0",
		"Extra":              "must-not-survive",
	} {
		require.NoError(t, writer.WriteField(key, value))
	}
	for _, field := range []string{"image", "mask", "file"} {
		part, err := writer.CreateFormFile(field, "secret.png")
		require.NoError(t, err)
		_, err = part.Write([]byte("secret file bytes"))
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	resolved, err := ResolveOutboundImageBillingMultipart(
		outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
		writer.FormDataContentType(),
		bytes.NewReader(body.Bytes()),
	)
	require.NoError(t, err)
	require.NotNil(t, resolved)
	assert.Equal(t, 2, resolved.Count)
	assert.Equal(t, []string{"secret multipart prompt"}, outboundPromptTexts(t, resolved))
	for key, want := range map[string]string{
		"size":            "1536x1024",
		"quality":         "high",
		"response_format": "url",
		"style":           "vivid",
		"background":      "transparent",
		"moderation":      "low",
		"output_format":   "webp",
		"input_fidelity":  "high",
	} {
		assert.Equal(t, want, gjson.GetBytes(resolved.Input.Body, key).String(), key)
	}
	assert.Equal(t, int64(90), gjson.GetBytes(resolved.Input.Body, "output_compression").Int())
	assert.Equal(t, int64(1), gjson.GetBytes(resolved.Input.Body, "partial_images").Int())
	assert.True(t, gjson.GetBytes(resolved.Input.Body, "stream").Bool())
	assert.False(t, gjson.GetBytes(resolved.Input.Body, "watermark").Bool())
	assert.True(t, gjson.GetBytes(resolved.Input.Body, "watermark_enabled").Bool())
	assert.Equal(t, "1536x1024", gjson.GetBytes(resolved.Input.Body, "resolution").String())
	for _, path := range []string{"prompt", "image", "mask", "file", "image_url", "b64_json", "Extra"} {
		assert.False(t, gjson.GetBytes(resolved.Input.Body, path).Exists(), path)
	}
	assert.NotContains(t, string(resolved.Input.Body), "secret")

	cost, trace, err := billingexpr.RunExprWithRequest(
		`param("stream") == true && param("output_compression") == 90 ? tier("safe", fixed(0.2)) : tier("fallback", fixed(0.01))`,
		billingexpr.TokenParams{},
		resolved.Input,
	)
	require.NoError(t, err)
	assert.Equal(t, "safe", trace.MatchedTier)
	assert.InDelta(t, 200_000, cost, 1e-9)
}

func TestResolveOutboundImageBillingJSONAndMultipartShareScalarSemantics(t *testing.T) {
	jsonBilling, err := ResolveOutboundImageBillingJSON(
		outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
		[]byte(`{"prompt":"secret","n":1,"stream":true,"output_compression":90}`),
	)
	require.NoError(t, err)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("prompt", "secret"))
	require.NoError(t, writer.WriteField("n", "1"))
	require.NoError(t, writer.WriteField("stream", "true"))
	require.NoError(t, writer.WriteField("output_compression", "90"))
	require.NoError(t, writer.Close())
	multipartBilling, err := ResolveOutboundImageBillingMultipart(
		outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
		writer.FormDataContentType(),
		bytes.NewReader(body.Bytes()),
	)
	require.NoError(t, err)

	const expression = `param("stream") == true && param("output_compression") == 90 ? tier("safe", fixed(0.2)) : tier("fallback", fixed(0.01))`
	for name, resolved := range map[string]*OutboundImageBilling{
		"JSON":      jsonBilling,
		"multipart": multipartBilling,
	} {
		t.Run(name, func(t *testing.T) {
			require.NotNil(t, resolved)
			assert.Equal(t, gjson.True, gjson.GetBytes(resolved.Input.Body, "stream").Type)
			assert.Equal(t, gjson.Number, gjson.GetBytes(resolved.Input.Body, "output_compression").Type)
			cost, trace, runErr := billingexpr.RunExprWithRequest(expression, billingexpr.TokenParams{}, resolved.Input)
			require.NoError(t, runErr)
			assert.Equal(t, "safe", trace.MatchedTier)
			assert.InDelta(t, 200_000, cost, 1e-9)
		})
	}
}

func TestResolveOutboundImageBillingJSONAndMultipartShareUnknownScalarSemantics(t *testing.T) {
	jsonBilling, err := ResolveOutboundImageBillingJSON(
		outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
		[]byte(`{
			"prompt":"secret",
			"n":1,
			"style":"photographic",
			"output_compression":101,
			"partial_images":4
		}`),
	)
	require.NoError(t, err)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("prompt", "secret"))
	require.NoError(t, writer.WriteField("n", "1"))
	require.NoError(t, writer.WriteField("style", "photographic"))
	require.NoError(t, writer.WriteField("output_compression", "101"))
	require.NoError(t, writer.WriteField("partial_images", "4"))
	require.NoError(t, writer.Close())
	multipartBilling, err := ResolveOutboundImageBillingMultipart(
		outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
		writer.FormDataContentType(),
		bytes.NewReader(body.Bytes()),
	)
	require.NoError(t, err)

	for name, resolved := range map[string]*OutboundImageBilling{
		"JSON":      jsonBilling,
		"multipart": multipartBilling,
	} {
		t.Run(name, func(t *testing.T) {
			require.NotNil(t, resolved)
			assert.Equal(t, "photographic", gjson.GetBytes(resolved.Input.Body, "style").String())
			assert.Equal(t, gjson.Number, gjson.GetBytes(resolved.Input.Body, "output_compression").Type)
			assert.Equal(t, int64(101), gjson.GetBytes(resolved.Input.Body, "output_compression").Int())
			assert.Equal(t, gjson.Number, gjson.GetBytes(resolved.Input.Body, "partial_images").Type)
			assert.Equal(t, int64(4), gjson.GetBytes(resolved.Input.Body, "partial_images").Int())
		})
	}
}

func TestResolveOutboundImageBillingMultipartRejectsNonJSONBooleanSyntax(t *testing.T) {
	for _, field := range []string{"stream", "watermark", "layer_decomposition", "watermark_enabled"} {
		for _, value := range []string{"1", "t", "TRUE", "False"} {
			t.Run(field+"="+value, func(t *testing.T) {
				var body bytes.Buffer
				writer := multipart.NewWriter(&body)
				require.NoError(t, writer.WriteField("n", "1"))
				require.NoError(t, writer.WriteField(field, value))
				require.NoError(t, writer.Close())

				resolved, err := ResolveOutboundImageBillingMultipart(
					outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
					writer.FormDataContentType(),
					bytes.NewReader(body.Bytes()),
				)
				require.ErrorContains(t, err, field)
				assert.Nil(t, resolved)
			})
		}
	}
}

func TestResolveOutboundImageBillingMultipartRejectsSourceConstrainedEnums(t *testing.T) {
	for field, value := range map[string]string{
		"size":            "not-a-size",
		"quality":         "not-a-quality",
		"response_format": "raw",
	} {
		t.Run(field, func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			require.NoError(t, writer.WriteField("n", "1"))
			require.NoError(t, writer.WriteField(field, value))
			require.NoError(t, writer.Close())

			resolved, err := ResolveOutboundImageBillingMultipart(
				outboundImageBillingInfo(constant.APITypeOpenAI, "billing-origin"),
				writer.FormDataContentType(),
				bytes.NewReader(body.Bytes()),
			)
			require.ErrorContains(t, err, field)
			assert.Nil(t, resolved)
		})
	}
}

func TestValidateImageMultipartFileFieldsRejectsAmbiguousValueFieldsBeforeConversion(t *testing.T) {
	tests := []struct {
		name   string
		values map[string][]string
	}{
		{name: "malformed index", values: map[string][]string{"image[bad]": {"secret"}}},
		{name: "duplicate index", values: map[string][]string{"image[0]": {"first", "second"}}},
		{name: "index gap", values: map[string][]string{"image[0]": {"first"}, "image[2]": {"third"}}},
		{name: "mixed forms", values: map[string][]string{"image": {"first"}, "image[0]": {"second"}}},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			err := ValidateImageMultipartFileFields(&multipart.Form{Value: testCase.values})
			require.ErrorContains(t, err, "image")
		})
	}
}

func TestResolveOutboundImageBillingMultipartCountsIndexedSeedreamFiles(t *testing.T) {
	buildBody := func(t *testing.T, fields map[string]string, imageFields ...string) ([]byte, string) {
		t.Helper()
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		for name, value := range fields {
			require.NoError(t, writer.WriteField(name, value))
		}
		for index, name := range imageFields {
			part, err := writer.CreateFormFile(name, fmt.Sprintf("secret-%d.png", index))
			require.NoError(t, err)
			_, err = part.Write([]byte("secret image bytes"))
			require.NoError(t, err)
		}
		require.NoError(t, writer.Close())
		return body.Bytes(), writer.FormDataContentType()
	}

	t.Run("two indexed references include extra price", func(t *testing.T) {
		body, contentType := buildBody(t, map[string]string{"n": "1", "size": "1K"}, "image[0]", "image[1]")
		resolved, err := ResolveOutboundImageBillingMultipart(
			outboundImageBillingInfo(constant.APITypeOpenAI, "doubao-seedream-5-0-pro-260628"),
			contentType,
			bytes.NewReader(body),
		)
		require.NoError(t, err)
		require.NotNil(t, resolved)
		assert.Equal(t, float64(2), imageRequestScalar(t, resolved.Input, "InputImages"))
		cost, _, err := billingexpr.RunExprWithRequest(
			`tier("seedream", fixed(images_up_to_1_5k * 0.1 + max(input_images - 1, 0) * 0.01))`,
			billingexpr.TokenParams{},
			resolved.Input,
		)
		require.NoError(t, err)
		assert.InDelta(t, 110_000, cost, 1e-9)
	})

	t.Run("one indexed reference permits layer decomposition", func(t *testing.T) {
		body, contentType := buildBody(t, map[string]string{
			"n": "1", "size": "1K", "layer_decomposition": "true",
		}, "image[0]")
		resolved, err := ResolveOutboundImageBillingMultipart(
			outboundImageBillingInfo(constant.APITypeOpenAI, "doubao-seedream-5-0-pro-260628"),
			contentType,
			bytes.NewReader(body),
		)
		require.NoError(t, err)
		require.NotNil(t, resolved)
		assert.Equal(t, 17, resolved.Count)
		require.NotNil(t, resolved.Input.ImageCount)
		assert.Equal(t, 17, *resolved.Input.ImageCount)
	})

	t.Run("two indexed references reject layer decomposition", func(t *testing.T) {
		body, contentType := buildBody(t, map[string]string{
			"n": "1", "size": "1K", "layer_decomposition": "true",
		}, "image[0]", "image[1]")
		resolved, err := ResolveOutboundImageBillingMultipart(
			outboundImageBillingInfo(constant.APITypeOpenAI, "doubao-seedream-5-0-pro-260628"),
			contentType,
			bytes.NewReader(body),
		)
		require.ErrorContains(t, err, "exactly one")
		assert.Nil(t, resolved)
	})

	for _, imageFields := range [][]string{
		{"image[1]"},
		{"image[01]"},
		{"image[bad]"},
		{"image[0]", "image[0]"},
		{"image", "image[0]"},
	} {
		name := strings.Join(imageFields, "+")
		t.Run("rejects ambiguous "+name, func(t *testing.T) {
			body, contentType := buildBody(t, map[string]string{"n": "1"}, imageFields...)
			resolved, err := ResolveOutboundImageBillingMultipart(
				outboundImageBillingInfo(constant.APITypeOpenAI, "doubao-seedream-5-0-pro-260628"),
				contentType,
				bytes.NewReader(body),
			)
			require.ErrorContains(t, err, "image")
			assert.Nil(t, resolved)
		})
	}
}

func TestResolveOutboundImageBillingSeedreamLayerCountUsesEffectiveOutputs(t *testing.T) {
	resolved, err := ResolveOutboundImageBillingJSON(
		outboundImageBillingInfo(constant.APITypeOpenAI, "doubao-seedream-5-0-pro-260628"),
		[]byte(`{
			"prompt":"secret",
			"n":1,
			"size":"1K",
			"image":"https://secret.invalid/reference.png",
			"layer_decomposition":true
		}`),
	)
	require.NoError(t, err)
	require.NotNil(t, resolved)
	assert.Equal(t, 17, resolved.Count)
	require.NotNil(t, resolved.Input.ImageCount)
	assert.Equal(t, 17, *resolved.Input.ImageCount)

	cost, trace, err := billingexpr.RunExprWithRequest(
		`tier("layer", fixed(0.01)) * image_count`,
		billingexpr.TokenParams{},
		resolved.Input,
	)
	require.NoError(t, err)
	require.NotNil(t, trace.ImageCount)
	assert.Equal(t, 17, *trace.ImageCount)
	assert.InDelta(t, 170_000, cost, 1e-9)
}

func TestResolveOutboundImageBillingMultipartRejectsExplicitZero(t *testing.T) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	require.NoError(t, writer.WriteField("model", "provider-seedream-alias"))
	require.NoError(t, writer.WriteField("n", "0"))
	require.NoError(t, writer.Close())

	info := outboundImageBillingInfo(constant.APITypeOpenAI, "doubao-seedream-5-0-pro-260628")
	_, err := ResolveOutboundImageBillingMultipart(info, writer.FormDataContentType(), bytes.NewReader(body.Bytes()))
	require.ErrorContains(t, err, "n must be an integer between 1 and 15")
}
