package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestTokenSpaceMaterialAssetCreatesAndGetsViaActionAPI(t *testing.T) {
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: "https://materials.example.invalid",
		GroupID:        "group-internal",
	})
	var seenIdempotencyKey string

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Query().Get("Action") {
		case "CreateAsset":
			require.Equal(t, http.MethodPost, r.Method)
			require.Equal(t, "/api/material", r.URL.Path)
			require.Equal(t, "Bearer key-test", r.Header.Get("Authorization"))
			seenIdempotencyKey = r.Header.Get("Idempotency-Key")
			var body tokenSpaceMaterialCreateRequest
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Equal(t, "group-internal", body.GroupID)
			require.Equal(t, "https://signed.example/source", body.URL)
			require.Equal(t, "Image", body.AssetType)
			require.NotEmpty(t, body.Name)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-create"},"Result":{"Id":"asset-created"}}`)
		case "GetAsset":
			require.Equal(t, http.MethodPost, r.Method)
			require.Equal(t, "/api/material", r.URL.Path)
			require.Equal(t, "Bearer key-test", r.Header.Get("Authorization"))
			var body tokenSpaceMaterialGetRequest
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Equal(t, "asset-created", body.ID)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-get"},"Result":{"Id":"asset-created","GroupId":"group-internal","Status":"Active"}}`)
		default:
			t.Fatalf("unexpected Action %q", r.URL.Query().Get("Action"))
		}
	}))
	defer server.Close()
	channel.OtherSettings = tokenSpaceMaterialSettingsJSON(t, server.URL, "group-internal")
	restore := installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	defer restore()

	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)
	createResult, err := materializer.CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:          model.Asset{PublicId: "ast_image", AssetType: "Image"},
		Channel:        channel,
		APIKey:         "key-test",
		IdempotencyKey: "idem-test",
		SignSource: func(context.Context, model.Asset) (string, error) {
			return "https://signed.example/source", nil
		},
	})
	require.NoError(t, err)
	require.Equal(t, "group-internal", createResult.UpstreamGroupID)
	require.Equal(t, "asset-created", createResult.UpstreamAssetID)
	require.Equal(t, model.AssetStatusProcessing, createResult.Status)
	require.Equal(t, "idem-test", seenIdempotencyKey)

	getResult, err := materializer.GetAsset(context.Background(), AssetMaterializeInput{
		Channel: channel,
		APIKey:  "key-test",
	}, createResult.UpstreamAssetID)
	require.NoError(t, err)
	require.Equal(t, "group-internal", getResult.UpstreamGroupID)
	require.Equal(t, "asset-created", getResult.UpstreamAssetID)
	require.Equal(t, model.AssetStatusActive, getResult.Status)
}

func TestTokenSpaceMaterialAssetGetMapsKnownStatuses(t *testing.T) {
	tests := []struct {
		status string
		want   string
	}{
		{status: "Active", want: model.AssetStatusActive},
		{status: "Pending", want: model.AssetStatusProcessing},
		{status: "Processing", want: model.AssetStatusProcessing},
		{status: "Failed", want: model.AssetStatusFailed},
	}
	for _, test := range tests {
		t.Run(test.status, func(t *testing.T) {
			materializer, channel := tokenSpaceMaterialMaterializerWithHandler(t, func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "GetAsset", r.URL.Query().Get("Action"))
				_, _ = io.WriteString(w, `{"Result":{"Id":"asset-created","GroupId":"group-internal","Status":"`+test.status+`"}}`)
			})

			result, err := materializer.GetAsset(context.Background(), AssetMaterializeInput{Channel: channel, APIKey: "key-test"}, "asset-created")

			require.NoError(t, err)
			require.Equal(t, "group-internal", result.UpstreamGroupID)
			require.Equal(t, "asset-created", result.UpstreamAssetID)
			require.Equal(t, test.want, result.Status)
		})
	}
}

func TestTokenSpaceMaterialAssetGetRejectsMissingOrMismatchedGroupAndAssetID(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{
			name: "missing group",
			body: `{"Result":{"Id":"asset-created","Status":"Active"}}`,
		},
		{
			name: "mismatched group",
			body: `{"Result":{"Id":"asset-created","GroupId":"group-other","Status":"Active"}}`,
		},
		{
			name: "mismatched asset id",
			body: `{"Result":{"Id":"asset-other","GroupId":"group-internal","Status":"Active"}}`,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			materializer, channel := tokenSpaceMaterialMaterializerWithHandler(t, func(w http.ResponseWriter, r *http.Request) {
				require.Equal(t, "GetAsset", r.URL.Query().Get("Action"))
				_, _ = io.WriteString(w, test.body)
			})

			_, err := materializer.GetAsset(context.Background(), AssetMaterializeInput{Channel: channel, APIKey: "key-test"}, "asset-created")

			require.Error(t, err)
			require.Equal(t, AssetMaterializeErrorProcessing, AssetMaterializeErrorClass(err))
			require.True(t, IsRetryableAssetMaterializeError(err))
			assertTokenSpaceMaterialErrorDoesNotLeak(t, err)
		})
	}
}

