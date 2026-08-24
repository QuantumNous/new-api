package service

import (
	"context"
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

type techMobiRoundTripFunc func(*http.Request) (*http.Response, error)

func (f techMobiRoundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestTechMobiAssetMaterializerStreamsMultipartUpload(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, rawURL string) (*http.Response, error) {
		require.Equal(t, "https://storage.example/signed-source", rawURL)
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("streamed-file-body")),
			Header:     http.Header{"Content-Type": []string{"image/png"}},
		}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, http.MethodPost, req.Method)
			require.Equal(t, "https://api.mindon.example/v1/assets/upload", req.URL.String())
			require.Equal(t, "Bearer channel-secret", req.Header.Get("Authorization"))
			require.Equal(t, "idem-techmobi-upload", req.Header.Get("Idempotency-Key"))
			require.LessOrEqual(t, req.ContentLength, int64(0), "upload must remain streaming")
			require.Nil(t, req.GetBody, "streaming upload must not retain a replay buffer")

			mediaType, params, err := mime.ParseMediaType(req.Header.Get("Content-Type"))
			require.NoError(t, err)
			require.Equal(t, "multipart/form-data", mediaType)
			reader := multipart.NewReader(req.Body, params["boundary"])

			modelPart, err := reader.NextPart()
			require.NoError(t, err)
			require.Equal(t, "model", modelPart.FormName())
			modelData, err := io.ReadAll(modelPart)
			require.NoError(t, err)
			require.Equal(t, "doubao/doubao-seedance-2-0-260128", string(modelData))

			filePart, err := reader.NextPart()
			require.NoError(t, err)
			require.Equal(t, "file", filePart.FormName())
			require.Equal(t, "reference.png", filePart.FileName())
			fileData, err := io.ReadAll(filePart)
			require.NoError(t, err)
			require.Equal(t, "streamed-file-body", string(fileData))

			_, err = reader.NextPart()
			require.ErrorIs(t, err, io.EOF)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"assetUrl":"asset://asset-opaque-123"}`)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	result, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset: model.Asset{
			ObjectKey:   "assets/user/reference.png",
			ContentType: "image/png",
		},
		Channel:        &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL:      "https://storage.example/signed-source",
		Model:          "doubao/doubao-seedance-2-0-260128",
		APIKey:         "channel-secret",
		IdempotencyKey: "idem-techmobi-upload",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://asset-opaque-123", result.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, result.Status)
}

func TestTechMobiAssetMaterializerSendsIdempotencyKey(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, "idem-header-key", req.Header.Get("Idempotency-Key"))
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"assetUrl":"asset://asset-idem-header"}`)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	result, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:          model.Asset{ObjectKey: "reference.mp4"},
		Channel:        &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL:      "https://storage.example/signed-source",
		Model:          "doubao/doubao-seedance-2-0-260128",
		APIKey:         "channel-secret",
		IdempotencyKey: "idem-header-key",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://asset-idem-header", result.UpstreamAssetID)
}

