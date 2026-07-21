package jimeng

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	rootcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertImageRequestMapsUnifiedImages(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "jimeng_high_aes_general_v21_L",
		Prompt: "put the product in a studio",
		Images: json.RawMessage(`[
			"https://cdn.example.com/reference.png"
		]`),
		ExtraFields: json.RawMessage(`{"width":768,"height":768}`),
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		request,
	)
	require.NoError(t, err)

	payload, ok := converted.(imageRequestPayload)
	require.True(t, ok)
	assert.Equal(t, []string{"https://cdn.example.com/reference.png"}, payload.ImageUrls)
	assert.Equal(t, 768, payload.Width)
}

func TestConvertImageRequestPreservesAuthoritativeFieldsAgainstExtraFields(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "jimeng_high_aes_general_v21_L",
		Prompt: "authorized prompt",
		Images: json.RawMessage(`["https://cdn.example.com/reference.png"]`),
		ExtraFields: json.RawMessage(`{
			"req_key":"unbilled_service",
			"prompt":"overridden prompt",
			"image_urls":["https://attacker.example/reference.png"],
			"binary_data_base64":["bWFsaWNpb3Vz"],
			"width":768
		}`),
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		request,
	)
	require.NoError(t, err)

	payload, ok := converted.(imageRequestPayload)
	require.True(t, ok)
	assert.Equal(t, request.Model, payload.ReqKey)
	assert.Equal(t, request.Prompt, payload.Prompt)
	assert.Equal(t, []string{"https://cdn.example.com/reference.png"}, payload.ImageUrls)
	assert.Empty(t, payload.BinaryData)
	assert.Equal(t, 768, payload.Width)
}

func TestConvertImageRequestRejectsOutOfRangeDimensions(t *testing.T) {
	tests := []struct {
		name        string
		extraFields string
	}{
		{name: "width explicit zero", extraFields: `{"width":0}`},
		{name: "width below minimum", extraFields: `{"width":255}`},
		{name: "width above maximum", extraFields: `{"width":769}`},
		{name: "height explicit zero", extraFields: `{"height":0}`},
		{name: "height below minimum", extraFields: `{"height":255}`},
		{name: "height above maximum", extraFields: `{"height":769}`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := (&Adaptor{}).ConvertImageRequest(
				gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
				&common.RelayInfo{},
				dto.ImageRequest{
					Model:       "jimeng_high_aes_general_v21_L",
					Prompt:      "draw",
					ExtraFields: json.RawMessage(test.extraFields),
				},
			)
			require.Error(t, err)
			assert.Contains(t, err.Error(), "must be between 256 and 768")
		})
	}
}

func TestConvertImageRequestAppliesAllowlistedExtraFields(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "jimeng_high_aes_general_v21_L",
		Prompt: "draw",
		ExtraFields: json.RawMessage(`{
			"seed":-1,
			"width":256,
			"height":768,
			"use_pre_llm":true,
			"use_sr":true,
			"return_url":true,
			"logo_info":{"add_logo":true,"position":1,"opacity":0.5,"logo_text_content":"brand"}
		}`),
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		request,
	)
	require.NoError(t, err)

	payload, ok := converted.(imageRequestPayload)
	require.True(t, ok)
	require.NotNil(t, payload.Seed)
	assert.Equal(t, int64(-1), *payload.Seed)
	assert.Equal(t, 256, payload.Width)
	assert.Equal(t, 768, payload.Height)
	require.NotNil(t, payload.UsePreLLM)
	require.NotNil(t, payload.UseSR)
	require.NotNil(t, payload.ReturnURL)
	assert.True(t, *payload.UsePreLLM)
	assert.True(t, *payload.UseSR)
	assert.True(t, *payload.ReturnURL)
	require.NotNil(t, payload.LogoInfo)
	require.NotNil(t, payload.LogoInfo.AddLogo)
	require.NotNil(t, payload.LogoInfo.LogoTextContent)
	assert.True(t, *payload.LogoInfo.AddLogo)
	assert.Equal(t, "brand", *payload.LogoInfo.LogoTextContent)
}

