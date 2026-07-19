package gemini

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/gin-gonic/gin"
)

const testImageDataURI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="

func testGeminiImageContext() *gin.Context {
	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	request.Header.Set("Content-Type", "application/json")
	c := gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New())
	c.Request = request
	return c
}

func testNativeImageInfo(model string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: model,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: model,
		},
	}
}

func TestConvertNativeImageRequestBuildsGeminiContentAndImageConfig(t *testing.T) {
	c := testGeminiImageContext()
	request := dto.ImageRequest{
		Model:  "gemini-3-pro-image-preview",
		Prompt: "a lighthouse at dusk",
		Images: mustJSON(t, []string{testImageDataURI}),
		Size:   "1536x864",
		Extra: map[string]json.RawMessage{
			"aspect_ratio": mustJSON(t, "16:9"),
			"resolution":   mustJSON(t, "2K"),
		},
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(c, testNativeImageInfo(request.Model), request)
	require.NoError(t, err)
	geminiRequest, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, geminiRequest.Contents, 1)
	assert.Equal(t, "user", geminiRequest.Contents[0].Role)
	require.Len(t, geminiRequest.Contents[0].Parts, 2)
	assert.Equal(t, request.Prompt, geminiRequest.Contents[0].Parts[0].Text)
	require.NotNil(t, geminiRequest.Contents[0].Parts[1].InlineData)
	assert.Equal(t, "image/png", geminiRequest.Contents[0].Parts[1].InlineData.MimeType)
	assert.NotEmpty(t, geminiRequest.Contents[0].Parts[1].InlineData.Data)
	assert.Equal(t, []string{"TEXT", "IMAGE"}, geminiRequest.GenerationConfig.ResponseModalities)

	var imageConfig map[string]string
	require.NoError(t, common.Unmarshal(geminiRequest.GenerationConfig.ImageConfig, &imageConfig))
	assert.Equal(t, map[string]string{
		"aspectRatio": "16:9",
		"imageSize":   "2K",
	}, imageConfig)
}

func TestConvertNativeImageRequestAcceptsPromptWithoutReferenceImages(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "gemini-2.5-flash-image",
		Prompt: "a paper boat",
	}
	converted, err := (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.NoError(t, err)
	geminiRequest, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, geminiRequest.Contents, 1)
	require.Len(t, geminiRequest.Contents[0].Parts, 1)
	assert.Equal(t, request.Prompt, geminiRequest.Contents[0].Parts[0].Text)
}

func TestConvertNativeImageRequestMapsSizeOnlyAndCandidateCount(t *testing.T) {
	two := uint(2)
	request := dto.ImageRequest{
		Model:  "gemini-3.1-flash-image",
		Prompt: "a paper boat",
		Size:   "2048x1152",
		N:      &two,
	}
	converted, err := (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.NoError(t, err)
	geminiRequest, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.NotNil(t, geminiRequest.GenerationConfig.CandidateCount)
	assert.Equal(t, 2, *geminiRequest.GenerationConfig.CandidateCount)

	var imageConfig map[string]string
	require.NoError(t, common.Unmarshal(geminiRequest.GenerationConfig.ImageConfig, &imageConfig))
	assert.Equal(t, "16:9", imageConfig["aspectRatio"])
	assert.Equal(t, "2K", imageConfig["imageSize"])
}

func TestConvertNativeImageRequestMapsFlashHalfKSize(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "gemini-3.1-flash-image",
		Prompt: "a paper boat",
		Size:   "512x512",
	}
	converted, err := (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.NoError(t, err)
	geminiRequest, ok := converted.(*dto.GeminiChatRequest)
	require.True(t, ok)

	var imageConfig map[string]string
	require.NoError(t, common.Unmarshal(geminiRequest.GenerationConfig.ImageConfig, &imageConfig))
	assert.Equal(t, "1:1", imageConfig["aspectRatio"])
	assert.Equal(t, "512", imageConfig["imageSize"])

	err = ValidateNativeImageRequestOptionsForModel(request, "gemini-3.1-flash-lite-image")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "minimum 1K")

	request.Model = ""
	_, err = (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo("gemini-3.1-flash-lite-image"), request)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "minimum 1K")
}

func TestConvertNativeImageRequestRejectsUnknownExplicitSize(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "gemini-3.1-flash-image",
		Prompt: "a paper boat",
		Size:   "2000x1600",
	}
	_, err := (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported image size")
}

func TestValidateNativeImageRequestOptionsKeepsExplicitSizeTier(t *testing.T) {
	request := dto.ImageRequest{
		Model:   "gemini-3.1-flash-image",
		Prompt:  "a paper boat",
		Size:    "3840x2160",
		Quality: "auto",
	}

	require.NoError(t, ValidateNativeImageRequestOptionsForModel(request, request.Model))
	config, err := nativeImageConfigForRequest(request)
	require.NoError(t, err)
	assert.Equal(t, "4K", config["image_size"])
}

