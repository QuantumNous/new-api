package image_stream

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildGenerationsRequestKeepsTextOnlyInputShape(t *testing.T) {
	request, err := buildGenerationsRequestWithError(&dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "draw a lighthouse",
		Size:   "1024x1024",
	}, "upstream-image-model")
	require.NoError(t, err)

	assert.Equal(t, "upstream-image-model", request.Model)
	assert.Equal(t, "draw a lighthouse", request.Input)
	assert.Equal(t, "1024x1024", request.Tools[0].Size)
	assert.Equal(t, "low", request.Tools[0].Moderation)
	assert.True(t, request.Stream)
}

func TestBuildGenerationsRequestBuildsMultimodalInputFromImages(t *testing.T) {
	request, err := buildGenerationsRequestWithError(&dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "put the subject in a snowy forest",
		Images: json.RawMessage(`[
			"https://example.com/source.png",
			"data:image/jpeg;base64,ZmFrZQ=="
		]`),
		OutputFormat: json.RawMessage(`"jpeg"`),
	}, "")
	require.NoError(t, err)

	input, ok := request.Input.([]map[string]any)
	require.True(t, ok)
	require.Len(t, input, 1)
	assert.Equal(t, "user", input[0]["role"])
	content, ok := input[0]["content"].([]map[string]any)
	require.True(t, ok)
	require.Len(t, content, 3)
	assert.Equal(t, map[string]any{
		"type": "input_text",
		"text": "put the subject in a snowy forest",
	}, content[0])
	assert.Equal(t, map[string]any{
		"type":      "input_image",
		"image_url": "https://example.com/source.png",
	}, content[1])
	assert.Equal(t, map[string]any{
		"type":      "input_image",
		"image_url": "data:image/jpeg;base64,ZmFrZQ==",
	}, content[2])
	assert.Equal(t, "jpeg", request.Tools[0].OutputFormat)
}

func TestBuildGenerationsRequestUsesSingularImageFallback(t *testing.T) {
	request, err := buildGenerationsRequestWithError(&dto.ImageRequest{
		Prompt: "edit this image",
		Image:  json.RawMessage(`"data:image/png;base64,ZmFrZQ=="`),
	}, "")
	require.NoError(t, err)

	input, ok := request.Input.([]map[string]any)
	require.True(t, ok)
	content, ok := input[0]["content"].([]map[string]any)
	require.True(t, ok)
	require.Len(t, content, 2)
	assert.Equal(t, "data:image/png;base64,ZmFrZQ==", content[1]["image_url"])
}

func TestBuildGenerationsRequestUsesNestedCanonicalImageAliases(t *testing.T) {
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-image-1",
		"input":{
			"prompt":"keep the subject unchanged",
			"image_input":["https://example.com/reference.png"]
		}
	}`), &request))
	built, err := buildGenerationsRequestWithError(&request, "")
	require.NoError(t, err)
	input, ok := built.Input.([]map[string]any)
	require.True(t, ok)
	content, ok := input[0]["content"].([]map[string]any)
	require.True(t, ok)
	require.Len(t, content, 2)
	assert.Equal(t, "keep the subject unchanged", content[0]["text"])
	assert.Equal(t, "https://example.com/reference.png", content[1]["image_url"])
}

func TestBuildGenerationsRequestForwardsUnifiedImageOptions(t *testing.T) {
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-image-2-image-to-image",
		"input":{
			"prompt":"keep the product centered",
			"input_urls":["https://example.com/product.png"],
			"aspect_ratio":"16:9",
			"resolution":"2K"
		}
	}`), &request))

	built, err := buildGenerationsRequestWithError(&request, "")
	require.NoError(t, err)
	require.Len(t, built.Tools, 1)
	assert.Equal(t, "2048x1152", built.Tools[0].Size)
	encoded, err := common.Marshal(built.Tools[0])
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), "aspect_ratio")
	assert.NotContains(t, string(encoded), "resolution")
}

func TestBuildGenerationsRequestAcceptsGPTImage2OfficialAutoAspectSample(t *testing.T) {
	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal([]byte(`{
		"model":"gpt-image-2-image-to-image",
		"callBackUrl":"https://your-domain.com/api/callback",
		"input":{
			"prompt":"take a photo with Sam Altman in the conference room",
			"input_urls":["https://static.aiquickdraw.com/tools/example/1776782793756_wrogXTdd.png"],
			"aspect_ratio":"auto"
		}
	}`), &request))
	require.NoError(t, ValidateAsyncOpenAIImageRequest(&request, request.Model))

	built, err := buildGenerationsRequestWithError(&request, "")
	require.NoError(t, err)
	require.Len(t, built.Tools, 1)
	assert.Equal(t, "auto", built.Tools[0].Size)
	assert.Equal(t, "gpt-image-2-image-to-image", built.Model)

	input, ok := built.Input.([]map[string]any)
	require.True(t, ok)
	content, ok := input[0]["content"].([]map[string]any)
	require.True(t, ok)
	require.Len(t, content, 2)
	assert.Equal(t, "take a photo with Sam Altman in the conference room", content[0]["text"])
	assert.Equal(t, "https://static.aiquickdraw.com/tools/example/1776782793756_wrogXTdd.png", content[1]["image_url"])
}

