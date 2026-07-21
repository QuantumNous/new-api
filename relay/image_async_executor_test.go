package relay

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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

func TestGenericImageExecutorAcquiresOutputLeaseAfterResponseHeadersBeforeBodyRead(t *testing.T) {
	requestArrived := make(chan struct{})
	allowHeaders := make(chan struct{})
	headersSent := make(chan struct{})
	allowBody := make(chan struct{})
	leaseRequested := make(chan struct{})
	allowLease := make(chan struct{})
	checkpointReleased := make(chan struct{})
	resultWriteLease := make(chan struct{})
	safeClose := func(ch chan struct{}) {
		select {
		case <-ch:
		default:
			close(ch)
		}
	}
	t.Cleanup(func() {
		safeClose(allowHeaders)
		safeClose(allowBody)
		safeClose(allowLease)
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(requestArrived)
		select {
		case <-allowHeaders:
		case <-r.Context().Done():
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		close(headersSent)
		select {
		case <-allowBody:
		case <-r.Context().Done():
			return
		}
		_, _ = w.Write([]byte(`{"data":[{"url":"https://images.example/result.png"}]}`))
	}))
	defer server.Close()

	request := &dto.ImageRequest{Model: "image-model", Prompt: "draw"}
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
	type executionOutcome struct {
		result *image_stream.GenericImageExecutionResult
		err    *types.NewAPIError
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	done := make(chan executionOutcome, 1)
	go func() {
		result, apiErr := image_stream.ExecuteGenericImageAdaptor(ctx, &image_stream.GenericImageExecutionRequest{
			RelayInfo:    info,
			ImageRequest: request,
			BeforeResponseRead: func() error {
				close(leaseRequested)
				select {
				case <-allowLease:
					return nil
				case <-ctx.Done():
					return ctx.Err()
				}
			},
			AfterResponseCheckpoint: func(responseBytes int) {
				assert.Positive(t, responseBytes)
				close(checkpointReleased)
			},
			BeforeResultWrite: func() error {
				select {
				case <-checkpointReleased:
				default:
					t.Error("result write lease was requested before the response checkpoint callback")
				}
				close(resultWriteLease)
				return nil
			},
		})
		done <- executionOutcome{result: result, err: apiErr}
	}()

	select {
	case <-requestArrived:
	case <-time.After(time.Second):
		t.Fatal("provider request did not arrive")
	}
	select {
	case <-leaseRequested:
		t.Fatal("output lease was requested while the provider was still generating")
	default:
	}
	close(allowHeaders)
	select {
	case <-headersSent:
	case <-time.After(time.Second):
		t.Fatal("provider response headers were not sent")
	}
	select {
	case <-leaseRequested:
	case <-time.After(time.Second):
		t.Fatal("output lease was not requested before reading the response body")
	}
	select {
	case <-done:
		t.Fatal("executor completed before the output lease and response body were released")
	default:
	}
	close(allowLease)
	close(allowBody)
	select {
	case outcome := <-done:
		require.Nil(t, outcome.err)
		require.NotNil(t, outcome.result)
		require.Len(t, outcome.result.Response.Data, 1)
		select {
		case <-resultWriteLease:
		default:
			t.Fatal("normalized image response was written without requesting the result lease")
		}
	case <-time.After(time.Second):
		t.Fatal("executor did not complete after the output lease was granted")
	}
}

func TestGenericImageExecutorRebuildsEditMultipartFromStagedInput(t *testing.T) {
	imageBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01, 0x02}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/images/edits", r.URL.Path)
		require.Contains(t, r.Header.Get("Content-Type"), "multipart/form-data; boundary=")
		require.NotContains(t, r.Header.Get("Content-Type"), "stale-boundary")
		require.NoError(t, r.ParseMultipartForm(64<<20))
		require.Equal(t, "gpt-image-1", r.PostForm.Get("model"))
		require.Equal(t, "turn it blue", r.PostForm.Get("prompt"))
		require.Equal(t, "png", r.PostForm.Get("output_format"))
		require.Len(t, r.MultipartForm.File["image"], 1)
		file, err := r.MultipartForm.File["image"][0].Open()
		require.NoError(t, err)
		defer file.Close()
		got, err := io.ReadAll(file)
		require.NoError(t, err)
		require.Equal(t, imageBytes, got)

		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write([]byte(`{"created":123,"data":[{"url":"https://images.example/result.png"}]}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	request := &dto.ImageRequest{
		Model:        "gpt-image-1",
		Prompt:       "turn it blue",
		Images:       json.RawMessage(`[` + `"data:image/png;base64,` + base64.StdEncoding.EncodeToString(imageBytes) + `"` + `]`),
		OutputFormat: json.RawMessage(`"png"`),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesEdits,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/edits",
		RequestHeaders:  map[string]string{"Content-Type": "multipart/form-data; boundary=stale-boundary"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    server.URL,
			ApiType:           constant.APITypeOpenAI,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
		},
	}

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    info,
		ImageRequest: request,
	})

	require.Nil(t, apiErr)
	require.NotNil(t, result)
	require.Len(t, result.Response.Data, 1)
	assert.Equal(t, "https://images.example/result.png", result.Response.Data[0].Url)
}

func TestGenericImageExecutorUsesJSONForEditOperationOnGenerationsProtocol(t *testing.T) {
	imageDataURI := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("image"))
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v1/images/generations", r.URL.Path)
		require.Equal(t, "application/json", r.Header.Get("Content-Type"))
		var body map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &body))
		require.Equal(t, "gpt-image-2", body["model"])
		require.Equal(t, "edit the image", body["prompt"])
		require.Contains(t, body, "images")
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"data":[{"url":"https://images.example/result.png"}]}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	request := &dto.ImageRequest{
		Model:  "gpt-image-2",
		Prompt: "edit the image",
		Images: json.RawMessage(`["` + imageDataURI + `"]`),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:                relayconstant.RelayModeImagesEdits,
		RelayFormat:              types.RelayFormatOpenAIImage,
		OriginModelName:          request.Model,
		RequestURLPath:           "/v1/images/generations",
		ImageRoutingProtocol:     dto.ImageRoutingProtocolImagesGenerations,
		ImageRoutingUpstreamPath: "/v1/images/generations",
		RequestHeaders:           map[string]string{"Content-Type": "application/json"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    server.URL,
			ApiType:           constant.APITypeOpenAI,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
		},
	}

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    info,
		ImageRequest: request,
	})

	require.Nil(t, apiErr)
	require.NotNil(t, result)
	require.Len(t, result.Response.Data, 1)
}

func TestSanitizeImageRoutingAliasesRemovesGatewayDimensions(t *testing.T) {
	request := dto.ImageRequest{Extra: map[string]json.RawMessage{
		"resolution":      json.RawMessage(`"4K"`),
		"aspect_ratio":    json.RawMessage(`"1:1"`),
		"negative_prompt": json.RawMessage(`"fog"`),
	}}

	sanitized := sanitizeImageRoutingAliases(request, dto.ImageRoutingProtocolImagesGenerations)

	assert.NotContains(t, sanitized.Extra, "resolution")
	assert.NotContains(t, sanitized.Extra, "aspect_ratio")
	assert.JSONEq(t, `"fog"`, string(sanitized.Extra["negative_prompt"]))
	assert.Contains(t, request.Extra, "resolution")
}

func TestGenericImageExecutorRebuildsEditMaskAndRepeatedFields(t *testing.T) {
	imageBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x01}
	maskBytes := []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0x02}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, r.ParseMultipartForm(64<<20))
		require.Len(t, r.MultipartForm.File["image[]"], 2)
		require.Len(t, r.MultipartForm.File["mask"], 1)
		require.Equal(t, []string{"first", "second"}, r.MultipartForm.Value["provider_option"])
		for index, expected := range [][]byte{imageBytes, imageBytes} {
			file, err := r.MultipartForm.File["image[]"][index].Open()
			require.NoError(t, err)
			got, err := io.ReadAll(file)
			require.NoError(t, err)
			require.NoError(t, file.Close())
			require.Equal(t, expected, got)
		}
		mask, err := r.MultipartForm.File["mask"][0].Open()
		require.NoError(t, err)
		gotMask, err := io.ReadAll(mask)
		require.NoError(t, err)
		require.NoError(t, mask.Close())
		require.Equal(t, maskBytes, gotMask)
		w.Header().Set("Content-Type", "application/json")
		_, err = w.Write([]byte(`{"data":[{"url":"https://images.example/result.png"}]}`))
		require.NoError(t, err)
	}))
	defer server.Close()

	imageDataURI := `"data:image/png;base64,` + base64.StdEncoding.EncodeToString(imageBytes) + `"`
	request := &dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "combine",
		Images: json.RawMessage(`[` + imageDataURI + `,` + imageDataURI + `]`),
		Mask:   json.RawMessage(`"data:image/png;base64,` + base64.StdEncoding.EncodeToString(maskBytes) + `"`),
		Extra: map[string]json.RawMessage{
			"provider_option": json.RawMessage(`["first","second"]`),
		},
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesEdits,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/edits",
		RequestHeaders:  map[string]string{"Content-Type": "multipart/form-data; boundary=stale"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    server.URL,
			ApiType:           constant.APITypeOpenAI,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
		},
	}

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    info,
		ImageRequest: request,
	})
	require.Nil(t, apiErr)
	require.NotNil(t, result)
}

func TestGenericImageExecutorStoredEditResponseDoesNotFetchStagedInput(t *testing.T) {
	request := &dto.ImageRequest{
		Model:  "gpt-image-1",
		Prompt: "turn it blue",
		Images: json.RawMessage(`["http://127.0.0.1/expired-private-input.png"]`),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesEdits,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: request.Model,
		RequestURLPath:  "/v1/images/edits",
		RequestHeaders:  map[string]string{"Content-Type": "multipart/form-data; boundary=expired"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			ChannelBaseUrl:    "https://unused.example.com",
			ApiType:           constant.APITypeOpenAI,
			ApiKey:            "test-key",
			UpstreamModelName: request.Model,
		},
	}

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    info,
		ImageRequest: request,
		UpstreamResponse: &image_stream.GenericImageUpstreamResponse{
			StatusCode: http.StatusOK,
			Header:     map[string][]string{"Content-Type": {"application/json"}},
			Body:       json.RawMessage(`{"created":123,"data":[{"url":"https://images.example/result.png"}]}`),
		},
	})

	require.Nil(t, apiErr)
	require.NotNil(t, result)
	require.Len(t, result.Response.Data, 1)
	assert.Equal(t, "https://images.example/result.png", result.Response.Data[0].Url)
}

func TestGenericImageExecutorAppliesCurrentOverrideToPersistedBody(t *testing.T) {
	var upstreamBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, common.DecodeJson(r.Body, &upstreamBody))
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(`{"data":[{"url":"https://images.example/result.png"}]}`))
		require.NoError(t, err)
	}))
	defer server.Close()
	deferredBody := []byte(`{"model":"image-model","prompt":"draw","seed":7}`)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeImagesGenerations,
		RelayFormat:     types.RelayFormatOpenAIImage,
		OriginModelName: "image-model",
		RequestURLPath:  "/v1/images/generations",
		RequestHeaders:  map[string]string{"Content-Type": "application/json"},
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeSiliconFlow,
			ChannelBaseUrl:    server.URL,
			ApiType:           constant.APITypeSiliconFlow,
			ApiKey:            "test-key",
			UpstreamModelName: "image-model",
			ParamOverride:     map[string]any{"seed": 99},
		},
	}

	result, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:       info,
		ImageRequest:    &dto.ImageRequest{Model: "image-model", Prompt: "draw"},
		PassThroughBody: deferredBody,
	})

	require.Nil(t, apiErr)
	require.NotNil(t, result)
	assert.Equal(t, float64(99), upstreamBody["seed"])
	assert.NotContains(t, string(deferredBody), "99")
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

func TestGenericImageExecutorRedactsProviderErrorSecrets(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, err := w.Write([]byte(`{"error":{"message":"rejected exact-provider-key custom-param-secret custom-header-secret Authorization: Bearer bearer-secret"}}`))
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
			ApiKey:            "exact-provider-key",
			UpstreamModelName: request.Model,
			ParamOverride: map[string]any{
				"provider_credential": "custom-param-secret",
			},
			HeadersOverride: map[string]any{
				"X-Provider-Credential": "custom-header-secret",
			},
		},
	}

	_, apiErr := image_stream.ExecuteGenericImageAdaptor(context.Background(), &image_stream.GenericImageExecutionRequest{
		RelayInfo:    info,
		ImageRequest: request,
	})

	require.NotNil(t, apiErr)
	assert.NotContains(t, apiErr.Error(), "exact-provider-key")
	assert.NotContains(t, apiErr.Error(), "custom-param-secret")
	assert.NotContains(t, apiErr.Error(), "custom-header-secret")
	assert.NotContains(t, apiErr.Error(), "bearer-secret")
	assert.Contains(t, apiErr.Error(), "***")
}

func TestGenericImageExecutorResumesFromCheckpointWithoutResubmitting(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Authorization", "Bearer provider-secret")
		w.Header().Set("Set-Cookie", "session=provider-secret")
		w.Header().Set("X-Request-Id", "request-123")
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
	assert.Equal(t, []string{"request-123"}, checkpoint.Header["X-Request-Id"])
	assert.NotContains(t, checkpoint.Header, "Authorization")
	assert.NotContains(t, checkpoint.Header, "Set-Cookie")
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