func TestTokenSpaceMaterialAssetClassifiesHTTPAndProtocolFailures(t *testing.T) {
	tests := []struct {
		name        string
		status      int
		body        string
		retryAfter  string
		wantClass   string
		wantHTTP    int
		wantRetry   time.Duration
		wantRetryOK bool
	}{
		{name: "business failure", status: http.StatusOK, body: `{"Result":{"Error":{"Code":"InvalidAsset","Message":"signed https://signed.example/source group-internal key-test"}}}`, wantClass: AssetMaterializeErrorDefinitive, wantHTTP: http.StatusOK},
		{name: "unauthorized", status: http.StatusUnauthorized, body: `{"Result":{"Error":{"Code":"AuthFailed","Message":"key-test"}}}`, wantClass: AssetMaterializeErrorDefinitive, wantHTTP: http.StatusUnauthorized},
		{name: "forbidden", status: http.StatusForbidden, body: `{"Result":{"Error":{"Code":"Forbidden","Message":"group-internal"}}}`, wantClass: AssetMaterializeErrorDefinitive, wantHTTP: http.StatusForbidden},
		{name: "unprocessable", status: http.StatusUnprocessableEntity, body: `{"Result":{"Error":{"Code":"InvalidAsset","Message":"bad signed URL"}}}`, wantClass: AssetMaterializeErrorDefinitive, wantHTTP: http.StatusUnprocessableEntity},
		{name: "throttled", status: http.StatusTooManyRequests, body: `{"Result":{"Error":{"Code":"QuotaWriteQPMExceeded","Message":"retry"}}}`, retryAfter: "999999999", wantClass: AssetMaterializeErrorThrottled, wantHTTP: http.StatusTooManyRequests, wantRetry: assetMaterializeMaxRetryAfter, wantRetryOK: true},
		{name: "upstream 5xx", status: http.StatusBadGateway, body: `{"Result":{"Error":{"Code":"BadGateway","Message":"try later"}}}`, wantClass: AssetMaterializeErrorUpstream5xx, wantHTTP: http.StatusBadGateway, wantRetryOK: true},
		{name: "malformed json", status: http.StatusOK, body: `{"Result":`, wantClass: AssetMaterializeErrorProcessing, wantHTTP: http.StatusOK, wantRetryOK: true},
		{name: "missing id", status: http.StatusOK, body: `{"Result":{"Status":"Active"}}`, wantClass: AssetMaterializeErrorProcessing, wantHTTP: http.StatusOK, wantRetryOK: true},
		{name: "unknown status", status: http.StatusOK, body: `{"Result":{"Id":"asset-created","GroupId":"group-internal","Status":"Mystery"}}`, wantClass: AssetMaterializeErrorProcessing, wantHTTP: http.StatusOK, wantRetryOK: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			materializer, channel := tokenSpaceMaterialMaterializerWithHandler(t, func(w http.ResponseWriter, r *http.Request) {
				if test.retryAfter != "" {
					w.Header().Set("Retry-After", test.retryAfter)
				}
				w.WriteHeader(test.status)
				_, _ = io.WriteString(w, test.body)
			})

			_, err := materializer.GetAsset(context.Background(), AssetMaterializeInput{Channel: channel, APIKey: "key-test"}, "asset-created")

			require.Error(t, err)
			var failure *AssetMaterializeFailure
			require.ErrorAs(t, err, &failure)
			require.Equal(t, test.wantClass, failure.Class)
			require.Equal(t, test.wantHTTP, failure.HTTPStatus)
			require.Equal(t, test.wantRetry, failure.RetryAfter)
			require.Equal(t, test.wantRetryOK, IsRetryableAssetMaterializeError(err))
			assertTokenSpaceMaterialErrorDoesNotLeak(t, err)
		})
	}
}