func TestTechMobiAssetMaterializerUsesDefaultBaseURL(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader("body")),
		}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			require.Equal(t, constant.ChannelBaseURLs[constant.ChannelTypeTechMobiVideo]+techMobiAssetUploadPath, req.URL.String())
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"assetUrl":"asset://asset-default-base"}`)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	result, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.png"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo},
		SourceURL: "https://storage.example/signed-source",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "channel-secret",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://asset-default-base", result.UpstreamAssetID)
}

func TestTechMobiAssetMaterializerRequiresExplicitSelectedKey(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	t.Cleanup(func() { techMobiAssetFetchSource = oldFetch })

	fetchCalled := false
	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		fetchCalled = true
		return nil, errors.New("source fetch should not run")
	}

	_, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.png"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, Key: "channel-fallback-key"},
		SourceURL: "https://storage.example/signed-source",
		Model:     "doubao/doubao-seedance-2-0-260128",
	})

	require.Error(t, err)
	require.False(t, fetchCalled)
}

func TestTechMobiAssetMaterializerRejectsAndSanitizesUpstreamFailures(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(_ *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusBadGateway,
				Body:       io.NopCloser(strings.NewReader(`{"error":"raw-provider-secret signed.example sk-live"}`)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	_, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-secret",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "sk-live-channel-secret",
	})

	require.Error(t, err)
	require.NotContains(t, err.Error(), "raw-provider-secret")
	require.NotContains(t, err.Error(), "signed.example")
	require.NotContains(t, err.Error(), "storage.example")
	require.NotContains(t, err.Error(), "sk-live")
}

func TestTechMobiAssetMaterializerClassifies429WithoutLeakingPrivateFields(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusTooManyRequests,
				Body:       io.NopCloser(strings.NewReader(`{"error":{"code":"QuotaWriteQPMExceeded","message":"provider quota says retry with signed URL https://storage.example/secret?key=sk-live"}}`)),
				Header: http.Header{
					"Retry-After":  []string{"15"},
					"X-Request-Id": []string{"req-rate-limit"},
				},
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	_, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-secret",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "sk-live-channel-secret",
	})

	require.Error(t, err)
	var failure *AssetMaterializeFailure
	require.ErrorAs(t, err, &failure)
	require.True(t, IsRetryableAssetMaterializeError(err))
	require.Equal(t, AssetMaterializeErrorThrottled, failure.Class)
	require.Equal(t, http.StatusTooManyRequests, failure.HTTPStatus)
	require.Equal(t, "QuotaWriteQPMExceeded", failure.UpstreamCode)
	require.Equal(t, 15*time.Second, failure.RetryAfter)
	require.Equal(t, "req-rate-limit", failure.RequestID)
	for _, marker := range []string{"provider quota", "api.mindon.example", "req-rate-limit", "Authorization", "sk-live", "storage.example"} {
		require.NotContains(t, err.Error(), marker)
	}
}

func TestTechMobiAssetMaterializerClassifiesHTTPDateRetryAfterAnd502WithoutLeaking(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusBadGateway,
				Body:       io.NopCloser(strings.NewReader(`{"code":"UPSTREAM_DOWN","request_id":"req-502","message":"bad gateway at https://upstream.example/private Authorization Bearer sk-live"}`)),
				Header:     http.Header{"Retry-After": []string{time.Date(2099, 1, 1, 0, 0, 0, 0, time.UTC).Format(http.TimeFormat)}},
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	_, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-secret",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "sk-live-channel-secret",
	})

	require.Error(t, err)
	var failure *AssetMaterializeFailure
	require.ErrorAs(t, err, &failure)
	require.True(t, IsRetryableAssetMaterializeError(err))
	require.Equal(t, AssetMaterializeErrorUpstream5xx, failure.Class)
	require.Equal(t, http.StatusBadGateway, failure.HTTPStatus)
	require.Equal(t, "UPSTREAM_DOWN", failure.UpstreamCode)
	require.Greater(t, failure.RetryAfter, time.Hour)
	for _, marker := range []string{"bad gateway", "upstream.example", "api.mindon.example", "req-502", "Authorization", "sk-live"} {
		require.NotContains(t, err.Error(), marker)
	}
}

func TestTechMobiAssetMaterializerRejectsSuccessJSONWithTrailingGarbage(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"assetUrl":"asset://asset-opaque-123"} trailing garbage`)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	result, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-source",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "channel-secret",
	})

	require.ErrorIs(t, err, errAssetUploadFailed)
	require.Empty(t, result.UpstreamAssetID)
	require.Empty(t, result.Status)
}

