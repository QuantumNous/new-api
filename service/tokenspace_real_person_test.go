package service

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestTokenSpaceRealPersonAssetActionsUseAuthenticatedGroup(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer token-key", r.Header.Get("Authorization"))
		switch r.URL.Query().Get("Action") {
		case "CreateAsset":
			var body tokenSpaceMaterialCreateRequest
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Equal(t, "group-real-person", body.GroupID)
			require.NotEqual(t, "group-virtual-not-for-real-person", body.GroupID)
			require.Equal(t, "https://source.example/face.png", body.URL)
			require.Equal(t, "Face reference", body.Name)
			require.Equal(t, "Image", body.AssetType)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-create-asset"},"Result":{"Id":"asset-real-person"}}`)
		case "GetAsset":
			var body tokenSpaceMaterialGetRequest
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Equal(t, "asset-real-person", body.ID)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-get-asset"},"Result":{"Id":"asset-real-person","GroupId":"group-real-person","Status":"Active"}}`)
		case "ListAssets":
			var body struct {
				Filter struct {
					GroupType string   `json:"GroupType"`
					GroupIDs  []string `json:"GroupIds"`
				} `json:"Filter"`
				PageNumber int `json:"PageNumber"`
				PageSize   int `json:"PageSize"`
			}
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Equal(t, "LivenessFace", body.Filter.GroupType)
			require.Equal(t, []string{"group-real-person"}, body.Filter.GroupIDs)
			require.Equal(t, 1, body.PageNumber)
			require.Equal(t, 25, body.PageSize)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-list-assets"},"Result":{"Items":[{"Id":"asset-real-person","Name":"Face reference","GroupId":"group-real-person","AssetType":"Image","Status":"Active","ProjectName":"default","CreateTime":"2026-08-24T01:02:03Z","UpdateTime":"2026-08-24T01:03:04Z"}],"TotalCount":1}}`)
		case "DeleteAsset":
			var body tokenSpaceMaterialGetRequest
			require.NoError(t, common.DecodeJson(r.Body, &body))
			require.Equal(t, "asset-real-person", body.ID)
			_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-delete-asset"},"Result":{"Id":"asset-real-person"}}`)
		default:
			t.Fatalf("unexpected Action %q", r.URL.Query().Get("Action"))
		}
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	binding := tokenSpaceRealPersonTestBinding(t, server.URL, "token-key")

	assetID, requestID, err := binding.Provider.CreateAsset(context.Background(), BytePlusCreateAssetRequest{
		GroupID:   "group-real-person",
		URL:       "https://source.example/face.png",
		Name:      "Face reference",
		AssetType: "Image",
	})
	require.NoError(t, err)
	require.Equal(t, "asset-real-person", assetID)
	require.Equal(t, "request-create-asset", requestID)

	status, err := binding.Provider.GetAsset(context.Background(), assetID)
	require.NoError(t, err)
	require.Equal(t, model.BytePlusAssetStatusActive, status.Status)
	require.Equal(t, "request-get-asset", status.RequestID)

	assets, err := binding.Provider.ListAssets(context.Background(), BytePlusListAssetsRequest{
		GroupIDs:   []string{"group-real-person"},
		PageNumber: 1,
		PageSize:   25,
		SortBy:     "CreateTime",
		SortOrder:  "Desc",
	})
	require.NoError(t, err)
	require.Equal(t, 1, assets.TotalCount)
	require.Len(t, assets.Items, 1)
	require.Equal(t, "asset-real-person", assets.Items[0].ID)
	require.Equal(t, int64(1787533323), assets.Items[0].CreateTime)
	require.Equal(t, int64(1787533384), assets.Items[0].UpdateTime)

	deleteRequestID, err := binding.Provider.DeleteAsset(context.Background(), assetID)
	require.NoError(t, err)
	require.Equal(t, "request-delete-asset", deleteRequestID)
}

func TestRealPersonAssetURLCreateUsesTokenSpaceProfileGroup(t *testing.T) {
	newBytePlusRealPersonServiceTestDB(t)
	installBytePlusRealPersonServiceTestDeps(t, &fakeBytePlusRealPersonClient{})
	seenGroupID := ""
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "CreateAsset", r.URL.Query().Get("Action"))
		var body tokenSpaceMaterialCreateRequest
		require.NoError(t, common.DecodeJson(r.Body, &body))
		seenGroupID = body.GroupID
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-create-asset"},"Result":{"Id":"asset-real-person"}}`)
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	insertTokenSpaceRealPersonChannel(t, 42, "default", true)
	settings := tokenSpaceMaterialSettingsJSON(t, server.URL, "group-virtual-not-for-real-person")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 42).Update("settings", settings).Error)
	groupID := "group-real-person"
	profile := model.BytePlusRealPersonProfile{
		PublicId:        "rph_tokenspace_active",
		UserId:          7,
		Name:            "Alice",
		ChannelId:       42,
		UpstreamGroupId: &groupID,
		Status:          model.BytePlusRealPersonProfileStatusActive,
		CreatedTime:     100,
		UpdatedTime:     100,
	}
	require.NoError(t, model.DB.Create(&profile).Error)

	response, apiErr := CreateBytePlusRealPersonAssetFromURL(context.Background(), 7, profile.PublicId, "tokenspace-asset-create", dto.BytePlusRealPersonAssetCreateRequest{
		URL:       "https://example.com/face.png",
		Name:      "Face reference",
		AssetType: "Image",
	})

	require.Nil(t, apiErr)
	require.NotEmpty(t, response.ID)
	require.Equal(t, model.BytePlusAssetStatusProcessing, response.Status)
	require.Equal(t, "group-real-person", seenGroupID)
	require.NotEqual(t, "group-virtual-not-for-real-person", seenGroupID)
}