func TestGPTImageSizeFromUnifiedOptionsEnforcesModelConstraints(t *testing.T) {
	tests := []struct {
		name       string
		aspect     string
		resolution string
		want       string
		wantError  string
	}{
		{name: "one k square", aspect: "1:1", resolution: "1K", want: "1024x1024"},
		{name: "one k landscape", aspect: "16:9", resolution: "1K", want: "1536x864"},
		{name: "one k portrait", aspect: "9:16", resolution: "1K", want: "864x1536"},
		{name: "one k three four", aspect: "3:4", resolution: "1K", want: "1024x1360"},
		{name: "one k four three", aspect: "4:3", resolution: "1K", want: "1360x1024"},
		{name: "two k square", aspect: "1:1", resolution: "2K", want: "1440x1440"},
		{name: "two k landscape", aspect: "16:9", resolution: "2K", want: "2048x1152"},
		{name: "two k portrait", aspect: "9:16", resolution: "2K", want: "1152x2048"},
		{name: "two k three four", aspect: "3:4", resolution: "2K", want: "1248x1664"},
		{name: "two k four three", aspect: "4:3", resolution: "2K", want: "1664x1248"},
		{name: "four k square", aspect: "1:1", resolution: "4K", want: "2880x2880"},
		{name: "four k landscape", aspect: "16:9", resolution: "4K", want: "3840x2160"},
		{name: "four k portrait", aspect: "9:16", resolution: "4K", want: "2160x3840"},
		{name: "four k three four", aspect: "3:4", resolution: "4K", want: "2448x3264"},
		{name: "four k four three", aspect: "4:3", resolution: "4K", want: "3264x2448"},
		{name: "old portrait ratio", aspect: "2:3", resolution: "2K", wantError: "not supported"},
		{name: "arbitrary ratio", aspect: "5:4", resolution: "2K", wantError: "not supported"},
		{name: "auto defaults upstream sizing at one k", aspect: "auto", resolution: "1K", want: "auto"},
		{name: "auto rejects two k", aspect: "auto", resolution: "2K", wantError: "only supported with resolution 1K"},
		{name: "auto rejects four k", aspect: "auto", resolution: "4K", wantError: "only supported with resolution 1K"},
		{name: "unknown resolution", aspect: "1:1", resolution: "8K", wantError: "unsupported resolution"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.ImageRequest{Extra: map[string]json.RawMessage{
				"aspect_ratio": json.RawMessage(`"` + tt.aspect + `"`),
				"resolution":   json.RawMessage(`"` + tt.resolution + `"`),
			}}
			size, err := gptImageSizeFromUnifiedOptions(request, "gpt-image-2")
			if tt.wantError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, size)
		})
	}
}

func TestGPTImageSizeFromUnifiedOptionsAutoDefaultsToOneKWhenResolutionOmitted(t *testing.T) {
	request := &dto.ImageRequest{Extra: map[string]json.RawMessage{
		"aspect_ratio": json.RawMessage(`"auto"`),
	}}

	size, err := gptImageSizeFromUnifiedOptions(request, "gpt-image-2")
	require.NoError(t, err)
	assert.Equal(t, "auto", size)
}

func TestValidateAsyncOpenAIImageRequestRejectsUnsupportedImageCount(t *testing.T) {
	two := uint(2)
	request := &dto.ImageRequest{Model: "gpt-image-2", Prompt: "a lighthouse", N: &two}

	err := ValidateAsyncOpenAIImageRequest(request, request.Model)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "n must be between 1 and 1")
}

func TestValidateAsyncOpenAIImageRequestRejectsUnsupportedQuality(t *testing.T) {
	request := &dto.ImageRequest{Model: "gpt-image-2", Prompt: "a lighthouse", Quality: "ultra"}

	err := ValidateAsyncOpenAIImageRequest(request, request.Model)

	require.Error(t, err)
	assert.Contains(t, err.Error(), `quality "ultra" is not supported`)
}

