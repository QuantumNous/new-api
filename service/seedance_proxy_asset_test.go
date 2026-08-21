package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestSeedanceProxyAssetMaterializerCreatesAndReadsAssetsViaGatewayBasePath(t *testing.T) {
	channel := &model.Channel{
		Id:            156,
		Type:          constant.ChannelTypeBytePlus,
		Key:           "seedance-key",
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"","group_id":"grp_shared_aigc"}}`,
	}

	var seenCreateRequest struct {
		GroupID   string `json:"GroupId"`
		URL       string `json:"URL"`
		AssetType string `json:"AssetType"`
		Name      string `json:"Name"`
	}
	var seenCreateAuth string
	var seenCreateID string
	var seenGetPath string
	var seenGetAuth string

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost:
			require.Equal(t, "/v1/base/api/seedance/proxy/assets", r.URL.Path)
			require.Empty(t, r.URL.RawQuery)
			seenCreateAuth = r.Header.Get("Authorization")
			require.NoError(t, common.DecodeJson(r.Body, &seenCreateRequest))
			seenCreateID = "up_123"
			w.Header().Set("Content-Type", "application/json")
			body, err := common.Marshal(map[string]any{
				"Result": map[string]any{
					"Id":      seenCreateID,
					"GroupId": "grp_shared_aigc",
				},
			})
			require.NoError(t, err)
			_, _ = w.Write(body)
		case r.Method == http.MethodGet:
			seenGetPath = r.URL.Path
			seenGetAuth = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			body, err := common.Marshal(map[string]any{
				"Result": map[string]any{
					"Id":      strings.TrimPrefix(r.URL.Path, "/v1/base/api/seedance/proxy/assets/"),
					"GroupId": "grp_shared_aigc",
					"Status":  "active",
				},
			})
			require.NoError(t, err)
			_, _ = w.Write(body)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	channel.OtherSettings = `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"` + server.URL + `/v1/base/","group_id":"grp_shared_aigc"}}`

	originalFactory := seedanceProxyAssetHTTPClientFactory
	seedanceProxyAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
		return server.Client(), nil
	}
	t.Cleanup(func() { seedanceProxyAssetHTTPClientFactory = originalFactory })

	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)

	createResult, err := materializer.CreateAsset(context.Background(), AssetMaterializeInput{
		Asset: model.Asset{
			PublicId:  "ast_1234567890abcdefABCDEF1234567890",
			AssetType: "Image",
		},
		Channel:        channel,
		APIKey:         "seedance-key",
		IdempotencyKey: "idem-1",
		SourceURL:      "https://source.example.invalid/image.png",
	})
	require.NoError(t, err)
	require.Equal(t, "grp_shared_aigc", createResult.UpstreamGroupID)
	require.Equal(t, seenCreateID, createResult.UpstreamAssetID)
	require.Equal(t, model.AssetStatusProcessing, createResult.Status)
	require.Equal(t, "Bearer seedance-key", seenCreateAuth)
	require.Equal(t, "grp_shared_aigc", seenCreateRequest.GroupID)
	require.Equal(t, "https://source.example.invalid/image.png", seenCreateRequest.URL)
	require.Equal(t, "Image", seenCreateRequest.AssetType)
	require.NotEmpty(t, seenCreateRequest.Name)

	getResult, err := materializer.GetAsset(context.Background(), AssetMaterializeInput{
		Asset:   model.Asset{PublicId: "ast_1234567890abcdefABCDEF1234567890"},
		Channel: channel,
		APIKey:  "seedance-key",
	}, createResult.UpstreamAssetID)
	require.NoError(t, err)
	require.Equal(t, seenCreateID, getResult.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, getResult.Status)
	require.Equal(t, "/v1/base/api/seedance/proxy/assets/"+seenCreateID, seenGetPath)
	require.Equal(t, "Bearer seedance-key", seenGetAuth)
}

func TestSeedanceProxyAssetMaterializerRejectsUnknownStatusOnGet(t *testing.T) {
	channel := &model.Channel{
		Id:            156,
		Type:          constant.ChannelTypeBytePlus,
		Key:           "seedance-key",
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"","group_id":"grp_shared_aigc"}}`,
	}

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		body, err := common.Marshal(map[string]any{
			"Result": map[string]any{
				"Id":      "up_123",
				"GroupId": "grp_shared_aigc",
				"Status":  "Mystery",
			},
		})
		require.NoError(t, err)
		_, _ = w.Write(body)
	}))
	defer server.Close()
	channel.OtherSettings = `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"` + server.URL + `/v1/base/","group_id":"grp_shared_aigc"}}`

	originalFactory := seedanceProxyAssetHTTPClientFactory
	seedanceProxyAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
		return server.Client(), nil
	}
	t.Cleanup(func() { seedanceProxyAssetHTTPClientFactory = originalFactory })

	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)

	_, err = materializer.GetAsset(context.Background(), AssetMaterializeInput{
		Channel: channel,
		APIKey:  "seedance-key",
	}, "up_123")
	require.Error(t, err)
	require.True(t, IsRetryableAssetMaterializeError(err))
	require.Equal(t, AssetMaterializeErrorProcessing, AssetMaterializeErrorClass(err))
}