func TestTokenSpaceMaterialAssetClassifiesTimeoutAndOversizedJSON(t *testing.T) {
	t.Run("timeout", func(t *testing.T) {
		server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(50 * time.Millisecond)
			_, _ = io.WriteString(w, `{"Result":{"Id":"asset-created","Status":"Active"}}`)
		}))
		defer server.Close()
		client := server.Client()
		client.Timeout = time.Nanosecond
		channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
			Provider:       "tokenspace_material",
			GatewayBaseURL: server.URL,
			GroupID:        "group-internal",
		})
		restore := installTokenSpaceMaterialHTTPClientFactory(t, client)
		defer restore()

		materializer, err := assetMaterializerForChannel(channel)
		require.NoError(t, err)
		_, err = materializer.GetAsset(context.Background(), AssetMaterializeInput{Channel: channel, APIKey: "key-test"}, "asset-created")

		require.Error(t, err)
		require.Equal(t, AssetMaterializeErrorTimeout, AssetMaterializeErrorClass(err))
	})

	t.Run("oversized", func(t *testing.T) {
		materializer, channel := tokenSpaceMaterialMaterializerWithHandler(t, func(w http.ResponseWriter, r *http.Request) {
			_, _ = io.WriteString(w, `{"Result":{"Id":"asset-created","GroupId":"group-internal","Status":"Active"}}`+strings.Repeat(" ", techMobiAssetResponseMaxSize))
		})

		_, err := materializer.GetAsset(context.Background(), AssetMaterializeInput{Channel: channel, APIKey: "key-test"}, "asset-created")

		require.Error(t, err)
		require.Equal(t, AssetMaterializeErrorProcessing, AssetMaterializeErrorClass(err))
	})
}

func TestTokenSpaceMaterialAssetNormalizesImageVideoAndAudioBeforeHTTP(t *testing.T) {
	var requests []tokenSpaceMaterialCreateRequest
	materializer, channel := tokenSpaceMaterialMaterializerWithHandler(t, func(w http.ResponseWriter, r *http.Request) {
		var body tokenSpaceMaterialCreateRequest
		require.NoError(t, common.DecodeJson(r.Body, &body))
		requests = append(requests, body)
		_, _ = io.WriteString(w, `{"Result":{"Id":"asset-created"}}`)
	})

	for _, assetType := range []string{"Image", "Video", "Audio"} {
		result, err := materializer.CreateAsset(context.Background(), AssetMaterializeInput{
			Asset:     model.Asset{PublicId: "ast_" + strings.ToLower(assetType), AssetType: assetType},
			Channel:   channel,
			APIKey:    "key-test",
			SourceURL: "https://signed.example/source",
		})
		require.NoError(t, err)
		require.Equal(t, "asset-created", result.UpstreamAssetID)
	}

	require.Len(t, requests, 3)
	require.Equal(t, "Image", requests[0].AssetType)
	require.Equal(t, "Video", requests[1].AssetType)
	require.Equal(t, "Audio", requests[2].AssetType)
}

func TestTokenSpaceMaterialAssetDoesNotExposeSecretsInErrorsOrResults(t *testing.T) {
	materializer, channel := tokenSpaceMaterialMaterializerWithHandler(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-secret"},"Result":{"Error":{"Code":"InvalidAsset","Message":"Bearer key-test https://signed.example/source group-internal response secret"}}}`)
	})

	result, err := materializer.CreateAsset(context.Background(), AssetMaterializeInput{
		Asset:     model.Asset{PublicId: "ast_image", AssetType: "Image"},
		Channel:   channel,
		APIKey:    "key-test",
		SourceURL: "https://signed.example/source",
	})

	require.Error(t, err)
	require.Empty(t, result.UpstreamGroupID)
	require.Empty(t, result.UpstreamAssetID)
	require.Empty(t, result.Status)
	assertTokenSpaceMaterialErrorDoesNotLeak(t, err)
}

func tokenSpaceMaterialMaterializerWithHandler(t *testing.T, handler http.HandlerFunc) (AssetMaterializer, *model.Channel) {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeTechMobiVideo, dto.AssetMaterializationSettings{
		Provider:       "tokenspace_material",
		GatewayBaseURL: server.URL,
		GroupID:        "group-internal",
	})
	restore := installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	t.Cleanup(restore)
	materializer, err := assetMaterializerForChannel(channel)
	require.NoError(t, err)
	return materializer, channel
}

func tokenSpaceMaterialSettingsJSON(t *testing.T, gatewayBaseURL string, groupID string) string {
	t.Helper()
	payload, err := common.Marshal(dto.ChannelOtherSettings{
		AssetMaterialization: &dto.AssetMaterializationSettings{
			Provider:       "tokenspace_material",
			GatewayBaseURL: gatewayBaseURL,
			GroupID:        groupID,
		},
	})
	require.NoError(t, err)
	return string(payload)
}

func installTokenSpaceMaterialHTTPClientFactory(t *testing.T, client *http.Client) func() {
	t.Helper()
	originalFactory := tokenSpaceMaterialAssetHTTPClientFactory
	tokenSpaceMaterialAssetHTTPClientFactory = func(channel *model.Channel) (*http.Client, error) {
		return client, nil
	}
	return func() { tokenSpaceMaterialAssetHTTPClientFactory = originalFactory }
}

func assertTokenSpaceMaterialErrorDoesNotLeak(t *testing.T, err error) {
	t.Helper()
	text := err.Error()
	for _, marker := range []string{"Bearer", "key-test", "signed.example", "group-internal", "response secret"} {
		require.NotContains(t, text, marker)
	}
}