func TestValidateNativeImageRequestOptionsChecksAspectRatioByModel(t *testing.T) {
	request := dto.ImageRequest{
		Prompt: "a paper boat",
		Extra: map[string]json.RawMessage{
			"aspect_ratio": mustJSON(t, "1:8"),
		},
	}

	require.NoError(t, ValidateNativeImageRequestOptionsForModel(request, "nano-banana-2"))
	for _, model := range []string{
		"gemini-2.5-flash-image",
		"nano-banana",
		"gemini-3-pro-image",
		"nano-banana-pro",
		"gemini-3.1-flash-lite-image",
	} {
		err := ValidateNativeImageRequestOptionsForModel(request, model)
		require.Error(t, err, model)
		assert.Contains(t, err.Error(), "aspect_ratio 1:8 is not supported", model)
	}
}

func TestValidateNativeImageRequestOptionsChecksResolutionByModel(t *testing.T) {
	request := dto.ImageRequest{
		Prompt: "a paper boat",
		Extra: map[string]json.RawMessage{
			"resolution": mustJSON(t, "4K"),
		},
	}

	for _, model := range []string{"nano-banana-2", "gemini-3.1-flash-image", "gemini-3-pro-image", "nano-banana-pro"} {
		require.NoError(t, ValidateNativeImageRequestOptionsForModel(request, model), model)
	}
	for _, model := range []string{"nano-banana", "gemini-2.5-flash-image", "gemini-3.1-flash-lite-image"} {
		err := ValidateNativeImageRequestOptionsForModel(request, model)
		require.Error(t, err, model)
		assert.Contains(t, err.Error(), "maximum 1K", model)
	}
}

func TestValidateNativeImageRequestOptionsRejectsLegacyHalfKAlias(t *testing.T) {
	request := dto.ImageRequest{
		Prompt: "a paper boat",
		Extra: map[string]json.RawMessage{
			"resolution": mustJSON(t, "0.5K"),
		},
	}

	for _, model := range []string{"gemini-3.1-flash-image", "gemini-2.5-flash-image"} {
		err := ValidateNativeImageRequestOptionsForModel(request, model)
		require.Error(t, err, model)
		assert.Contains(t, err.Error(), `unsupported resolution "0.5K"`, model)
	}

	request.Extra["resolution"] = mustJSON(t, "512")
	require.NoError(t, ValidateNativeImageRequestOptionsForModel(request, "gemini-3.1-flash-image"))
	err := ValidateNativeImageRequestOptionsForModel(request, "gemini-2.5-flash-image")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "minimum 1K")
}

func TestValidateNativeImageRequestOptionsRejectsUnknownQuality(t *testing.T) {
	request := dto.ImageRequest{Model: "nano-banana-2", Prompt: "a paper boat", Quality: "ultra"}

	err := ValidateNativeImageRequestOptionsForModel(request, request.Model)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported image quality")
}

func TestGetRequestURLNormalizesGeminiModelAlias(t *testing.T) {
	info := testNativeImageInfo(" models/GEMINI-3.1-FLASH-IMAGE ")
	info.ChannelMeta.ChannelBaseUrl = "https://generativelanguage.googleapis.com"

	requestURL, err := (&Adaptor{}).GetRequestURL(info)
	require.NoError(t, err)
	assert.Contains(t, requestURL, "/models/gemini-3.1-flash-image:generateContent")
	assert.NotContains(t, requestURL, "/models/models/")
}

func TestConvertImageRequestPreservesImagenEnvelope(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "imagen-4.0-generate-001",
		Prompt: "a mountain cabin",
		Size:   "1792x1024",
	}
	converted, err := (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.NoError(t, err)
	imagenRequest, ok := converted.(dto.GeminiImageRequest)
	require.True(t, ok)
	require.Len(t, imagenRequest.Instances, 1)
	assert.Equal(t, request.Prompt, imagenRequest.Instances[0].Prompt)
	assert.Equal(t, "16:9", imagenRequest.Parameters.AspectRatio)
}

func TestConvertImageRequestMapsUnifiedImagenDimensions(t *testing.T) {
	request := dto.ImageRequest{
		Model:   "imagen-4.0-generate-001",
		Prompt:  "a mountain cabin",
		Size:    "1024x1024",
		Quality: "standard",
		Extra: map[string]json.RawMessage{
			"aspect_ratio": mustJSON(t, "3:4"),
			"resolution":   mustJSON(t, "2K"),
		},
	}

	converted, err := (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.NoError(t, err)
	imagenRequest, ok := converted.(dto.GeminiImageRequest)
	require.True(t, ok)
	assert.Equal(t, "3:4", imagenRequest.Parameters.AspectRatio)
	assert.Equal(t, "2K", imagenRequest.Parameters.ImageSize)
}

func TestConvertImageRequestRejectsUnsupportedImagenDimensions(t *testing.T) {
	request := dto.ImageRequest{
		Model:  "imagen-4.0-generate-001",
		Prompt: "a mountain cabin",
		Extra: map[string]json.RawMessage{
			"aspect_ratio": mustJSON(t, "3:2"),
		},
	}

	_, err := (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "aspect_ratio 3:2 is not supported")

	request.Extra = map[string]json.RawMessage{"resolution": mustJSON(t, "4K")}
	_, err = (&Adaptor{}).ConvertImageRequest(testGeminiImageContext(), testNativeImageInfo(request.Model), request)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "resolution 4K is not supported")
}