func TestTechMobiAssetMaterializerRejectsOversizeSuccessBodyNeutrally(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"assetUrl":"asset://asset-opaque-123"}` + strings.Repeat(" ", techMobiAssetResponseMaxSize))),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	_, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-source",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "channel-secret",
	})

	require.ErrorIs(t, err, errAssetUploadFailed)
	require.NotContains(t, err.Error(), "asset-opaque-123")
}

func TestTechMobiAssetMaterializerAcceptsSuccessBodyAtMaxSize(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	successPayload := `{"assetUrl":"asset://asset-at-limit"}`
	successJSON := successPayload + strings.Repeat(" ", techMobiAssetResponseMaxSize-len(successPayload))
	require.Len(t, successJSON, techMobiAssetResponseMaxSize)
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(successJSON)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	result, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-source",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "channel-secret",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://asset-at-limit", result.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, result.Status)
}

func TestTechMobiAssetMaterializerTreatsProcessingResponseAsRetryable(t *testing.T) {
	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(`{"status":"Processing","code":"PENDING_UPSTREAM","request_id":"req-processing"}`)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	_, err := (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-secret",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "sk-live-channel-secret",
	})

	require.Error(t, err)
	var failure *AssetMaterializeFailure
	require.ErrorAs(t, err, &failure)
	require.True(t, IsRetryableAssetMaterializeError(err))
	require.Equal(t, AssetMaterializeErrorProcessing, failure.Class)
	require.Equal(t, "PENDING_UPSTREAM", failure.UpstreamCode)
	require.Equal(t, "req-processing", failure.RequestID)
	require.NotContains(t, err.Error(), "req-processing")
}

func TestTechMobiAssetMaterializerProcessingWithAssetURLIsUsable(t *testing.T) {
	result, err := createTechMobiAssetWithUploadResponse(t, `{"status":"Processing","assetUrl":"asset://upstream-processing"}`)

	if err != nil {
		t.Fatalf("expected nil error, got class %s: %v", AssetMaterializeErrorClass(err), err)
	}
	require.Equal(t, "asset://upstream-processing", result.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, result.Status)
}

func TestTechMobiAssetMaterializerProcessingMissingAssetURLIsRetryable(t *testing.T) {
	result, err := createTechMobiAssetWithUploadResponse(t, `{"status":"Processing"}`)

	require.Error(t, err)
	require.Empty(t, result.UpstreamAssetID)
	require.True(t, IsRetryableAssetMaterializeError(err))
	require.Equal(t, AssetMaterializeErrorProcessing, AssetMaterializeErrorClass(err))
}

func TestTechMobiAssetMaterializerProcessingInvalidAssetURLIsRetryable(t *testing.T) {
	result, err := createTechMobiAssetWithUploadResponse(t, `{"status":"Processing","assetUrl":" asset://upstream-processing"}`)

	require.Error(t, err)
	require.Empty(t, result.UpstreamAssetID)
	require.True(t, IsRetryableAssetMaterializeError(err))
	require.Equal(t, AssetMaterializeErrorProcessing, AssetMaterializeErrorClass(err))
}

func createTechMobiAssetWithUploadResponse(t *testing.T, uploadBody string) (AssetMaterializeResult, error) {
	t.Helper()

	oldFetch := techMobiAssetFetchSource
	oldClientFactory := techMobiAssetHTTPClientFactory
	t.Cleanup(func() {
		techMobiAssetFetchSource = oldFetch
		techMobiAssetHTTPClientFactory = oldClientFactory
	})

	techMobiAssetFetchSource = func(_ context.Context, _ string) (*http.Response, error) {
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("body"))}, nil
	}
	techMobiAssetHTTPClientFactory = func(_ *model.Channel) (*http.Client, error) {
		return &http.Client{Transport: techMobiRoundTripFunc(func(req *http.Request) (*http.Response, error) {
			_, err := io.Copy(io.Discard, req.Body)
			require.NoError(t, err)
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(strings.NewReader(uploadBody)),
				Header:     make(http.Header),
			}, nil
		})}, nil
	}

	baseURL := "https://api.mindon.example"
	return (techMobiAssetBindingMaterializer{}).CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{ObjectKey: "reference.mp4"},
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-source",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "channel-secret",
	})
}

func TestTechMobiAssetMaterializerGetAssetReturnsActiveForValidHandle(t *testing.T) {
	result, err := (techMobiAssetBindingMaterializer{}).GetAsset(
		context.Background(),
		AssetMaterializeInput{},
		"asset://asset-opaque-123",
	)

	if err != nil {
		t.Fatalf("expected nil error, got class %s: %v", AssetMaterializeErrorClass(err), err)
	}
	require.Equal(t, "asset://asset-opaque-123", result.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, result.Status)
}

func TestTechMobiAssetMaterializerIsRegistered(t *testing.T) {
	materializer, ok := assetMaterializerForChannelType(constant.ChannelTypeTechMobiVideo)
	require.True(t, ok)
	require.IsType(t, techMobiAssetBindingMaterializer{}, materializer)
}