func TestGPTImageSizeFromUnifiedOptionsValidatesExplicitSizes(t *testing.T) {
	officialGPTImage2Sizes := []string{
		"1024x1024", "1536x864", "864x1536", "1024x1360", "1360x1024",
		"1440x1440", "2048x1152", "1152x2048", "1248x1664", "1664x1248",
		"2880x2880", "3840x2160", "2160x3840", "2448x3264", "3264x2448",
		"auto",
	}
	for _, explicitSize := range officialGPTImage2Sizes {
		t.Run(explicitSize, func(t *testing.T) {
			size, err := gptImageSizeFromUnifiedOptions(&dto.ImageRequest{Size: explicitSize}, "gpt-image-2")
			require.NoError(t, err)
			assert.Equal(t, explicitSize, size)
		})
	}

	_, err := gptImageSizeFromUnifiedOptions(&dto.ImageRequest{Size: "2000x1600"}, "gpt-image-2")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "15 official sizes")

	size, err := gptImageSizeFromUnifiedOptions(&dto.ImageRequest{Size: "1536x1024"}, "gpt-image-1")
	require.NoError(t, err)
	assert.Equal(t, "1536x1024", size)

	_, err = gptImageSizeFromUnifiedOptions(&dto.ImageRequest{Size: "1440x1440"}, "gpt-image-1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not supported")
}

func TestGPTImageSizeFromUnifiedOptionsRestrictsLegacyModels(t *testing.T) {
	tests := []struct {
		name       string
		aspect     string
		resolution string
		want       string
		wantError  string
	}{
		{name: "square", aspect: "1:1", resolution: "1K", want: "1024x1024"},
		{name: "landscape", aspect: "3:2", resolution: "1K", want: "1536x1024"},
		{name: "portrait", aspect: "2:3", resolution: "1K", want: "1024x1536"},
		{name: "arbitrary ratio", aspect: "16:9", resolution: "1K", wantError: "not supported"},
		{name: "higher resolution", aspect: "1:1", resolution: "2K", wantError: "not supported"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.ImageRequest{Extra: map[string]json.RawMessage{
				"aspect_ratio": json.RawMessage(`"` + tt.aspect + `"`),
				"resolution":   json.RawMessage(`"` + tt.resolution + `"`),
			}}
			size, err := gptImageSizeFromUnifiedOptions(request, "gpt-image-1")
			if tt.wantError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, size)
		})
	}
}

func TestBuildGenerationsRequestRejectsMalformedImageAndToolFields(t *testing.T) {
	tests := []struct {
		name    string
		request dto.ImageRequest
		want    string
	}{
		{
			name: "unsupported image scheme",
			request: dto.ImageRequest{
				Prompt: "edit",
				Images: json.RawMessage(`["file:///tmp/source.png"]`),
			},
			want: "unsupported image URL scheme",
		},
		{
			name: "too many image sources",
			request: dto.ImageRequest{
				Prompt: "edit",
				Images: json.RawMessage(`[
					"https://example.com/1.png", "https://example.com/2.png",
					"https://example.com/3.png", "https://example.com/4.png",
					"https://example.com/5.png", "https://example.com/6.png",
					"https://example.com/7.png", "https://example.com/8.png",
					"https://example.com/9.png", "https://example.com/10.png",
					"https://example.com/11.png", "https://example.com/12.png",
					"https://example.com/13.png", "https://example.com/14.png",
					"https://example.com/15.png", "https://example.com/16.png",
					"https://example.com/17.png"
				]`),
			},
			want: "too many image URLs",
		},
		{
			name: "non-string output format",
			request: dto.ImageRequest{
				Prompt:       "draw",
				OutputFormat: json.RawMessage(`{"format":"png"}`),
			},
			want: "output_format must be a string",
		},
		{
			name: "invalid output compression JSON",
			request: dto.ImageRequest{
				Prompt:            "draw",
				OutputCompression: json.RawMessage(`{"unterminated"`),
			},
			want: "output_compression must be an integer between 0 and 100",
		},
		{
			name: "output compression out of range",
			request: dto.ImageRequest{
				Prompt:            "draw",
				OutputCompression: json.RawMessage(`101`),
			},
			want: "output_compression must be an integer between 0 and 100",
		},
		{
			name: "non-string background",
			request: dto.ImageRequest{
				Prompt:     "draw",
				Background: json.RawMessage(`{}`),
			},
			want: "background must be a string",
		},
		{
			name: "unsupported moderation",
			request: dto.ImageRequest{
				Prompt:     "draw",
				Moderation: json.RawMessage(`"strict"`),
			},
			want: "unsupported moderation",
		},
		{
			name: "non-string aspect ratio",
			request: dto.ImageRequest{
				Prompt: "draw",
				Extra:  map[string]json.RawMessage{"aspect_ratio": json.RawMessage(`16`)},
			},
			want: "aspect_ratio must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := buildGenerationsRequestWithError(&tt.request, "")
			require.Error(t, err)
			assert.Contains(t, err.Error(), tt.want)
		})
	}
}