func TestChatImageHandlerNormalizesInlineImages(t *testing.T) {
	recorder := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(recorder, gin.New())
	body := `{"candidates":[{"content":{"parts":[{"text":"A lighthouse"},{"inlineData":{"mimeType":"image/png","data":"aW1hZ2U="}},{"fileData":{"mimeType":"image/jpeg","fileUri":"https://cdn.example.com/lighthouse.jpg"}},{"inlineData":{"mimeType":"text/plain","data":"ignored"}}]}}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":11,"totalTokenCount":18}}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	usage, apiErr := ChatImageHandler(c, testNativeImageInfo("gemini-3-pro-image-preview"), resp)
	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 7, usage.PromptTokens)
	assert.Equal(t, 11, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
	assert.Equal(t, http.StatusOK, recorder.Code)
	var imageResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
	require.Len(t, imageResponse.Data, 2)
	assert.Equal(t, "aW1hZ2U=", imageResponse.Data[0].B64Json)
	assert.Equal(t, "https://cdn.example.com/lighthouse.jpg", imageResponse.Data[1].Url)
}

func TestChatImageHandlerSkipsThoughtImagesAndUsesResolutionFallbackUsage(t *testing.T) {
	recorder := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(recorder, gin.New())
	body := `{"candidates":[{"content":{"parts":[{"thought":true,"inlineData":{"mimeType":"image/png","data":"dGhvdWdodA=="}},{"inlineData":{"mimeType":"image/png","data":"ZmluYWw="}}]}}]}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := testNativeImageInfo("gemini-3.1-flash-image")
	info.Request = &dto.ImageRequest{Model: "gemini-3.1-flash-image", Prompt: "a lighthouse", Size: "512x512"}
	info.SetEstimatePromptTokens(9)

	usage, apiErr := ChatImageHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 9, usage.PromptTokens)
	assert.Equal(t, 747, usage.CompletionTokens)
	assert.Equal(t, 756, usage.TotalTokens)
	var imageResponse dto.ImageResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &imageResponse))
	require.Len(t, imageResponse.Data, 1)
	assert.Equal(t, "ZmluYWw=", imageResponse.Data[0].B64Json)
}

func TestNativeImageFallbackTokensPerImageUsesModelResolution(t *testing.T) {
	tests := []struct {
		name       string
		model      string
		size       string
		wantTokens int
	}{
		{name: "flash half K", model: "gemini-3.1-flash-image", size: "512x512", wantTokens: 747},
		{name: "flash one K", model: "gemini-3.1-flash-image", size: "1024x1024", wantTokens: 1120},
		{name: "flash two K", model: "gemini-3.1-flash-image", size: "2048x2048", wantTokens: 1680},
		{name: "flash four K", model: "gemini-3.1-flash-image", size: "4096x4096", wantTokens: 2520},
		{name: "pro four K", model: "gemini-3-pro-image", size: "4096x4096", wantTokens: 2000},
		{name: "flash lite one K", model: "gemini-3.1-flash-lite-image", size: "1024x1024", wantTokens: 1120},
		{name: "gemini 2.5", model: "gemini-2.5-flash-image", size: "1024x1024", wantTokens: 1290},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			info := testNativeImageInfo(test.model)
			info.Request = &dto.ImageRequest{Model: test.model, Prompt: "image", Size: test.size}
			tokens, ok := nativeImageFallbackTokensPerImage(info)
			require.True(t, ok)
			assert.Equal(t, test.wantTokens, tokens)
		})
	}
}

func TestDoResponseKeepsNativeGeminiEnvelopeForImageModel(t *testing.T) {
	recorder := httptest.NewRecorder()
	c := gin.CreateTestContextOnly(recorder, gin.New())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1beta/models/nano-banana-2:generateContent", nil)
	body := `{"candidates":[{"content":{"parts":[{"inlineData":{"mimeType":"image/png","data":"aW1hZ2U="}}]}}]}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := testNativeImageInfo("nano-banana-2")
	info.RelayMode = relayconstant.RelayModeGemini
	info.RelayFormat = types.RelayFormatGemini
	info.RequestURLPath = c.Request.URL.Path

	usage, apiErr := (&Adaptor{}).DoResponse(c, resp, info)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.JSONEq(t, body, recorder.Body.String())
	var responseFields map[string]json.RawMessage
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &responseFields))
	assert.Contains(t, responseFields, "candidates")
	assert.NotContains(t, responseFields, "data")
}

func TestIsGeminiModelSupportImagineAcceptsNativeAliases(t *testing.T) {
	for _, model := range []string{
		"gemini-2.5-flash-image-preview",
		"models/gemini-3.1-pro-image",
		"NANO-BANANA-PRO",
	} {
		assert.True(t, model_setting.IsGeminiModelSupportImagine(model), model)
	}
}

func mustJSON(t *testing.T, value any) json.RawMessage {
	t.Helper()
	encoded, err := common.Marshal(value)
	require.NoError(t, err)
	return encoded
}
