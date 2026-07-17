package relay

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/openai/image_stream"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenericImageExecutorPreservesExtraAndAppliesParamOverride(t *testing.T) {
	var upstreamBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/images/generations", r.URL.Path)
		require.Equal(t, "Bearer test-key", r.Header.Get("Authorization"))
		require.NoError(t, common.DecodeJson(r.Body, &upstreamBody))

		responseBody, err := common.Marshal(map[string]any{
			"created": 123,
			"data": []map[string]any{{
				"url":            "https://images.example/result.png",
				"revised_prompt": "revised",
			}},
			"usage": map[string]any{
				"input_tokens":  7,
				"output_tokens": 11,
				"total_tokens":  18,
			},
		})
		require.NoError(t, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, err = w.Write(responseBody)
		require.NoError(t, err)
	}))
	defer server.Close()

	request := &dto.ImageRequest{
		Model:  "black-forest-labs/FLUX.1-schnell",
		Prompt: "a red kite",
		Extra: map[string]json.RawMessage{
			"negative_prompt": json.RawMessage(`"rain"`),
			"batch_size":      json.RawMessage(`2`),
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		RequestHeaders:  map[string]string{"Content-Type": "application/json"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeSiliconFlow,
			ChannelId:         91,
			ChannelBaseUrl:    server.URL,
			ApiType:           constant.APITypeSiliconFlow,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
			ParamOverride: map[string]any{
				"seed": 99,
			},
		},
	}
	info.PriceData.AddOtherRatio("n", 2)

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    info,
		ImageRequest: request,
	})

	require.Nil(t, apiErr)
	require.NotNil(t, result)
	require.Len(t, result.Response.Data, 1)
	assert.Equal(t, "https://images.example/result.png", result.Response.Data[0].Url)
	assert.Equal(t, "revised", result.Response.Data[0].RevisedPrompt)
	assert.Equal(t, 7, result.Usage.PromptTokens)
	assert.Equal(t, 11, result.Usage.CompletionTokens)
	assert.Equal(t, 18, result.Usage.TotalTokens)
	assert.Equal(t, 2.0, result.OtherRatios["n"])

	assert.Equal(t, "rain", upstreamBody["negative_prompt"])
	assert.Equal(t, float64(2), upstreamBody["batch_size"])
	assert.Equal(t, float64(99), upstreamBody["seed"])
	assert.Equal(t, "black-forest-labs/FLUX.1-schnell", upstreamBody["model"])
	assert.Equal(t, "a red kite", upstreamBody["prompt"])
	require.Contains(t, request.Extra, "negative_prompt")
}

func TestBoundedImageResponseWriterRejectsOversizedBody(t *testing.T) {
	writer := newBoundedImageResponseWriter(4)
	written, err := writer.Write([]byte("12345"))

	assert.Zero(t, written)
	assert.ErrorIs(t, err, errGenericImageResponseTooLarge)
	assert.ErrorIs(t, writer.err, errGenericImageResponseTooLarge)
	assert.Empty(t, writer.body.Bytes())
}

func TestGenericImageExecutorBoundsProviderErrorBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, err := w.Write(make([]byte, maxGenericImageErrorResponseBytes+1))
		require.NoError(t, err)
	}))
	defer server.Close()

	request := &dto.ImageRequest{Model: "black-forest-labs/FLUX.1-schnell", Prompt: "cat"}
	info := &relaycommon.RelayInfo{
		RelayMode:      relayconstant.RelayModeImagesGenerations,
		RelayFormat:    types.RelayFormatOpenAIImage,
		RequestURLPath: "/v1/images/generations",
		RequestHeaders: map[string]string{"Content-Type": "application/json"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeSiliconFlow,
			ChannelBaseUrl:    server.URL,
			ApiType:           constant.APITypeSiliconFlow,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
		},
	}

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    info,
		ImageRequest: request,
	})

	assert.Nil(t, result)
	require.NotNil(t, apiErr)
	assert.Equal(t, types.ErrorCodeBadResponseStatusCode, apiErr.GetErrorCode())
	assert.Equal(t, http.StatusServiceUnavailable, apiErr.StatusCode)
	assert.Contains(t, apiErr.Error(), "provider error response exceeds")
}