func TestTokenSpaceVerificationJobUsesPersistedProfileChannel(t *testing.T) {
	newBytePlusRealPersonJobsFixtureWithoutRows(t)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "GetVisualValidateResult", r.URL.Query().Get("Action"))
		require.Equal(t, "Bearer tokenspace-key", r.Header.Get("Authorization"))
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-poll"},"Result":{"GroupId":"group-real-person"}}`)
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	insertTokenSpaceRealPersonChannel(t, 42, "default", true)
	settings := tokenSpaceMaterialSettingsJSON(t, server.URL, "group-virtual-not-for-real-person")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 42).Update("settings", settings).Error)
	profile := model.BytePlusRealPersonProfile{
		PublicId: "rph_tokenspace_job", UserId: 7, Name: "Alice", ChannelId: 42,
		Status: model.BytePlusRealPersonProfileStatusPendingVerification, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&profile).Error)
	cipher := plainBytePlusRealPersonCipher{}
	bytedCiphertext, err := cipher.Encrypt("rvs_tokenspace_job", bytePlusSensitiveFieldBytedToken, "byted-secret")
	require.NoError(t, err)
	session := model.BytePlusVisualValidationSession{
		PublicId: "rvs_tokenspace_job", ProfileId: profile.Id, CallbackTokenHash: strings.Repeat("a", 64),
		BytedTokenCiphertext: bytedCiphertext, Status: model.BytePlusVisualValidationSessionStatusPending,
		ExpiresAt: 2300, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&session).Error)
	require.NoError(t, model.DB.Model(&profile).Update("current_validation_session_id", session.Id).Error)

	processed, err := runBytePlusRealPersonVerificationStatusJobs(context.Background(), 2000, 1950, 10)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.NoError(t, model.DB.First(&profile, profile.Id).Error)
	require.Equal(t, model.BytePlusRealPersonProfileStatusActive, profile.Status)
	require.NotNil(t, profile.UpstreamGroupId)
	require.Equal(t, "group-real-person", *profile.UpstreamGroupId)
}

func TestTokenSpaceAssetStatusJobUsesPersistedAssetChannel(t *testing.T) {
	newBytePlusRealPersonJobsFixtureWithoutRows(t)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "GetAsset", r.URL.Query().Get("Action"))
		require.Equal(t, "Bearer tokenspace-key", r.Header.Get("Authorization"))
		var body tokenSpaceMaterialGetRequest
		require.NoError(t, common.DecodeJson(r.Body, &body))
		require.Equal(t, "asset-real-person", body.ID)
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-status"},"Result":{"Id":"asset-real-person","Status":"Active"}}`)
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	insertTokenSpaceRealPersonChannel(t, 42, "default", true)
	settings := tokenSpaceMaterialSettingsJSON(t, server.URL, "group-virtual-not-for-real-person")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 42).Update("settings", settings).Error)
	asset := model.BytePlusAsset{
		PublicId: "ast_tokenspace_status", UserId: 7, ChannelId: 42,
		UpstreamAssetId: "asset-real-person", AssetType: "Image",
		Status: model.BytePlusAssetStatusProcessing, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&asset).Error)

	processed, err := runBytePlusRealPersonAssetStatusJobs(context.Background(), 2000, 1950, 10)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.NoError(t, model.DB.First(&asset, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusActive, asset.Status)
}

func TestTokenSpaceAssetDeleteJobUsesPersistedAssetChannel(t *testing.T) {
	newBytePlusRealPersonJobsFixtureWithoutRows(t)
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "DeleteAsset", r.URL.Query().Get("Action"))
		require.Equal(t, "Bearer tokenspace-key", r.Header.Get("Authorization"))
		var body tokenSpaceMaterialGetRequest
		require.NoError(t, common.DecodeJson(r.Body, &body))
		require.Equal(t, "asset-real-person", body.ID)
		_, _ = io.WriteString(w, `{"ResponseMetadata":{"RequestId":"request-delete"},"Result":{"Id":"asset-real-person"}}`)
	}))
	defer server.Close()
	installTokenSpaceMaterialHTTPClientFactory(t, server.Client())
	insertTokenSpaceRealPersonChannel(t, 42, "default", true)
	settings := tokenSpaceMaterialSettingsJSON(t, server.URL, "group-virtual-not-for-real-person")
	require.NoError(t, model.DB.Model(&model.Channel{}).Where("id = ?", 42).Update("settings", settings).Error)
	asset := model.BytePlusAsset{
		PublicId: "ast_tokenspace_delete", UserId: 7, ChannelId: 42,
		UpstreamAssetId: "asset-real-person", AssetType: "Image",
		Status: model.BytePlusAssetStatusDeleting, NextDeleteAt: 100,
		DeleteLeaseUpdatedTime: 0, CreatedTime: 100, UpdatedTime: 100,
	}
	require.NoError(t, model.DB.Create(&asset).Error)

	processed, err := runBytePlusRealPersonAssetDeleteJobs(context.Background(), 2000, 1950, 10)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.NoError(t, model.DB.First(&asset, asset.Id).Error)
	require.Equal(t, model.BytePlusAssetStatusDeleted, asset.Status)
	require.Equal(t, int64(2000), asset.DeletedTime)
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