func TestSeedanceProxyAssetMaterializerRejectsUnsafeGatewayBaseURL(t *testing.T) {
	cases := []string{
		"http://asset-gateway.example.invalid/v1/base/",
		"https://user@asset-gateway.example.invalid/v1/base/",
		"https://asset-gateway.example.invalid/v1/base/?q=1",
		"https://asset-gateway.example.invalid/v1/base/#frag",
		"https://asset-gateway.example.invalid/v1/base/../escape",
		"https://asset-gateway.example.invalid/v1/base/%2e%2e/escape",
	}
	for _, rawURL := range cases {
		t.Run(rawURL, func(t *testing.T) {
			channel := &model.Channel{
				Id:            156,
				Type:          constant.ChannelTypeBytePlus,
				Key:           "seedance-key",
				OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"` + rawURL + `","group_id":"grp_shared_aigc"}}`,
			}

			materializer, err := assetMaterializerForChannel(channel)
			require.Error(t, err)
			require.ErrorIs(t, err, ErrAssetBindingUnavailable)
			require.Nil(t, materializer)
		})
	}
}

func TestSeedanceProxyAssetMaterializerClassifies429WithBoundedRetryAfter(t *testing.T) {
	channel := &model.Channel{
		Id:            156,
		Type:          constant.ChannelTypeBytePlus,
		Key:           "seedance-key",
		OtherSettings: `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"","group_id":"grp_shared_aigc"}}`,
	}

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "999999999")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(`{"Error":{"Code":"QuotaWriteQPMExceeded","Message":"retry later"}}`))
	}))
	defer server.Close()
	channel.OtherSettings = `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"` + server.URL + `/v1/base/","group_id":"grp_shared_aigc"}}`

	originalFactory := seedanceProxyAssetHTTPClientFactory
	seedanceProxyAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
		return server.Client(), nil
	}
	t.Cleanup(func() { seedanceProxyAssetHTTPClientFactory = originalFactory })

	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)

	_, err = materializer.CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:      model.Asset{PublicId: "ast_123", AssetType: "Image"},
		Channel:    channel,
		APIKey:     "seedance-key",
		SourceURL:  "https://source.example.invalid/image.png",
		SignSource: nil,
	})
	require.Error(t, err)
	var failure *AssetMaterializeFailure
	require.ErrorAs(t, err, &failure)
	require.Equal(t, AssetMaterializeErrorThrottled, failure.Class)
	require.Equal(t, http.StatusTooManyRequests, failure.HTTPStatus)
	require.Equal(t, assetMaterializeMaxRetryAfter, failure.RetryAfter)
	require.True(t, IsRetryableAssetMaterializeError(err))
}

func TestSeedanceProxyAssetMaterializerCreatesAudioAsset(t *testing.T) {
	channel := &model.Channel{
		Id:   156,
		Type: constant.ChannelTypeBytePlus,
		Key:  "seedance-key",
	}

	var seenRequest seedanceProxyAssetCreateRequest
	var seenAuthorization string
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, seedanceProxyAssetUploadPath, r.URL.Path)
		seenAuthorization = r.Header.Get("Authorization")
		require.NoError(t, common.DecodeJson(r.Body, &seenRequest))
		_, _ = w.Write([]byte(`{"Result":{"Id":"upstream-audio","GroupId":"grp_shared_aigc"}}`))
	}))
	defer server.Close()
	channel.OtherSettings = `{"asset_materialization":{"provider":"seedance_proxy","gateway_base_url":"` + server.URL + `","group_id":"grp_shared_aigc"}}`

	originalFactory := seedanceProxyAssetHTTPClientFactory
	seedanceProxyAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
		return server.Client(), nil
	}
	t.Cleanup(func() { seedanceProxyAssetHTTPClientFactory = originalFactory })

	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)

	result, err := materializer.CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{PublicId: "ast_audio", AssetType: "Audio"},
		Channel:   channel,
		APIKey:    "seedance-key",
		SourceURL: "https://source.example.invalid/audio.mp3",
	})
	require.NoError(t, err)
	require.Equal(t, "upstream-audio", result.UpstreamAssetID)
	require.Equal(t, "grp_shared_aigc", result.UpstreamGroupID)
	require.Equal(t, model.AssetStatusProcessing, result.Status)
	require.Equal(t, "Bearer seedance-key", seenAuthorization)
	require.Equal(t, "grp_shared_aigc", seenRequest.GroupID)
	require.Equal(t, "https://source.example.invalid/audio.mp3", seenRequest.URL)
	require.Equal(t, "Audio", seenRequest.AssetType)
}