func TestGenericImageExecutorResumesFromCheckpointWithoutResubmitting(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"created":123,"data":[{"url":"https://images.example/result.png"}]}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	newInfo := func() *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			RelayMode:      relayconstant.RelayModeImagesGenerations,
			RelayFormat:    types.RelayFormatOpenAIImage,
			RequestURLPath: "/v1/images/generations",
			RequestHeaders: map[string]string{"Content-Type": "application/json"},
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelType:       constant.ChannelTypeSiliconFlow,
				ChannelBaseUrl:    server.URL,
				ApiType:           constant.APITypeSiliconFlow,
				ApiKey:            "test-key",
				UpstreamModelName: "black-forest-labs/FLUX.1-schnell",
			},
		}
	}
	request := &dto.ImageRequest{Model: "black-forest-labs/FLUX.1-schnell", Prompt: "cat"}
	var checkpoint *image_stream.GenericImageUpstreamResponse
	first, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    newInfo(),
		ImageRequest: request,
		Checkpoint: func(response *image_stream.GenericImageUpstreamResponse) error {
			encoded, err := common.Marshal(response)
			require.NoError(t, err)
			checkpoint = &image_stream.GenericImageUpstreamResponse{}
			return common.Unmarshal(encoded, checkpoint)
		},
	})
	require.Nil(t, apiErr)
	require.NotNil(t, first)
	require.NotNil(t, checkpoint)
	assert.Equal(t, http.StatusOK, checkpoint.StatusCode)
	assert.JSONEq(t, `{"created":123,"data":[{"url":"https://images.example/result.png"}]}`, string(checkpoint.Body))
	assert.Equal(t, 1, requestCount)

	resumed, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:        newInfo(),
		ImageRequest:     request,
		UpstreamResponse: checkpoint,
	})
	require.Nil(t, apiErr)
	require.NotNil(t, resumed)
	require.Len(t, resumed.Response.Data, 1)
	assert.Equal(t, "https://images.example/result.png", resumed.Response.Data[0].Url)
	assert.Equal(t, 1, requestCount, "a recovered task must not submit the provider request again")
}

func TestGenericImageExecutorRehydratesAdvancedCustomRoute(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/custom/images/gpt-image-1", r.URL.Path)
		assert.Equal(t, "Bearer advanced-key", r.Header.Get("Authorization"))
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"created":123,"data":[{"url":"https://images.example/result.png"}]}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	request := &dto.ImageRequest{Model: "gpt-image-1", Prompt: "cat"}
	preparedBody, err := common.Marshal(request)
	require.NoError(t, err)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/generations",
		RequestHeaders:  map[string]string{"Content-Type": "application/json"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeAdvancedCustom,
			ChannelBaseUrl:    server.URL,
			ApiType:           constant.APITypeAdvancedCustom,
			ApiKey:            "advanced-key",
			UpstreamModelName: request.Model,
			ChannelOtherSettings: dto.ChannelOtherSettings{AdvancedCustom: &dto.AdvancedCustomConfig{
				Routes: []dto.AdvancedCustomRoute{{
					IncomingPath: "/v1/images/generations",
					UpstreamPath: server.URL + "/custom/images/{model}",
					Converter:    "none",
				}},
			}},
		},
	}

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:       info,
		ImageRequest:    request,
		PassThroughBody: preparedBody,
	})

	require.Nil(t, apiErr)
	require.NotNil(t, result)
	require.Len(t, result.Response.Data, 1)
	assert.Equal(t, "https://images.example/result.png", result.Response.Data[0].Url)
}