func TestBuildGenerationsRequestOutputCompressionPreservesJSONValue(t *testing.T) {
	request, err := buildGenerationsRequestWithError(&dto.ImageRequest{
		Prompt:            "draw",
		OutputCompression: json.RawMessage(`90`),
	}, "")
	require.NoError(t, err)

	encoded, err := common.Marshal(request)
	require.NoError(t, err)
	assert.Contains(t, string(encoded), `"output_compression":90`)
}

func TestRequestAsyncImageUpstreamClassifiesBuilderErrorsAsClientInvalid(t *testing.T) {
	_, err := requestAsyncImageUpstream(
		context.Background(),
		"http://127.0.0.1:1",
		"key",
		"",
		"gpt-image-1",
		"task-validation",
		&dto.ImageRequest{
			Prompt: "edit",
			Image:  json.RawMessage(`"file:///tmp/source.png"`),
		},
	)
	require.Error(t, err)
	var validationErr *imageRequestValidationError
	require.ErrorAs(t, err, &validationErr)
	assert.Equal(t, 400, asyncImageUpstreamStatus(err))
}

func TestRequestAsyncImageUpstreamBuildsResponsesEditFromStagedInput(t *testing.T) {
	imageBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/responses", r.URL.Path)
		require.Equal(t, "Bearer request-key", r.Header.Get("Authorization"))
		var body struct {
			Model string `json:"model"`
			Input []struct {
				Content []struct {
					Type     string `json:"type"`
					Text     string `json:"text"`
					ImageURL string `json:"image_url"`
				} `json:"content"`
			} `json:"input"`
		}
		require.NoError(t, common.DecodeJson(r.Body, &body))
		require.Equal(t, "mapped-gpt-image", body.Model)
		require.Len(t, body.Input, 1)
		require.Len(t, body.Input[0].Content, 2)
		assert.Equal(t, "input_text", body.Input[0].Content[0].Type)
		assert.Equal(t, "turn it blue", body.Input[0].Content[0].Text)
		assert.Equal(t, "input_image", body.Input[0].Content[1].Type)
		assert.Equal(t, "data:image/png;base64,"+base64.StdEncoding.EncodeToString(imageBytes), body.Input[0].Content[1].ImageURL)

		w.Header().Set("Content-Type", "text/event-stream")
		_, err := w.Write([]byte("data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"image_generation_call\",\"result\":\"result\"}}\n\n" +
			"data: {\"type\":\"response.completed\",\"response\":{\"model\":\"mapped-gpt-image\",\"usage\":{\"input_tokens\":2,\"output_tokens\":3}}}\n\n"))
		require.NoError(t, err)
	}))
	defer server.Close()

	response, err := requestAsyncImageUpstream(
		context.Background(),
		server.URL,
		"request-key",
		"",
		"mapped-gpt-image",
		"task-edit",
		&dto.ImageRequest{
			Model:  "gpt-image-1",
			Prompt: "turn it blue",
			Images: json.RawMessage(`[` + `"data:image/png;base64,` + base64.StdEncoding.EncodeToString(imageBytes) + `"` + `]`),
		},
		relayconstant.RelayModeImagesEdits,
	)

	require.NoError(t, err)
	require.NotNil(t, response)
	require.Len(t, response.Output, 1)
	assert.Equal(t, "result", response.Output[0].Result)
}

func TestRequestAsyncImageUpstreamDoesNotReturnProviderErrorBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, writeErr := w.Write([]byte(`{"error":{"message":"Authorization: Bearer provider-secret"},"api_key":"json-secret"}`))
		require.NoError(t, writeErr)
	}))
	defer server.Close()

	_, err := requestAsyncImageUpstream(
		context.Background(),
		server.URL,
		"request-key",
		"",
		"gpt-image-1",
		"task-provider-error",
		&dto.ImageRequest{Prompt: "draw"},
	)

	require.Error(t, err)
	assert.Equal(t, http.StatusUnauthorized, asyncImageUpstreamStatus(err))
	assert.Contains(t, err.Error(), "status 401")
	assert.NotContains(t, err.Error(), "provider-secret")
	assert.NotContains(t, err.Error(), "json-secret")
}
