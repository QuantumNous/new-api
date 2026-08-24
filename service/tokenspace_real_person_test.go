package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestTokenSpaceRealPersonVerificationUsesActionAPIWithoutCallback(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/api/material", r.URL.Path)
		require.Equal(t, "Bearer token-key", r.Header.Get("Authorization"))
		switch r.URL.Query().Get("Action") {
		case "CreateVisualValidateSession":
			var body map[string]any
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Empty(t, body)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-create"},"Result":{"BytedToken":"byted-secret","H5Link":"https://api.tokenspace.example/real-validate?token=secret","QrCode":"data:image/png;base64,ignored"}}`)
		case "GetVisualValidateResult":
			var body struct {
				BytedToken string `json:"BytedToken"`
			}
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Equal(t, "byted-secret", body.BytedToken)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-poll"},"Result":{"GroupId":"group-real-person"}}`)
		default:
			t.Fatalf("unexpected Action %q", r.URL.Query().Get("Action"))
		}
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	binding := tokenSpaceRealPersonTestBinding(t, server.URL, "token-key")

	session, err := binding.Provider.CreateVisualValidateSession(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, "byted-secret", session.BytedToken)
	require.Equal(t, "https://api.tokenspace.example/real-validate?token=secret", session.H5Link)
	require.Equal(t, "request-create", session.RequestID)
	require.Empty(t, session.CallbackURL)

	result, err := binding.Provider.GetVisualValidateResult(context.Background(), session.BytedToken)
	require.NoError(t, err)
	require.Equal(t, "group-real-person", result.GroupID)
	require.Equal(t, "request-poll", result.RequestID)
}

func TestTokenSpaceRealPersonVerificationRejectsMissingSecrets(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-missing"},"Result":{"QrCode":"data:image/png;base64,ignored"}}`)
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	binding := tokenSpaceRealPersonTestBinding(t, server.URL, "token-key")

	_, err := binding.Provider.CreateVisualValidateSession(context.Background(), "")

	require.Error(t, err)
	require.NotContains(t, err.Error(), "token-key")
}

func TestTokenSpaceRealPersonCreateDoesNotRequireBytePlusCallback(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	installBytePlusRealPersonServiceTestDeps(t, &fakeBytePlusRealPersonClient{})
	t.Setenv(bytePlusRealPersonCallbackBaseURLEnv, "")
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "CreateVisualValidateSession", r.URL.Query().Get("Action"))
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-create"},"Result":{"BytedToken":"byted-secret","H5Link":"https://api.tokenspace.example/real-validate?token=secret"}}`)
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	insertTokenSpaceRealPersonChannel(t, 42, "default", true)
	settings := tokenSpaceMaterialSettingsJSON(t, server.URL, "group-virtual-not-for-real-person")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 42).Update("settings", settings).Error)

	response, apiErr := CreateBytePlusRealPerson(context.Background(), 7, "default", "default", 42, "tokenspace-create", dto.BytePlusRealPersonCreateRequest{Name: "Alice"})

	require.Nil(t, apiErr)
	require.Equal(t, "https://api.tokenspace.example/real-validate?token=secret", response.VerificationURL)
	require.Equal(t, int64(2300), response.VerificationExpiresAt)
	var profile model.BytePlusRealPersonProfile
	require.NoError(t, model.DB.First(&profile, "public_id = ?", response.ID).Error)
	require.Equal(t, 42, profile.ChannelId)
	var session model.BytePlusVisualValidationSession
	require.NoError(t, model.DB.First(&session, "profile_id = ?", profile.Id).Error)
	require.Equal(t, int64(2300), session.ExpiresAt)
	require.NotEmpty(t, session.BytedTokenCiphertext)
	require.NotEmpty(t, session.H5LinkCiphertext)
}

func tokenSpaceRealPersonTestBinding(t *testing.T, gatewayURL string, apiKey string) *realPersonProviderBinding {
	t.Helper()
	channel := channelWithAssetMaterializationSettings(t, constant.ChannelTypeDoubaoVideo, dto.AssetMaterializationSettings{
		Provider:       assetMaterializationProviderTokenSpaceMaterial,
		GatewayBaseURL: gatewayURL,
		GroupID:        "group-virtual-not-for-real-person",
	})
	channel.Status = common.ChannelStatusEnabled
	channel.Key = apiKey
	binding, err := realPersonProviderForChannel(channel)
	require.NoError(t, err)
	return binding
}