func TestConvertImageRequestPreservesExplicitFalseOptions(t *testing.T) {
	converted, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		dto.ImageRequest{
			Model:          "jimeng_high_aes_general_v21_L",
			Prompt:         "draw",
			ResponseFormat: "b64_json",
			ExtraFields: json.RawMessage(`{
				"seed":0,
				"use_pre_llm":false,
				"use_sr":false,
				"return_url":false,
				"logo_info":{"add_logo":false,"position":0,"language":0,"opacity":0,"logo_text_content":""}
			}`),
		},
	)
	require.NoError(t, err)

	payload, ok := converted.(imageRequestPayload)
	require.True(t, ok)
	encoded, err := rootcommon.Marshal(payload)
	require.NoError(t, err)
	var upstream map[string]any
	require.NoError(t, rootcommon.Unmarshal(encoded, &upstream))
	assert.Equal(t, float64(0), upstream["seed"])
	assert.Equal(t, false, upstream["use_pre_llm"])
	assert.Equal(t, false, upstream["use_sr"])
	assert.Equal(t, false, upstream["return_url"])
	logoInfo, ok := upstream["logo_info"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, false, logoInfo["add_logo"])
	assert.Equal(t, float64(0), logoInfo["position"])
	assert.Equal(t, float64(0), logoInfo["language"])
	assert.Equal(t, float64(0), logoInfo["opacity"])
	assert.Equal(t, "", logoInfo["logo_text_content"])
}

func TestConvertImageRequestRejectsMalformedExtraFields(t *testing.T) {
	_, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		dto.ImageRequest{
			Model:       "jimeng_high_aes_general_v21_L",
			Prompt:      "draw",
			ExtraFields: json.RawMessage(`{"width":`),
		},
	)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to unmarshal extra fields")
}

func TestConvertImageRequestRejectsUnsupportedBatchCount(t *testing.T) {
	two := uint(2)
	_, err := (&Adaptor{}).ConvertImageRequest(
		gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()),
		&common.RelayInfo{},
		dto.ImageRequest{Model: "jimeng_high_aes_general_v21_L", Prompt: "draw", N: &two},
	)
	require.Error(t, err)
	require.Contains(t, err.Error(), "supports only n=1")
}

func TestDoRequestAppliesAsyncIdempotencyAndCustomHeaderOverrides(t *testing.T) {
	requestHeaders := make(chan http.Header, 1)
	requestTargets := make(chan string, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestHeaders <- r.Header.Clone()
		requestTargets <- r.URL.RequestURI()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":10000,"data":{}}`))
	}))
	defer server.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)

	info := &common.RelayInfo{
		ChannelMeta: &common.ChannelMeta{
			ChannelBaseUrl: server.URL,
			ApiKey:         "access-key|secret-key",
			HeadersOverride: map[string]any{
				"Idempotency-Key": "image-task-stable-id",
				"X-Custom-Header": "custom-value",
			},
		},
		ImageRoutingProtocol:     dto.ImageRoutingProtocolAdapter,
		ImageRoutingUpstreamPath: "/custom/images/generations",
	}

	result, err := (&Adaptor{}).DoRequest(c, info, strings.NewReader(`{"req_key":"jimeng-test","prompt":"draw"}`))
	require.NoError(t, err)
	response, ok := result.(*http.Response)
	require.True(t, ok)
	defer response.Body.Close()
	_, err = io.Copy(io.Discard, response.Body)
	require.NoError(t, err)

	upstreamHeaders := <-requestHeaders
	require.Equal(t, "/custom/images/generations?Action=CVProcess&Version=2022-08-31", <-requestTargets)
	require.Equal(t, "image-task-stable-id", upstreamHeaders.Get("Idempotency-Key"))
	require.Equal(t, "custom-value", upstreamHeaders.Get("X-Custom-Header"))
	require.NotEmpty(t, upstreamHeaders.Get("Authorization"))
}

func TestDoResponseUsesImageHandlerForEdits(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	response := &http.Response{
		StatusCode: http.StatusOK,
		Body: io.NopCloser(strings.NewReader(`{
			"code":10000,
			"data":{"image_urls":["https://cdn.example.com/edited.png"]}
		}`)),
	}
	info := &common.RelayInfo{
		RelayMode: relayconstant.RelayModeImagesEdits,
		StartTime: time.Now(),
	}

	usage, apiErr := (&Adaptor{}).DoResponse(c, response, info)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.JSONEq(t, `{"created":`+strconv.FormatInt(info.StartTime.Unix(), 10)+`,"data":[{"url":"https://cdn.example.com/edited.png","b64_json":"","revised_prompt":""}]}`, recorder.Body.String())
}
