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
		Channel:   &model.Channel{Type: constant.ChannelTypeTechMobiVideo, BaseURL: &baseURL},
		SourceURL: "https://storage.example/signed-source",
		Model:     "doubao/doubao-seedance-2-0-260128",
		APIKey:    "channel-secret",
	})

	require.NoError(t, err)
	require.Equal(t, "asset://asset-opaque-123", result.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, result.Status)
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

func TestTechMobiAssetMaterializerGetAssetIsImmediatelyActive(t *testing.T) {
	result, err := (techMobiAssetBindingMaterializer{}).GetAsset(
		context.Background(),
		AssetMaterializeInput{},
		"asset://asset-opaque-123",
	)

	require.NoError(t, err)
	require.Equal(t, "asset://asset-opaque-123", result.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, result.Status)
}

func TestTechMobiAssetMaterializerIsRegistered(t *testing.T) {
	materializer, ok := assetMaterializerForChannel(constant.ChannelTypeTechMobiVideo)
	require.True(t, ok)
	require.IsType(t, techMobiAssetBindingMaterializer{}, materializer)
}
